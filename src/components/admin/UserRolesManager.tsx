// src/components/admin/UserRolesManager.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { 
  getAllRoles, 
  getUserRoles, 
  assignRole, 
  revokeRole,
  Role,
  UserRole 
} from '../../lib/permissions';
import { Shield, X, Plus, AlertCircle } from 'lucide-react';

export default function UserRolesManager() {
  const { organizations } = useStore();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // 사용자 목록 로딩
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { supabase } = await import('../../lib/supabase');
        
        // 현재 사용자 정보 가져오기
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 현재 사용자의 회사 및 권한 확인
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (!currentProfile) return;

        // 현재 사용자의 최고 레벨 확인
        const { getMyRoleLevel } = await import('../../lib/permissions');
        const roleLevel = await getMyRoleLevel();

        // Super Admin(레벨 100+)이면 모든 회사, 아니면 자기 회사만
        let query = supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            company_id,
            companies (
              name
            )
          `)
          .order('full_name');

        // Company Admin 이하는 자기 회사만
        if (roleLevel < 100 && currentProfile.company_id) {
          query = query.eq('company_id', currentProfile.company_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        setUsers(data || []);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };

    loadUsers();
  }, []);

  // 역할 목록 로딩
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const rolesList = await getAllRoles();
        setRoles(rolesList);
      } catch (error) {
        console.error('Failed to load roles:', error);
      }
    };

    loadRoles();
  }, []);

  // 선택된 사용자의 역할 로딩
  useEffect(() => {
    const loadUserRoles = async () => {
      if (!selectedUser) return;

      try {
        setLoading(true);
        const roles = await getUserRoles(selectedUser.id);
        setUserRoles(roles);
      } catch (error) {
        console.error('Failed to load user roles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserRoles();
  }, [selectedUser]);

  // 역할 할당
  const handleAssignRole = async (roleId: string, orgId?: string) => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      await assignRole(selectedUser.id, roleId, orgId);
      
      // 목록 새로고침
      const updatedRoles = await getUserRoles(selectedUser.id);
      setUserRoles(updatedRoles);
      setShowAssignModal(false);
    } catch (error) {
      console.error('Failed to assign role:', error);
      alert('역할 할당에 실패했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 역할 해제
  const handleRevokeRole = async (userRoleId: string) => {
    if (!confirm('정말 이 역할을 해제하시겠습니까?')) return;

    try {
      setLoading(true);
      await revokeRole(userRoleId);
      
      // 목록 새로고침
      const updatedRoles = await getUserRoles(selectedUser!.id);
      setUserRoles(updatedRoles);
    } catch (error) {
      console.error('Failed to revoke role:', error);
      alert('역할 해제에 실패했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 역할 레벨별 색상
  const getRoleColor = (level: number) => {
    if (level >= 100) return 'purple';
    if (level >= 90) return 'blue';
    if (level >= 70) return 'indigo';
    if (level >= 50) return 'green';
    if (level >= 30) return 'yellow';
    return 'slate';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 왼쪽: 사용자 목록 */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">사용자 목록</h3>
          <p className="text-sm text-slate-600">역할을 관리할 사용자를 선택하세요</p>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">사용자를 찾을 수 없습니다</p>
            <p className="text-sm text-slate-500 mt-1">
              사용자 초대 탭에서 팀원을 초대하세요
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                  selectedUser?.id === user.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-slate-600 font-bold">
                    {user.full_name?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 truncate">
                    {user.full_name || '이름 없음'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {user.companies?.name || '회사 없음'}
                  </div>
                </div>
                {selectedUser?.id === user.id && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 오른쪽: 선택된 사용자의 역할 관리 */}
      <div>
        {selectedUser ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedUser.full_name}의 역할
                </h3>
                <p className="text-sm text-slate-600">
                  역할을 추가하거나 제거할 수 있습니다
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                역할 추가
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : userRoles.length > 0 ? (
              <div className="space-y-3">
                {userRoles.map((userRole) => {
                  const role = userRole.role;
                  const org = userRole.organization;
                  const color = role ? getRoleColor(role.level) : 'slate';

                  return (
                    <div
                      key={userRole.id}
                      className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 bg-${color}-100 rounded-lg`}>
                          <Shield className={`w-5 h-5 text-${color}-600`} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {role?.display_name || '알 수 없음'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {org ? `${org.name}에서` : '전체 시스템'}
                            {' • '}
                            레벨 {role?.level || 0}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeRole(userRole.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="역할 해제"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-slate-50 rounded-lg border border-slate-200">
                <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">할당된 역할이 없습니다</p>
                <p className="text-sm text-slate-500 mt-1">
                  '역할 추가' 버튼을 눌러 역할을 할당하세요
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-lg border border-slate-200">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">왼쪽에서 사용자를 선택하세요</p>
          </div>
        )}
      </div>

      {/* 역할 할당 모달 */}
      {showAssignModal && (
        <AssignRoleModal
          roles={roles}
          organizations={organizations}
          onAssign={handleAssignRole}
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </div>
  );
}

// ============================================
// 역할 할당 모달
// ============================================
interface AssignRoleModalProps {
  roles: Role[];
  organizations: any[];
  onAssign: (roleId: string, orgId?: string) => void;
  onClose: () => void;
}

function AssignRoleModal({ roles, organizations, onAssign, onClose }: AssignRoleModalProps) {
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  const handleSubmit = () => {
    if (!selectedRoleId) {
      alert('역할을 선택해주세요');
      return;
    }
    onAssign(selectedRoleId, selectedOrgId || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">역할 할당</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* 역할 선택 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              역할 선택 *
            </label>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">-- 역할을 선택하세요 --</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.display_name} (레벨 {role.level})
                </option>
              ))}
            </select>
          </div>

          {/* 조직 선택 (선택사항) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              적용 조직 (선택사항)
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">-- 전체 시스템 --</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.level})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              조직을 선택하지 않으면 전체 시스템에 대한 역할이 부여됩니다
            </p>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>💡 팁:</strong> 특정 조직에만 역할을 부여하면 해당 조직에서만 권한이 적용됩니다.
            </p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            할당
          </button>
        </div>
      </div>
    </div>
  );
}