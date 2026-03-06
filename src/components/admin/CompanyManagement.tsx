// src/components/admin/CompanyManagement.tsx
import { useEffect, useState, useRef } from 'react';
import { Building2, Plus, Calendar, MoreVertical, Edit3, Trash2, Power, X, Save, Loader2, Check } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  industry?: string;
  size?: number;
  status: string;
  created_at: string;
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

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
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAdminCount();
    loadInvitations();
  }, [company.id]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const loadAdminCount = async () => {
    try {
      const { supabase } = await import('../../lib/supabase');
      
      const { data: roleData } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'company_admin')
        .single();
      
      if (!roleData) return;
      
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

  // ★ 상태 변경
  const handleToggleStatus = async () => {
    const newStatus = company.status === 'active' ? 'inactive' : 'active';
    const label = newStatus === 'active' ? '활성' : '비활성';
    
    if (!confirm(`"${company.name}"을(를) ${label} 상태로 변경하시겠습니까?`)) return;

    try {
      const { supabase } = await import('../../lib/supabase');
      const { error } = await supabase
        .from('companies')
        .update({ status: newStatus })
        .eq('id', company.id);

      if (error) throw error;
      setShowMenu(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('상태 변경에 실패했습니다');
    }
  };

  // ★ 회사 삭제
  const handleDelete = async () => {
    const confirmText = prompt(
      `"${company.name}"을(를) 삭제하려면 회사명을 정확히 입력하세요.\n\n⚠️ 이 작업은 되돌릴 수 없으며, 소속 조직·사용자·OKR 데이터가 모두 삭제됩니다.`
    );

    if (confirmText !== company.name) {
      if (confirmText !== null) alert('회사명이 일치하지 않습니다.');
      return;
    }

    try {
      const { supabase } = await import('../../lib/supabase');

      // 관련 데이터 삭제 (FK 제약 순서대로)
      // 1. invitations
      await supabase.from('invitations').delete().eq('company_id', company.id);
      
      // 2. 조직에 연결된 user_roles
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id')
        .eq('company_id', company.id);
      
      if (orgs && orgs.length > 0) {
        const orgIds = orgs.map(o => o.id);
        await supabase.from('user_roles').delete().in('org_id', orgIds);
      }

      // 3. organizations
      await supabase.from('organizations').delete().eq('company_id', company.id);

      // 4. profiles의 company_id 해제
      await supabase
        .from('profiles')
        .update({ company_id: null })
        .eq('company_id', company.id);

      // 5. 회사 삭제
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);

      if (error) throw error;

      setShowMenu(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to delete company:', error);
      alert('회사 삭제에 실패했습니다: ' + (error as Error).message);
    }
  };

  const statusColors = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: '활성' },
    trial: { bg: 'bg-blue-100', text: 'text-blue-700', label: '체험' },
    inactive: { bg: 'bg-slate-100', text: 'text-slate-700', label: '비활성' }
  };

  const status = statusColors[company.status as keyof typeof statusColors] || statusColors.active;

  return (
    <>
      <div className={`bg-white rounded-xl border p-6 hover:shadow-lg transition-shadow ${
        company.status === 'inactive' ? 'border-slate-300 opacity-70' : 'border-slate-200'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              company.status === 'inactive' ? 'bg-slate-100' : 'bg-blue-100'
            }`}>
              <Building2 className={`w-6 h-6 ${
                company.status === 'inactive' ? 'text-slate-400' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{company.name}</h3>
              {company.industry && (
                <p className="text-xs text-slate-500">{company.industry}</p>
              )}
            </div>
          </div>

          {/* ★ 점점점 메뉴 */}
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-10 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                <button
                  onClick={() => { setShowMenu(false); setShowEditModal(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-slate-400" />
                  정보 수정
                </button>
                <button
                  onClick={handleToggleStatus}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Power className={`w-4 h-4 ${company.status === 'inactive' ? 'text-green-500' : 'text-amber-500'}`} />
                  {company.status === 'inactive' ? '활성화' : '비활성화'}
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  회사 삭제
                </button>
              </div>
            )}
          </div>
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

        {showInvites && invitations.length === 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 text-center py-2">발송된 초대가 없습니다</p>
          </div>
        )}
      </div>

      {/* ★ 회사 정보 수정 모달 */}
      {showEditModal && (
        <EditCompanyModal
          company={company}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => { setShowEditModal(false); onUpdate(); }}
        />
      )}
    </>
  );
}

// ============================================
// 회사 정보 수정 모달
// ============================================
interface EditCompanyModalProps {
  company: Company;
  onClose: () => void;
  onSuccess: () => void;
}

function EditCompanyModal({ company, onClose, onSuccess }: EditCompanyModalProps) {
  const [formData, setFormData] = useState({
    name: company.name,
    industry: company.industry || '',
    size: company.size?.toString() || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('회사명을 입력해주세요');
      return;
    }

    try {
      setSaving(true);
      const { supabase } = await import('../../lib/supabase');

      const { error } = await supabase
        .from('companies')
        .update({
          name: formData.name.trim(),
          industry: formData.industry.trim() || null,
          size: formData.size ? parseInt(formData.size) : null,
        })
        .eq('id', company.id);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Failed to update company:', error);
      alert('수정에 실패했습니다: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">회사 정보 수정</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">회사명 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">산업</label>
            <input
              type="text"
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              placeholder="예: IT, 제조, 금융"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">직원 수</label>
            <input
              type="number"
              value={formData.size}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              placeholder="예: 50"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
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

      const inviteToken = Math.random().toString(36).substring(2, 15) + 
                         Math.random().toString(36).substring(2, 15);
      const inviteDomain = formData.adminEmail.split('@')[1];

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

      // 전사 조직 자동 생성
      await supabase
        .from('organizations')
        .insert({
          company_id: company.id,
          name: formData.name,
          level: '전사',
          org_type: 'Middle',
          sort_order: 0,
        });

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
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">새 회사 추가</h3>
              <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">회사명 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="예: ABC 주식회사"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">산업</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="예: IT"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">직원 수</label>
                  <input
                    type="number"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="예: 50"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">최초 관리자 정보</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">이메일 *</label>
                    <input
                      type="email"
                      value={formData.adminEmail}
                      onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="admin@company.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">이름</label>
                    <input
                      type="text"
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="홍길동"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {loading ? '생성 중...' : '회사 생성'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 mb-2">회사가 생성되었습니다!</h3>
            <p className="text-sm text-slate-600 mb-6">관리자에게 아래 초대 링크를 전달하세요</p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
              <p className="text-xs text-slate-500 mb-2">초대 링크</p>
              <p className="text-sm text-slate-900 break-all font-mono bg-white p-2 rounded border border-slate-200">
                {inviteLink}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyToClipboard}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                📋 링크 복사
              </button>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              >
                닫기
              </button>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              💡 실제 프로덕션에서는 이메일로 자동 발송됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}