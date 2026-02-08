// src/components/admin/CompanyManagement.tsx
import { useEffect, useState } from 'react';
import { Building2, Plus, Users, Calendar, MoreVertical, UserPlus } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  industry?: string;
  size?: number;
  status: string;
  created_at: string;
}

interface CompanyAdmin {
  id: string;
  full_name: string;
  email: string;
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [recentInviteLink, setRecentInviteLink] = useState<string | null>(null);

  // 회사 목록 로딩
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const { supabase } = await import('../../lib/supabase');
      
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">회사 관리</h2>
          <p className="text-sm text-slate-600">
            등록된 회사 목록을 관리하고 새 회사를 추가합니다
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          새 회사 추가
        </button>
      </div>

      {/* 회사 목록 */}
      {companies.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
          <Building2 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            등록된 회사가 없습니다
          </h3>
          <p className="text-sm text-slate-600 mb-6">
            첫 번째 회사를 추가하여 시작하세요
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            새 회사 추가
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <CompanyCard 
              key={company.id} 
              company={company}
              onUpdate={loadCompanies}
            />
          ))}
        </div>
      )}

      {/* 회사 추가 모달 */}
      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadCompanies();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// 회사 카드 컴포넌트
// ============================================
interface CompanyCardProps {
  company: Company;
  onUpdate: () => void;
}

function CompanyCard({ company, onUpdate }: CompanyCardProps) {
  const [adminCount, setAdminCount] = useState(0);
  const [showInvites, setShowInvites] = useState(false);
  const [invitations, setInvitations] = useState<any[]>([]);

  useEffect(() => {
    loadAdminCount();
    loadInvitations();
  }, [company.id]);

  const loadAdminCount = async () => {
    try {
      const { supabase } = await import('../../lib/supabase');
      
      // 1. company_admin 역할 ID 가져오기
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'company_admin')
        .single();
      
      if (!roleData) {
        console.error('company_admin role not found');
        return;
      }
      
      // 2. 이 회사 소속 프로필의 company_admin 역할만 카운트
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', company.id);
      
      if (!profiles || profiles.length === 0) {
        setAdminCount(0);
        return;
      }
      
      const profileIds = profiles.map(p => p.id);
      
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', roleData.id)
        .in('profile_id', profileIds);
      
      setAdminCount(count || 0);
    } catch (error) {
      console.error('Failed to load admin count:', error);
      setAdminCount(0);
    }
  };

  const loadInvitations = async () => {
    try {
      const { supabase } = await import('../../lib/supabase');
      const { data } = await supabase
        .from('invitations')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      
      setInvitations(data || []);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/accept-invite/${token}`;
    await navigator.clipboard.writeText(link);
    alert('초대 링크가 복사되었습니다!');
  };

  const statusColors = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: '활성' },
    trial: { bg: 'bg-blue-100', text: 'text-blue-700', label: '체험' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-700', label: '비활성' }
  };

  const status = statusColors[company.status as keyof typeof statusColors] || statusColors.active;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">{company.name}</h3>
            {company.industry && (
              <p className="text-xs text-slate-500">{company.industry}</p>
            )}
          </div>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <MoreVertical className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">상태</span>
          <span className={`px-2 py-1 ${status.bg} ${status.text} rounded text-xs font-medium`}>
            {status.label}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">관리자</span>
          <span className="font-medium text-slate-900">{adminCount}명</span>
        </div>

        {company.size && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">직원 수</span>
            <span className="font-medium text-slate-900">{company.size}명</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500 pt-3 border-t border-slate-100">
          <Calendar className="w-3 h-3" />
          {new Date(company.created_at).toLocaleDateString('ko-KR')} 등록
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <button 
          onClick={() => setShowInvites(!showInvites)}
          className="w-full px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          {showInvites ? '초대 목록 숨기기' : '초대 목록 보기'}
        </button>
      </div>

      {/* 초대 목록 */}
      {showInvites && invitations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">발송된 초대</h4>
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-2 bg-slate-50 rounded text-xs">
              <div>
                <div className="font-medium text-slate-900">{inv.email}</div>
                <div className="text-slate-500">
                  {inv.status === 'pending' && '대기중'}
                  {inv.status === 'accepted' && '수락됨'}
                  {inv.status === 'expired' && '만료됨'}
                </div>
              </div>
              {inv.status === 'pending' && (
                <button
                  onClick={() => copyInviteLink(inv.token)}
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  복사
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// 회사 추가 모달
// ============================================
interface AddCompanyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddCompanyModal({ onClose, onSuccess }: AddCompanyModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    size: '',
    adminEmail: '',
    adminName: ''
  });
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.adminEmail) {
      alert('회사명과 관리자 이메일은 필수입니다');
      return;
    }

    try {
      setLoading(true);
      const { supabase } = await import('../../lib/supabase');

      // 1. 회사 생성
      const inviteToken = Math.random().toString(36).substring(2, 15) + 
                         Math.random().toString(36).substring(2, 15);
      const inviteDomain = formData.adminEmail.split('@')[1]; // 도메인 추출

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: formData.name,
          industry: formData.industry || null,
          size: formData.size ? parseInt(formData.size) : null,
          status: 'trial',
          invite_token: inviteToken,
          invite_domain: inviteDomain,
          invite_enabled: true
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // 2. 초대 생성
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'company_admin')
        .single();

      const invitationToken = Math.random().toString(36).substring(2, 15) + 
                             Math.random().toString(36).substring(2, 15);

      const { error: inviteError } = await supabase
        .from('invitations')
        .insert({
          company_id: company.id,
          email: formData.adminEmail,
          full_name: formData.adminName || null,
          role_id: roleData?.id,
          token: invitationToken,
          invited_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (inviteError) throw inviteError;

      // 초대 링크 저장 (모달에 표시)
      const link = `${window.location.origin}/accept-invite/${invitationToken}`;
      setInviteLink(link);
      
      onSuccess();
    } catch (error) {
      console.error('Failed to create company:', error);
      alert('회사 생성에 실패했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink);
      alert('초대 링크가 복사되었습니다!');
    }
  };

  const handleClose = () => {
    setInviteLink(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        {!inviteLink ? (
          <>
            <h3 className="text-xl font-bold text-slate-900 mb-6">새 회사 추가</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              회사명 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="예: ABC 주식회사"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                산업
              </label>
              <input
                type="text"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="예: IT"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                직원 수
              </label>
              <input
                type="number"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="예: 50"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-3">
              최초 관리자 정보
            </h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  이메일 *
                </label>
                <input
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="admin@company.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  이름
                </label>
                <input
                  type="text"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="홍길동"
                />
              </div>
            </div>
          </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? '생성 중...' : '회사 생성'}
              </button>
            </div>
          </form>
        </>
        ) : (
          <>
            {/* 초대 링크 생성 완료 화면 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                회사가 생성되었습니다!
              </h3>
              <p className="text-sm text-slate-600 mb-6">
                관리자에게 아래 초대 링크를 전달하세요
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
                <p className="text-xs text-slate-500 mb-2">초대 링크</p>
                <p className="text-sm text-slate-900 break-all font-mono bg-white p-2 rounded border border-slate-200">
                  {inviteLink}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copyToClipboard}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  📋 링크 복사
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  닫기
                </button>
              </div>

              <p className="text-xs text-slate-500 mt-4">
                💡 실제 프로덕션에서는 이메일로 자동 발송됩니다
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}