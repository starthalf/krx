// src/components/admin/UserInvitation.tsx
import { useState, useEffect } from 'react';
import { UserPlus, Mail, Send, X, Copy, Check } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getAllRoles, Role } from '../../lib/permissions';

interface InvitationForm {
  email: string;
  full_name: string;
  role_id: string;
  org_id: string;
}

export default function UserInvitation() {
  const { organizations } = useStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    loadRoles();
    loadInvitations();
  }, []);

  const loadRoles = async () => {
    try {
      const data = await getAllRoles();
      // Super Admin 제외하고 표시
      setRoles(data.filter(r => r.level < 100));
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const loadInvitations = async () => {
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // 현재 사용자가 보낸 초대 목록
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          *,
          role:roles(display_name),
          organization:organizations(name),
          inviter:profiles!invitations_invited_by_fkey(full_name)
        `)
        .eq('invited_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const handleSendInvite = async (formData: InvitationForm) => {
    try {
      setLoading(true);
      const { supabase } = await import('../../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('User not found');

      // 현재 사용자의 company_id 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Company not found');

      // 초대 토큰 생성
      const token = Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);

      // 초대 생성
      const { error } = await supabase
        .from('invitations')
        .insert({
          company_id: profile.company_id,
          email: formData.email,
          full_name: formData.full_name || null,
          role_id: formData.role_id || null,
          org_id: formData.org_id || null,
          token: token,
          invited_by: user.id
        });

      if (error) throw error;

      // 초대 링크 표시
      const inviteLink = `${window.location.origin}/accept-invite/${token}`;
      alert(`초대가 발송되었습니다!\n\n초대 링크:\n${inviteLink}\n\n(실제 프로덕션에서는 이메일로 자동 발송됩니다)`);

      // 목록 새로고침
      await loadInvitations();
      setShowInviteModal(false);
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('초대 발송에 실패했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/accept-invite/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '대기중' },
      accepted: { bg: 'bg-green-100', text: 'text-green-700', label: '수락됨' },
      expired: { bg: 'bg-slate-100', text: 'text-slate-700', label: '만료됨' }
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">사용자 초대</h2>
          <p className="text-sm text-slate-600">
            새로운 팀원을 초대하고 역할을 배정합니다
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          초대 보내기
        </button>
      </div>

      {/* 초대 목록 */}
      <div className="space-y-3">
        {invitations.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
            <Mail className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">아직 보낸 초대가 없습니다</p>
          </div>
        ) : (
          invitations.map((inv) => {
            const status = getStatusBadge(inv.status);
            const isExpired = new Date(inv.expires_at) < new Date();

            return (
              <div
                key={inv.id}
                className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200"
              >
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">{inv.email}</div>
                  {inv.full_name && (
                    <div className="text-sm text-slate-600">{inv.full_name}</div>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    {inv.role?.display_name && (
                      <span className="px-2 py-1 bg-slate-100 rounded">
                        {inv.role.display_name}
                      </span>
                    )}
                    {inv.organization?.name && (
                      <span className="px-2 py-1 bg-slate-100 rounded">
                        {inv.organization.name}
                      </span>
                    )}
                    <span>{new Date(inv.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 ${status.bg} ${status.text} text-xs font-medium rounded-full`}>
                    {isExpired && inv.status === 'pending' ? '만료됨' : status.label}
                  </span>
                  
                  {inv.status === 'pending' && !isExpired && (
                    <button
                      onClick={() => copyInviteLink(inv.token)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="초대 링크 복사"
                    >
                      {copiedToken === inv.token ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 초대 보내기 모달 */}
      {showInviteModal && (
        <InviteModal
          roles={roles}
          organizations={organizations}
          onSend={handleSendInvite}
          onClose={() => setShowInviteModal(false)}
          loading={loading}
        />
      )}
    </div>
  );
}

// ============================================
// 초대 모달 컴포넌트
// ============================================
interface InviteModalProps {
  roles: Role[];
  organizations: any[];
  onSend: (data: InvitationForm) => void;
  onClose: () => void;
  loading: boolean;
}

function InviteModal({ roles, organizations, onSend, onClose, loading }: InviteModalProps) {
  const [formData, setFormData] = useState<InvitationForm>({
    email: '',
    full_name: '',
    role_id: '',
    org_id: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
      alert('이메일을 입력해주세요');
      return;
    }

    onSend(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">사용자 초대</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              이메일 *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="user@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              이름
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="홍길동"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              역할 (선택)
            </label>
            <select
              value={formData.role_id}
              onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">-- 나중에 지정 --</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.display_name} (레벨 {role.level})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              소속 조직 (선택)
            </label>
            <select
              value={formData.org_id}
              onChange={(e) => setFormData({ ...formData, org_id: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">-- 나중에 지정 --</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.level})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>💡 팁:</strong> 초대 링크가 생성되며, 상대방이 링크를 통해 가입/로그인하면 자동으로 팀에 합류됩니다.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                '발송 중...'
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  초대 보내기
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}