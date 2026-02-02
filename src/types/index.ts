export interface Company {
  id: string;
  name: string;
  industry: string;
  size: number;
  fiscalYear: string;
  vision?: string;
  strategy?: string;
}

export interface Organization {
  id: string;
  companyId: string;
  name: string;
  level: "전사" | "부문" | "본부" | "실" | "팀";
  parentOrgId: string | null;
  orgType: "Front" | "Middle" | "Back";
  mission: string;
  functionTags: string[];
  headcount: number;
  children?: Organization[];
}

export interface Objective {
  id: string;
  orgId: string;
  name: string;
  biiType: "Build" | "Innovate" | "Improve";
  period: string;
  status: "draft" | "review" | "agreed" | "active" | "reviewing" | "completed";
  parentObjId: string | null;
  order: number;
}

export interface Milestone {
  id: string;
  text: string;
  quarter: string;
  completed: boolean;
}

export interface DynamicKR {
  id: string;
  objectiveId: string;
  orgId: string;
  name: string;
  definition: string;
  formula: string;
  unit: string;
  weight: number;
  targetValue: number;
  currentValue: number;
  progressPct: number;

  biiType: "Build" | "Innovate" | "Improve";
  biiScore: number;
  kpiCategory: "전략" | "고유업무" | "공통";
  perspective: "재무" | "고객" | "프로세스" | "학습성장";
  indicatorType: "투입" | "과정" | "산출" | "결과";
  measurementCycle: "월" | "분기" | "반기" | "연";

  gradeCriteria: {
    S: number;
    A: number;
    B: number;
    C: number;
    D: number;
  };
  quarterlyTargets: { Q1: number; Q2: number; Q3: number; Q4: number };
  quarterlyActuals: { Q1: number | null; Q2: number | null; Q3: number | null; Q4: number | null };

  cascadingType: "Full" | "Shared" | "Joint" | null;
  parentKrId: string | null;
  poolKpiId: string | null;

  status: "draft" | "agreed" | "active" | "completed";
  dataSource: "auto" | "manual" | "hybrid";
  dataSourceDetail?: string;

  milestones?: Milestone[];
}

export interface CFRThread {
  id: string;
  krId: string;
  type: "Conversation" | "Feedback" | "Recognition";
  content: string;
  author: string;
  createdAt: string;
}

export interface KRHistory {
  id: string;
  krId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  changedBy: string;
  changedAt: string;
}

export interface PoolKPI {
  id: string;
  name: string;
  definition: string;
  formula: string;
  functionTags: string[];
  industryTags: string[];
  orgLevelTags: string[];
  perspective: string;
  indicatorType: string;
  unit: string;
  usageCount: number;
}

export interface ActivityFeedItem {
  id: string;
  type: 'checkin' | 'feedback' | 'status_change';
  user: string;
  message: string;
  timestamp: string;
}

export type BIIType = "Build" | "Innovate" | "Improve";
export type GradeType = "S" | "A" | "B" | "C" | "D";
