// src/pages/CEOOKRSetup.tsx
// CEO 전용 전사 OKR 수립 + 전체 조직 초안 생성 + 사이클 시작 통합 페이지
// Phase 1~3 통합: 컨텍스트 입력 → 전사 OKR 확정 → 전 조직 초안 → 사이클 시작

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Bot, Target, ChevronRight, ChevronLeft, Check, CheckCircle2,
  RefreshCw, Pencil, Trash2, Plus, X, Loader2, ArrowLeft, Send,
  GitBranch, CalendarClock, Megaphone, Zap, Eye, AlertCircle,
  ChevronDown, ChevronUp, Sparkles, Rocket
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { getBIIColor } from '../utils/helpers';
import type { BIIType, Company } from '../types';

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
  { id: 0, name: '경영 컨텍스트', icon: '📋', description: '회사 현황과 전략 방향 입력' },
  { id: 1, name: '전사 OKR 수립', icon: '🎯', description: 'AI 생성 → 수정 → 확정' },
  { id: 2, name: '전체 조직 초안', icon: '🏗️', description: '모든 조직 OKR 초안 일괄 생성' },
  { id: 3, name: '사이클 시작', icon: '🚀', description: '마감일 설정 및 알림 발송' },
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

  // 컨텍스트 로딩은 company 세팅 후
  useEffect(() => {
    if (company?.id) {
      loadExistingContext();
    }
  }, [company?.id]);

  const loadExistingContext = async () => {
    if (!company?.id) return;
    try {
      const { data } = await supabase
        .from('company_okr_contexts')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setContext({
          currentSituation: data.current_situation || '',
          annualGoals: data.annual_goals || '',
          keyStrategies: data.key_strategies || '',
          challenges: data.challenges || '',
          competitiveLandscape: data.competitive_landscape || '',
          additionalContext: data.additional_context || '',
        });
        if (data.status === 'finalized') {
          setContextSaved(true);
        }
      }
    } catch {
      // 첫 사용 - 빈 컨텍스트
    }
  };

  // ─── Step 0: 컨텍스트 저장 ─────────────────────────────

  const handleSaveContext = async () => {
    if (!company?.id || !user?.id) return;

    try {
      // upsert: 같은 회사+기간에 기존 것이 있으면 업데이트
      const { error } = await supabase
        .from('company_okr_contexts')
        .upsert({
          company_id: company.id,
          period: '2025-H1', // TODO: 동적으로
          current_situation: context.currentSituation,
          annual_goals: context.annualGoals,
          key_strategies: context.keyStrategies,
          challenges: context.challenges,
          competitive_landscape: context.competitiveLandscape,
          additional_context: context.additionalContext,
          status: 'draft',
        }, {
          onConflict: 'company_id,period',
          ignoreDuplicates: false,
        });

      // onConflict가 안 되면 그냥 insert 시도
      if (error) {
        // 기존 레코드 업데이트
        const { data: existing } = await supabase
          .from('company_okr_contexts')
          .select('id')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existing) {
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
            .eq('id', existing.id);
        } else {
          // 신규 생성
          await supabase
            .from('company_okr_contexts')
            .insert({
              company_id: company.id,
              period: '2025-H1',
              current_situation: context.currentSituation,
              annual_goals: context.annualGoals,
              key_strategies: context.keyStrategies,
              challenges: context.challenges,
              competitive_landscape: context.competitiveLandscape,
              additional_context: context.additionalContext,
              status: 'draft',
            });
        }
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
        setExpandedObjId(generated[0]?.id || null);
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
    if (!company?.id || !user?.id) return;

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
        .eq('period', '2025-H1');

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
            period: '2025-H1',
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
    if (!company?.id) return;

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
      .eq('period', '2025-H1')
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

    // 상태 초기화
    const statuses: OrgDraftStatus[] = childOrgs.map(org => ({
      orgId: org.id,
      orgName: org.name,
      level: org.level,
      status: 'pending',
      objectiveCount: 0,
    }));
    setOrgDraftStatuses(statuses);
    setIsGeneratingAllDrafts(true);

    // 순차 생성 (API rate limit 고려)
    for (let i = 0; i < childOrgs.length; i++) {
      const org = childOrgs[i];

      // 상태: generating
      setOrgDraftStatuses(prev => prev.map(s =>
        s.orgId === org.id ? { ...s, status: 'generating' } : s
      ));

      try {
        const { data, error } = await supabase.functions.invoke('generate-objectives', {
          body: {
            orgName: org.name,
            orgMission: org.mission || '',
            orgType: org.orgType || 'Front',
            functionTags: org.functionTags || [],
            industry: company.industry,
            cascadingMode: true,
            parentOKRs,
          }
        });

        if (error) throw error;

        if (data?.objectives) {
          // DB에 ai_draft로 저장
          let savedCount = 0;
          
          // 기존 ai_draft 삭제
          const { data: existingObjs } = await supabase
            .from('objectives')
            .select('id')
            .eq('org_id', org.id)
            .eq('period', '2025-H1')
            .eq('source', 'ai_draft');

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
                period: '2025-H1',
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
    if (!company?.id || !user?.id || !deadlineDate) {
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
          period: '2025-H1',
          title: '2025년 상반기 OKR 수립',
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
          .select('profile_id, role:roles(level)')
          .eq('org_id', org.id);

        const leaders = orgMembers?.filter((m: any) => m.role?.level >= 70) || [];

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

  // ─── Render ────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
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
          </div>
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const isActive = idx === currentStep;
              const isDone = idx < currentStep || (idx === 1 && companyOKRFinalized) || (idx === 2 && allDraftsComplete) || (idx === 3 && cycleStarted);
              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div
                    className={`flex items-center gap-3 cursor-pointer ${isActive ? 'opacity-100' : isDone ? 'opacity-80' : 'opacity-40'}`}
                    onClick={() => setCurrentStep(idx)}
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

        {/* ════════ Step 0: 경영 컨텍스트 입력 ════════ */}
        {currentStep === 0 && (
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
                onClick={() => { handleSaveContext(); setCurrentStep(1); }}
                disabled={!canProceedStep0}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                다음: 전사 OKR 생성
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* ════════ Step 1: 전사 OKR 수립 ════════ */}
        {currentStep === 1 && (
          <div className="space-y-6">
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
                <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">AI가 전사 OKR을 생성하고 있습니다...</h3>
                <p className="text-slate-600 mb-4">{company?.industry} 업종 KPI DB를 참조하여 최적의 목표를 설계 중</p>
                <div className="h-2 bg-slate-200 rounded-full max-w-xs mx-auto overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
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
                <div className="space-y-3">
                  {objectives.map((obj, idx) => {
                    const biiColor = BII_COLORS[obj.biiType] || BII_COLORS.Improve;
                    const perspColor = PERSPECTIVE_COLORS[obj.perspective] || '';
                    const isExpanded = expandedObjId === obj.id;
                    const totalWeight = obj.keyResults.reduce((s, kr) => s + kr.weight, 0);

                    return (
                      <div key={obj.id} className={`bg-white rounded-xl border-2 transition-all ${obj.selected ? 'border-blue-200' : 'border-slate-200 opacity-60'}`}>
                        {/* ── 접힌 상태: 1줄 요약 ── */}
                        <div className="px-5 py-4 flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={obj.selected}
                            onChange={() => toggleObjective(obj.id)}
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 flex-shrink-0"
                          />
                          <span className="text-base font-extrabold text-blue-600 italic font-serif w-7 flex-shrink-0">O{idx + 1}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold flex-shrink-0 ${biiColor.bg} ${biiColor.text}`}>{obj.biiType}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold flex-shrink-0 ${perspColor}`}>{obj.perspective}</span>
                          <span className="text-sm font-medium text-slate-900 truncate flex-1">{obj.name || '(목표 입력)'}</span>
                          <span className="text-xs text-slate-400 flex-shrink-0">KR {obj.keyResults.length}개</span>
                          <button
                            onClick={() => setExpandedObjId(isExpanded ? null : obj.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 flex-shrink-0 transition-colors ${isExpanded ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                          >
                            <Pencil className="w-3 h-3" />
                            {isExpanded ? '접기' : '수정'}
                          </button>
                          <button onClick={() => deleteObjective(obj.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-500 flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* ── 펼친 상태: 편집 영역 ── */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 px-5 pb-5">
                            {/* Objective 편집 */}
                            <div className="pt-4 pb-3 space-y-3">
                              <div className="flex items-center gap-3">
                                <label className="text-xs text-slate-500 w-16 flex-shrink-0">목표명</label>
                                <input
                                  value={obj.name}
                                  onChange={(e) => handleObjChange(obj.id, 'name', e.target.value)}
                                  className="flex-1 text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                />
                              </div>
                              <div className="flex items-center gap-3">
                                <label className="text-xs text-slate-500 w-16 flex-shrink-0">BII</label>
                                <select
                                  value={obj.biiType}
                                  onChange={(e) => handleObjChange(obj.id, 'biiType', e.target.value)}
                                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer"
                                >
                                  <option value="Build">Build</option>
                                  <option value="Innovate">Innovate</option>
                                  <option value="Improve">Improve</option>
                                </select>
                                <label className="text-xs text-slate-500 ml-4">관점</label>
                                <select
                                  value={obj.perspective}
                                  onChange={(e) => handleObjChange(obj.id, 'perspective', e.target.value)}
                                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer"
                                >
                                  <option value="재무">재무</option>
                                  <option value="고객">고객</option>
                                  <option value="프로세스">프로세스</option>
                                  <option value="학습성장">학습성장</option>
                                </select>
                              </div>
                              {obj.rationale && (
                                <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">💡 {obj.rationale}</p>
                              )}
                            </div>

                            {/* KR 리스트 */}
                            <div className="pt-2">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-medium text-slate-700">
                                  핵심결과 (KR) · 가중치 합계: <span className={totalWeight === 100 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{totalWeight}%</span>
                                </span>
                              </div>
                              <div className="space-y-2">
                                {obj.keyResults.map((kr, kIdx) => (
                                  <div key={kr.id} className="bg-slate-50 rounded-lg p-3">
                                    {/* KR 1줄: 번호 + 이름 + 핵심 수치 */}
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-xs font-extrabold text-indigo-600 italic font-serif flex-shrink-0">KR{kIdx + 1}</span>
                                      <input
                                        value={kr.name}
                                        onChange={(e) => handleKRChange(obj.id, kr.id, 'name', e.target.value)}
                                        className="flex-1 text-sm font-medium border border-slate-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                                      />
                                      <button
                                        onClick={() => {
                                          if (!confirm('이 KR을 삭제하시겠습니까?')) return;
                                          setObjectives(prev => prev.map(o =>
                                            o.id === obj.id ? { ...o, keyResults: o.keyResults.filter(k => k.id !== kr.id) } : o
                                          ));
                                        }}
                                        className="p-1 hover:bg-red-50 rounded text-slate-300 hover:text-red-500 flex-shrink-0"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    {/* KR 핵심 수치: 가중치 + 목표 + 단위 */}
                                    <div className="flex items-center gap-4 text-xs">
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-500">가중치</span>
                                        <input type="number" value={kr.weight} onChange={(e) => handleKRChange(obj.id, kr.id, 'weight', parseInt(e.target.value) || 0)}
                                          className="w-12 text-center border border-slate-200 rounded px-1 py-0.5 bg-white" min={0} max={100} />
                                        <span className="text-slate-400">%</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-500">목표값</span>
                                        <input type="number" value={kr.targetValue} onChange={(e) => handleKRChange(obj.id, kr.id, 'targetValue', parseFloat(e.target.value) || 0)}
                                          className="w-16 text-center border border-slate-200 rounded px-1 py-0.5 bg-white" />
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-500">단위</span>
                                        <select value={kr.unit} onChange={(e) => handleKRChange(obj.id, kr.id, 'unit', e.target.value)}
                                          className="border border-slate-200 rounded px-1 py-0.5 bg-white cursor-pointer">
                                          {['%', '원', '만원', '억원', '건', '명', '점', '일', '개', '회', '배'].map(u => (
                                            <option key={u} value={u}>{u}</option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-500">유형</span>
                                        <select value={kr.indicatorType} onChange={(e) => handleKRChange(obj.id, kr.id, 'indicatorType', e.target.value)}
                                          className="border border-slate-200 rounded px-1 py-0.5 bg-white cursor-pointer">
                                          <option value="결과">결과</option>
                                          <option value="과정">과정</option>
                                        </select>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-slate-500">주기</span>
                                        <select value={kr.measurementCycle} onChange={(e) => handleKRChange(obj.id, kr.id, 'measurementCycle', e.target.value)}
                                          className="border border-slate-200 rounded px-1 py-0.5 bg-white cursor-pointer">
                                          <option value="월">월</option>
                                          <option value="분기">분기</option>
                                          <option value="반기">반기</option>
                                          <option value="연">연</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                ))}
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
                    <button onClick={handleGenerateCompanyOKR} className="px-4 py-2 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4" /> AI 다시 생성
                    </button>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setCurrentStep(0)} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center gap-2">
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
                        onClick={() => setCurrentStep(2)}
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

        {/* ════════ Step 2: 전체 조직 초안 생성 ════════ */}
        {currentStep === 2 && (
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
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${(orgDraftStatuses.filter(s => s.status === 'done' || s.status === 'error').length / orgDraftStatuses.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {orgDraftStatuses.filter(s => s.status === 'done').length} / {orgDraftStatuses.length}
                    </span>
                  </div>

                  {/* 조직별 상태 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {orgDraftStatuses.map(s => (
                      <div key={s.orgId} className={`flex items-center gap-3 p-3 rounded-lg border ${
                        s.status === 'done' ? 'bg-green-50 border-green-200' :
                        s.status === 'generating' ? 'bg-blue-50 border-blue-200' :
                        s.status === 'error' ? 'bg-red-50 border-red-200' :
                        'bg-slate-50 border-slate-200'
                      }`}>
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
                      onClick={() => setCurrentStep(3)}
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
              <button onClick={() => setCurrentStep(1)} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> 이전
              </button>
            </div>
          </div>
        )}

        {/* ════════ Step 3: 사이클 시작 ════════ */}
        {currentStep === 3 && (
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
                      placeholder="AI가 생성한 초안을 바탕으로 조직 OKR을 수정/확정해주세요."
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
                  <h3 className="text-xl font-bold text-slate-900 mb-2">사이클이 시작되었습니다! 🎉</h3>
                  <p className="text-slate-600 mb-6">모든 조직장에게 알림이 발송되었습니다.</p>
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
                </div>
              )}
            </div>

            {/* 네비게이션 */}
            {!cycleStarted && (
              <div className="flex justify-start max-w-2xl mx-auto">
                <button onClick={() => setCurrentStep(2)} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center gap-2">
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