// src/lib/period-api.ts
// 기간 라이프사이클 관련 API 함수

import { supabase } from './supabase';
import {
  FiscalPeriod,
  FiscalPeriodStatus,
  PeriodSnapshot,
  ObjectiveContinuity,
  PeriodIncompleteDetails,
  CompanyPeriodSummary,
  mapFiscalPeriod,
  mapPeriodSnapshot,
  mapObjectiveContinuity,
  ContinuityType,
} from '../types/period.types';

// ─────────────────────────────────────────────────────────────
// 기간 CRUD
// ─────────────────────────────────────────────────────────────

/**
 * 회사의 모든 기간 조회
 */
export async function fetchFiscalPeriods(companyId: string): Promise<FiscalPeriod[]> {
  const { data, error } = await supabase
    .from('fiscal_periods')
    .select('*')
    .eq('company_id', companyId)
    .order('starts_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapFiscalPeriod);
}

/**
 * 특정 기간 조회
 */
export async function fetchFiscalPeriod(periodId: string): Promise<FiscalPeriod | null> {
  const { data, error } = await supabase
    .from('fiscal_periods')
    .select('*')
    .eq('id', periodId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapFiscalPeriod(data);
}

/**
 * 활성 기간 조회 (현재 active 상태인 기간)
 */
export async function fetchActivePeriod(
  companyId: string,
  periodType?: 'year' | 'half' | 'quarter'
): Promise<FiscalPeriod | null> {
  let query = supabase
    .from('fiscal_periods')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'active');

  if (periodType) {
    query = query.eq('period_type', periodType);
  }

  const { data, error } = await query.order('starts_at', { ascending: false }).limit(1).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapFiscalPeriod(data);
}

/**
 * 연도별 기간 계층 조회 (연도 → 반기 → 분기)
 */
export async function fetchPeriodHierarchy(
  companyId: string,
  year: number
): Promise<FiscalPeriod | null> {
  const { data, error } = await supabase
    .from('fiscal_periods')
    .select('*')
    .eq('company_id', companyId)
    .eq('period_type', 'year')
    .eq('period_code', year.toString())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  const yearPeriod = mapFiscalPeriod(data);

  // 하위 기간 (반기) 조회
  const { data: halfData } = await supabase
    .from('fiscal_periods')
    .select('*')
    .eq('parent_period_id', yearPeriod.id)
    .order('starts_at');

  const halfPeriods = (halfData || []).map(mapFiscalPeriod);

  // 각 반기의 분기 조회
  for (const half of halfPeriods) {
    const { data: quarterData } = await supabase
      .from('fiscal_periods')
      .select('*')
      .eq('parent_period_id', half.id)
      .order('starts_at');

    half.childPeriods = (quarterData || []).map(mapFiscalPeriod);
  }

  yearPeriod.childPeriods = halfPeriods;
  return yearPeriod;
}

/**
 * 연도 기간 생성 (연도 + 반기 + 분기 자동 생성)
 */
export async function createFiscalYear(
  companyId: string,
  year: number,
  createdBy: string
): Promise<{ success: boolean; yearId?: string; error?: string }> {
  const { data, error } = await supabase.rpc('create_fiscal_year', {
    p_company_id: companyId,
    p_year: year,
    p_created_by: createdBy,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: data?.success || false,
    yearId: data?.year_id,
    error: data?.error,
  };
}

// ─────────────────────────────────────────────────────────────
// 기간 상태 전환
// ─────────────────────────────────────────────────────────────

/**
 * 기간 상태 전환
 */
export async function transitionPeriodStatus(
  periodId: string,
  newStatus: FiscalPeriodStatus,
  actorId: string,
  options?: {
    force?: boolean;
    forceReason?: string;
  }
): Promise<{ success: boolean; error?: string; incompleteItems?: any }> {
  const { data, error } = await supabase.rpc('transition_fiscal_period', {
    p_period_id: periodId,
    p_new_status: newStatus,
    p_actor_id: actorId,
    p_force: options?.force || false,
    p_force_reason: options?.forceReason || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: data?.success || false,
    error: data?.error,
    incompleteItems: data?.incomplete_items,
  };
}

/**
 * 기간 활성화 (upcoming → active)
 */
export async function activatePeriod(
  periodId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  return transitionPeriodStatus(periodId, 'active', actorId);
}

/**
 * 마감 시작 (active → closing)
 */
export async function startClosing(
  periodId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  return transitionPeriodStatus(periodId, 'closing', actorId);
}

/**
 * 마감 완료 (closing → closed)
 */
export async function closePeriod(
  periodId: string,
  actorId: string,
  options?: {
    force?: boolean;
    forceReason?: string;
  }
): Promise<{ success: boolean; error?: string; incompleteItems?: any }> {
  return transitionPeriodStatus(periodId, 'closed', actorId, options);
}

/**
 * 강제 마감
 */
export async function forceClosePeriod(
  periodId: string,
  actorId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  return transitionPeriodStatus(periodId, 'closed', actorId, {
    force: true,
    forceReason: reason,
  });
}

/**
 * 아카이브 (closed → archived)
 */
export async function archivePeriod(
  periodId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  return transitionPeriodStatus(periodId, 'archived', actorId);
}

/**
 * 마감 취소 (closing → active)
 */
export async function cancelClosing(
  periodId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  return transitionPeriodStatus(periodId, 'active', actorId);
}

// ─────────────────────────────────────────────────────────────
// 마감 관련
// ─────────────────────────────────────────────────────────────

/**
 * 미완료 항목 조회
 */
export async function fetchIncompleteItems(
  periodId: string
): Promise<PeriodIncompleteDetails | null> {
  const { data, error } = await supabase.rpc('get_period_incomplete_items', {
    p_period_id: periodId,
  });

  if (error) {
    console.error('미완료 항목 조회 실패:', error);
    return null;
  }

  if (!data?.success) return null;

  return {
    success: true,
    periodCode: data.period_code,
    unapprovedOkrSets: data.unapproved_okr_sets || [],
    krsWithoutCheckin: data.krs_without_checkin || [],
    zeroAchievementOrgs: data.zero_achievement_orgs || [],
  };
}

/**
 * 스냅샷 생성
 */
export async function createPeriodSnapshot(
  periodId: string,
  actorId: string
): Promise<{ success: boolean; snapshotCount?: number; error?: string }> {
  const { data, error } = await supabase.rpc('create_period_snapshot', {
    p_period_id: periodId,
    p_actor_id: actorId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: data?.success || false,
    snapshotCount: data?.snapshot_count,
    error: data?.error,
  };
}

/**
 * 기간의 스냅샷 목록 조회
 */
export async function fetchPeriodSnapshots(periodId: string): Promise<PeriodSnapshot[]> {
  const { data, error } = await supabase
    .from('period_snapshots')
    .select(`
      *,
      organizations!inner(id, name, level)
    `)
    .eq('fiscal_period_id', periodId)
    .order('org_id');

  if (error) throw error;
  return (data || []).map(mapPeriodSnapshot);
}

/**
 * 특정 조직의 스냅샷 조회
 */
export async function fetchOrgSnapshot(
  periodId: string,
  orgId: string
): Promise<PeriodSnapshot | null> {
  const { data, error } = await supabase
    .from('period_snapshots')
    .select('*')
    .eq('fiscal_period_id', periodId)
    .eq('org_id', orgId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapPeriodSnapshot(data);
}

/**
 * 전사 기간 요약 조회
 */
export async function fetchCompanyPeriodSummary(
  periodId: string,
  companyId: string
): Promise<CompanyPeriodSummary | null> {
  const { data, error } = await supabase
    .from('company_period_summary')
    .select('*')
    .eq('fiscal_period_id', periodId)
    .eq('company_id', companyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return {
    id: data.id,
    fiscalPeriodId: data.fiscal_period_id,
    companyId: data.company_id,
    totalOrgs: data.total_orgs || 0,
    totalObjectives: data.total_objectives || 0,
    totalKrs: data.total_krs || 0,
    companyAvgAchievement: parseFloat(data.company_avg_achievement) || 0,
    topPerformers: data.top_performers || [],
    lowPerformers: data.low_performers || [],
    companyGradeDistribution: data.company_grade_distribution || {},
    companyBiiDistribution: data.company_bii_distribution || {},
    perspectiveDistribution: data.perspective_distribution || {},
    createdAt: data.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// Carry-over (목표 연속성)
// ─────────────────────────────────────────────────────────────

/**
 * Carry-over 생성
 */
export async function createCarryOver(
  sourceObjectiveId: string,
  targetObjectiveId: string,
  continuityType: ContinuityType,
  notes: string,
  createdBy: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('create_objective_carryover', {
    p_source_objective_id: sourceObjectiveId,
    p_target_objective_id: targetObjectiveId,
    p_continuity_type: continuityType,
    p_notes: notes,
    p_created_by: createdBy,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return {
    success: data?.success || false,
    error: data?.error,
  };
}

/**
 * 목표의 연속성 이력 조회
 */
export async function fetchObjectiveContinuity(
  objectiveId: string
): Promise<ObjectiveContinuity[]> {
  const { data, error } = await supabase
    .from('objective_continuity')
    .select('*')
    .or(`source_objective_id.eq.${objectiveId},target_objective_id.eq.${objectiveId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapObjectiveContinuity);
}

/**
 * 이전 기간 목표 목록 조회 (Carry-over 후보)
 */
export async function fetchCarryOverCandidates(
  companyId: string,
  previousPeriodCode: string,
  orgId?: string
) {
  let query = supabase
    .from('objectives')
    .select(`
      id, name, bii_type, status, period,
      organizations!inner(id, name, company_id),
      key_results(id, name, current_value, target_value)
    `)
    .eq('organizations.company_id', companyId)
    .eq('period', previousPeriodCode);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query.order('name');

  if (error) throw error;

  return (data || []).map((obj: any) => ({
    objective: {
      id: obj.id,
      name: obj.name,
      biiType: obj.bii_type,
      status: obj.status,
      achievementRate: calculateAchievementRate(obj.key_results),
    },
    period: {
      code: obj.period,
    },
    krs: (obj.key_results || []).map((kr: any) => ({
      id: kr.id,
      name: kr.name,
      achievementRate: kr.target_value > 0 
        ? Math.round((kr.current_value / kr.target_value) * 100) 
        : 0,
    })),
  }));
}

function calculateAchievementRate(krs: any[]): number {
  if (!krs || krs.length === 0) return 0;
  const total = krs.reduce((sum, kr) => {
    if (kr.target_value > 0) {
      return sum + (kr.current_value / kr.target_value) * 100;
    }
    return sum;
  }, 0);
  return Math.round(total / krs.length);
}

// ─────────────────────────────────────────────────────────────
// 히스토리/아카이브 조회
// ─────────────────────────────────────────────────────────────

/**
 * 아카이브된 기간 목록 조회
 */
export async function fetchArchivedPeriods(companyId: string): Promise<FiscalPeriod[]> {
  const { data, error } = await supabase
    .from('fiscal_periods')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['closed', 'archived'])
    .order('ends_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapFiscalPeriod);
}

/**
 * 마감 로그 조회
 */
export async function fetchPeriodCloseLogs(periodId: string) {
  const { data, error } = await supabase
    .from('period_close_log')
    .select(`
      *,
      profiles!actor_id(full_name)
    `)
    .eq('fiscal_period_id', periodId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((log: any) => ({
    id: log.id,
    fiscalPeriodId: log.fiscal_period_id,
    action: log.action,
    actorId: log.actor_id,
    actorName: log.profiles?.full_name || log.actor_name,
    details: log.details,
    createdAt: log.created_at,
  }));
}

// ─────────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────────

/**
 * period_code로 기간 조회
 */
export async function fetchPeriodByCode(
  companyId: string,
  periodCode: string
): Promise<FiscalPeriod | null> {
  const { data, error } = await supabase
    .from('fiscal_periods')
    .select('*')
    .eq('company_id', companyId)
    .eq('period_code', periodCode)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return mapFiscalPeriod(data);
}

/**
 * 기간 코드 생성 헬퍼
 */
export function generatePeriodCode(
  year: number,
  type: 'year' | 'half' | 'quarter',
  index?: number
): string {
  switch (type) {
    case 'year':
      return `${year}`;
    case 'half':
      return `${year}-H${index}`;
    case 'quarter':
      return `${year}-Q${index}`;
    default:
      return `${year}`;
  }
}

/**
 * 기존 period 문자열 → fiscal_period_id 매핑
 * (마이그레이션용)
 */
export async function migratePeriodToFiscalPeriod(
  companyId: string,
  periodCode: string
): Promise<string | null> {
  const period = await fetchPeriodByCode(companyId, periodCode);
  return period?.id || null;
}