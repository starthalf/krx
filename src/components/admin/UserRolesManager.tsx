// src/components/admin/UserRolesManager.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import {
  getAllRoles,
  assignRole,
  revokeRole,
  getMyRoleLevel,
  getAssignableRoles,
  getRoleInfo,
  ROLE_LEVELS,
  Role,
} from '../../lib/permissions';
import { supabase } from '../../lib/supabase';
import {
  Shield, X, Plus, Check, Eye, Settings, Users,
  Target, BarChart3, Crown, Search, Building2,
  Pencil, Trash2, UserPlus,
} from 'lucide-react';

// ─── helpers ─────────────────────────
function getRoleIcon(level: number) {
  if (level >= 100) return Settings;
  if (level >= 90) return Crown;
  if (level >= 80) return Users;
  if (level >= 70) return Target;
  if (level >= 30) return BarChart3;
  return Eye;
}

function getRoleBadge(level: number) {
  if (level >= 100) return { bg: 'bg-purple-100', text: 'text-purple-700' };
  if (level >= 90) return { bg: 'bg-red-100', text: 'text-red-700' };
  if (level >= 80) return { bg: 'bg-orange-100', text: 'text-orange-700' };
  if (level >= 70) return { bg: 'bg-blue-100', text: 'text-blue-700' };
  if (level >= 30) return { bg: 'bg-green-100', text: 'text-green-700' };
  return { bg: 'bg-slate-100', text: 'text-slate-600' };
}

interface RoleEntry {
  userRoleId: string;
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  roleLevel: number;
  orgId?: string;
  orgName?: string;
}

interface UserWithRoles {
  id: string;
  full_name: string;
  company_name?: string;
  roles: RoleEntry[];
  maxLevel: number;
}

// ============================================
// 메인 컴포넌트
// ============================================
export default function UserRolesManager() {
  const { organizations } = useStore();
  const [usersWithRoles, setUsersWithRoles] = useState<UserWithRoles[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [myRoleLevel, setMyRoleLevel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [editingUserRole, setEditingUserRole] = useState<RoleEntry | null>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const level = await getMyRoleLevel();
      setMyRoleLevel(level);
      const rolesList = await getAllRoles();
      setAllRoles(rolesList);
      await loadUsersWithRoles(level);
    } catch (error) {
      console.error('Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsersWithRoles = async (level?: number) => {
    const myLevel = level ?? myRoleLevel;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      if (!currentProfile) return;

      // ── 1단계: profiles 조회 ──
      let profileQuery = supabase
        .from('profiles')
        .select('id, full_name, company_id, companies ( name )')
        .order('full_name');

      if (myLevel < ROLE_LEVELS.SUPER_ADMIN && currentProfile.company_id) {
        profileQuery = profileQuery.eq('company_id', currentProfile.company_id);
      }

      const { data: profiles, error: pErr } = await profileQuery;
      if (pErr) { console.error('profiles 조회 실패:', pErr); return; }
      if (!profiles || profiles.length === 0) { setUsersWithRoles([]); return; }

      // ── 2단계: user_roles 조회 (별도) ──
      const profileIds = profiles.map(p => p.id);
      const { data: rawRoles, error: rErr } = await supabase
        .from('user_roles')
        .select(`
          id, profile_id, role_id, org_id,
          roles ( name, display_name, level ),
          organizations ( id, name )
        `)
        .in('profile_id', profileIds);

      if (rErr) console.error('user_roles 조회 실패:', rErr);

      // ── 3단계: 병합 ──
      const rolesMap = new Map<string, any[]>();
      (rawRoles || []).forEach((ur: any) => {
        const list = rolesMap.get(ur.profile_id) || [];
        list.push(ur);
        rolesMap.set(ur.profile_id, list);
      });

      const mapped: UserWithRoles[] = profiles.map((u: any) => {
        const userRoles = rolesMap.get(u.id) || [];
        const roles: RoleEntry[] = userRoles.map((ur: any) => ({
          userRoleId: ur.id,
          roleId: ur.role_id,
          roleName: ur.roles?.name || '',
          roleDisplayName: ur.roles?.display_name || '알 수 없음',
          roleLevel: ur.roles?.level || 0,
          orgId: ur.org_id || undefined,
          orgName: ur.organizations?.name || undefined,
        }));

        return {
          id: u.id,
          full_name: u.full_name || '이름 미설정',
          company_name: (u.companies as any)?.name || '',
          roles,
          maxLevel: roles.length > 0 ? Math.max(...roles.map(r => r.roleLevel)) : 0,
        };
      });

      mapped.sort((a, b) => b.maxLevel - a.maxLevel);
      setUsersWithRoles(mapped);
    } catch (error) {
      console.error('loadUsersWithRoles 전체 실패:', error);
    }
  };

  const filteredUsers = usersWithRoles.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.roles.some(r => r.roleDisplayName.includes(searchQuery)) ||
    u.roles.some(r => r.orgName?.includes(searchQuery))
  );

  // ─── 핸들러 ─────────────────
  const handleAssignRole = async (roleId: string, orgId?: string) => {
    if (!targetUserId) return;
    try {
      await assignRole(targetUserId, roleId, orgId);
      await loadUsersWithRoles();
      setShowAssignModal(false);
      setTargetUserId(null);
    } catch (error) { alert('역할 할당 실패: ' + (error as Error).message); }
  };

  const handleRevokeRole = async (userRoleId: string) => {
    if (!confirm('이 역할을 해제하시겠습니까?')) return;
    try {
      await revokeRole(userRoleId);
      await loadUsersWithRoles();
    } catch (error) { alert('역할 해제 실패: ' + (error as Error).message); }
  };

  const handleEditRole = async (userRoleId: string, newRoleId: string, newOrgId?: string) => {
    try {
      const userId = usersWithRoles.find(u => u.roles.some(r => r.userRoleId === userRoleId))?.id;
      await revokeRole(userRoleId);
      if (userId) await assignRole(userId, newRoleId, newOrgId);
      await loadUsersWithRoles();
      setShowEditModal(false);
      setEditingUserRole(null);
    } catch (error) { alert('역할 변경 실패: ' + (error as Error).message); }
  };

  const handleChangeOrg = async (userRoleId: string, userId: string, roleId: string, newOrgId: string) => {
    try {
      await revokeRole(userRoleId);
      await assignRole(userId, roleId, newOrgId || undefined);
      await loadUsersWithRoles();
    } catch (error) { alert('조직 변경 실패: ' + (error as Error).message); }
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
          <h2 className="text-xl font-bold text-slate-900">사용자 관리</h2>
          <p className="text-sm text-slate-600 mt-1">{usersWithRoles.length}명의 사용자</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="이름, 역할, 조직으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-3">사용자</div>
          <div className="col-span-3">역할</div>
          <div className="col-span-3">소속 조직</div>
          <div className="col-span-3 text-right">관리</div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">{searchQuery ? '검색 결과가 없습니다' : '사용자가 없습니다'}</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                organizations={organizations}
                onAddRole={() => { setTargetUserId(user.id); setShowAssignModal(true); }}
                onRevokeRole={handleRevokeRole}
                onChangeOrg={handleChangeOrg}
                onEditRole={(r) => { setTargetUserId(user.id); setEditingUserRole(r); setShowEditModal(true); }}
              />
            ))
          )}
        </div>
      </div>

      {showAssignModal && targetUserId && (
        <AssignRoleModal
          roles={allRoles} organizations={organizations} myRoleLevel={myRoleLevel}
          userName={usersWithRoles.find(u => u.id === targetUserId)?.full_name || ''}
          onAssign={handleAssignRole}
          onClose={() => { setShowAssignModal(false); setTargetUserId(null); }}
        />
      )}

      {showEditModal && editingUserRole && targetUserId && (
        <EditRoleModal
          currentRole={editingUserRole} roles={allRoles} organizations={organizations} myRoleLevel={myRoleLevel}
          userName={usersWithRoles.find(u => u.id === targetUserId)?.full_name || ''}
          onSave={handleEditRole}
          onClose={() => { setShowEditModal(false); setEditingUserRole(null); setTargetUserId(null); }}
        />
      )}
    </div>
  );
}

// ============================================
// 사용자 행
// ============================================
function UserRow({ user, organizations, onAddRole, onRevokeRole, onChangeOrg, onEditRole }: {
  user: UserWithRoles; organizations: any[];
  onAddRole: () => void; onRevokeRole: (id: string) => void;
  onChangeOrg: (urId: string, userId: string, roleId: string, newOrgId: string) => void;
  onEditRole: (r: RoleEntry) => void;
}) {
  const [showOrgSelect, setShowOrgSelect] = useState<string | null>(null);

  if (user.roles.length === 0) {
    return (
      <div className="grid grid-cols-12 gap-4 px-5 py-4 items-center hover:bg-slate-50">
        <div className="col-span-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">{user.full_name.charAt(0)}</span>
          </div>
          <div>
            <div className="font-medium text-sm text-slate-900">{user.full_name}</div>
            <div className="text-xs text-slate-400">{user.company_name}</div>
          </div>
        </div>
        <div className="col-span-3"><span className="text-xs text-slate-400 italic">역할 미할당</span></div>
        <div className="col-span-3"><span className="text-xs text-slate-400">-</span></div>
        <div className="col-span-3 flex justify-end">
          <button onClick={onAddRole} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg">
            <UserPlus className="w-3.5 h-3.5" />역할 추가
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {user.roles.map((role, idx) => {
        const badge = getRoleBadge(role.roleLevel);
        const Icon = getRoleIcon(role.roleLevel);
        return (
          <div key={role.userRoleId} className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-slate-50">
            <div className="col-span-3 flex items-center gap-3">
              {idx === 0 ? (
                <>
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">{user.full_name.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-slate-900">{user.full_name}</div>
                    <div className="text-xs text-slate-400">{user.company_name}</div>
                  </div>
                </>
              ) : (
                <div className="ml-12 border-l-2 border-slate-200 pl-3">
                  <div className="text-xs text-slate-400">추가 역할</div>
                </div>
              )}
            </div>

            <div className="col-span-3">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${badge.text}`} />
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
                  {role.roleDisplayName}
                </span>
              </div>
            </div>

            <div className="col-span-3">
              {showOrgSelect === role.userRoleId ? (
                <select
                  defaultValue={role.orgId || ''}
                  onChange={(e) => { onChangeOrg(role.userRoleId, user.id, role.roleId, e.target.value); setShowOrgSelect(null); }}
                  className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus onBlur={() => setShowOrgSelect(null)}
                >
                  <option value="">전체 (미지정)</option>
                  {organizations.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
                </select>
              ) : (
                <button
                  onClick={() => setShowOrgSelect(role.userRoleId)}
                  className="flex items-center gap-1.5 text-sm text-slate-700 hover:text-blue-600 group"
                  title="클릭하여 조직 변경"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500" />
                  {/* ★ FIX: CEO/Admin은 org_id가 null이므로 역할 레벨에 맞게 표시 */}
                  {role.orgName ? (
                    <span>{role.orgName}</span>
                  ) : role.roleLevel >= 90 ? (
                    <span className="text-red-600 font-medium text-xs">전사</span>
                  ) : role.roleLevel >= 80 ? (
                    <span className="text-orange-600 font-medium text-xs">전사 관리</span>
                  ) : (
                    <span className="text-slate-400 italic text-xs">미지정</span>
                  )}
                  <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100" />
                </button>
              )}
            </div>

            <div className="col-span-3 flex items-center justify-end gap-1">
              <button onClick={() => onEditRole(role)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="역할 변경">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onRevokeRole(role.userRoleId)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="역할 해제">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {idx === 0 && (
                <button onClick={onAddRole} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="역할 추가">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ============================================
// 역할 할당 모달
// ============================================
function AssignRoleModal({ roles, organizations, myRoleLevel, userName, onAssign, onClose }: {
  roles: Role[]; organizations: any[]; myRoleLevel: number; userName: string;
  onAssign: (roleId: string, orgId?: string) => void; onClose: () => void;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const assignableRoles = getAssignableRoles(roles, myRoleLevel);
  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const needsOrgSelection = selectedRole && selectedRole.level <= ROLE_LEVELS.ORG_LEADER;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">역할 할당</h3>
            <p className="text-sm text-slate-500">{userName}에게 새 역할을 할당합니다</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-3">역할 선택</label>
            {assignableRoles.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">할당 가능한 역할이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {assignableRoles.map((role) => {
                  const info = getRoleInfo(role.level);
                  const Icon = getRoleIcon(role.level);
                  const isSelected = selectedRoleId === role.id;
                  return (
                    <button key={role.id}
                      onClick={() => { setSelectedRoleId(role.id); if (role.level >= ROLE_LEVELS.COMPANY_ADMIN) setSelectedOrgId(''); }}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${isSelected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-slate-100'} flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : info.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900">{role.display_name}</span>
                            {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{role.description || info.summary}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {info.capabilities.slice(0, 4).map((cap, i) => (
                              <span key={i} className="px-2 py-0.5 text-[11px] rounded-full bg-slate-100 text-slate-600">{cap}</span>
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

          {needsOrgSelection && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                적용 조직
                {selectedRole?.level === ROLE_LEVELS.ORG_LEADER
                  ? <span className="font-normal text-red-500 ml-1">(필수)</span>
                  : <span className="font-normal text-slate-400 ml-1">(선택)</span>}
              </label>
              <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">{selectedRole?.level === ROLE_LEVELS.ORG_LEADER ? '-- 조직을 선택하세요 --' : '전체 (미지정)'}</option>
                {organizations.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium">취소</button>
          <button onClick={() => onAssign(selectedRoleId, selectedOrgId || undefined)}
            disabled={!selectedRoleId || (selectedRole?.level === ROLE_LEVELS.ORG_LEADER && !selectedOrgId)}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            할당
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 역할 수정 모달
// ============================================
function EditRoleModal({ currentRole, roles, organizations, myRoleLevel, userName, onSave, onClose }: {
  currentRole: RoleEntry; roles: Role[]; organizations: any[]; myRoleLevel: number; userName: string;
  onSave: (urId: string, newRoleId: string, newOrgId?: string) => void; onClose: () => void;
}) {
  const [selectedRoleId, setSelectedRoleId] = useState(currentRole.roleId);
  const [selectedOrgId, setSelectedOrgId] = useState(currentRole.orgId || '');
  const assignableRoles = getAssignableRoles(roles, myRoleLevel);
  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const needsOrgSelection = selectedRole && selectedRole.level <= ROLE_LEVELS.ORG_LEADER;
  const hasChanged = selectedRoleId !== currentRole.roleId || selectedOrgId !== (currentRole.orgId || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">역할 변경</h3>
            <p className="text-sm text-slate-500">{userName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-400 mb-1">현재</div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getRoleBadge(currentRole.roleLevel).bg} ${getRoleBadge(currentRole.roleLevel).text}`}>
              {currentRole.roleDisplayName}
            </span>
            {currentRole.orgName && <span className="text-xs text-slate-500">@ {currentRole.orgName}</span>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">새 역할</label>
            <select value={selectedRoleId}
              onChange={(e) => { setSelectedRoleId(e.target.value); const r = roles.find(r => r.id === e.target.value); if (r && r.level >= ROLE_LEVELS.COMPANY_ADMIN) setSelectedOrgId(''); }}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              {assignableRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.display_name} (Lv.{role.level})</option> 
              ))}
            </select>
          </div>
          {needsOrgSelection && (
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                적용 조직
                {selectedRole?.level === ROLE_LEVELS.ORG_LEADER ? <span className="font-normal text-red-500 ml-1">(필수)</span> : <span className="font-normal text-slate-400 ml-1">(선택)</span>}
              </label>
              <select value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">{selectedRole?.level === ROLE_LEVELS.ORG_LEADER ? '-- 조직을 선택하세요 --' : '전체 (미지정)'}</option>
                {organizations.map((org) => (<option key={org.id} value={org.id}>{org.name}</option>))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium">취소</button>
          <button onClick={() => onSave(currentRole.userRoleId, selectedRoleId, selectedOrgId || undefined)}
            disabled={!hasChanged || (selectedRole?.level === ROLE_LEVELS.ORG_LEADER && !selectedOrgId)}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            변경
          </button>
        </div>
      </div>
    </div>
  );
}      