// src/components/admin/UserRolesManager.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  getAllRoles,
  getUserRoles,
  assignRole,
  revokeRole,
  getMyRoleLevel,
  getAssignableRoles,
  getRoleInfo,
  ROLE_LEVELS,
  Role,
  UserRole,
} from '../../lib/permissions';
import { Shield, X, Plus, AlertCircle, Check, Eye, Settings, Users, Target, BarChart3, Crown } from 'lucide-react';

// ─── 역할 아이콘 맵 ─────────────────────────
function getRoleIcon(level: number) {
  if (level >= 100) return Settings;
  if (level >= 90) return Crown;
  if (level >= 80) return Users;
  if (level >= 70) return Target;
  if (level >= 30) return BarChart3;
  return Eye;
}

export default function UserRolesManager() {
  const { organizations } = useStore();
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [myRoleLevel, setMyRoleLevel] = useState(0);

  useEffect(() => {
    const init = async () => {
      const level = await getMyRoleLevel();
      setMyRoleLevel(level);
    };
    init();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { supabase } = await import('../../lib/supabase');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();
        if (!currentProfile) return;

        const level = await getMyRoleLevel();

        let query = supabase
          .from('profiles')
          .select('id, full_name, company_id, companies ( name )')
          .order('full_name');

        if (level < ROLE_LEVELS.SUPER_ADMIN && currentProfile.company_id) {
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

  const handleAssignRole = async (roleId: string, orgId?: string) => {
    if (!selectedUser) return;
    try {
      setLoading(true);
      await assignRole(selectedUser.id, roleId, orgId);
      const updatedRoles = await getUserRoles(selectedUser.id);
      setUserRoles(updatedRoles);
      setShowAssignModal(false);
      alert('✅ 역할이 할당되었습니다');
    } catch (error) {
      console.error('Failed to assign role:', error);
      alert('역할 할당에 실패했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeRole = async (userRoleId: string) => {
    if (!confirm('이 역할을 해제하시겠습니까?')) return;
    try {
      setLoading(true);
      await revokeRole(userRoleId);
      if (selectedUser) {
        const updatedRoles = await getUserRoles(selectedUser.id);
        setUserRoles(updatedRoles);
      }
      alert('✅ 역할이 해제되었습니다');
    } catch (error) {
      console.error('Failed to revoke role:', error);
      alert('역할 해제에 실패했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 왼쪽: 사용자 목록 */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">사용자 목록</h3>
          <p className="text-sm text-slate-600">역할을 관리할 사용자를 선택하세요</p>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                selectedUser?.id === user.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {user.full_name?.charAt(0) || '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-900 truncate">
                  {user.full_name || '이름 미설정'}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {(user.companies as any)?.name || '회사 미지정'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 오른쪽: 역할 관리 */}
      <div>
        {selectedUser ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedUser.full_name}의 역할
                </h3>
                <p className="text-sm text-slate-600">
                  {(selectedUser.companies as any)?.name}
                </p>
              </div>
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                역할 추가
              </button>
            </div>

            {loading ? (
              <div className="text-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : userRoles.length > 0 ? (
              <div className="space-y-3">
                {userRoles.map((userRole) => {
                  const role = userRole.role;
                  const org = userRole.organization;
                  const info = getRoleInfo(role?.level || 0);
                  const Icon = getRoleIcon(role?.level || 0);

                  return (
                    <div key={userRole.id}
                      className={`flex items-center gap-3 p-4 rounded-lg border ${info.bgColor}`}>
                      <div className="p-2 rounded-lg bg-white/60">
                        <Icon className={`w-5 h-5 ${info.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">
                          {role?.display_name || '알 수 없는 역할'}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{info.summary}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {org ? `${org.name}에서` : '전체 시스템'}
                        </div>
                      </div>
                      <button onClick={() => handleRevokeRole(userRole.id)}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="역할 해제">
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
                <p className="text-sm text-slate-500 mt-1">'역할 추가' 버튼을 눌러 역할을 할당하세요</p>
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
          myRoleLevel={myRoleLevel}
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
  myRoleLevel: number;
  onAssign: (roleId: string, orgId?: string) => void;
  onClose: () => void;
}

function AssignRoleModal({ roles, organizations, myRoleLevel, onAssign, onClose }: AssignRoleModalProps) {
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // 핵심: getAssignableRoles로 할당 가능한 역할 필터
  const assignableRoles = getAssignableRoles(roles, myRoleLevel);

  // 선택된 역할이 org_leader면 조직 선택 필요
  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const needsOrgSelection = selectedRole && selectedRole.level <= ROLE_LEVELS.ORG_LEADER;

  const handleSubmit = () => {
    if (!selectedRoleId) {
      alert('역할을 선택해주세요');
      return;
    }
    onAssign(selectedRoleId, selectedOrgId || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-slate-900">역할 할당</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* 역할 선택 — 카드형 */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-3">
              역할 선택
            </label>

            {assignableRoles.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                할당 가능한 역할이 없습니다. 자신보다 낮은 레벨의 역할만 할당할 수 있습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {assignableRoles.map((role) => {
                  const info = getRoleInfo(role.level);
                  const Icon = getRoleIcon(role.level);
                  const isSelected = selectedRoleId === role.id;

                  return (
                    <button
                      key={role.id}
                      onClick={() => {
                        setSelectedRoleId(role.id);
                        // CEO/company_admin은 조직 선택 불필요 → 초기화
                        if (role.level >= ROLE_LEVELS.COMPANY_ADMIN) {
                          setSelectedOrgId('');
                        }
                      }}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-slate-100'} flex-shrink-0 mt-0.5`}>
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : info.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">
                              {role.display_name}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {role.description || info.summary}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {info.capabilities.slice(0, 4).map((cap, i) => (
                              <span key={i} className="inline-flex items-center px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-600">
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 조직 선택 — org_leader/member일 때만 표시 */}
          {needsOrgSelection && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                적용 조직 {selectedRole?.level === ROLE_LEVELS.ORG_LEADER
                  ? <span className="font-normal text-red-500">(필수)</span>
                  : <span className="font-normal text-slate-400">(선택)</span>
                }
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              >
                <option value="">
                  {selectedRole?.level === ROLE_LEVELS.ORG_LEADER
                    ? '-- 조직을 선택하세요 --'
                    : '전체 시스템 (모든 조직)'}
                </option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.level})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                {selectedRole?.level === ROLE_LEVELS.ORG_LEADER
                  ? '조직장은 특정 조직에 배정해야 합니다. 배정된 조직과 하위 조직을 관리합니다.'
                  : '특정 조직을 선택하면 해당 조직에서만 이 역할이 적용됩니다'}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !selectedRoleId ||
              (selectedRole?.level === ROLE_LEVELS.ORG_LEADER && !selectedOrgId)
            }
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            할당
          </button>
        </div>
      </div>
    </div>
  );
}