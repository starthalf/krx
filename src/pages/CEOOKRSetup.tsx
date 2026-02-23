// src/pages/CEOOKRSetup.tsx
// CEO 전용 전사 OKR 수립 + 전체 조직 초안 생성 + 사이클 시작 통합 페이지 
// Phase 1~3 통합: 컨텍스트 입력 → 전사 OKR 확정 → 전 조직 초안 → 사이클 시작

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Bot, Target, ChevronRight, ChevronLeft, Check, CheckCircle2,
  RefreshCw, Pencil, Trash2, Plus, X, Loader2, ArrowLeft, Send,
  GitBranch, CalendarClock, Megaphone, Zap, Eye, AlertCircle,
  ChevronDown, ChevronUp, Sparkles, Rocket, Calendar, Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { getBIIColor } from '../utils/helpers';
import type { BIIType, Company } from '../types';
// import { fetchActivePeriod } from '../lib/period-api'; // 이제 직접 supabase 쿼리

// ─── Types ───────────────────────────────────────────────

interface CompanyContext {
  currentSituation: string;
  annualGoals: string;
  keyStrategies: string;
  challenges: string;
  competitiveLandscape: string;
  additionalContext: string;
}

interface GeneratedObjective {
  id: string;
  name: string;
  biiType: BIIType;
  perspective: string;
  rationale: string;
  selected: boolean;
  keyResults: GeneratedKR[];
}

interface GeneratedKR {
  id: string;
  name: string;
  definition: string;
  formula: string;
  unit: string;
  targetValue: number;
  weight: number;
  indicatorType: string;
  perspective: string;
  biiType: string;
  measurementCycle: string;
  gradeCriteria: { S: number; A: number; B: number; C: number; D: number };
  quarterlyTargets: { Q1: number; Q2: number; Q3: number; Q4: number };
  poolKpiId?: string;
  poolKpiName?: string;
}

interface OrgDraftStatus {
  orgId: string;
  orgName: string;
  level: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  objectiveCount: number;
  error?: string;
}

// ─── Steps ───────────────────────────────────────────────

const STEPS = [
  { id: 0, name: '기간 설정', icon: '📅', description: '수립 대상 기간 선택' },
  { id: 1, name: '경영 컨텍스트', icon: '📋', description: '회사 현황과 전략 방향 입력' },
  { id: 2, name: '전사 OKR 수립', icon: '🎯', description: 'AI 생성 → 수정 → 확정' },
  { id: 3, name: '전체 조직 초안', icon: '🏗️', description: '모든 조직 OKR 초안 일괄 생성' },
  { id: 4, name: '사이클 시작', icon: '🚀', description: '마감일 설정 및 알림 발송' },
];

// ─── Helpers ─────────────────────────────────────────────

const BII_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Build:    { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Innovate: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  Improve:  { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
};

const PERSPECTIVE_COLORS: Record<string, string> = {
  '재무': 'bg-emerald-100 text-emerald-700',
  '고객': 'bg-sky-100 text-sky-700',
  '프로세스': 'bg-amber-100 text-amber-700',
  '학습성장': 'bg-violet-100 text-violet-700',
};

// ─── Main Component ──────────────────────────────────────

export default function CEOOKRSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { company, organizations } = useStore();

  // ==================== 기간 관련 State (NEW) ====================
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedPeriodCode, setSelectedPeriodCode] = useState<string>('');
  const [periodLoading, setPeriodLoading] = useState(true);
  const [availablePeriods, setAvailablePeriods] = useState<any[]>([]);
  const [periodConfirmed, setPeriodConfirmed] = useState(false);
  const [periodUnitFilter, setPeriodUnitFilter] = useState<'year' | 'half' | 'quarter'>('year');

  // 단계 관리
  const [currentStep, setCurrentStep] = useState(0);

  // Step 0: 컨텍스트
  const [context, setContext] = useState<CompanyContext>({
    currentSituation: '',
    annualGoals: '',
    keyStrategies: '',
    challenges: '',
    competitiveLandscape: '',
    additionalContext: '',
  });
  const [contextSaved, setContextSaved] = useState(false);

  // Step 1: 전사 OKR
  const [objectives, setObjectives] = useState<GeneratedObjective[]>([]);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [companyOKRFinalized, setCompanyOKRFinalized] = useState(false);
  const [expandedObjId, setExpandedObjId] = useState<string | null>(null);
  const [editingObjId, setEditingObjId] = useState<string | null>(null);
  const [editingKRId, setEditingKRId] = useState<string | null>(null);

  // Step 2: 전체 조직 초안
  const [orgDraftStatuses, setOrgDraftStatuses] = useState<OrgDraftStatus[]>([]);
  const [isGeneratingAllDrafts, setIsGeneratingAllDrafts] = useState(false);
  const [allDraftsComplete, setAllDraftsComplete] = useState(false);
  const [previewOrg, setPreviewOrg] = useState<{ orgId: string; orgName: string; level: string } | null>(null);
  const [previewOKRs, setPreviewOKRs] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Step 3: 사이클 시작
  const [deadlineDate, setDeadlineDate] = useState('');
  const [cycleMessage, setCycleMessage] = useState('');
  const [isCycleStarting, setIsCycleStarting] = useState(false);
  const [cycleStarted, setCycleStarted] = useState(false);

  // company가 없으면 자동 로딩
  useEffect(() => {
    const loadCompany = async () => {
      if (!user?.id) return;
      if (company) return; // 이미 있으면 스킵
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', profile.company_id)
          .single();
        
        if (companyData) {
          useStore.getState().setCompany({
            id: companyData.id,
            name: companyData.name,
            industry: companyData.industry,
            size: companyData.size,
            vision: companyData.vision || '',
          } as Company);
          
          if (organizations.length === 0) {
            await useStore.getState().fetchOrganizations(companyData.id);
          }
        }
      }
    };
    
    loadCompany();
  }, [user?.id, company]);

  // ==================== 기간 로드 ====================
  const loadAvailablePeriods = useCallback(async () => {
    if (!company?.id) { setPeriodLoading(false); return; }
    setPeriodLoading(true);
    try {
      // 1. 회사 정책에서 수립 주기 로드
      const { data: companyData } = await supabase
        .from('companies')
        .select('okr_cycle_unit')
        .eq('id', company.id)
        .single();
      const cycleUnit = companyData?.okr_cycle_unit || 'year';
      setPeriodUnitFilter(cycleUnit);

      // 2. 정책에 맞는 기간만 로드
      const { data, error } = await supabase
        .from('fiscal_periods')
        .select('id, period_code, period_name, period_type, starts_at, ends_at, status, planning_status, company_okr_finalized, all_orgs_draft_generated')
        .eq('company_id', company.id)
        .eq('period_type', cycleUnit)
        .in('status', ['upcoming', 'planning', 'active'])
        .order('period_code', { ascending: false });
      if (error) throw error;
      setAvailablePeriods(data || []);

      // 자동 선택: 현재 날짜를 포함하는 기간 > 가장 가까운 미래 기간 > planning/active 우선
      if (!selectedPeriodId && data && data.length > 0) {
        const now = new Date();
        // 1) 이미 수립 진행 중인 기간
        const inProgress = data.find(p => p.status === 'planning');
        // 2) 현재 날짜를 포함하는 기간
        const current = data.find(p => new Date(p.starts_at) <= now && now <= new Date(p.ends_at));
        // 3) 시작일이 가장 가까운 미래 기간
        const future = data
          .filter(p => new Date(p.starts_at) > now)
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
        // 4) 가장 최근 과거 기간
        const past = data
          .filter(p => new Date(p.ends_at) < now)
          .sort((a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime())[0];

        const auto = inProgress || current || future || past || data[0];
        if (auto) {
          setSelectedPeriodId(auto.id);
          setSelectedPeriodCode(auto.period_code);
        }
      }
    } catch (err) {
      console.error('기간 로드 실패:', err);
    } finally {
      setPeriodLoading(false);
    }
  }, [company?.id, selectedPeriodId]);

  useEffect(() => { loadAvailablePeriods(); }, [loadAvailablePeriods]);

  // ==================== 기간 설정 핸들러 ====================

  const handleSelectPeriod = (period: any) => {
    setSelectedPeriodId(period.id);
    setSelectedPeriodCode(period.period_code);
  };

  const handleConfirmPeriod = async () => {
    if (!selectedPeriodId) return;
    const selected = availablePeriods.find(p => p.id === selectedPeriodId);
    if (selected?.status === 'upcoming') {
      await supabase.from('fiscal_periods')
        .update({ status: 'planning', planning_status: 'setup' })
        .eq('id', selectedPeriodId);
    }
    setPeriodConfirmed(true);
    setCurrentStep(1);
  };

  const periodStatusLabel = (status: string) => {
    const m: Record<string, { label: string; color: string }> = {
      upcoming: { label: '예정', color: 'bg-slate-100 text-slate-600' },
      planning: { label: '수립중', color: 'bg-blue-100 text-blue-700' },
      active: { label: '실행중', color: 'bg-green-100 text-green-700' },
    };
    return m[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
  };

  const cycleUnitLabel = periodUnitFilter === 'year' ? '연도' : periodUnitFilter === 'half' ? '반기' : '분기';

  // 컨텍스트 + 기존 진행 상태 복원 (기간 확정 후)
  useEffect(() => {
    if (company?.id && selectedPeriodCode && periodConfirmed) {
      loadExistingContext();
      loadExistingProgress();
    }
  }, [company?.id, selectedPeriodCode, periodConfirmed]);

  // 기존 진행 상태 복원 (전사 OKR 확정 여부, 조직 초안 생성 여부)
  const loadExistingProgress = async () => {
    if (!company?.id || !selectedPeriodCode) return;
    try {
      const companyOrg = organizations.find(o => o.level === '전사');
      if (!companyOrg) return;

      // 1. 전사 OKR 확정 여부 확인
      const { data: companyObjs } = await supabase
        .from('objectives')
        .select(`
          id, name, bii_type, approval_status, sort_order,
          key_results(id, name, definition, formula, unit, weight, target_value, indicator_type, perspective, bii_type, measurement_cycle, grade_criteria, quarterly_targets)
        `)
        .eq('org_id', companyOrg.id)
        .eq('period', selectedPeriodCode)
        .order('sort_order');

      if (companyObjs && companyObjs.length > 0) {
        // 전사 OKR이 있으면 복원
        const restored: GeneratedObjective[] = companyObjs.map((obj: any, idx: number) => ({
          id: obj.id,
          name: obj.name,
          biiType: obj.bii_type || 'Improve',
          perspective: obj.key_results?.[0]?.perspective || '재무',
          rationale: '',
          selected: true,
          keyResults: (obj.key_results || []).map((kr: any, kIdx: number) => ({
            id: kr.id,
            name: kr.name,
            definition: kr.definition || '',
            formula: kr.formula || '',
            unit: kr.unit || '%',
            targetValue: kr.target_value || 100,
            weight: kr.weight || 30,
            indicatorType: kr.indicator_type || '결과',
            perspective: kr.perspective || '재무',
            biiType: kr.bii_type || obj.bii_type || 'Improve',
            measurementCycle: kr.measurement_cycle || '월',
            gradeCriteria: kr.grade_criteria || { S: 120, A: 110, B: 100, C: 90, D: 0 },
            quarterlyTargets: kr.quarterly_targets || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
          })),
        }));

        setObjectives(restored);

        // finalized 상태면 확정 완료
        const isFinalized = companyObjs.some((o: any) => o.approval_status === 'finalized');
        if (isFinalized) {
          setCompanyOKRFinalized(true);
          setCurrentStep(2); // Step 2로 이동 (확정 완료 상태)
        } else {
          setCurrentStep(2); // OKR이 있지만 아직 확정 전
        }
      }

      // 2. 하위 조직 초안 생성 여부 확인
      const childOrgs = organizations.filter(o => o.level !== '전사');
      if (childOrgs.length > 0) {
        let allDone = true;
        const statuses: OrgDraftStatus[] = [];

        for (const org of childOrgs) {
          const { data: orgObjs, count } = await supabase
            .from('objectives')
            .select('id', { count: 'exact' })
            .eq('org_id', org.id)
            .eq('period', selectedPeriodCode)
            .eq('source', 'ai_draft');

          const objCount = count || 0;
          if (objCount > 0) {
            statuses.push({
              orgId: org.id,
              orgName: org.name,
              level: org.level,
              status: 'done',
              objectiveCount: objCount,
            });
          } else {
            allDone = false;
          }
        }

        if (statuses.length > 0) {
          setOrgDraftStatuses(statuses);
          if (allDone && statuses.length === childOrgs.length) {
            setAllDraftsComplete(true);
            if (companyObjs && companyObjs.some((o: any) => o.approval_status === 'finalized')) {
              setCurrentStep(3); // 전사 확정 + 조직 초안 완료 → Step 3
            }
          }
        }
      }

      // 3. 사이클 시작 여부 확인
      const { data: cycles } = await supabase
        .from('okr_planning_cycles')
        .select('*')
        .eq('company_id', company.id)
        .eq('period', selectedPeriodCode)
        .order('created_at', { ascending: false })
        .limit(1);

      if (cycles && cycles.length > 0 && cycles[0].cycle_started_at) {
        const cycleStatus = cycles[0].status;
        if (cycleStatus === 'in_progress') {
          setCycleStarted(true);
          setCurrentStep(4);
        }
      }

    } catch (err) {
      console.error('진행 상태 복원 실패:', err);
    }
  };

  const loadExistingContext = async () => {
    if (!company?.id) return;
    try {
      const { data } = await supabase
        .from('company_okr_contexts')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const row = data[0];
        setContext({
          currentSituation: row.current_situation || '',
          annualGoals: row.annual_goals || '',
          keyStrategies: row.key_strategies || '',
          challenges: row.challenges || '',
          competitiveLandscape: row.competitive_landscape || '',
          additionalContext: row.additional_context || '',
        });
        if (row.status === 'finalized') {
          setContextSaved(true);
        }
      }
    } catch {
      // 첫 사용 - 빈 컨텍스트
    }
  };

  // ─── Step 0: 컨텍스트 저장 ─────────────────────────────

  const handleSaveContext = async () => {
    if (!company?.id || !user?.id || !selectedPeriodCode) return;

    try {
      // 기존 레코드 확인
      const { data: existing } = await supabase
        .from('company_okr_contexts')
        .select('id')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        // 업데이트
        await supabase
          .from('company_okr_contexts')
          .update({
            current_situation: context.currentSituation,
            annual_goals: context.annualGoals,
            key_strategies: context.keyStrategies,
            challenges: context.challenges,
            competitive_landscape: context.competitiveLandscape,
            additional_context: context.additionalContext,
          })
          .eq('id', existing[0].id);
      } else {
        // 신규 생성
        await supabase
          .from('company_okr_contexts')
          .insert({
            company_id: company.id,
            period: selectedPeriodCode,
            current_situation: context.currentSituation,
            annual_goals: context.annualGoals,
            key_strategies: context.keyStrategies,
            challenges: context.challenges,
            competitive_landscape: context.competitiveLandscape,
            additional_context: context.additionalContext,
            status: 'draft',
          });
      }

      setContextSaved(true);
    } catch (err: any) {
      console.error('컨텍스트 저장 실패:', err);
      alert('저장 실패: ' + err.message);
    }
  };

  // ─── Step 1: AI 전사 OKR 생성 ─────────────────────────

  const handleGenerateCompanyOKR = async () => {
    if (!company) return;

    setIsAIGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-company-okr', {
        body: {
          companyName: company.name,
          industry: company.industry,
          companySize: company.size,
          vision: company.vision,
          currentSituation: context.currentSituation,
          annualGoals: context.annualGoals,
          keyStrategies: context.keyStrategies,
          challenges: context.challenges,
          competitiveLandscape: context.competitiveLandscape,
          additionalContext: context.additionalContext,
        }
      });

      if (error) throw error;

      if (data?.objectives) {
        const generated: GeneratedObjective[] = data.objectives.map((obj: any, idx: number) => ({
          id: `obj-${Date.now()}-${idx}`,
          name: obj.name,
          biiType: obj.biiType || 'Improve',
          perspective: obj.perspective || '재무',
          rationale: obj.rationale || '',
          selected: true,
          keyResults: (obj.keyResults || []).map((kr: any, kIdx: number) => ({
            id: `kr-${Date.now()}-${idx}-${kIdx}`,
            name: kr.name,
            definition: kr.definition || '',
            formula: kr.formula || '',
            unit: kr.unit || '%',
            targetValue: kr.targetValue || 100,
            weight: kr.weight || Math.floor(100 / (obj.keyResults?.length || 3)),
            indicatorType: kr.indicatorType || '결과',
            perspective: kr.perspective || obj.perspective || '재무',
            biiType: kr.biiType || obj.biiType || 'Improve',
            measurementCycle: kr.measurementCycle || '월',
            gradeCriteria: kr.gradeCriteria || { S: 120, A: 110, B: 100, C: 90, D: 0 },
            quarterlyTargets: kr.quarterlyTargets || { Q1: 25, Q2: 50, Q3: 75, Q4: 100 },
            poolKpiId: kr.poolKpiId,
            poolKpiName: kr.poolKpiName,
          })),
        }));

        setObjectives(generated);
        setExpandedObjId(null);
      }
    } catch (err: any) {
      console.error('AI 생성 실패:', err);
      alert('AI 생성 실패: ' + err.message);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 전사 OKR 확정 (DB 저장)
  const handleFinalizeCompanyOKR = async () => {
    if (!company?.id || !user?.id || !selectedPeriodCode) return;

    const selectedObjs = objectives.filter(o => o.selected);
    if (selectedObjs.length === 0) {
      alert('최소 1개 이상의 목표를 선택해주세요.');
      return;
    }

    if (!confirm(`선택된 ${selectedObjs.length}개 전사 목표를 확정하시겠습니까?`)) return;

    try {
      // 전사 조직 찾기
      const companyOrg = organizations.find(o => o.level === '전사');
      if (!companyOrg) {
        alert('전사 조직이 설정되어 있지 않습니다. 관리자 설정에서 조직을 먼저 등록해주세요.');
        return;
      }

      // 기존 전사 OKR 삭제 (해당 기간)
      const { data: existingObjs } = await supabase
        .from('objectives')
        .select('id')
        .eq('org_id', companyOrg.id)
        .eq('period', selectedPeriodCode);

      if (existingObjs && existingObjs.length > 0) {
        const objIds = existingObjs.map(o => o.id);
        await supabase.from('key_results').delete().in('objective_id', objIds);
        await supabase.from('objectives').delete().in('id', objIds);
      }

      // 새 전사 OKR 저장
      for (const obj of selectedObjs) {
        const { data: savedObj, error: objError } = await supabase
          .from('objectives')
          .insert({
            org_id: companyOrg.id,
            name: obj.name,
            bii_type: obj.biiType,
            period: selectedPeriodCode,
            status: 'active',
            source: 'ai_draft',
            approval_status: 'finalized',
            cascade_type: 'independent',
            sort_order: selectedObjs.indexOf(obj),
          })
          .select()
          .single();

        if (objError) throw objError;
        if (!savedObj) continue;

        for (const kr of obj.keyResults) {
          const { error: krError } = await supabase
            .from('key_results')
            .insert({
              objective_id: savedObj.id,
              org_id: companyOrg.id,
              name: kr.name,
              definition: kr.definition,
              formula: kr.formula,
              unit: kr.unit,
              weight: kr.weight,
              target_value: kr.targetValue,
              current_value: 0,
              bii_type: kr.biiType,
              kpi_category: '전략',
              perspective: kr.perspective,
              indicator_type: kr.indicatorType,
              measurement_cycle: kr.measurementCycle,
              grade_criteria: kr.gradeCriteria,
              quarterly_targets: kr.quarterlyTargets,
              status: 'active',
              source: 'ai_draft',
              pool_kpi_id: kr.poolKpiId || null,
              cascade_type: 'independent',
            });
          if (krError) throw krError;
        }
      }

      // 컨텍스트 상태 확정
      await supabase
        .from('company_okr_contexts')
        .update({ status: 'finalized', finalized_at: new Date().toISOString(), finalized_by: user.id })
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1);

      setCompanyOKRFinalized(true);
      alert('✅ 전사 OKR이 확정되었습니다!');

    } catch (err: any) {
      console.error('전사 OKR 확정 실패:', err);
      alert('확정 실패: ' + err.message);
    }
  };

  // ─── Step 2: 전체 조직 초안 일괄 생성 ─────────────────

  const handleGenerateAllDrafts = async () => {
    if (!company?.id || !selectedPeriodCode) return;

    const companyOrg = organizations.find(o => o.level === '전사');
    if (!companyOrg) {
      alert('전사 조직이 없습니다.');
      return;
    }

    // 전사 확정 OKR 조회
    const { data: companyObjs } = await supabase
      .from('objectives')
      .select(`
        id, name, bii_type,
        key_results(id, name)
      `)
      .eq('org_id', companyOrg.id)
      .eq('period', selectedPeriodCode)
      .eq('approval_status', 'finalized');

    if (!companyObjs || companyObjs.length === 0) {
      alert('확정된 전사 OKR이 없습니다. Step 1을 먼저 완료해주세요.');
      return;
    }

    const parentOKRs = companyObjs.map(obj => ({
      objectiveId: obj.id,
      objectiveName: obj.name,
      biiType: obj.bii_type,
      keyResults: (obj.key_results || []).map((kr: any) => kr.name),
    }));

    // 하위 조직 목록 (전사 제외)
    const childOrgs = organizations.filter(o => o.level !== '전사');
    if (childOrgs.length === 0) {
      alert('하위 조직이 없습니다.');
      return;
    }

    // 조직별 상위 체인의 OKR 수집 함수
    const getDirectParentOKRs = async (org: typeof childOrgs[0]) => {
      // 직속 상위 조직의 OKR을 가져옴 (이미 생성된 ai_draft 포함)
      if (!org.parentOrgId) return parentOKRs; // 상위가 전사면 전사 OKR 반환
      
      const parentOrg = organizations.find(o => o.id === org.parentOrgId);
      if (!parentOrg || parentOrg.level === '전사') return parentOKRs; // 상위가 전사면 전사 OKR 반환
      
      // 직속 상위 조직(부문 등)의 objectives 조회
      const { data: directParentObjs } = await supabase
        .from('objectives')
        .select('id, name, bii_type, key_results(id, name)')
        .eq('org_id', parentOrg.id)
        .eq('period', selectedPeriodCode)
        .in('source', ['ai_draft', 'manual'])
        .order('sort_order');
      
      if (directParentObjs && directParentObjs.length > 0) {
        return directParentObjs.map(obj => ({
          objectiveId: obj.id,
          objectiveName: obj.name,
          biiType: obj.bii_type,
          keyResults: (obj.key_results || []).map((kr: any) => kr.name),
        }));
      }
      
      // 직속 상위 조직에 OKR이 없으면 전사 OKR fallback
      return parentOKRs;
    };

    // 상태 초기화
    // 레벨 순서: 부문 → 본부 → 팀 (상위 조직 초안이 먼저 생성되어야 하위에서 참조 가능)
    const levelOrder: Record<string, number> = { '부문': 1, '본부': 2, '팀': 3, '센터': 3 };
    const sortedChildOrgs = [...childOrgs].sort((a, b) => 
      (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99)
    );

    const statuses: OrgDraftStatus[] = sortedChildOrgs.map(org => ({
      orgId: org.id,
      orgName: org.name,
      level: org.level,
      status: 'pending',
      objectiveCount: 0,
    }));
    setOrgDraftStatuses(statuses);
    setIsGeneratingAllDrafts(true);

    // 순차 생성 (API rate limit 고려, 상위 레벨부터)
    for (let i = 0; i < sortedChildOrgs.length; i++) {
      const org = sortedChildOrgs[i];

      // 상태: generating
      setOrgDraftStatuses(prev => prev.map(s =>
        s.orgId === org.id ? { ...s, status: 'generating' } : s
      ));

      try {
        // 직속 상위 조직의 OKR을 가져옴
        const directParentOKRs = await getDirectParentOKRs(org);
        const parentOrg = organizations.find(o => o.id === org.parentOrgId);
        const parentOrgName = parentOrg?.name || '전사';
        const parentOrgLevel = parentOrg?.level || '전사';

        const { data, error } = await supabase.functions.invoke('generate-objectives', {
          body: {
            orgName: org.name,
            orgMission: org.mission || '',
            orgType: org.orgType || 'Front',
            functionTags: org.functionTags || [],
            industry: company.industry,
            cascadingMode: true,
            parentOKRs: directParentOKRs, // 직속 상위 OKR (부문 or 전사)
            companyOKRs: parentOKRs, // 전사 OKR (항상 참조 컨텍스트로)
            parentOrgName,
            parentOrgLevel,
          }
        });

        if (error) throw error;

        if (data?.objectives) {
          // DB에 ai_draft로 저장
          let savedCount = 0;
          
          // 기존 초안 삭제 (source 관계없이 — 조직장이 수정한 것도 포함)
          const { data: existingObjs } = await supabase
            .from('objectives')
            .select('id')
            .eq('org_id', org.id)
            .eq('period', selectedPeriodCode);

          if (existingObjs && existingObjs.length > 0) {
            const ids = existingObjs.map(o => o.id);
            await supabase.from('key_results').delete().in('objective_id', ids);
            await supabase.from('objectives').delete().in('id', ids);
          }

          for (const obj of data.objectives) {
            const parentObjId = obj.parentObjectiveId || null;
            const cascadeType = obj.cascadeType || 'independent';

            const { data: savedObj } = await supabase
              .from('objectives')
              .insert({
                org_id: org.id,
                name: obj.name,
                bii_type: obj.biiType || 'Improve',
                period: selectedPeriodCode,
                status: 'draft',
                source: 'ai_draft',
                approval_status: 'ai_draft',
                parent_obj_id: parentObjId,
                cascade_type: cascadeType,
                sort_order: savedCount,
              })
              .select()
              .single();

            if (savedObj) {
              savedCount++;
              // 이 Objective에 대한 KR도 생성
              try {
                const { data: krData } = await supabase.functions.invoke('generate-krs', {
                  body: {
                    objectiveName: obj.name,
                    objectiveType: obj.biiType || 'Improve',
                    perspective: obj.perspective || '재무',
                    orgType: org.orgType || 'Front',
                    functionTags: org.functionTags || [],
                    industry: company.industry,
                  }
                });

                if (krData?.krs) {
                  for (const kr of krData.krs) {
                    await supabase.from('key_results').insert({
                      objective_id: savedObj.id,
                      org_id: org.id,
                      name: kr.name,
                      definition: kr.definition || '',
                      formula: kr.formula || '',
                      unit: kr.unit || '%',
                      weight: kr.weight || 30,
                      target_value: kr.targetValue || 100,
                      current_value: 0,
                      bii_type: kr.biiType || obj.biiType || 'Improve',
                      kpi_category: '전략',
                      perspective: kr.perspective || obj.perspective || '재무',
                      indicator_type: kr.indicatorType || '결과',
                      measurement_cycle: kr.measurementCycle || '월',
                      grade_criteria: kr.gradeCriteria || { S: 120, A: 110, B: 100, C: 90, D: 0 },
                      quarterly_targets: kr.quarterlyTargets || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
                      status: 'draft',
                      source: 'ai_draft',
                      cascade_type: cascadeType,
                    });
                  }
                }
              } catch (krErr) {
                console.warn(`KR 생성 실패 (${org.name}/${obj.name}):`, krErr);
              }
            }
          }

          setOrgDraftStatuses(prev => prev.map(s =>
            s.orgId === org.id ? { ...s, status: 'done', objectiveCount: savedCount } : s
          ));
        }

      } catch (err: any) {
        console.error(`조직 ${org.name} 초안 생성 실패:`, err);
        setOrgDraftStatuses(prev => prev.map(s =>
          s.orgId === org.id ? { ...s, status: 'error', error: err.message } : s
        ));
      }
    }

    setIsGeneratingAllDrafts(false);
    setAllDraftsComplete(true);
  };

  // ─── Step 3: 사이클 시작 ───────────────────────────────

  const handleStartCycle = async () => {
    if (!company?.id || !user?.id || !deadlineDate || !selectedPeriodCode) {
      alert('마감일을 설정해주세요.');
      return;
    }

    if (!confirm('사이클을 시작하면 모든 조직장에게 알림이 발송됩니다. 시작하시겠습니까?')) return;

    setIsCycleStarting(true);
    try {
      // 1. okr_planning_cycles 생성
      const { data: cycle, error: cycleError } = await supabase
        .from('okr_planning_cycles')
        .insert({
          company_id: company.id,
          period: selectedPeriodCode,
          title: `${selectedPeriodCode} OKR 수립`,
          status: 'in_progress',
          starts_at: new Date().toISOString(),
          deadline_at: new Date(deadlineDate + 'T23:59:59').toISOString(),
          company_okr_finalized: true,
          company_okr_finalized_at: new Date().toISOString(),
          all_orgs_draft_generated: allDraftsComplete,
          all_orgs_draft_generated_at: allDraftsComplete ? new Date().toISOString() : null,
          cycle_started_at: new Date().toISOString(),
          message: cycleMessage || 'AI가 생성한 초안을 바탕으로 조직 OKR을 수립해주세요.',
          created_by: user.id,
        })
        .select()
        .single();

      if (cycleError) throw cycleError;

      // 2. 모든 조직장에게 알림 발송
      const childOrgs = organizations.filter(o => o.level !== '전사');
      const notifications = [];

      for (const org of childOrgs) {
        // 조직에 속한 사용자 중 리더 찾기 (간단히: 해당 org의 user_roles에서 높은 레벨)
        const { data: orgMembers } = await supabase
          .from('user_roles')
          .select('profile_id, roles!inner(name, level)')
          .eq('org_id', org.id);

        const leaders = orgMembers?.filter((m: any) => {
          const role = m.roles;
          return role && role.level >= 50;
        }) || [];

        for (const leader of leaders) {
          notifications.push({
            recipient_id: leader.profile_id,
            sender_id: user.id,
            sender_name: '대표이사',
            type: 'okr_cycle_started',
            title: 'OKR 수립 사이클이 시작되었습니다',
            message: cycleMessage || `AI 초안을 바탕으로 ${org.name}의 OKR을 수정/확정해주세요. 마감: ${deadlineDate}`,
            resource_type: 'cycle',
            resource_id: cycle.id,
            org_id: org.id,
            priority: 'high',
            action_url: `/wizard/${org.id}`,
          });
        }
      }

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }

      setCycleStarted(true);
      alert(`✅ 사이클이 시작되었습니다! ${notifications.length}명에게 알림이 발송되었습니다.`);

    } catch (err: any) {
      console.error('사이클 시작 실패:', err);
      alert('사이클 시작 실패: ' + err.message);
    } finally {
      setIsCycleStarting(false);
    }
  };

  // ─── 조직 초안 미리보기 ─────────────────────────────────
  const handlePreviewOrg = async (orgId: string, orgName: string, level: string) => {
    if (!selectedPeriodCode) return;
    
    setPreviewOrg({ orgId, orgName, level });
    setPreviewLoading(true);
    try {
      // 1. objectives 조회
      const { data: objs, error: objError } = await supabase
        .from('objectives')
        .select('id, name, bii_type, perspective, parent_obj_id')
        .eq('org_id', orgId)
        .eq('period', selectedPeriodCode)
        .order('created_at', { ascending: true });

      if (objError) console.error('objectives 조회 에러:', objError);

      if (!objs || objs.length === 0) {
        console.warn('objectives 0건 — orgId:', orgId, 'period:', selectedPeriodCode);
        setPreviewOKRs([]);
        setPreviewLoading(false);
        return;
      }

      // 2. 해당 objectives의 KR 조회
      const objIds = objs.map(o => o.id);
      const { data: krs, error: krError } = await supabase
        .from('key_results')
        .select('id, name, definition, formula, objective_id')
        .in('objective_id', objIds);

      if (krError) console.error('key_results 조회 에러:', krError);

      // 3. objectives에 KR 매핑
      const result = objs.map(obj => ({
        ...obj,
        key_results: (krs || []).filter(kr => kr.objective_id === obj.id),
      }));

      setPreviewOKRs(result);
    } catch (err) {
      console.error('미리보기 로드 실패:', err);
      setPreviewOKRs([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  // ─── Objective 수정 핸들러 ─────────────────────────────

  const handleObjChange = (objId: string, field: string, value: any) => {
    setObjectives(prev => prev.map(o =>
      o.id === objId ? { ...o, [field]: value } : o
    ));
  };

  const handleKRChange = (objId: string, krId: string, field: string, value: any) => {
    setObjectives(prev => prev.map(o =>
      o.id === objId ? {
        ...o,
        keyResults: o.keyResults.map(kr =>
          kr.id === krId ? { ...kr, [field]: value } : kr
        )
      } : o
    ));
  };

  const toggleObjective = (objId: string) => {
    setObjectives(prev => prev.map(o =>
      o.id === objId ? { ...o, selected: !o.selected } : o
    ));
  };

  const deleteObjective = (objId: string) => {
    if (!confirm('이 목표를 삭제하시겠습니까?')) return;
    setObjectives(prev => prev.filter(o => o.id !== objId));
  };

  const addObjective = () => {
    const newObj: GeneratedObjective = {
      id: `obj-new-${Date.now()}`,
      name: '',
      biiType: 'Improve',
      perspective: '재무',
      rationale: '',
      selected: true,
      keyResults: [],
    };
    setObjectives(prev => [...prev, newObj]);
    setEditingObjId(newObj.id);
    setExpandedObjId(newObj.id);
  };

  // ─── 계산 값 ──────────────────────────────────────────

  const selectedCount = objectives.filter(o => o.selected).length;
  const biiBalance = {
    Build: objectives.filter(o => o.selected && o.biiType === 'Build').length,
    Innovate: objectives.filter(o => o.selected && o.biiType === 'Innovate').length,
    Improve: objectives.filter(o => o.selected && o.biiType === 'Improve').length,
  };

  const contextFilled = Object.values(context).some(v => v.trim().length > 0);
  const canProceedStep0 = contextFilled;
  const canProceedStep1 = objectives.length > 0 && selectedCount >= 1;
  const canProceedStep2 = companyOKRFinalized;

  // ─── 로딩 상태는 Step 0 내부에서 처리 ──────────────────

  // ✅ selectedPeriodCode가 없어도 Step 0에서 기간을 선택할 수 있으므로 블로킹하지 않음

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 조직 초안 미리보기 모달 */}
      {previewOrg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewOrg(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">{previewOrg.level}</span>
                  <h3 className="text-lg font-bold text-slate-900">{previewOrg.orgName}</h3>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">AI 생성 초안 · {previewOKRs.length}개 목표</p>
              </div>
              <button onClick={() => setPreviewOrg(null)} className="p-2 hover:bg-white/80 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-80px)] space-y-4">
              {previewLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                </div>
              ) : previewOKRs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">초안이 없습니다</div>
              ) : (
                previewOKRs.map((obj: any, idx: number) => {
                  const parentObj = obj.parent_obj_id
                    ? objectives.find(o => o.id === obj.parent_obj_id)
                    : null;
                  return (
                    <div key={obj.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      {/* Objective 헤더 */}
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                            <i className="not-italic font-serif">O</i>{idx + 1}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            obj.bii_type === 'Build' ? 'bg-blue-100 text-blue-700' :
                            obj.bii_type === 'Innovate' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {obj.bii_type || 'Improve'}
                          </span>
                          {obj.perspective && <span className="text-xs text-slate-400">{obj.perspective}</span>}
                        </div>
                        <p className="text-sm font-semibold text-slate-900 mt-1">{obj.name}</p>
                        {parentObj && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-violet-600">
                            <GitBranch className="w-3 h-3" />
                            <span>상위: {parentObj.name}</span>
                          </div>
                        )}
                      </div>
                      {/* KR 목록 */}
                      <div className="px-4 py-2 space-y-2">
                        {(obj.key_results || []).map((kr: any, krIdx: number) => (
                          <div key={kr.id} className="flex items-start gap-2 py-1.5">
                            <span className="text-xs font-bold text-slate-400 mt-0.5 w-8 flex-shrink-0">KR{krIdx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800">{kr.name}</p>
                              {kr.definition && <p className="text-xs text-slate-400 mt-0.5">{kr.definition}</p>}
                            </div>
                          </div>
                        ))}
                        {(!obj.key_results || obj.key_results.length === 0) && (
                          <p className="text-xs text-slate-400 py-2">KR 없음</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">전사 OKR 수립</h1>
                  <p className="text-sm text-slate-500">{company?.name} · {company?.industry}</p>
                </div>
              </div>
            </div>
            {/* 기간 표시 배지 */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg font-medium">
                📅 {selectedPeriodCode || '기간 미선택'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = idx === currentStep;
              const isDone = (idx === 0 && periodConfirmed) || (idx === 1 && periodConfirmed && currentStep > 1) || (idx === 2 && companyOKRFinalized) || (idx === 3 && allDraftsComplete) || (idx === 4 && cycleStarted);
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div
                    className={`flex items-center gap-3 cursor-pointer ${isActive ? 'opacity-100' : isDone ? 'opacity-80' : 'opacity-40'}`}
                    onClick={() => { if (idx === 0 || periodConfirmed) setCurrentStep(idx); }}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg
                      ${isDone ? 'bg-green-100 text-green-700' : isActive ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-300' : 'bg-slate-100'}`}
                    >
                      {isDone ? <Check className="w-5 h-5" /> : step.icon}
                    </div>
                    <div className="hidden md:block">
                      <div className={`text-sm font-medium ${isActive ? 'text-blue-700' : isDone ? 'text-green-700' : 'text-slate-500'}`}>
                        {step.name}
                      </div>
                      <div className="text-xs text-slate-400">{step.description}</div>
                    </div>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${idx < currentStep ? 'bg-green-300' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ════════ Step 0: 기간 선택 ════════ */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">수립 대상 기간 선택</h2>
                  <p className="text-sm text-slate-500">OKR을 수립할 기간을 선택하세요</p>
                </div>
              </div>

              {/* 현재 정책 표시 */}
              <div className="mb-5 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-700">수립 주기: <strong className="text-slate-900">{cycleUnitLabel} 단위</strong></span>
                </div>
                <button onClick={() => navigate('/admin?tab=okr-policy')} className="text-xs text-blue-600 hover:text-blue-700">
                  정책 변경 →
                </button>
              </div>

              {/* 기간 선택 */}
              {periodLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">기간 정보를 불러오는 중...</p>
                </div>
              ) : availablePeriods.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    사용 가능한 {cycleUnitLabel} 기간이 없습니다
                  </h3>
                  <p className="text-slate-600 text-sm mb-4">관리자 설정의 "기간 관리"에서 먼저 기간을 생성해주세요.</p>
                  <button
                    onClick={() => navigate('/admin?tab=periods')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    기간 관리로 이동
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">대상 기간</label>
                  <select
                    value={selectedPeriodId || ''}
                    onChange={e => {
                      const p = availablePeriods.find(fp => fp.id === e.target.value);
                      if (p) handleSelectPeriod(p);
                    }}
                    className="w-full max-w-md px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">기간을 선택하세요</option>
                    {availablePeriods.map(p => {
                      const sl = periodStatusLabel(p.status);
                      const dateRange = `${new Date(p.starts_at).toLocaleDateString('ko-KR')} ~ ${new Date(p.ends_at).toLocaleDateString('ko-KR')}`;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.period_name} ({sl.label}) · {dateRange}
                        </option>
                      );
                    })}
                  </select>

                  {/* 선택된 기간 상세 */}
                  {selectedPeriodId && (() => {
                    const sp = availablePeriods.find(p => p.id === selectedPeriodId);
                    if (!sp) return null;
                    const sl = periodStatusLabel(sp.status);
                    return (
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-slate-900">{sp.period_name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sl.color}`}>{sl.label}</span>
                        </div>
                        <div className="text-sm text-slate-600">
                          {new Date(sp.starts_at).toLocaleDateString('ko-KR')} ~ {new Date(sp.ends_at).toLocaleDateString('ko-KR')}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {sp.company_okr_finalized && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">전사 OKR 확정됨</span>}
                          {sp.all_orgs_draft_generated && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">조직 초안 완료</span>}
                          {!sp.company_okr_finalized && !sp.all_orgs_draft_generated && sp.status === 'planning' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">수립 진행 중</span>}
                          {!sp.company_okr_finalized && !sp.all_orgs_draft_generated && sp.status !== 'planning' && <span className="text-xs text-slate-400">아직 수립이 시작되지 않았습니다</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* 다음 단계 */}
            <div className="flex justify-end">
              <button
                onClick={handleConfirmPeriod}
                disabled={!selectedPeriodId}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                기간 확정 후 다음
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ════════ Step 1: 경영 컨텍스트 입력 ════════ */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">경영 컨텍스트 입력</h2>
                  <p className="text-sm text-slate-500">회사의 현 상황과 전략 방향을 입력하면 AI가 최적의 전사 OKR을 생성합니다</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5">
                {[
                  { key: 'currentSituation', label: '🏢 현 상황', placeholder: '회사의 현재 매출, 시장 포지션, 주요 제품/서비스 현황 등', rows: 3 },
                  { key: 'annualGoals', label: '🎯 올해 목표', placeholder: '올해 달성하고자 하는 핵심 목표 (매출, 성장률, 신규 시장 진출 등)', rows: 3 },
                  { key: 'keyStrategies', label: '⚡ 핵심 전략', placeholder: '목표 달성을 위한 주요 전략 방향 (3~5개)', rows: 3 },
                  { key: 'challenges', label: '🔥 도전/어려움', placeholder: '현재 직면한 주요 과제, 리스크, 해결해야 할 문제', rows: 2 },
                  { key: 'competitiveLandscape', label: '🏆 경쟁 상황', placeholder: '주요 경쟁사, 시장 트렌드, 차별화 포인트', rows: 2 },
                  { key: 'additionalContext', label: '📝 기타 참고', placeholder: '(선택) 추가로 AI가 참고할 사항', rows: 2 },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
                    <textarea
                      value={(context as any)[field.key]}
                      onChange={(e) => setContext(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={field.rows}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSaveContext}
                  className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                >
                  💾 임시 저장
                </button>
                {contextSaved && (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="w-4 h-4" /> 저장됨
                  </span>
                )}
              </div>
            </div>

            {/* 다음 단계 */}
            <div className="flex justify-end">
              <button
                onClick={() => { handleSaveContext(); setCurrentStep(2); }}
                disabled={!canProceedStep0}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                다음: 전사 OKR 생성
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ════════ Step 2: 전사 OKR 수립 ════════ */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* 사이클 진행 중 경고 */}
            {cycleStarted && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-amber-800 font-semibold text-sm">사이클 진행 중 — 수정 시 주의</p>
                  <p className="text-amber-700 text-xs mt-1">전사 OKR을 수정하면 이미 배포된 하위 조직 초안과 불일치가 발생할 수 있습니다. 수정 후 조직 초안 재생성을 권장합니다.</p>
                </div>
              </div>
            )}
            {/* AI 생성 버튼 */}
            {objectives.length === 0 && !isAIGenerating && (
              <div className="bg-gradient-to-br from-blue-50 to-violet-50 border-2 border-dashed border-blue-200 rounded-xl p-12 text-center">
                <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">AI로 전사 OKR 생성</h3>
                <p className="text-slate-600 mb-6 max-w-lg mx-auto">
                  입력하신 경영 컨텍스트를 바탕으로 {company?.industry} 업종에 최적화된 전사 OKR을 생성합니다
                </p>
                <button
                  onClick={handleGenerateCompanyOKR}
                  className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors text-lg flex items-center gap-2 mx-auto"
                >
                  <Zap className="w-5 h-5" />
                  AI 전사 OKR 생성
                </button>
              </div>
            )}

            {/* 로딩 */}
            {isAIGenerating && (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-bounce" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">AI가 전사 OKR을 생성하고 있습니다...</h3>
                <p className="text-slate-600 mb-6">{company?.industry} 업종 OKR DB를 참조하여 최적의 목표를 설계 중</p>
                <div className="max-w-xs mx-auto mb-3">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500 rounded-full animate-[shimmer_2s_infinite]"
                      style={{ width: '100%', backgroundSize: '200% 100%', animation: 'shimmer 2s linear infinite' }} />
                  </div>
                </div>
                <p className="text-xs text-slate-400">보통 15~30초 소요됩니다</p>
                <style>{`
                  @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                  }
                `}</style>
              </div>
            )}

            {/* 생성된 OKR 목록 */}
            {objectives.length > 0 && !isAIGenerating && (
              <>
                {/* 요약 카드 */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                    <div className="text-2xl font-bold text-slate-900">{selectedCount}</div>
                    <div className="text-xs text-slate-500">선택된 목표</div>
                  </div>
                  {Object.entries(biiBalance).map(([type, count]) => {
                    const color = BII_COLORS[type];
                    return (
                      <div key={type} className={`rounded-xl border p-4 text-center ${color.bg} ${color.border}`}>
                        <div className={`text-2xl font-bold ${color.text}`}>{count}</div>
                        <div className={`text-xs ${color.text}`}>{type}</div>
                      </div>
                    );
                  })}
                </div>

                {/* 목표 리스트 */}
                <div className="space-y-4">
                  {objectives.map((obj, idx) => {
                    const biiColor = BII_COLORS[obj.biiType] || BII_COLORS.Improve;
                    const perspColor = PERSPECTIVE_COLORS[obj.perspective] || '';
                    const isExpanded = expandedObjId === obj.id;
                    const isObjEditing = editingObjId === obj.id;
                    const totalWeight = obj.keyResults.reduce((s, kr) => s + kr.weight, 0);

                    return (
                      <div key={obj.id} className={`bg-white rounded-xl border-2 transition-all ${obj.selected ? 'border-blue-200' : 'border-slate-200 opacity-60'}`}>
                        {/* ── 카드 헤더 (항상 보임) ── */}
                        <div className="p-5 flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={obj.selected}
                            onChange={() => toggleObjective(obj.id)}
                            className="w-5 h-5 mt-1 rounded border-slate-300 text-blue-600"
                          />
                          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedObjId(isExpanded ? null : obj.id)}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base font-extrabold text-blue-600 italic font-serif">O{idx + 1}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>{obj.biiType}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${perspColor}`}>{obj.perspective}</span>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">{obj.name || '(목표를 입력하세요)'}</h3>
                            {obj.rationale && (
                              <p className="text-sm text-slate-500 mt-1">💡 {obj.rationale}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => deleteObjective(obj.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setExpandedObjId(isExpanded ? null : obj.id)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                              {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                            </button>
                          </div>
                        </div>

                        {/* ── 펼친 영역 ── */}
                        {isExpanded && (
                          <div className="px-5 pb-5">

                            {/* Objective 수정 버튼 - 헤더에 바로 연결 */}
                            <div className="pl-9 pb-4">
                              {isObjEditing ? (
                                <div className="space-y-3 bg-blue-50 rounded-lg p-4 border border-blue-200">
                                  <div>
                                    <label className="text-xs text-slate-500 block mb-1">목표명</label>
                                    <input
                                      value={obj.name}
                                      onChange={(e) => handleObjChange(obj.id, 'name', e.target.value)}
                                      className="w-full text-sm font-semibold border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    />
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-1">BII 유형</label>
                                      <select value={obj.biiType} onChange={(e) => handleObjChange(obj.id, 'biiType', e.target.value)}
                                        className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white cursor-pointer">
                                        <option value="Build">Build</option>
                                        <option value="Innovate">Innovate</option>
                                        <option value="Improve">Improve</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 block mb-1">BSC 관점</label>
                                      <select value={obj.perspective} onChange={(e) => handleObjChange(obj.id, 'perspective', e.target.value)}
                                        className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white cursor-pointer">
                                        <option value="재무">재무</option>
                                        <option value="고객">고객</option>
                                        <option value="프로세스">프로세스</option>
                                        <option value="학습성장">학습성장</option>
                                      </select>
                                    </div>
                                  </div>
                                  <button onClick={() => setEditingObjId(null)}
                                    className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg font-medium hover:bg-blue-700">
                                    수정 완료
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => { if (cycleStarted && !confirm('⚠️ 사이클 진행 중입니다. 전사 OKR을 수정하면 하위 조직 초안과 불일치가 발생할 수 있습니다. 계속하시겠습니까?')) return; setEditingObjId(obj.id); }}
                                  className={`px-3 py-1 text-xs rounded-lg font-medium flex items-center gap-1.5 -mt-1 ${cycleStarted ? 'text-amber-600 hover:bg-amber-50' : 'text-blue-600 hover:bg-blue-50'}`}>
                                  <Pencil className="w-3 h-3" /> 목표 수정 {cycleStarted && '⚠️'}
                                </button>
                              )}
                            </div>

                            {/* KR 리스트 - 여기에만 구분선 */}
                            <div className="border-t border-slate-100 pt-4">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-slate-700">
                                  핵심결과 (KR) · 가중치 합계: <span className={totalWeight === 100 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{totalWeight}%</span>
                                </span>
                              </div>
                              <div className="space-y-3">
                                {obj.keyResults.map((kr, kIdx) => {
                                  const isKREditing = editingKRId === kr.id;
                                  return (
                                    <div key={kr.id} className="bg-slate-50 rounded-lg p-4">
                                      {/* KR 요약 (항상 보임) */}
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-extrabold text-indigo-600 italic font-serif flex-shrink-0">KR{kIdx + 1}</span>
                                        <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{kr.unit}</span>
                                        <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">가중치 {kr.weight}%</span>
                                        <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">목표 {kr.targetValue}</span>
                                      </div>
                                      <p className="text-sm font-medium text-slate-900 mb-1">{kr.name}</p>
                                      {kr.definition && <p className="text-xs text-slate-500">{kr.definition}</p>}

                                      {/* KR 수정 영역 (토글) */}
                                      {isKREditing ? (
                                        <div className="mt-3 bg-white rounded-lg p-3 border border-indigo-200 space-y-2">
                                          <div>
                                            <label className="text-[11px] text-slate-500 block mb-0.5">KR명</label>
                                            <input value={kr.name} onChange={(e) => handleKRChange(obj.id, kr.id, 'name', e.target.value)}
                                              className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-400 outline-none" />
                                          </div>
                                          <div className="flex items-center gap-3 flex-wrap">
                                            <div>
                                              <label className="text-[11px] text-slate-500 block mb-0.5">가중치(%)</label>
                                              <input type="number" value={kr.weight} onChange={(e) => handleKRChange(obj.id, kr.id, 'weight', parseInt(e.target.value) || 0)}
                                                className="w-16 text-sm text-center border border-slate-300 rounded px-2 py-1" min={0} max={100} />
                                            </div>
                                            <div>
                                              <label className="text-[11px] text-slate-500 block mb-0.5">목표값</label>
                                              <input type="number" value={kr.targetValue} onChange={(e) => handleKRChange(obj.id, kr.id, 'targetValue', parseFloat(e.target.value) || 0)}
                                                className="w-20 text-sm text-center border border-slate-300 rounded px-2 py-1" />
                                            </div>
                                            <div>
                                              <label className="text-[11px] text-slate-500 block mb-0.5">단위</label>
                                              <select value={kr.unit} onChange={(e) => handleKRChange(obj.id, kr.id, 'unit', e.target.value)}
                                                className="text-sm border border-slate-300 rounded px-2 py-1 cursor-pointer">
                                                {['%', '원', '만원', '억원', '건', '명', '점', '일', '개', '회', '배'].map(u => (
                                                  <option key={u} value={u}>{u}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div>
                                              <label className="text-[11px] text-slate-500 block mb-0.5">유형</label>
                                              <select value={kr.indicatorType} onChange={(e) => handleKRChange(obj.id, kr.id, 'indicatorType', e.target.value)}
                                                className="text-sm border border-slate-300 rounded px-2 py-1 cursor-pointer">
                                                <option value="결과">결과</option>
                                                <option value="과정">과정</option>
                                              </select>
                                            </div>
                                            <div>
                                              <label className="text-[11px] text-slate-500 block mb-0.5">측정주기</label>
                                              <select value={kr.measurementCycle} onChange={(e) => handleKRChange(obj.id, kr.id, 'measurementCycle', e.target.value)}
                                                className="text-sm border border-slate-300 rounded px-2 py-1 cursor-pointer">
                                                <option value="월">월</option>
                                                <option value="분기">분기</option>
                                                <option value="반기">반기</option>
                                                <option value="연">연</option>
                                              </select>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 pt-1">
                                            <button onClick={() => setEditingKRId(null)}
                                              className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-lg font-medium hover:bg-indigo-700">
                                              수정 완료
                                            </button>
                                            <button onClick={() => {
                                                if (!confirm('이 KR을 삭제하시겠습니까?')) return;
                                                setObjectives(prev => prev.map(o =>
                                                  o.id === obj.id ? { ...o, keyResults: o.keyResults.filter(k => k.id !== kr.id) } : o
                                                ));
                                              }}
                                              className="px-3 py-1 text-red-600 text-xs rounded-lg font-medium hover:bg-red-50 border border-red-200">
                                              삭제
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button onClick={() => { if (cycleStarted && !confirm('⚠️ 사이클 진행 중입니다. 수정하시겠습니까?')) return; setEditingKRId(kr.id); }}
                                          className={`mt-2 px-3 py-1 border text-xs rounded-lg font-medium flex items-center gap-1 ${cycleStarted ? 'border-amber-200 text-amber-600 hover:bg-amber-50' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                          <Pencil className="w-3 h-3" /> KR 수정 {cycleStarted && '⚠️'}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center justify-between pt-4">
                  <div className="flex gap-3">
                    <button onClick={addObjective} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> 목표 추가
                    </button>
                    {!cycleStarted && (
                      <button onClick={handleGenerateCompanyOKR} className="px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4" /> AI 다시 생성
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setCurrentStep(1)} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center gap-2">
                      <ChevronLeft className="w-4 h-4" /> 이전
                    </button>
                    {!companyOKRFinalized ? (
                      <button
                        onClick={handleFinalizeCompanyOKR}
                        disabled={!canProceedStep1}
                        className="px-8 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" /> 전사 OKR 확정
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentStep(3)}
                        className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
                      >
                        다음: 전체 조직 초안 생성 <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {companyOKRFinalized && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                      <span className="text-green-800 font-semibold">전사 OKR 확정 완료!</span>
                      <span className="text-green-700 text-sm ml-2">다음 단계에서 전체 조직 초안을 생성할 수 있습니다.</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════ Step 3: 전체 조직 초안 생성 ════════ */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <GitBranch className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">전체 조직 OKR 초안 생성</h2>
                  <p className="text-sm text-slate-500">
                    확정된 전사 OKR을 기반으로 {organizations.filter(o => o.level !== '전사').length}개 하위 조직의 OKR 초안을 AI가 자동 생성합니다
                  </p>
                </div>
              </div>

              {/* 시작 전 */}
              {orgDraftStatuses.length === 0 && !isGeneratingAllDrafts && (
                <div className="text-center py-8">
                  <div className="text-5xl mb-4">🏗️</div>
                  <p className="text-slate-600 mb-6">
                    전사 OKR을 Cascading하여 각 조직별 맞춤 OKR 초안을 생성합니다.
                    <br />각 조직의 유형·기능·미션을 반영하여 자동으로 연결됩니다.
                  </p>
                  <button
                    onClick={handleGenerateAllDrafts}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 text-lg flex items-center gap-2 mx-auto"
                  >
                    <Zap className="w-5 h-5" />
                    전체 조직 초안 생성 시작
                  </button>
                </div>
              )}

              {/* 진행 상태 */}
              {orgDraftStatuses.length > 0 && (
                <div className="space-y-3">
                  {/* 진행률 */}
                  {(() => {
                    const doneCount = orgDraftStatuses.filter(s => s.status === 'done' || s.status === 'error').length;
                    const total = orgDraftStatuses.length;
                    const pct = Math.round((doneCount / total) * 100);
                    const generatingOrg = orgDraftStatuses.find(s => s.status === 'generating');
                    return (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-700">
                            {generatingOrg ? (
                              <><Loader2 className="w-4 h-4 inline animate-spin mr-1 text-indigo-600" /><span className="font-medium">{generatingOrg.orgName}</span> 생성 중...</>
                            ) : doneCount === total ? (
                              <span className="text-green-700 font-medium">✅ 전체 완료</span>
                            ) : (
                              '대기 중...'
                            )}
                          </span>
                          <span className="text-sm font-bold text-slate-700">{doneCount} / {total} ({pct}%)</span>
                        </div>
                        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {isGeneratingAllDrafts && <p className="text-xs text-slate-400 mt-1">조직당 약 20~40초 소요됩니다</p>}
                      </div>
                    );
                  })()}

                  {/* 조직별 상태 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {orgDraftStatuses.map(s => (
                      <div
                        key={s.orgId}
                        onClick={() => s.status === 'done' && handlePreviewOrg(s.orgId, s.orgName, s.level)}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          s.status === 'done' ? 'bg-green-50 border-green-200 cursor-pointer hover:bg-green-100 hover:shadow-sm' :
                          s.status === 'generating' ? 'bg-blue-50 border-blue-200' :
                          s.status === 'error' ? 'bg-red-50 border-red-200' :
                          'bg-slate-50 border-slate-200'
                        }`}
                      >
                        {s.status === 'generating' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                        {s.status === 'done' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                        {s.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
                        {s.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900">{s.orgName}</div>
                          <div className="text-xs text-slate-500">{s.level}</div>
                        </div>
                        {s.status === 'done' && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{s.objectiveCount}개 목표</span>
                        )}
                        {s.status === 'error' && (
                          <span className="text-xs text-red-600">실패</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 완료 후 */}
              {allDraftsComplete && (
                <div className="mt-6 space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <div>
                      <span className="text-green-800 font-semibold">전체 조직 초안 생성 완료!</span>
                      <span className="text-green-700 text-sm ml-2">
                        {orgDraftStatuses.filter(s => s.status === 'done').length}개 조직의 OKR 초안이 준비되었습니다.
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => navigate('/okr-map')}
                      className="px-6 py-2.5 border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-lg font-medium hover:bg-indigo-100 flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" /> OKR Map에서 연결성 확인
                    </button>
                    <button
                      onClick={() => setCurrentStep(4)}
                      className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center gap-2"
                    >
                      다음: 사이클 시작 <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 네비게이션 */}
            <div className="flex justify-between">
              <button onClick={() => setCurrentStep(2)} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> 이전
              </button>
            </div>
          </div>
        )}

        {/* ════════ Step 4: 사이클 시작 ════════ */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Rocket className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">OKR 수립 사이클 시작</h2>
                  <p className="text-sm text-slate-500">마감일을 설정하고 모든 조직장에게 수립 알림을 보냅니다</p>
                </div>
              </div>

              {!cycleStarted ? (
                <div className="space-y-5">
                  {/* 마감일 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">📅 수립 마감일</label>
                    <input
                      type="date"
                      value={deadlineDate}
                      onChange={(e) => setDeadlineDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  {/* 메시지 */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">💬 조직장에게 보낼 메시지</label>
                    <textarea
                      value={cycleMessage}
                      onChange={(e) => setCycleMessage(e.target.value)}
                      placeholder="CEO가 작성한 초안을 바탕으로 조직 OKR을 수정/확정해주세요."
                      rows={3}
                      className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                  </div>

                  {/* 요약 */}
                  <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 space-y-1">
                    <div>📊 전사 OKR: {objectives.filter(o => o.selected).length}개 목표 확정</div>
                    <div>🏢 대상 조직: {organizations.filter(o => o.level !== '전사').length}개</div>
                    <div>📋 AI 초안: {allDraftsComplete ? '✅ 전체 생성 완료' : '⏳ 미생성'}</div>
                  </div>

                  {/* 시작 버튼 */}
                  <button
                    onClick={handleStartCycle}
                    disabled={!deadlineDate || isCycleStarting}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
                  >
                    {isCycleStarting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> 시작 중...</>
                    ) : (
                      <><Megaphone className="w-5 h-5" /> 사이클 시작 & 전체 알림 발송</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">사이클이 시작되었습니다! 🎉</h3>
                  <p className="text-slate-600 mb-6">
                    모든 조직장에게 알림이 발송되었습니다.<br />
                    각 조직장은 각 조직별 OKR 초안 수정을 시작합니다.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => navigate('/okr-setup')}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
                    >
                      <Megaphone className="w-4 h-4" /> 수립 현황 보기
                    </button>
                    <button
                      onClick={() => navigate('/okr-map')}
                      className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center gap-2"
                    >
                      <GitBranch className="w-4 h-4" /> OKR Map 보기
                    </button>
                  </div>

                  {/* 하단 관리 링크 */}
                  <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-center">
                    <button
                      onClick={() => navigate('/admin?tab=cycles')}
                      className="text-sm text-slate-400 hover:text-blue-600 flex items-center gap-1.5 transition-colors"
                    >
                      <Megaphone className="w-3.5 h-3.5" /> 사이클 관리
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 네비게이션 */}
            {!cycleStarted && (
              <div className="flex justify-start max-w-2xl mx-auto">
                <button onClick={() => setCurrentStep(3)} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" /> 이전
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}