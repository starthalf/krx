// src/types/period.types.ts
// 기간 라이프사이클 관련 타입 정의

// ─────────────────────────────────────────────────────────────
// 기간 상태
// ─────────────────────────────────────────────────────────────
export type FiscalPeriodStatus = 
  | 'upcoming'   // 예정 (아직 시작 안 됨)
  | 'active'     // 활성 (수립/실행 중)
  | 'closing'    // 마감 진행 중
  | 'closed'     // 마감 완료
  | 'archived';  // 아카이브 (영구 보관)

export type PeriodType = 'year' | 'half' | 'quarter';

export type ContinuityType = 
  | 'carry_over'  // 그대로 이어받음
  | 'evolved'     // 발전/변형됨
  | 'split'       // 하나가 여러 개로 분리
  | 'merged';     // 여러 개가 하나로 통합

// ─────────────────────────────────────────────────────────────
// 기간 마스터 (fiscal_periods)
// ─────────────────────────────────────────────────────────────
export interface FiscalPeriod {
  id: string;
  companyId: string;
  
  // 기간 정보
  periodType: PeriodType;
  periodCode: string;       // '2025', '2025-H1', '2025-Q1'
  periodName: string;       // '2025년', '2025년 상반기'
  parentPeriodId: string | null;
  
  // 날짜
  startsAt: string;
  endsAt: string;
  
  // 상태
  status: FiscalPeriodStatus;
  
  // 마감 정보
  closedAt: string | null;
  closedBy: string | null;
  closeNotes: string | null;
  
  // 강제 마감 정보
  forceClosed: boolean;
  forceCloseReason: string | null;
  forceClosedBy: string | null;
  forceClosedAt: string | null;
  incompleteItems: IncompleteItems | null;
  
  // 메타
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  
  // 계층 관계 (조회 시 join)
  parentPeriod?: FiscalPeriod | null;
  childPeriods?: FiscalPeriod[];
}

// DB Row → FiscalPeriod 변환
export function mapFiscalPeriod(row: any): FiscalPeriod {
  return {
    id: row.id,
    companyId: row.company_id,
    periodType: row.period_type,
    periodCode: row.period_code,
    periodName: row.period_name,
    parentPeriodId: row.parent_period_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    closedAt: row.closed_at,
    closedBy: row.closed_by,
    closeNotes: row.close_notes,
    forceClosed: row.force_closed || false,
    forceCloseReason: row.force_close_reason,
    forceClosedBy: row.force_closed_by,
    forceClosedAt: row.force_closed_at,
    incompleteItems: row.incomplete_items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

// ─────────────────────────────────────────────────────────────
// 미완료 항목
// ─────────────────────────────────────────────────────────────
export interface IncompleteItems {
  incomplete_okr_sets: number;
  incomplete_checkins: number;
}

export interface UnapprovedOkrSet {
  org_id: string;
  org_name: string;
  org_level: string;
  status: string;
  objective_count: number;
}

export interface KrWithoutCheckin {
  kr_id: string;
  kr_name: string;
  objective_name: string;
  org_name: string;
  current_value: number;
  target_value: number;
}

export interface ZeroAchievementOrg {
  org_id: string;
  org_name: string;
  kr_count: number;
}

export interface PeriodIncompleteDetails {
  success: boolean;
  periodCode: string;
  unapprovedOkrSets: UnapprovedOkrSet[];
  krsWithoutCheckin: KrWithoutCheckin[];
  zeroAchievementOrgs: ZeroAchievementOrg[];
}

// ─────────────────────────────────────────────────────────────
// 기간 스냅샷 (period_snapshots)
// ─────────────────────────────────────────────────────────────
export interface GradeDistribution {
  S?: number;
  A?: number;
  B?: number;
  C?: number;
  D?: number;
}

export interface BIIDistribution {
  Build?: number;
  Innovate?: number;
  Improve?: number;
}

export interface PeriodSnapshot {
  id: string;
  fiscalPeriodId: string;
  orgId: string;
  
  // 스냅샷 시점
  snapshotAt: string;
  snapshotBy: string | null;
  
  // 스냅샷 데이터
  objectivesSnapshot: any[];
  krsSnapshot: any[];
  checkinsSnapshot: any[];
  
  // 집계
  totalObjectives: number;
  totalKrs: number;
  totalCheckins: number;
  
  // 달성률
  avgAchievementRate: number;
  weightedAchievementRate: number;
  
  // 분포
  gradeDistribution: GradeDistribution;
  biiDistribution: BIIDistribution;
  statusSummary: Record<string, number>;
  
  createdAt: string;
}

export function mapPeriodSnapshot(row: any): PeriodSnapshot {
  return {
    id: row.id,
    fiscalPeriodId: row.fiscal_period_id,
    orgId: row.org_id,
    snapshotAt: row.snapshot_at,
    snapshotBy: row.snapshot_by,
    objectivesSnapshot: row.objectives_snapshot || [],
    krsSnapshot: row.krs_snapshot || [],
    checkinsSnapshot: row.checkins_snapshot || [],
    totalObjectives: row.total_objectives || 0,
    totalKrs: row.total_krs || 0,
    totalCheckins: row.total_checkins || 0,
    avgAchievementRate: parseFloat(row.avg_achievement_rate) || 0,
    weightedAchievementRate: parseFloat(row.weighted_achievement_rate) || 0,
    gradeDistribution: row.grade_distribution || {},
    biiDistribution: row.bii_distribution || {},
    statusSummary: row.status_summary || {},
    createdAt: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// 전사 기간 요약 (company_period_summary)
// ─────────────────────────────────────────────────────────────
export interface OrgPerformance {
  org_id: string;
  org_name: string;
  rate: number;
}

export interface CompanyPeriodSummary {
  id: string;
  fiscalPeriodId: string;
  companyId: string;
  
  // 집계
  totalOrgs: number;
  totalObjectives: number;
  totalKrs: number;
  
  // 달성률
  companyAvgAchievement: number;
  
  // 랭킹
  topPerformers: OrgPerformance[];
  lowPerformers: OrgPerformance[];
  
  // 분포
  companyGradeDistribution: GradeDistribution;
  companyBiiDistribution: BIIDistribution;
  perspectiveDistribution: Record<string, number>;
  
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// 목표 연속성 (objective_continuity)
// ─────────────────────────────────────────────────────────────
export interface ObjectiveContinuity {
  id: string;
  
  // Source (이전 기간)
  sourceObjectiveId: string | null;
  sourcePeriodId: string;
  sourceObjectiveName: string;
  
  // Target (다음 기간)
  targetObjectiveId: string | null;
  targetPeriodId: string;
  targetObjectiveName: string;
  
  // 연속성 정보
  continuityType: ContinuityType;
  notes: string | null;
  
  createdBy: string | null;
  createdAt: string;
}

export function mapObjectiveContinuity(row: any): ObjectiveContinuity {
  return {
    id: row.id,
    sourceObjectiveId: row.source_objective_id,
    sourcePeriodId: row.source_period_id,
    sourceObjectiveName: row.source_objective_name,
    targetObjectiveId: row.target_objective_id,
    targetPeriodId: row.target_period_id,
    targetObjectiveName: row.target_objective_name,
    continuityType: row.continuity_type,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────
// 마감 로그 (period_close_log)
// ─────────────────────────────────────────────────────────────
export type CloseLogAction = 
  | 'close_initiated'
  | 'close_completed'
  | 'force_close'
  | 'snapshot_created'
  | 'archive_moved'
  | 'reopen';

export interface PeriodCloseLog {
  id: string;
  fiscalPeriodId: string;
  action: CloseLogAction;
  actorId: string;
  actorName: string | null;
  details: any;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// UI용 확장 타입
// ─────────────────────────────────────────────────────────────

// 기간 카드에 표시할 정보
export interface FiscalPeriodWithStats extends FiscalPeriod {
  // 진행 상황
  totalOrgs: number;
  completedOrgs: number;
  
  // 현재 기간 여부
  isCurrent: boolean;
  
  // 하위 기간
  childPeriods?: FiscalPeriodWithStats[];
}

// 마감 위자드 상태
export interface CloseWizardState {
  step: 'review' | 'incomplete' | 'confirm' | 'complete';
  period: FiscalPeriod;
  incompleteDetails: PeriodIncompleteDetails | null;
  forceClose: boolean;
  forceCloseReason: string;
  isProcessing: boolean;
  error: string | null;
}

// Carry-over 선택 UI용
export interface CarryOverCandidate {
  objective: {
    id: string;
    name: string;
    biiType: string;
    status: string;
    achievementRate: number;
  };
  period: {
    id: string;
    code: string;
    name: string;
  };
  krs: {
    id: string;
    name: string;
    achievementRate: number;
  }[];
}

// ─────────────────────────────────────────────────────────────
// 상수 & 설정
// ─────────────────────────────────────────────────────────────
export const PERIOD_STATUS_CONFIG: Record<FiscalPeriodStatus, {
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = {
  upcoming: {
    label: '예정',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    description: '아직 시작되지 않은 기간',
  },
  active: {
    label: '진행 중',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'OKR 수립/실행 중인 기간',
  },
  closing: {
    label: '마감 중',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    description: '마감 프로세스 진행 중',
  },
  closed: {
    label: '마감',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    description: '마감 완료, 스냅샷 생성됨',
  },
  archived: {
    label: '아카이브',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    description: '영구 보관, 읽기 전용',
  },
};

export const CONTINUITY_TYPE_CONFIG: Record<ContinuityType, {
  label: string;
  description: string;
  icon: string;
}> = {
  carry_over: {
    label: '그대로 이어받기',
    description: '동일한 목표를 다음 기간에 계속 추진',
    icon: '➡️',
  },
  evolved: {
    label: '발전/변형',
    description: '기존 목표를 발전시키거나 변형',
    icon: '🔄',
  },
  split: {
    label: '분리',
    description: '하나의 목표를 여러 개로 분리',
    icon: '🔀',
  },
  merged: {
    label: '통합',
    description: '여러 목표를 하나로 통합',
    icon: '🔗',
  },
};

// 기간 타입별 레이블
export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  year: '연도',
  half: '반기',
  quarter: '분기',
};