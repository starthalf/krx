// src/components/admin/UserInvitation.tsx
import { useState, useEffect } from 'react';
import { UserPlus, Mail, Send, X, Copy, Check, Crown, User, AlertCircle, Plus, Eye, Building2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { supabase } from '../../lib/supabase';

interface InvitationForm {
  email: string;
  full_name: string;
  role_type: 'org_head' | 'team_member' | 'viewer' | '';
  org_id: string;
}

export default function UserInvitation() {
  const { organizations } = useStore();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTeamInviteModal, setShowTeamInviteModal] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);

  // 조직이 있는지 확인
  const hasOrganizations = organizations.length > 0;

  useEffect(() => {
    loadInvitations();
    loadCompanyInfo();
  }, []);

  const loadInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('invitations')
        .select(`
          *,
          role:roles(name, display_name),
          organization:organizations(name, level),
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

  const loadCompanyInfo = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      setCompany(companyData);
    } catch (error) {
      console.error('Failed to load company:', error);
    }
  };

  const handleSendInvite = async (formData: InvitationForm) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Company not found');

      // role_type으로 role_id 찾기
      let roleId = null;
      if (formData.role_type) {
        const { data: role } = await supabase
          .from('roles')
          .select('id')
          .eq('name', formData.role_type)
          .single();
        roleId = role?.id;
      }

      // 초대 토큰 생성
      const token = Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);

      // 초대 생성 - viewer는 org_id 없이도 가능
      const { error } = await supabase
        .from('invitations')
        .insert({
          company_id: profile.company_id,
          email: formData.email,
          full_name: formData.full_name || null,
          role_id: roleId,
          org_id: formData.org_id || null,
          token: token,
          invited_by: user.id
        });

      if (error) throw error;

      const inviteLink = `${window.location.origin}/accept-invite/${token}`;
      alert(`초대가 발송되었습니다!\n\n초대 링크:\n${inviteLink}\n\n(실제 프로덕션에서는 이메일로 자동 발송됩니다)`);

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

  const getRoleBadge = (role: any) => {
    if (!role) return null;
    
    if (role.name === 'org_head') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
          <Crown className="w-3 h-3" />
          조직장
        </span>
      );
    }

    if (role.name === 'viewer') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
          <Eye className="w-3 h-3" />
          조회자
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs">
        <User className="w-3 h-3" />
        {role.display_name || '팀원'}
      </span>
    );
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
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">사용자 초대</h2>
          <p className="text-sm text-slate-600">
            새로운 팀원을 초대하고 조직/역할을 배정합니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTeamInviteModal(true)}
            disabled={!hasOrganizations}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mail className="w-4 h-4" />
            팀 초대 링크
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            disabled={!hasOrganizations}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-4 h-4" />
            개별 초대
          </button>
        </div>
      </div>

      {/* 조직 없음 경고 */}
      {!hasOrganizations && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex gap-3">
            <Building2 className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">조직을 먼저 설정해주세요</p>
              <p className="text-sm text-amber-700 mt-1">
                사용자를 초대하려면 최소 1개 이상의 조직이 필요합니다.
              </p>
              <a 
                href="/admin?tab=organization" 
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
              >
                조직 관리로 이동 →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 안내 - 조직이 있을 때만 */}
      {hasOrganizations && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">💡 역할 안내</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>조직장</strong>: 담당 조직의 OKR을 관리하고, 상위 조직에 승인 요청, 하위 조직에 독촉이 가능합니다 (조직 필수)</li>
                <li>• <strong>팀원</strong>: 본인 OKR 및 체크인 권한 (조직 필수)</li>
                <li>• <strong>조회자</strong>: 읽기 전용 권한 - 대시보드 조회, 공개된 OKR 열람 (조직 선택)</li>
              </ul>
            </div>
          </div>
        </div>
      )}

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
                  <div className="flex items-center gap-3 mt-2">
                    {getRoleBadge(inv.role)}
                    {inv.organization?.name && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                        {inv.organization.name} ({inv.organization.level})
                      </span>
                    )}
                    <span className="text-xs text-slate-500">
                      {new Date(inv.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 ${status.bg} ${status.text} text-xs font-medium rounded-full`}>
                    {isExpired && inv.status === 'pending' ? '만료됨' : status.label}
                  </span>
                  
                  {inv.status === 'pending' && !isExpired && (
                    <button
                      onClick={() => copyInviteLink(inv.token)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      title="초대 링크 복사"
                    >
                      {copiedToken === inv.token ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 개별 초대 모달 */}
      {showInviteModal && (
        <InviteModal
          organizations={organizations}
          loading={loading}
          onSubmit={handleSendInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* 팀 초대 링크 모달 */}
      {showTeamInviteModal && company && (
        <TeamInviteLinkModal
          company={company}
          onClose={() => setShowTeamInviteModal(false)}
          onUpdate={() => loadCompanyInfo()}
        />
      )}
    </div>
  );
}

// ============================================
// 개별 초대 모달 — 여러 명 동시 초대
// ============================================
interface InviteEntry {
  id: string;
  email: string;
  full_name: string;
  role_type: 'org_head' | 'team_member' | 'viewer' | '';
  org_id: string;
}

interface InviteModalProps {
  organizations: any[];
  loading: boolean;
  onSubmit: (data: InvitationForm) => Promise<void>;
  onClose: () => void;
}

function InviteModal({ organizations, loading, onSubmit, onClose }: InviteModalProps) {
  const [entries, setEntries] = useState<InviteEntry[]>([
    { id: crypto.randomUUID(), email: '', full_name: '', role_type: '', org_id: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<{ email: string; success: boolean; error?: string }[]>([]);

  // 엔트리 추가
  const addEntry = () => {
    setEntries([...entries, { 
      id: crypto.randomUUID(), 
      email: '', 
      full_name: '', 
      role_type: '', 
      org_id: '' 
    }]);
  };

  // 엔트리 삭제
  const removeEntry = (id: string) => {
    if (entries.length === 1) return;
    setEntries(entries.filter(e => e.id !== id));
  };

  // 엔트리 업데이트
  const updateEntry = (id: string, field: keyof InviteEntry, value: string) => {
    setEntries(entries.map(e => {
      if (e.id !== id) return e;
      
      // 역할이 viewer로 바뀌면 org_id는 선택 사항이므로 유지
      // 역할이 org_head나 team_member로 바뀌면 org_id 필수
      return { ...e, [field]: value };
    }));
  };

  // 전체 역할/조직 일괄 적용
  const applyToAll = (field: 'role_type' | 'org_id', value: string) => {
    setEntries(entries.map(e => ({ ...e, [field]: value })));
  };

  // 조직 선택이 필수인지 확인
  const isOrgRequired = (roleType: string): boolean => {
    return roleType === 'org_head' || roleType === 'team_member';
  };

  // 유효성 검사
  const validateEntries = (): boolean => {
    for (const entry of entries) {
      if (!entry.email) {
        alert('모든 이메일을 입력해주세요');
        return false;
      }
      if (!entry.role_type) {
        alert(`${entry.email}: 역할을 선택해주세요`);
        return false;
      }
      // 조직장, 팀원은 조직 필수
      if (isOrgRequired(entry.role_type) && !entry.org_id) {
        alert(`${entry.email}: ${entry.role_type === 'org_head' ? '조직장' : '팀원'}은 소속 조직을 선택해야 합니다`);
        return false;
      }
    }
    return true;
  };

  // 제출
  const handleSubmit = async () => {
    if (!validateEntries()) return;

    setSubmitting(true);
    setResults([]);
    
    const newResults: typeof results = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      setCurrentIndex(i);
      
      try {
        await onSubmit({
          email: entry.email,
          full_name: entry.full_name,
          role_type: entry.role_type as 'org_head' | 'team_member' | 'viewer',
          org_id: entry.org_id
        });
        newResults.push({ email: entry.email, success: true });
      } catch (error) {
        newResults.push({ email: entry.email, success: false, error: (error as Error).message });
      }
    }

    setResults(newResults);
    setSubmitting(false);

    // 모두 성공하면 닫기
    if (newResults.every(r => r.success)) {
      setTimeout(() => {
        alert(`${newResults.length}명의 초대가 완료되었습니다!`);
        onClose();
      }, 500);
    }
  };

  // 조직을 계층별로 그룹핑
  const groupedOrgs = organizations.reduce((acc, org) => {
    const level = org.level || '기타';
    if (!acc[level]) acc[level] = [];
    acc[level].push(org);
    return acc;
  }, {} as Record<string, typeof organizations>);

  // 결과 화면
  if (results.length > 0) {
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">초대 결과</h3>
          
          <div className="mb-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex gap-4 text-center">
              <div className="flex-1">
                <div className="text-2xl font-bold text-green-600">{successCount}</div>
                <div className="text-sm text-slate-600">성공</div>
              </div>
              {failCount > 0 && (
                <div className="flex-1">
                  <div className="text-2xl font-bold text-red-600">{failCount}</div>
                  <div className="text-sm text-slate-600">실패</div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
            {results.map((result, idx) => (
              <div 
                key={idx}
                className={`flex items-center gap-2 p-2 rounded-lg ${
                  result.success ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                {result.success ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <X className="w-4 h-4 text-red-600" />
                )}
                <span className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.email}
                </span>
                {result.error && (
                  <span className="text-xs text-red-600 ml-auto">{result.error}</span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            닫기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">사용자 초대</h3>
            <p className="text-sm text-slate-600">{entries.length}명</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 일괄 적용 */}
        <div className="flex gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">일괄 역할 적용</label>
            <select
              onChange={(e) => applyToAll('role_type', e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">선택...</option>
              <option value="org_head">👑 조직장</option>
              <option value="team_member">👤 팀원</option>
              <option value="viewer">👁 조회자</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">일괄 조직 적용</label>
            <select
              onChange={(e) => applyToAll('org_id', e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            >
              <option value="">선택...</option>
              {Object.entries(groupedOrgs).map(([level, orgs]) => (
                <optgroup key={level} label={level}>
                  {(orgs as any[]).map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[40px_1fr_1fr_1fr_1fr_40px] gap-2 px-2 py-2 bg-slate-100 rounded-t-lg text-xs font-medium text-slate-600">
          <div>#</div>
          <div>이메일 <span className="text-red-500">*</span></div>
          <div>이름</div>
          <div>역할 <span className="text-red-500">*</span></div>
          <div>소속 조직</div>
          <div></div>
        </div>

        {/* 엔트리 목록 - 리스트 형태 */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-b-lg mb-4">
          {entries.map((entry, index) => {
            const orgRequired = isOrgRequired(entry.role_type);
            
            return (
              <div 
                key={entry.id} 
                className={`grid grid-cols-[40px_1fr_1fr_1fr_1fr_40px] gap-2 px-2 py-2 items-center ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                } ${index !== entries.length - 1 ? 'border-b border-slate-100' : ''}`}
              >
                {/* 번호 */}
                <div className="text-sm text-slate-500 text-center">{index + 1}</div>

                {/* 이메일 */}
                <input
                  type="email"
                  value={entry.email}
                  onChange={(e) => updateEntry(entry.id, 'email', e.target.value)}
                  placeholder="user@example.com"
                  className="px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />

                {/* 이름 */}
                <input
                  type="text"
                  value={entry.full_name}
                  onChange={(e) => updateEntry(entry.id, 'full_name', e.target.value)}
                  placeholder="홍길동"
                  className="px-2 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />

                {/* 역할 */}
                <select
                  value={entry.role_type}
                  onChange={(e) => updateEntry(entry.id, 'role_type', e.target.value)}
                  className={`px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                    entry.role_type ? 'border-slate-300' : 'border-red-400 bg-red-50'
                  }`}
                >
                  <option value="">역할 선택 *</option>
                  <option value="org_head">👑 조직장</option>
                  <option value="team_member">👤 팀원</option>
                  <option value="viewer">👁 조회자</option>
                </select>

                {/* 소속 조직 - 역할에 따라 필수 여부 변경 */}
                <div className="relative">
                  <select
                    value={entry.org_id}
                    onChange={(e) => updateEntry(entry.id, 'org_id', e.target.value)}
                    disabled={!entry.role_type}
                    className={`w-full px-2 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 ${
                      !entry.role_type 
                        ? 'border-slate-200' 
                        : orgRequired && !entry.org_id 
                          ? 'border-red-400 bg-red-50' 
                          : 'border-slate-300'
                    }`}
                  >
                    <option value="">
                      {!entry.role_type 
                        ? '역할 먼저 선택' 
                        : orgRequired 
                          ? '조직 선택 *' 
                          : '조직 선택 (선택사항)'}
                    </option>
                    {Object.entries(groupedOrgs).map(([level, orgs]) => (
                      <optgroup key={level} label={level}>
                        {(orgs as any[]).map((org) => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {orgRequired && !entry.org_id && entry.role_type && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                  )}
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={() => removeEntry(entry.id)}
                  disabled={entries.length === 1}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* 추가 버튼 */}
        <button
          onClick={addEntry}
          className="w-full py-2 border-2 border-dashed border-slate-300 text-slate-600 rounded-lg hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors mb-4 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          사용자 추가
        </button>

        {/* 하단 버튼 */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                {currentIndex + 1}/{entries.length} 처리 중...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                {entries.length}명 초대하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 팀 초대 링크 모달
// ============================================
interface TeamInviteLinkModalProps {
  company: any;
  onClose: () => void;
  onUpdate: () => void;
}

function TeamInviteLinkModal({ company, onClose, onUpdate }: TeamInviteLinkModalProps) {
  const [inviteDomain, setInviteDomain] = useState(company.invite_domain || '');
  const [inviteEnabled, setInviteEnabled] = useState(company.invite_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteLink = company.invite_token 
    ? `${window.location.origin}/join/${company.invite_token}`
    : '';

  const handleCopyLink = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('companies')
        .update({
          invite_domain: inviteDomain,
          invite_enabled: inviteEnabled
        })
        .eq('id', company.id);

      if (error) throw error;

      alert('설정이 저장되었습니다');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Failed to update invite settings:', error);
      alert('설정 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm('새 링크를 생성하면 기존 링크는 사용할 수 없습니다. 계속하시겠습니까?')) {
      return;
    }

    try {
      setSaving(true);
      const newToken = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);

      const { error } = await supabase
        .from('companies')
        .update({ invite_token: newToken })
        .eq('id', company.id);

      if (error) throw error;

      alert('새 초대 링크가 생성되었습니다');
      onUpdate();
    } catch (error) {
      console.error('Failed to regenerate token:', error);
      alert('링크 생성에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900">팀 초대 링크 관리</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 안내 */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">🔗 팀 초대 링크란?</h4>
          <p className="text-sm text-blue-800">
            링크 하나로 팀원 전체를 초대할 수 있습니다. 
            이 링크로 가입한 사용자는 <strong>직접 조직/역할을 선택</strong>하게 됩니다.
          </p>
        </div>

        {/* 활성화 상태 */}
        <div className="mb-6 p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900">링크 상태</h4>
              <p className="text-sm text-slate-600 mt-1">
                {inviteEnabled ? '✅ 활성화됨' : '⛔ 비활성화됨'}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={inviteEnabled}
                onChange={(e) => setInviteEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* 이메일 도메인 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            📧 허용된 이메일 도메인
          </label>
          <div className="flex gap-2">
            <span className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg">@</span>
            <input
              type="text"
              value={inviteDomain}
              onChange={(e) => setInviteDomain(e.target.value)}
              placeholder="company.com"
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            비워두면 모든 이메일 도메인 허용
          </p>
        </div>

        {/* 초대 링크 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            🔗 공유 링크
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteLink}
              readOnly
              className="flex-1 px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-slate-700"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              {copied ? '복사됨!' : '복사'}
            </button>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={handleRegenerateToken}
            disabled={saving}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            링크 재생성
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}