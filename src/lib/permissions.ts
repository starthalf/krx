// src/lib/permissions.ts
// ============================================
// OKRio 권한 체계 v2 — Level 기반 간소화
// 역할 6개: super_admin(100), ceo(90), company_admin(80), org_leader(70), member(30), viewer(10)
// permissions 테이블 미사용 — 모든 접근 제어는 role.level + org 계층으로 판단
// ============================================

import { supabase } from './supabase';

// ============================================
// 타입 정의
// ============================================

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

// ============================================
// 역할 레벨 상수
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
// 역할 설명 (UI용)
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
// 메뉴 접근 제어
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
  // 메뉴 경로에서 가장 긴 매칭 찾기
  const match = Object.entries(MENU_MIN_LEVELS)
    .filter(([path]) => menu.startsWith(path))
    .sort(([a], [b]) => b.length - a.length)[0];

  return level >= (match ? match[1] : ROLE_LEVELS.MEMBER);
}

// ============================================
// 데이터 접근 범위 제어
// ============================================

/**
 * 특정 조직의 데이터에 접근 가능한지 판단
 * 원칙: 상위 역할은 하위 역할의 모든 권한 포함 (100 ⊃ 90 ⊃ 80 ⊃ 70 ⊃ 30 ⊃ 10)
 */
export function canAccessOrg(
  userLevel: number,
  userOrgId: string | null,
  targetOrgId: string,
  organizations: Array<{ id: string; parentOrgId?: string | null; companyId?: string }>
): boolean {
  // super_admin: 무조건 OK
  if (userLevel >= ROLE_LEVELS.SUPER_ADMIN) return true;

  // ceo + company_admin: 같은 회사면 전부 OK
  if (userLevel >= ROLE_LEVELS.COMPANY_ADMIN) return true;

  // org_leader: 본인 조직 또는 하위 조직
  if (userLevel >= ROLE_LEVELS.ORG_LEADER && userOrgId) {
    return userOrgId === targetOrgId || isDescendant(targetOrgId, userOrgId, organizations);
  }

  // member: 본인 조직만
  if (userLevel >= ROLE_LEVELS.MEMBER) {
    return userOrgId === targetOrgId;
  }

  // viewer: false (별도 공개 로직에서 처리)
  return false;
}

/**
 * 특정 조직의 OKR을 승인할 수 있는지 판단
 */
export function canApproveOrg(
  approverLevel: number,
  approverOrgId: string | null,
  targetOrgId: string,
  organizations: Array<{ id: string; parentOrgId?: string | null }>
): boolean {
  // ceo 이상: 전체 승인 가능
  if (approverLevel >= ROLE_LEVELS.CEO) return true;

  // org_leader: 직속 하위 조직만 승인
  if (approverLevel >= ROLE_LEVELS.ORG_LEADER && approverOrgId) {
    return isDirectChild(targetOrgId, approverOrgId, organizations);
  }

  return false;
}

/**
 * 관리자 기능(조직/사용자/설정) 접근 가능 여부
 * CEO(90)는 company_admin(80)의 모든 권한을 포함
 */
export function canAdmin(userLevel: number): boolean {
  return userLevel >= ROLE_LEVELS.COMPANY_ADMIN; // 80, 90, 100
}

/**
 * 전사 OKR 수립 가능 여부 (CEO 전용)
 */
export function canSetupCompanyOKR(userLevel: number): boolean {
  return userLevel >= ROLE_LEVELS.CEO; // 90, 100
}

/**
 * OKR 수립 위저드 접근 가능 여부
 */
export function canSetupOrgOKR(userLevel: number): boolean {
  return userLevel >= ROLE_LEVELS.ORG_LEADER; // 70, 80, 90, 100
}

/**
 * KPI Pool 편집 가능 여부
 */
export function canEditKPIPool(userLevel: number): boolean {
  return userLevel >= ROLE_LEVELS.COMPANY_ADMIN; // 80, 90, 100
}

// ============================================
// 조직 계층 유틸리티
// ============================================

/**
 * targetOrgId가 ancestorOrgId의 하위(자손) 조직인지 판단
 */
export function isDescendant(
  targetOrgId: string,
  ancestorOrgId: string,
  organizations: Array<{ id: string; parentOrgId?: string | null }>
): boolean {
  let current = organizations.find(o => o.id === targetOrgId);
  const visited = new Set<string>();

  while (current?.parentOrgId) {
    if (visited.has(current.id)) break; // 순환 방지
    visited.add(current.id);

    if (current.parentOrgId === ancestorOrgId) return true;
    current = organizations.find(o => o.id === current!.parentOrgId);
  }

  return false;
}

/**
 * targetOrgId가 parentOrgId의 직속 하위인지 판단
 */
export function isDirectChild(
  targetOrgId: string,
  parentOrgId: string,
  organizations: Array<{ id: string; parentOrgId?: string | null }>
): boolean {
  const target = organizations.find(o => o.id === targetOrgId);
  return target?.parentOrgId === parentOrgId;
}

// ============================================
// 역할 관리 (DB 연동)
// ============================================

export async function getAllRoles(): Promise<Role[]> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('level', { ascending: false });

  if (error) throw error;
  return data as Role[];
}

export async function getRoleById(roleId: string): Promise<Role> {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .single();

  if (error) throw error;
  return data as Role;
}

// ============================================
// 사용자 역할 관리
// ============================================

export async function getUserRoles(profileId: string): Promise<UserRole[]> {
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

export async function assignRole(
  profileId: string,
  roleId: string,
  orgId?: string
): Promise<UserRole> {
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

export async function revokeRole(userRoleId: string): Promise<void> {
  const { error } = await supabase
    .from('user_roles')
    .delete()
    .eq('id', userRoleId);

  if (error) throw error;
}

/**
 * 현재 사용자의 최고 역할 레벨 가져오기
 */
export async function getMyRoleLevel(orgId?: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_my_role_level', {
    target_org_id: orgId || null
  });

  if (error) {
    console.error('Get role level error:', error);
    return 0;
  }

  return data || 0;
}

/**
 * 역할 할당 시 허용 가능한 역할 목록 필터링
 * 원칙: 자기보다 낮은 레벨만 할당 가능 (CEO는 company_admin 이하)
 */
export function getAssignableRoles(roles: Role[], myLevel: number): Role[] {
  if (myLevel >= ROLE_LEVELS.SUPER_ADMIN) return roles; // super_admin: 전부
  if (myLevel >= ROLE_LEVELS.CEO) return roles.filter(r => r.level <= ROLE_LEVELS.COMPANY_ADMIN);
  if (myLevel >= ROLE_LEVELS.COMPANY_ADMIN) return roles.filter(r => r.level <= ROLE_LEVELS.ORG_LEADER);
  return roles.filter(r => r.level < myLevel);
}

// ============================================
// 조직 계층 템플릿 관리
// ============================================

export async function getOrgLevelTemplate(companyId: string): Promise<OrgLevelTemplate[]> {
  const { data, error } = await supabase
    .from('org_level_templates')
    .select('*')
    .eq('company_id', companyId)
    .order('level_order');

  if (error) throw error;
  return data as OrgLevelTemplate[];
}

export async function saveOrgLevelTemplate(
  companyId: string,
  levels: Array<{
    level_order: number;
    level_name: string;
    level_code: string;
    is_required: boolean;
  }>
): Promise<OrgLevelTemplate[]> {
  const { error: deleteError } = await supabase
    .from('org_level_templates')
    .delete()
    .eq('company_id', companyId);

  if (deleteError) throw deleteError;

  const { data, error } = await supabase
    .from('org_level_templates')
    .insert(levels.map(l => ({ ...l, company_id: companyId })))
    .select();

  if (error) throw error;
  return data as OrgLevelTemplate[];
}

export async function createDefaultOrgTemplate(companyId: string): Promise<OrgLevelTemplate[]> {
  const defaultLevels = [
    { level_order: 1, level_name: '전사', level_code: 'COMPANY', is_required: true },
    { level_order: 2, level_name: '본부', level_code: 'DIVISION', is_required: true },
    { level_order: 3, level_name: '팀', level_code: 'TEAM', is_required: true },
    { level_order: 4, level_name: '개인', level_code: 'INDIVIDUAL', is_required: true },
  ];

  return saveOrgLevelTemplate(companyId, defaultLevels);
}

// ============================================
// 편의 함수
// ============================================

export function getRoleLevelName(level: number): string {
  if (level >= 100) return 'super_admin';
  if (level >= 90) return 'ceo';
  if (level >= 80) return 'company_admin';
  if (level >= 70) return 'org_leader';
  if (level >= 30) return 'member';
  return 'viewer';
}