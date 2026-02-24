// src/lib/permissions.ts
import { supabase } from './supabase';

// ============================================
// 타입 정의
// ============================================

export interface OrgLevelTemplate {
  id: string;
  company_id: string;
  level_order: number;
  level_name: string;
  level_code: string;
  is_required: boolean;
  default_role_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  level: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  profile_id: string;
  role_id: string;
  org_id?: string;
  granted_at: string;
  granted_by?: string;
  role?: Role;
  organization?: any;
}

export interface UserCustomPermission {
  id: string;
  profile_id: string;
  permission_id: string;
  org_id?: string;
  granted_by?: string;
  granted_at: string;
  expires_at?: string;
  reason?: string;
  permission?: Permission;
  organization?: any;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  permission?: Permission;
}

// ============================================
// 조직 계층 템플릿 관리
// ============================================

/**
 * 회사의 조직 계층 템플릿 가져오기
 */
export async function getOrgLevelTemplate(companyId: string) {
  const { data, error } = await supabase
    .from('org_level_templates')
    .select('*')
    .eq('company_id', companyId)
    .order('level_order');

  if (error) throw error;
  return data as OrgLevelTemplate[];
}

/**
 * 조직 계층 템플릿 저장/수정
 */
export async function saveOrgLevelTemplate(
  companyId: string,
  levels: Array<{
    level_order: number;
    level_name: string;
    level_code: string;
    is_required: boolean;
  }>
) {
  // 기존 템플릿 삭제
  const { error: deleteError } = await supabase
    .from('org_level_templates')
    .delete()
    .eq('company_id', companyId);

  if (deleteError) throw deleteError;

  // 새 템플릿 삽입
  const { data, error } = await supabase
    .from('org_level_templates')
    .insert(levels.map(l => ({ ...l, company_id: companyId })))
    .select();

  if (error) throw error;
  return data as OrgLevelTemplate[];
}

/**
 * 기본 조직 계층 템플릿 생성 (4단계 구조)
 */
export async function createDefaultOrgTemplate(companyId: string) {
  const defaultLevels = [
    { level_order: 1, level_name: '전사', level_code: 'COMPANY', is_required: true },
    { level_order: 2, level_name: '본부', level_code: 'DIVISION', is_required: true },
    { level_order: 3, level_name: '팀', level_code: 'TEAM', is_required: true },
    { level_order: 4, level_name: '개인', level_code: 'INDIVIDUAL', is_required: true },
  ];

  return saveOrgLevelTemplate(companyId, defaultLevels);
}

// ============================================
// 역할 관리
// ============================================

/**
 * 모든 역할 가져오기
 */
export async function getAllRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('level', { ascending: false });

  if (error) throw error;
  return data as Role[];
}

/**
 * 특정 역할 가져오기
 */
export async function getRoleById(roleId: string) {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .single();

  if (error) throw error;
  return data as Role;
}

/**
 * 역할 생성
 */
export async function createRole(role: {
  name: string;
  display_name: string;
  description?: string;
  level: number;
}) {
  const { data, error } = await supabase
    .from('roles')
    .insert({ ...role, is_system: false })
    .select()
    .single();

  if (error) throw error;
  return data as Role;
}

/**
 * 역할 수정
 */
export async function updateRole(roleId: string, updates: Partial<Role>) {
  const { data, error } = await supabase
    .from('roles')
    .update(updates)
    .eq('id', roleId)
    .select()
    .single();

  if (error) throw error;
  return data as Role;
}

/**
 * 역할 삭제 (시스템 역할은 삭제 불가)
 */
export async function deleteRole(roleId: string) {
  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', roleId)
    .eq('is_system', false); // 시스템 역할은 삭제 불가

  if (error) throw error;
}

// ============================================
// 권한 관리
// ============================================

/**
 * 모든 권한 가져오기 (카테고리별 그룹화)
 */
export async function getAllPermissions() {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('category, code');

  if (error) throw error;

  // 카테고리별로 그룹화
  const grouped = (data as Permission[]).reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return grouped;
}

/**
 * 특정 카테고리의 권한 가져오기
 */
export async function getPermissionsByCategory(category: string) {
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .eq('category', category)
    .order('code');

  if (error) throw error;
  return data as Permission[];
}

// ============================================
// 역할-권한 매핑 관리
// ============================================

/**
 * 특정 역할의 권한 가져오기
 */
export async function getRolePermissions(roleId: string) {
  const { data, error } = await supabase
    .from('role_permissions')
    .select(`
      *,
      permission:permissions(*)
    `)
    .eq('role_id', roleId);

  if (error) throw error;
  return data as RolePermission[];
}

/**
 * 역할에 권한 추가/제거 (전체 교체 방식)
 */
export async function updateRolePermissions(
  roleId: string,
  permissionIds: string[]
) {
  // 기존 권한 삭제
  const { error: deleteError } = await supabase
    .from('role_permissions')
    .delete()
    .eq('role_id', roleId);

  if (deleteError) throw deleteError;

  // 새 권한이 있으면 추가
  if (permissionIds.length > 0) {
    const { error: insertError } = await supabase
      .from('role_permissions')
      .insert(permissionIds.map(pid => ({
        role_id: roleId,
        permission_id: pid
      })));

    if (insertError) throw insertError;
  }
}

// ============================================
// 사용자 역할 관리
// ============================================

/**
 * 사용자의 모든 역할 가져오기
 */
export async function getUserRoles(profileId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      *,
      role:roles(*),
      organization:organizations(id, name, level_code)
    `)
    .eq('profile_id', profileId);

  if (error) throw error;
  return data as UserRole[];
}

/**
 * 사용자에게 역할 할당
 */
export async function assignRole(
  profileId: string,
  roleId: string,
  orgId?: string
) {
  const { data: currentUser } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('user_roles')
    .insert({
      profile_id: profileId,
      role_id: roleId,
      org_id: orgId,
      granted_by: currentUser?.user?.id
    })
    .select()
    .single();

  if (error) throw error;
  return data as UserRole;
}

/**
 * 사용자의 역할 해제
 */
export async function revokeRole(userRoleId: string) {
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('id', userRoleId);

  if (error) throw error;
}

/**
 * 사용자의 특정 조직에서의 역할 변경
 */
export async function updateUserRoleInOrg(
  profileId: string,
  orgId: string,
  newRoleId: string
) {
  // 기존 역할 삭제
  await supabase
    .from('user_roles')
    .delete()
    .eq('profile_id', profileId)
    .eq('org_id', orgId);

  // 새 역할 할당
  return assignRole(profileId, newRoleId, orgId);
}

// ============================================
// 사용자 커스텀 권한 관리
// ============================================

/**
 * 사용자의 커스텀 권한 가져오기
 */
export async function getUserCustomPermissions(profileId: string) {
  const { data, error } = await supabase
    .from('user_custom_permissions')
    .select(`
      *,
      permission:permissions(*),
      organization:organizations(id, name)
    `)
    .eq('profile_id', profileId)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

  if (error) throw error;
  return data as UserCustomPermission[];
}

/**
 * 사용자에게 커스텀 권한 부여
 */
export async function grantCustomPermission(
  profileId: string,
  permissionId: string,
  options?: {
    orgId?: string;
    expiresAt?: string;
    reason?: string;
  }
) {
  const { data: currentUser } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('user_custom_permissions')
    .insert({
      profile_id: profileId,
      permission_id: permissionId,
      org_id: options?.orgId,
      expires_at: options?.expiresAt,
      reason: options?.reason,
      granted_by: currentUser?.user?.id
    })
    .select()
    .single();

  if (error) throw error;
  return data as UserCustomPermission;
}

/**
 * 사용자의 커스텀 권한 해제
 */
export async function revokeCustomPermission(customPermissionId: string) {
  const { error } = await supabase
    .from('user_custom_permissions')
    .delete()
    .eq('id', customPermissionId);

  if (error) throw error;
}

// ============================================
// 사용자 권한 조회 (통합)
// ============================================

/**
 * 사용자의 모든 권한 조회 (역할 + 커스텀)
 */
export async function getUserAllPermissions(profileId: string) {
  // 역할 기반 권한
  const { data: rolePerms } = await supabase
    .from('user_roles')
    .select(`
      org_id,
      role:roles(name, display_name, level),
      role_id
    `)
    .eq('profile_id', profileId);

  // 각 역할의 권한 가져오기
  const rolePermissions = await Promise.all(
    (rolePerms || []).map(async (ur) => {
      const perms = await getRolePermissions(ur.role_id);
      return {
        ...ur,
        permissions: perms
      };
    })
  );

  // 커스텀 권한
  const customPerms = await getUserCustomPermissions(profileId);

  return {
    rolePermissions,
    customPermissions: customPerms
  };
}

/**
 * 현재 사용자가 특정 권한을 가지고 있는지 확인 (클라이언트 측)
 */
export async function checkPermission(
  permissionCode: string,
  orgId?: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc('has_permission', {
    user_id: user.id,
    permission_code: permissionCode,
    target_org_id: orgId
  });

  if (error) {
    console.error('Permission check error:', error);
    return false;
  }

  return data === true;
}

/**
 * 현재 사용자가 특정 조직을 관리할 수 있는지 확인
 */
export async function checkCanManageOrg(orgId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_manage_org', {
    target_org_id: orgId
  });

  if (error) {
    console.error('Can manage org check error:', error);
    return false;
  }

  return data === true;
}

/**
 * 현재 사용자의 역할 레벨 가져오기
 */
export async function getMyRoleLevel(orgId?: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_my_role_level', {
    target_org_id: orgId
  });

  if (error) {
    console.error('Get role level error:', error);
    return 0;
  }

  return data || 0;
}

// ============================================
// 역할 레벨 상수 (v2)
// ============================================

export const ROLE_LEVELS = {
  SUPER_ADMIN: 100,
  CEO: 90,
  COMPANY_ADMIN: 80,
  ORG_LEADER: 70,
  MEMBER: 30,
  VIEWER: 10,
} as const;

// ============================================
// 역할 설명 (UI용, v2)
// ============================================

export const ROLE_DESCRIPTIONS: Record<number, {
  summary: string;
  capabilities: string[];
  color: string;
  bgColor: string;
}> = {
  100: {
    summary: '플랫폼 전체를 관리합니다',
    capabilities: ['모든 회사 관리', '시스템 설정'],
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  90: {
    summary: '전사 OKR을 수립하고 최종 승인합니다',
    capabilities: ['전사 OKR 수립/확정', '초안 배포', '사이클 관리', '최종 승인', '전사 대시보드', '시스템 설정'],
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
  },
  80: {
    summary: '조직구조·사용자·시스템을 관리합니다',
    capabilities: ['조직 관리', '사용자 초대/역할', '기간 설정', 'KPI Pool', '시스템 설정'],
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 border-orange-200',
  },
  70: {
    summary: '담당 조직의 OKR을 수립하고 하위 조직을 관리합니다',
    capabilities: ['조직 OKR 수립/제출', '하위 OKR 승인/반려', '체크인 관리/독촉', '성과 대시보드'],
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  30: {
    summary: '개인 OKR을 수립하고 체크인합니다',
    capabilities: ['개인 OKR 입력', '실적 체크인', '피드백 작성/수신'],
    color: 'text-green-700',
    bgColor: 'bg-green-50 border-green-200',
  },
  10: {
    summary: '성과 데이터를 조회만 할 수 있습니다',
    capabilities: ['대시보드 조회', '공개 OKR 열람'],
    color: 'text-slate-600',
    bgColor: 'bg-slate-50 border-slate-200',
  },
};

export function getRoleInfo(level: number) {
  if (ROLE_DESCRIPTIONS[level]) return ROLE_DESCRIPTIONS[level];
  const keys = Object.keys(ROLE_DESCRIPTIONS).map(Number).sort((a, b) => b - a);
  for (const k of keys) {
    if (level >= k) return ROLE_DESCRIPTIONS[k];
  }
  return ROLE_DESCRIPTIONS[10];
}

// ============================================
// 메뉴 접근 제어 (v2)
// ============================================

const MENU_MIN_LEVELS: Record<string, number> = {
  '/ceo-okr-setup': ROLE_LEVELS.CEO,
  '/wizard': ROLE_LEVELS.ORG_LEADER,
  '/okr-map': ROLE_LEVELS.ORG_LEADER,
  '/okr-setup': ROLE_LEVELS.ORG_LEADER,
  '/approval-inbox': ROLE_LEVELS.ORG_LEADER,
  '/admin': ROLE_LEVELS.COMPANY_ADMIN,
  '/checkin': ROLE_LEVELS.MEMBER,
  '/notifications': ROLE_LEVELS.MEMBER,
  '/kpi-pool': ROLE_LEVELS.ORG_LEADER,
};

export function canAccessMenu(level: number, menu: string): boolean {
  const match = Object.entries(MENU_MIN_LEVELS)
    .filter(([path]) => menu.startsWith(path))
    .sort(([a], [b]) => b.length - a.length)[0];
  return level >= (match ? match[1] : ROLE_LEVELS.MEMBER);
}

// ============================================
// 데이터 접근 범위 제어 (v2)
// ============================================

export function canAccessOrg(
  userLevel: number,
  userOrgId: string | null,
  targetOrgId: string,
  organizations: Array<{ id: string; parentOrgId?: string | null }>
): boolean {
  if (userLevel >= ROLE_LEVELS.SUPER_ADMIN) return true;
  if (userLevel >= ROLE_LEVELS.COMPANY_ADMIN) return true;
  if (userLevel >= ROLE_LEVELS.ORG_LEADER && userOrgId) {
    return userOrgId === targetOrgId || isDescendant(targetOrgId, userOrgId, organizations);
  }
  if (userLevel >= ROLE_LEVELS.MEMBER) return userOrgId === targetOrgId;
  return false;
}

export function canApproveOrg(
  approverLevel: number,
  approverOrgId: string | null,
  targetOrgId: string,
  organizations: Array<{ id: string; parentOrgId?: string | null }>
): boolean {
  if (approverLevel >= ROLE_LEVELS.CEO) return true;
  if (approverLevel >= ROLE_LEVELS.ORG_LEADER && approverOrgId) {
    return isDirectChild(targetOrgId, approverOrgId, organizations);
  }
  return false;
}

export function canAdmin(userLevel: number): boolean {
  return userLevel >= ROLE_LEVELS.COMPANY_ADMIN;
}

export function canSetupCompanyOKR(userLevel: number): boolean {
  return userLevel >= ROLE_LEVELS.CEO;
}

export function canSetupOrgOKR(userLevel: number): boolean {
  return userLevel >= ROLE_LEVELS.ORG_LEADER;
}

export function canEditKPIPool(userLevel: number): boolean {
  return userLevel >= ROLE_LEVELS.COMPANY_ADMIN;
}

// ============================================
// 조직 계층 유틸리티
// ============================================

export function isDescendant(
  targetOrgId: string,
  ancestorOrgId: string,
  organizations: Array<{ id: string; parentOrgId?: string | null }>
): boolean {
  let current = organizations.find(o => o.id === targetOrgId);
  const visited = new Set<string>();
  while (current?.parentOrgId) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    if (current.parentOrgId === ancestorOrgId) return true;
    current = organizations.find(o => o.id === current!.parentOrgId);
  }
  return false;
}

export function isDirectChild(
  targetOrgId: string,
  parentOrgId: string,
  organizations: Array<{ id: string; parentOrgId?: string | null }>
): boolean {
  const target = organizations.find(o => o.id === targetOrgId);
  return target?.parentOrgId === parentOrgId;
}

// ============================================
// 역할 할당 유틸 (v2)
// ============================================

export function getAssignableRoles(roles: Role[], myLevel: number): Role[] {
  if (myLevel >= ROLE_LEVELS.SUPER_ADMIN) return roles; // 전부
  if (myLevel >= ROLE_LEVELS.CEO) return roles.filter(r => r.level <= ROLE_LEVELS.CEO); // CEO까지 (다른 사람에게 CEO 부여 가능)
  if (myLevel >= ROLE_LEVELS.COMPANY_ADMIN) return roles.filter(r => r.level <= ROLE_LEVELS.ORG_LEADER); // 조직장까지
  return roles.filter(r => r.level < myLevel);
}

// ============================================
// 편의 함수들
// ============================================

/**
 * 권한 코드로 권한 이름 가져오기
 */
export function getPermissionName(
  permissions: Record<string, Permission[]>,
  code: string
): string {
  for (const category in permissions) {
    const perm = permissions[category].find(p => p.code === code);
    if (perm) return perm.name;
  }
  return code;
}

/**
 * 역할 레벨로 역할 이름 가져오기 (v2 업데이트)
 */
export function getRoleLevelName(level: number): string {
  if (level >= 100) return 'super_admin';
  if (level >= 90) return 'ceo';
  if (level >= 80) return 'company_admin';
  if (level >= 70) return 'org_leader';
  if (level >= 30) return 'member';
  return 'viewer';
}

/**
 * 권한이 만료되었는지 확인
 */
export function isPermissionExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}