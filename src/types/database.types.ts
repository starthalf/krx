// ============================================================
// database.types.ts에 추가할 타입 정의
// okr_planning_cycles 관련
// ============================================================

// --- 테이블 타입 (database.types.ts의 Tables에 추가) ---

/*
okr_planning_cycles: {
  Row: {
    id: string
    company_id: string
    period: string
    title: string
    status: 'planning' | 'in_progress' | 'closed' | 'finalized'
    starts_at: string
    deadline_at: string
    grace_period_at: string | null
    company_okr_finalized: boolean
    company_okr_finalized_at: string | null
    message: string | null
    target_org_levels: string[] | null
    auto_remind_days: number[]
    last_auto_remind_at: string | null
    created_by: string | null
    created_at: string
    updated_at: string
  }
  Insert: {
    id?: string
    company_id: string
    period: string
    title: string
    status?: 'planning' | 'in_progress' | 'closed' | 'finalized'
    starts_at: string
    deadline_at: string
    grace_period_at?: string | null
    company_okr_finalized?: boolean
    message?: string | null
    target_org_levels?: string[] | null
    auto_remind_days?: number[]
    created_by?: string | null
  }
  Update: {
    period?: string
    title?: string
    status?: 'planning' | 'in_progress' | 'closed' | 'finalized'
    starts_at?: string
    deadline_at?: string
    grace_period_at?: string | null
    company_okr_finalized?: boolean
    company_okr_finalized_at?: string | null
    message?: string | null
    target_org_levels?: string[] | null
    auto_remind_days?: number[]
  }
}
*/


// --- 프론트엔드에서 사용할 인터페이스 ---

export interface PlanningCycle {
  id: string;
  companyId: string;
  period: string;
  title: string;
  status: 'planning' | 'in_progress' | 'closed' | 'finalized';
  startsAt: string;
  deadlineAt: string;
  gracePeriodAt: string | null;
  companyOkrFinalized: boolean;
  companyOkrFinalizedAt: string | null;
  message: string | null;
  targetOrgLevels: string[] | null;
  autoRemindDays: number[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CycleBannerInfo {
  cycleId: string;
  period: string;
  title: string;
  status: string;
  deadlineAt: string;
  daysRemaining: number;
  isOverdue: boolean;
  totalOrgs: number;
  submittedOrgs: number;
  approvedOrgs: number;
  completionPct: number;
}

export interface CycleOrgStatus {
  orgId: string;
  orgName: string;
  orgLevel: string;
  okrSetStatus: string;
  objectiveCount: number;
  krCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  headProfileId: string | null;
  headName: string | null;
}

// --- DB → 프론트 변환 헬퍼 ---

export function mapPlanningCycle(row: any): PlanningCycle {
  return {
    id: row.id,
    companyId: row.company_id,
    period: row.period,
    title: row.title,
    status: row.status,
    startsAt: row.starts_at,
    deadlineAt: row.deadline_at,
    gracePeriodAt: row.grace_period_at,
    companyOkrFinalized: row.company_okr_finalized,
    companyOkrFinalizedAt: row.company_okr_finalized_at,
    message: row.message,
    targetOrgLevels: row.target_org_levels,
    autoRemindDays: row.auto_remind_days || [7, 3, 1],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapCycleBannerInfo(row: any): CycleBannerInfo {
  return {
    cycleId: row.cycle_id,
    period: row.period,
    title: row.title,
    status: row.status,
    deadlineAt: row.deadline_at,
    daysRemaining: row.days_remaining,
    isOverdue: row.is_overdue,
    totalOrgs: row.total_orgs,
    submittedOrgs: row.submitted_orgs,
    approvedOrgs: row.approved_orgs,
    completionPct: row.completion_pct,
  };
}

export function mapCycleOrgStatus(row: any): CycleOrgStatus {
  return {
    orgId: row.org_id,
    orgName: row.org_name,
    orgLevel: row.org_level,
    okrSetStatus: row.okr_set_status,
    objectiveCount: row.objective_count,
    krCount: row.kr_count,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    headProfileId: row.head_profile_id,
    headName: row.head_name,
  };
}