// src/pages/Wizard.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, Bot, Target, RefreshCw, Pencil, Trash2, 
  ChevronDown, BookOpen, Plus, X, ArrowLeft, Loader2, Check, Search, Star, Database,
  GitBranch, Link2, AlertCircle, FileCheck, Clock, MessageSquare, Send, Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { getBIIColor, getKPICategoryColor } from '../utils/helpers';
import type { BIIType } from '../types';
import OKRCommentPanel from '../components/OKRCommentPanel';

// Wizard 전용 타입
type ApprovalStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revision_requested';

interface ParentOKR {
  objectiveId: string;
  objectiveName: string;
  biiType: string;
  keyResults: string[];
}

interface ObjectiveCandidate {
  id: string;
  name: string;
  biiType: BIIType;
  perspective: string;
  selected: boolean;
  parentObjId?: string | null;
  cascadeType?: string;
  source?: string;
}

interface KRCandidate {
  id: string;
  objectiveId: string;
  name: string;
  definition: string;
  formula: string;
  unit: string;
  weight: number;
  targetValue: number;
  biiType: BIIType;
  kpiCategory: '전략' | '고유업무' | '공통';
  perspective: '재무' | '고객' | '프로세스' | '학습성장';
  indicatorType: '투입' | '과정' | '산출' | '결과';
  measurementCycle: '월' | '분기' | '반기' | '연';
  previousYear: number;
  poolMatch: number;
  gradeCriteria: { S: number; A: number; B: number; C: number; D: number };
  quarterlyTargets: { Q1: number; Q2: number; Q3: number; Q4: number };
}

export default function Wizard() {
  const navigate = useNavigate();
  // URL 파라미터 처리 (조직 ID가 없을 수도 있음)
  const { orgId: urlOrgId } = useParams<{ orgId: string }>();
  const { fetchObjectives, fetchKRs, organizations } = useStore();

  // ==================== State 관리 ====================
  
  // 조직 선택 관련
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(urlOrgId || null);
  const [showOrgSelector, setShowOrgSelector] = useState(!urlOrgId); // URL에 ID가 없으면 선택창 표시

  // 위저드 진행 관련
  const [currentStep, setCurrentStep] = useState(0);
  const [showOneClickModal, setShowOneClickModal] = useState(!urlOrgId); // 조직 선택 후 모달 표시
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 데이터 입력 관련
  const [mission, setMission] = useState('고객 중심의 마케팅 전략을 통한 시장 점유율 확대');
  const [selectedObjectiveTab, setSelectedObjectiveTab] = useState('1');
  const [expandedKR, setExpandedKR] = useState<string | null>(null);
  
  // [New] KR 편집 모드 (수정 중인 KR의 ID)
  const [editingKRId, setEditingKRId] = useState<string | null>(null);
  const [editingObjId, setEditingObjId] = useState<string | null>(null);

  // [New] 회사 업종 (DB에서 가져옴 → Edge Function에 전달)
  const [companyIndustry, setCompanyIndustry] = useState<string>('SaaS/클라우드');

  // [New] Pool에서 선택 모달
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [poolKPIs, setPoolKPIs] = useState<any[]>([]);
  const [poolSearch, setPoolSearch] = useState('');
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolSelectedIds, setPoolSelectedIds] = useState<Set<string>>(new Set());
  const [poolFunctionFilter, setPoolFunctionFilter] = useState('');

  // [New] Cascading 관련
  const [parentOKRs, setParentOKRs] = useState<ParentOKR[]>([]);
  const [parentOrgName, setParentOrgName] = useState<string>('');
  const [parentOrgLevel, setParentOrgLevel] = useState<string>('');
  const [isLoadingParent, setIsLoadingParent] = useState(false);
  const [cascadingLinked, setCascadingLinked] = useState<Record<string, string>>({});

  // [New] 승인 워크플로우
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('draft');
  const [approvalComment, setApprovalComment] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [showReviewRequestModal, setShowReviewRequestModal] = useState(false);
  const [reviewRequestOrgs, setReviewRequestOrgs] = useState<string[]>([]);
  const [reviewRequestMessage, setReviewRequestMessage] = useState('');

  // 현재 선택된 조직 정보 계산
  const orgId = selectedOrgId;
  const currentOrg = organizations.find(o => o.id === orgId);
  const currentOrgName = currentOrg?.name || '우리 조직';

  // ==================== Effects ====================

  // 조직 선택이 완료되면 초기 모달 띄우기
  useEffect(() => {
    if (selectedOrgId && showOrgSelector) {
      setShowOrgSelector(false);
      setShowOneClickModal(true);
    }
  }, [selectedOrgId, showOrgSelector]);

  // [New] 회사 industry 가져오기
  useEffect(() => {
    const fetchCompanyIndustry = async () => {
      const targetOrgId = selectedOrgId || urlOrgId;
      if (!targetOrgId) return;
      
      const targetOrg = organizations.find(o => o.id === targetOrgId);
      if (!targetOrg?.companyId) return;
      
      try {
        const { data } = await supabase
          .from('companies')
          .select('industry')
          .eq('id', targetOrg.companyId)
          .single();
        
        if (data?.industry) {
          setCompanyIndustry(data.industry);
        }
      } catch (err) {
        console.warn('회사 업종 조회 실패, 기본값 사용:', err);
      }
    };
    fetchCompanyIndustry();
  }, [selectedOrgId, urlOrgId, organizations]);

  // ==================== Data States ====================

  // AI 초안 로딩 상태
  const [isLoadingDraft, setIsLoadingDraft] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  // 상위 조직 OKR (Cascading 시각화용)
  interface ParentObjective {
    id: string;
    name: string;
    biiType: string;
    orgName: string;
  }
  const [parentObjectives, setParentObjectives] = useState<ParentObjective[]>([]);

  const [objectives, setObjectives] = useState<ObjectiveCandidate[]>([]);

  const [krs, setKrs] = useState<(KRCandidate & { selected?: boolean; parentObjId?: string | null })[]>([]);

  // ==================== AI 초안 자동 로딩 ====================

  useEffect(() => {
    const targetOrgId = selectedOrgId || urlOrgId;
    if (!targetOrgId) return;

    loadDraftFromDB(targetOrgId);
    loadParentOKRs(targetOrgId);
  }, [selectedOrgId, urlOrgId]);

  // DB에서 AI 초안 로딩
  const loadDraftFromDB = async (targetOrgId: string) => {
    setIsLoadingDraft(true);
    try {
      // 해당 조직의 objectives 조회 (ai_draft 또는 draft)
      const { data: objs, error: objErr } = await supabase
        .from('objectives')
        .select(`
          id, name, bii_type, period, status, source, sort_order,
          parent_obj_id, cascade_type, approval_status
        `)
        .eq('org_id', targetOrgId)
        .eq('period', '2025-H1')
        .in('source', ['ai_draft', 'manual'])
        .order('sort_order');

      if (objErr) throw objErr;

      if (objs && objs.length > 0) {
        setHasDraft(true);

        // Objectives 변환
        const loadedObjectives: ObjectiveCandidate[] = objs.map((obj: any) => ({
          id: obj.id,
          name: obj.name,
          biiType: obj.bii_type || 'Improve',
          perspective: '재무', // DB에 perspective 없으면 기본값
          selected: true,
          parentObjId: obj.parent_obj_id,
          cascadeType: obj.cascade_type || 'independent',
          source: obj.source,
        }));
        setObjectives(loadedObjectives);
        setSelectedObjectiveTab(loadedObjectives[0]?.id || '');

        // 각 objective의 KR 조회
        const objIds = objs.map((o: any) => o.id);
        const { data: allKRs } = await supabase
          .from('key_results')
          .select('*')
          .in('objective_id', objIds)
          .order('created_at');

        if (allKRs && allKRs.length > 0) {
          const loadedKRs = allKRs.map((kr: any) => ({
            id: kr.id,
            objectiveId: kr.objective_id,
            name: kr.name,
            definition: kr.definition || '',
            formula: kr.formula || '',
            unit: kr.unit || '%',
            weight: kr.weight || 20,
            targetValue: kr.target_value || 100,
            biiType: (kr.bii_type || 'Improve') as BIIType,
            kpiCategory: (kr.kpi_category || '전략') as any,
            perspective: (kr.perspective || '재무') as any,
            indicatorType: (kr.indicator_type || '결과') as any,
            measurementCycle: (kr.measurement_cycle || '월') as any,
            previousYear: 0,
            poolMatch: 0,
            gradeCriteria: kr.grade_criteria || { S: 120, A: 110, B: 100, C: 90, D: 0 },
            quarterlyTargets: kr.quarterly_targets || { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
            selected: true,
            parentObjId: kr.parent_obj_id || null,
          }));
          setKrs(loadedKRs);
        }

        // 초안이 있으면 바로 KR 설정 단계로
        setShowOneClickModal(false);
        setCurrentStep(2);
      } else {
        setHasDraft(false);
        // 초안 없으면 원클릭 모달
        if (!urlOrgId) setShowOneClickModal(true);
      }
    } catch (err) {
      console.error('AI 초안 로딩 실패:', err);
    } finally {
      setIsLoadingDraft(false);
    }
  };

  // 상위 조직 OKR 로딩 (Cascading 시각화용)
  const loadParentOKRs = async (targetOrgId: string) => {
    try {
      const currentOrg = organizations.find(o => o.id === targetOrgId);
      if (!currentOrg?.parentOrgId) return;

      // 상위 조직 찾기 (전사까지)
      const parentIds: string[] = [];
      let cursor = currentOrg.parentOrgId;
      while (cursor) {
        parentIds.push(cursor);
        const parent = organizations.find(o => o.id === cursor);
        cursor = parent?.parentOrgId || null;
      }

      if (parentIds.length === 0) return;

      // 상위 조직들의 확정된 objectives
      const { data: parentObjs } = await supabase
        .from('objectives')
        .select('id, name, bii_type, org_id, status')
        .in('org_id', parentIds)
        .eq('period', '2025-H1')
        .in('status', ['finalized', 'active', 'draft']);

      if (parentObjs) {
        const mapped: ParentObjective[] = parentObjs.map((po: any) => {
          const org = organizations.find(o => o.id === po.org_id);
          return {
            id: po.id,
            name: po.name,
            biiType: po.bii_type || 'Improve',
            orgName: org?.name || '상위 조직',
          };
        });
        setParentObjectives(mapped);
      }
    } catch (err) {
      console.error('상위 OKR 로딩 실패:', err);
    }
  };

  // ==================== Handlers ====================

  // 조직 선택 핸들러
  const handleSelectOrg = (selectOrgId: string) => {
    setSelectedOrgId(selectOrgId);
    navigate(`/wizard/${selectOrgId}`, { replace: true });
  };

  // KR 체크박스 토글
  const toggleKR = (krId: string) => {
    setKrs(krs.map(kr => 
      kr.id === krId ? { ...kr, selected: !kr.selected } : kr
    ));
  };

  // KR 값 변경 핸들러 (편집 모드용)
  const handleKRChange = (krId: string, field: string, value: any) => {
    setKrs(prev => prev.map(kr => 
      kr.id === krId ? { ...kr, [field]: value } : kr
    ));
  };

  // 목표 선택 토글
  const toggleObjective = (id: string) => {
    setObjectives(objectives.map(obj =>
      obj.id === id ? { ...obj, selected: !obj.selected } : obj
    ));
  };

  // KR 수동 추가
  const handleAddKR = () => {
    const newKR: KRCandidate & { selected: boolean } = {
      id: `kr-new-${Date.now()}`,
      objectiveId: selectedObjectiveTab,
      name: '새 KR',
      definition: '',
      formula: '',
      unit: '%',
      weight: 10,
      targetValue: 100,
      biiType: 'Improve',
      kpiCategory: '전략',
      perspective: '재무',
      indicatorType: '결과',
      measurementCycle: '월',
      previousYear: 0,
      poolMatch: 0,
      gradeCriteria: { S: 120, A: 110, B: 100, C: 90, D: 0 },
      quarterlyTargets: { Q1: 25, Q2: 50, Q3: 75, Q4: 100 },
      selected: true
    };
    setKrs([...krs, newKR]);
    setExpandedKR(newKR.id);
    setEditingKRId(newKR.id); // 추가하자마자 편집 모드
  };

  // [New] Pool 모달 열기 - DB에서 KPI 검색
  const handleOpenPoolModal = async () => {
    setShowPoolModal(true);
    setPoolSelectedIds(new Set());
    setPoolSearch('');
    setPoolFunctionFilter('');
    await fetchPoolKPIs('', '');
  };

  // [New] Pool KPI 검색
  const fetchPoolKPIs = async (search: string, fnFilter: string) => {
    setPoolLoading(true);
    try {
      let query = supabase
        .from('kpi_pool')
        .select('*')
        .order('relevance_score', { ascending: false })
        .limit(50);

      // 업종 필터 (현재 회사 업종)
      if (companyIndustry) {
        query = query.contains('industry_tags', [companyIndustry]);
      }

      // 텍스트 검색
      if (search) {
        query = query.or(`name.ilike.%${search}%,definition.ilike.%${search}%`);
      }

      // 기능 필터
      if (fnFilter) {
        query = query.contains('function_tags', [fnFilter]);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPoolKPIs(data || []);
    } catch (err) {
      console.error('Pool 조회 오류:', err);
    } finally {
      setPoolLoading(false);
    }
  };

  // [New] Pool 검색 디바운스
  useEffect(() => {
    if (!showPoolModal) return;
    const timer = setTimeout(() => {
      fetchPoolKPIs(poolSearch, poolFunctionFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [poolSearch, poolFunctionFilter, showPoolModal]);

  // [New] Pool 체크박스 토글
  const togglePoolSelection = (id: string) => {
    setPoolSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // [New] Pool에서 선택한 KPI를 KR로 추가
  const handleAddFromPool = () => {
    const currentObj = objectives.find(o => o.id === selectedObjectiveTab);
    if (!currentObj) return;

    const selectedPoolKPIs = poolKPIs.filter(k => poolSelectedIds.has(k.id));
    const newKRs: (KRCandidate & { selected: boolean })[] = selectedPoolKPIs.map((pk, idx) => ({
      id: `kr-pool-${Date.now()}-${idx}`,
      objectiveId: selectedObjectiveTab,
      name: pk.name,
      definition: pk.definition || '',
      formula: pk.formula || '',
      unit: pk.unit || '%',
      weight: pk.weight_range?.typical || 15,
      targetValue: pk.typical_target?.median || 100,
      biiType: (pk.bii_type?.[0] || currentObj.biiType) as BIIType,
      kpiCategory: '전략' as const,
      perspective: (pk.perspective || currentObj.perspective) as any,
      indicatorType: (pk.indicator_type || '결과') as any,
      measurementCycle: (pk.measurement_cycle || '월') as any,
      previousYear: 0,
      poolMatch: pk.relevance_score || 80,
      gradeCriteria: pk.grade_template || { S: 120, A: 110, B: 100, C: 90, D: 0 },
      quarterlyTargets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
      selected: true
    }));

    setKrs(prev => [...prev, ...newKRs]);
    setShowPoolModal(false);
    alert(`✅ ${newKRs.length}개 KR을 Pool에서 추가했습니다!`);
  };

  // AI KR 추천 (v2: industry, orgType 추가)
  const handleAIRegenerateKRs = async () => {
    const currentObj = objectives.find(o => o.id === selectedObjectiveTab);
    if (!currentObj) return;

    setIsAIGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-krs', {
        body: {
          objectiveName: currentObj.name,
          objectiveType: currentObj.biiType,
          perspective: currentObj.perspective,
          // v2: 새 파라미터 추가
          orgType: currentOrg?.orgType || 'Front',
          functionTags: currentOrg?.functionTags || [],
          industry: companyIndustry
        }
      });

      if (error) throw error;

      if (data && data.krs) {
        const aiKRs: (KRCandidate & { selected: boolean })[] = data.krs.map((item: any, idx: number) => ({
          id: `kr-ai-${Date.now()}-${idx}`,
          objectiveId: selectedObjectiveTab,
          name: item.name,
          definition: item.definition || '',
          formula: item.formula || '실적 측정',
          unit: item.unit || '건',
          weight: item.weight || 30,
          targetValue: item.targetValue || 100,
          biiType: item.biiType || currentObj.biiType,
          kpiCategory: '전략',
          perspective: item.perspective || currentObj.perspective,
          indicatorType: item.indicatorType || (item.type === '결과' ? '결과' : '과정'),
          measurementCycle: item.measurementCycle || '월',
          previousYear: 0,
          poolMatch: item.poolMatch || 0,
          gradeCriteria: item.gradeCriteria || { S: 120, A: 110, B: 100, C: 90, D: 0 },
          quarterlyTargets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
          selected: true
        }));
        
        setKrs(prev => [
          ...prev.filter(kr => kr.objectiveId !== selectedObjectiveTab),
          ...aiKRs
        ]);
        
        alert('🤖 AI가 해당 목표에 맞는 새로운 KR을 생성했습니다!');
      }
      
    } catch (error: any) {
      console.error('AI KR Error:', error);
      alert(`AI 생성 실패: ${error.message}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // AI 원클릭 전체 생성
  const handleOneClickGenerate = async () => {
    setIsAIGenerating(true);
    setShowOneClickModal(false);

    try {
      // v2: generate-objectives 사용 (one-click-generate 없음)
      const { data, error } = await supabase.functions.invoke('generate-objectives', {
        body: {
          orgName: currentOrgName,
          orgMission: mission,
          orgType: currentOrg?.orgType || 'Front',
          functionTags: currentOrg?.functionTags || [],
          industry: companyIndustry
        }
      });

      if (error) throw error;

      if (data && data.objectives) {
        const newObjectives = data.objectives.map((obj: any, idx: number) => ({
          id: String(idx + 1),
          name: obj.name,
          biiType: obj.biiType || 'Improve',
          perspective: obj.perspective || '재무',
          selected: true 
        }));
        setObjectives(newObjectives);

        // 목표 생성 후 각 목표에 대해 KR도 자동 생성
        const allNewKRs: (KRCandidate & { selected: boolean })[] = [];
        
        for (const obj of data.objectives) {
          const objIdx = data.objectives.indexOf(obj);
          try {
            const { data: krData } = await supabase.functions.invoke('generate-krs', {
              body: {
                objectiveName: obj.name,
                objectiveType: obj.biiType || 'Improve',
                perspective: obj.perspective || '재무',
                orgType: currentOrg?.orgType || 'Front',
                functionTags: currentOrg?.functionTags || [],
                industry: companyIndustry
              }
            });

            if (krData?.krs) {
              krData.krs.forEach((kr: any, krIdx: number) => {
                allNewKRs.push({
                  id: `kr-${objIdx}-${krIdx}`,
                  objectiveId: String(objIdx + 1),
                  name: kr.name,
                  definition: kr.definition || kr.name,
                  formula: kr.formula || '실적 측정',
                  unit: kr.unit || '건',
                  weight: kr.weight || 20,
                  targetValue: kr.targetValue || 100,
                  biiType: kr.biiType || obj.biiType || 'Improve',
                  kpiCategory: kr.kpiCategory || '전략',
                  perspective: kr.perspective || obj.perspective || '재무',
                  indicatorType: kr.indicatorType || '결과',
                  measurementCycle: kr.measurementCycle || '월',
                  previousYear: 0,
                  poolMatch: kr.poolMatch || 0,
                  gradeCriteria: kr.gradeCriteria || { S: 120, A: 110, B: 100, C: 90, D: 0 },
                  quarterlyTargets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
                  selected: true
                });
              });
            }
          } catch (krErr) {
            console.warn(`KR 생성 실패 (목표 ${objIdx + 1}):`, krErr);
          }
        }

        if (allNewKRs.length > 0) {
          setKrs(allNewKRs);
        }

        setCurrentStep(4);
        alert('✨ AI가 OKR 전체 세트를 생성했습니다! 내용을 확인해주세요.');
      }

    } catch (error: any) {
      console.error('AI Error:', error);
      alert(`생성 실패: ${error.message}`);
      setShowOneClickModal(true); 
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 위저드 시작 (수동)
  const handleStartWizard = () => {
    setShowOneClickModal(false);
    setCurrentStep(0);
  };

  // 상위 조직에 제출
  const handleSubmitForApproval = async () => {
    if (!orgId) return;
    if (!confirm('목표를 상위 조직에 제출하시겠습니까?')) return;

    try {
      // 모든 objectives의 approval_status를 submitted로 업데이트
      const selectedIds = objectives.filter(o => o.selected && o.source).map(o => o.id);
      if (selectedIds.length > 0) {
        await supabase
          .from('objectives')
          .update({ approval_status: 'submitted', status: 'submitted' })
          .in('id', selectedIds);
      }
      setApprovalStatus('submitted');
      setSubmittedAt(new Date().toISOString());
      alert('✅ 제출되었습니다. 상위 조직의 검토를 기다려주세요.');
    } catch (err: any) {
      alert(`제출 실패: ${err.message}`);
    }
  };

  // 유관부서 검토 요청 발송
  const handleSendReviewRequest = async () => {
    if (reviewRequestOrgs.length === 0) return;
    try {
      // TODO: notifications 테이블에 검토 요청 알림 insert
      alert(`✅ ${reviewRequestOrgs.length}개 조직에 검토 요청을 발송했습니다.`);
      setShowReviewRequestModal(false);
      setReviewRequestOrgs([]);
      setReviewRequestMessage('');
    } catch (err: any) {
      alert(`발송 실패: ${err.message}`);
    }
  };

  // AI 목표 생성 핸들러 (Step 1) - v2: industry 동적
  const handleAIGenerateObjectives = async () => {
    setIsAIGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-objectives', {
        body: {
          orgName: currentOrgName,
          orgMission: mission,
          orgType: currentOrg?.orgType || 'Front',
          functionTags: currentOrg?.functionTags || [],
          industry: companyIndustry
        }
      });

      if (error) throw error;

      if (data && data.objectives) {
        const newObjectives = data.objectives.map((obj: any, index: number) => ({
          id: String(index + 1), 
          name: obj.name,
          biiType: obj.biiType || 'Improve',
          perspective: obj.perspective || '재무',
          selected: index < 3
        }));
        setObjectives(newObjectives);
      }

    } catch (error: any) {
      console.error('AI Error:', error);
      alert(`AI 생성 실패: ${error.message}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // 최종 저장
  const handleSave = async () => {
    if (!orgId) {
      alert('조직 ID가 없습니다. 다시 시도해주세요.');
      return;
    }

    if (!confirm('목표를 저장하시겠습니까?')) return;

    setIsSaving(true);
    try {
      const selectedObjectives = objectives.filter(o => o.selected);
      
      for (const obj of selectedObjectives) {
        let savedObjId = obj.id;

        // 기존 DB 레코드면 update, 새로 만든 거면 insert
        const isExisting = obj.source === 'ai_draft' || obj.source === 'manual';

        if (isExisting && obj.id && !obj.id.startsWith('obj-new-')) {
          // UPDATE 기존 objective
          const { error: objError } = await supabase
            .from('objectives')
            .update({
              name: obj.name,
              bii_type: obj.biiType,
              source: 'manual', // 수정했으니 manual로
              status: 'draft',
              approval_status: 'draft',
            })
            .eq('id', obj.id);

          if (objError) throw new Error(`목표 수정 실패: ${objError.message}`);
        } else {
          // INSERT 새 objective
          const { data: savedObj, error: objError } = await supabase
            .from('objectives')
            .insert({
              org_id: orgId,
              name: obj.name,
              bii_type: obj.biiType,
              period: '2025-H1',
              status: 'draft',
              source: 'manual',
              approval_status: 'draft',
              parent_obj_id: obj.parentObjId || null,
              cascade_type: obj.cascadeType || 'independent',
              sort_order: parseInt(obj.id) || 0
            })
            .select()
            .single();

          if (objError) throw new Error(`목표 저장 실패: ${objError.message}`);
          if (!savedObj) continue;
          savedObjId = savedObj.id;
        }

        // KR 처리: 해당 objective의 KR들
        const relatedKRs = krs.filter(k => k.objectiveId === obj.id && k.selected !== false);
        
        for (const kr of relatedKRs) {
          const krPayload = {
            name: kr.name,
            definition: kr.definition,
            formula: kr.formula,
            unit: kr.unit,
            weight: kr.weight,
            target_value: kr.targetValue,
            bii_type: kr.biiType,
            kpi_category: kr.kpiCategory,
            perspective: kr.perspective,
            indicator_type: kr.indicatorType,
            measurement_cycle: kr.measurementCycle,
            grade_criteria: kr.gradeCriteria,
            quarterly_targets: kr.quarterlyTargets,
          };

          const isExistingKR = kr.id && !kr.id.startsWith('kr-new-') && !kr.id.startsWith('kr-ai-') && !kr.id.startsWith('kr-pool-');

          if (isExistingKR) {
            const { error } = await supabase
              .from('key_results')
              .update({ ...krPayload, source: 'manual' })
              .eq('id', kr.id);
            if (error) throw new Error(`KR 수정 실패: ${error.message}`);
          } else {
            const { error } = await supabase
              .from('key_results')
              .insert({
                ...krPayload,
                objective_id: savedObjId,
                org_id: orgId,
                current_value: 0,
                source: 'manual',
                status: 'draft'
              });
            if (error) throw new Error(`KR 저장 실패: ${error.message}`);
          }
        }

        // 선택 해제된 KR 삭제
        const deselectedKRs = krs.filter(k => k.objectiveId === obj.id && k.selected === false);
        for (const dk of deselectedKRs) {
          if (dk.id && !dk.id.startsWith('kr-new-')) {
            await supabase.from('key_results').delete().eq('id', dk.id);
          }
        }
      }

      // 선택 해제된 Objective 삭제
      const deselectedObjs = objectives.filter(o => !o.selected && o.source);
      for (const dobj of deselectedObjs) {
        if (dobj.id && !dobj.id.startsWith('obj-new-')) {
          await supabase.from('key_results').delete().eq('objective_id', dobj.id);
          await supabase.from('objectives').delete().eq('id', dobj.id);
        }
      }

      await fetchObjectives(orgId);
      await fetchKRs(orgId);
      
      alert('✅ 저장되었습니다!');
      navigate('/okr/team'); 

    } catch (error: any) {
      console.error(error);
      alert(`저장 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper Values
  const steps = [
    { id: 0, name: '전략방향', description: '전사 전략 및 조직 미션 확인' },
    { id: 1, name: '목표수립', description: '3-5개 핵심 목표 선정' },
    { id: 2, name: 'KR설정', description: '각 목표별 핵심결과 정의' },
    { id: 3, name: '세부설정', description: 'Cascading 및 공통 KPI 설정' },
    { id: 4, name: '최종확인', description: '종합 점검 및 확정' },
  ];

  const biiBalance = {
    Build: objectives.filter(o => o.selected && o.biiType === 'Build').length,
    Innovate: objectives.filter(o => o.selected && o.biiType === 'Innovate').length,
    Improve: objectives.filter(o => o.selected && o.biiType === 'Improve').length,
  };

  const selectedKRs = krs.filter(kr => kr.selected !== false);
  const totalWeight = selectedKRs
    .filter(kr => kr.objectiveId === selectedObjectiveTab)
    .reduce((sum, kr) => sum + kr.weight, 0);

  // ==================== Render ====================

  // [화면 1] 조직 선택 화면 (URL 파라미터 없을 때)
  if (showOrgSelector) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">조직 선택</h2>
            <button 
              onClick={() => navigate(-1)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <p className="text-slate-600 mb-6">
            목표를 수립할 조직을 선택해주세요
          </p>

          {/* 전사 OKR은 CEO OKR 수립 메뉴에서 수립 — 여기서는 하위 조직만 */}

          {/* 부문 */}
          {organizations.filter(o => o.level === '부문').length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">부문</h3>
              <div className="grid grid-cols-2 gap-3">
                {organizations
                  .filter(o => o.level === '부문')
                  .map(org => (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org.id)}
                      className="text-left border-2 border-slate-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <div className="text-sm text-slate-500">{org.level} • {org.orgType}</div>
                      <div className="text-base font-semibold text-slate-900 mt-1">{org.name}</div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* 본부 */}
          {organizations.filter(o => o.level === '본부').length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">본부</h3>
              <div className="grid grid-cols-2 gap-3">
                {organizations
                  .filter(o => o.level === '본부')
                  .map(org => (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org.id)}
                      className="text-left border-2 border-slate-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <div className="text-sm text-slate-500">{org.level} • {org.orgType}</div>
                      <div className="text-base font-semibold text-slate-900 mt-1">{org.name}</div>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* 팀 */}
          {organizations.filter(o => o.level === '팀').length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">팀</h3>
              <div className="grid grid-cols-2 gap-3">
                {organizations
                  .filter(o => o.level === '팀')
                  .map(org => (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org.id)}
                      className="text-left border-2 border-slate-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <div className="text-sm text-slate-500">{org.level} • {org.orgType}</div>
                      <div className="text-base font-semibold text-slate-900 mt-1">{org.name}</div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // [예외처리] 잘못된 접근
  if (!orgId) {
    return (
      <div className="p-6 text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
          <p className="text-red-800 mb-2">조직 정보를 불러올 수 없습니다</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // [로딩] AI 초안 불러오는 중
  if (isLoadingDraft) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">초안을 불러오는 중...</h3>
          <p className="text-sm text-slate-500">{currentOrgName}의 OKR 데이터를 확인하고 있습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      {!showOneClickModal && (
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
            title="뒤로 가기"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">목표 수립 ({currentOrgName})</h1>
          <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {companyIndustry}
          </span>
          {hasDraft && (
            <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Bot className="w-3 h-3" />
              CEO 초안 기반
            </span>
          )}
        </div>
      )}

      {/* 모달: 수립 방식 선택 (초안이 없을 때만) */}
      {showOneClickModal && !hasDraft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-3xl w-full mx-4 relative">
            <button 
              onClick={() => navigate(-1)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-slate-900 mb-2">{currentOrgName} 목표 수립</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  CEO가 배포한 초안이 아직 없습니다. 직접 수립하거나 AI를 활용해 생성하세요.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="border-2 border-slate-200 rounded-xl p-6 hover:border-blue-600 transition-all cursor-pointer">
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">AI 전체 생성</h3>
                <p className="text-sm text-slate-600 mb-4">
                  AI가 조직정보를 분석하여 목표+KR을 한번에 생성합니다.
                </p>
                <button
                  onClick={handleOneClickGenerate}
                  className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors"
                >
                  🚀 전체 생성
                </button>
              </div>

              <div className="border-2 border-slate-200 rounded-xl p-6 hover:border-blue-600 transition-all cursor-pointer">
                <div className="text-3xl mb-3">📝</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">위저드로 직접 수립</h3>
                <p className="text-sm text-slate-600 mb-4">
                  단계를 따라가며 직접 수립합니다. AI가 각 단계에서 보조합니다.
                </p>
                <button
                  onClick={handleStartWizard}
                  className="w-full bg-slate-100 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-200 transition-colors"
                >
                  📝 시작하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 오버레이 */}
      {isAIGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">AI가 분석 중입니다...</h3>
            <p className="text-slate-600 mb-4">
              {companyIndustry} 업종의 KPI DB를 참조하여 최적의 목표를 생성하고 있습니다.
            </p>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      )}

      {isSaving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">저장 중입니다...</h3>
            <p className="text-slate-600">DB에 데이터를 기록하고 있습니다.</p>
          </div>
        </div>
      )}

      {/* Pool에서 선택 모달 */}
      {showPoolModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl mx-4 max-h-[85vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="p-6 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Database className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-900">KR Pool에서 선택</h2>
                  <span className="text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{companyIndustry}</span>
                </div>
                <button onClick={() => setShowPoolModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* 검색 & 필터 */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="KR명, 정의 검색..."
                    value={poolSearch}
                    onChange={(e) => setPoolSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <select
                  value={poolFunctionFilter}
                  onChange={(e) => setPoolFunctionFilter(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[140px]"
                >
                  <option value="">전체 기능</option>
                  <option value="영업">영업</option>
                  <option value="마케팅">마케팅</option>
                  <option value="R&D/연구개발">R&D/연구개발</option>
                  <option value="생산/제조">생산/제조</option>
                  <option value="품질">품질</option>
                  <option value="구매/조달">구매/조달</option>
                  <option value="HR/인사">HR/인사</option>
                  <option value="재무/회계">재무/회계</option>
                  <option value="IT/정보시스템">IT/정보시스템</option>
                  <option value="경영기획">경영기획</option>
                  <option value="SCM/물류">SCM/물류</option>
                  <option value="고객서비스/CS">고객서비스/CS</option>
                  <option value="설비/시설">설비/시설</option>
                  <option value="법무/컴플라이언스">법무/컴플라이언스</option>
                  <option value="사업개발">사업개발</option>
                </select>
              </div>
            </div>

            {/* 모달 바디 - KPI 리스트 */}
            <div className="flex-1 overflow-y-auto p-6">
              {poolLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <span className="ml-3 text-slate-500">검색 중...</span>
                </div>
              ) : poolKPIs.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">검색 결과가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {poolKPIs.map((pk) => {
                    const isChecked = poolSelectedIds.has(pk.id);
                    const biiColor = getBIIColor((pk.bii_type?.[0] || 'Improve') as BIIType);
                    const perspColors: Record<string, string> = {
                      '재무': 'bg-emerald-100 text-emerald-700',
                      '고객': 'bg-sky-100 text-sky-700',
                      '프로세스': 'bg-amber-100 text-amber-700',
                      '학습성장': 'bg-violet-100 text-violet-700',
                    };
                    const pColor = perspColors[pk.perspective] || 'bg-slate-100 text-slate-600';

                    return (
                      <div
                        key={pk.id}
                        onClick={() => togglePoolSelection(pk.id)}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          isChecked 
                            ? 'border-blue-500 bg-blue-50/50' 
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-900 text-sm">{pk.name}</span>
                              {pk.is_mandatory && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-500 mb-2 line-clamp-1">{pk.definition}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                                {pk.bii_type?.[0] || 'Improve'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${pColor}`}>
                                {pk.perspective}
                              </span>
                              <span className="text-xs text-slate-400">{pk.unit}</span>
                              <span className="text-xs text-slate-400">•</span>
                              <span className="text-xs text-slate-400">{pk.indicator_type}</span>
                              {pk.formula && (
                                <>
                                  <span className="text-xs text-slate-400">•</span>
                                  <span className="text-xs text-slate-400 truncate max-w-[200px]">{pk.formula}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs text-slate-400">관련도</div>
                            <div className="text-sm font-semibold text-blue-600">{pk.relevance_score}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0 bg-slate-50">
              <div className="text-sm text-slate-600">
                {poolSelectedIds.size > 0 
                  ? <span className="font-medium text-blue-600">{poolSelectedIds.size}개 선택됨</span>
                  : <span>{poolKPIs.length}개 KR 검색됨</span>
                }
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPoolModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  onClick={handleAddFromPool}
                  disabled={poolSelectedIds.size === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {poolSelectedIds.size}개 추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 mb-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                  currentStep === index
                    ? 'bg-blue-600 text-white'
                    : currentStep > index
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {currentStep > index ? '✓' : index + 1}
                </div>
                <div className="mt-2 text-center">
                  <div className={`text-sm font-medium ${currentStep === index ? 'text-blue-600' : 'text-slate-600'}`}>
                    {step.name}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-20 h-1 mx-2 ${currentStep > index ? 'bg-green-600' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        
        {/* Step 0: 전략 방향 */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">전략 방향 확인</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h3 className="font-semibold text-blue-900 mb-2">전사 전략방향</h3>
              <p className="text-blue-700">디지털 혁신을 통한 지속 가능한 성장과 고객 가치 창출</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">우리 조직 미션</label>
              <textarea
                value={mission}
                onChange={(e) => setMission(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                rows={4}
              />
              <button className="mt-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg hover:from-blue-700 hover:to-violet-700 transition-colors text-sm font-medium flex items-center gap-2">
                <Bot className="w-4 h-4" />
                AI 미션 제안
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-600">
                💡 좋은 미션은 Build, Innovate, Improve 중 하나의 방향을 내포합니다
              </p>
            </div>
          </div>
        )}

        {/* Step 1: 목표 수립 */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">목표(Objective) 수립</h2>
              <div className="bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">BII 밸런스</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Build:</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-600" style={{ width: `${biiBalance.Build * 20}%` }} />
                    </div>
                    <span className="font-medium">{biiBalance.Build}개</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Innovate:</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${biiBalance.Innovate * 20}%` }} />
                    </div>
                    <span className="font-medium">{biiBalance.Innovate}개</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Improve:</span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-600" style={{ width: `${biiBalance.Improve * 20}%` }} />
                    </div>
                    <span className="font-medium">{biiBalance.Improve}개</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-slate-600">
              {hasDraft 
                ? '📋 CEO가 배포한 초안 목표입니다. 검토 후 선택/수정/추가하세요.' 
                : '🤖 AI가 목표 후보를 생성했습니다. 3~5개를 선택해주세요.'}
            </p>

            {/* 상위 조직 목표 참조 (접이식) */}
            {parentObjectives.length > 0 && (
              <details className="bg-violet-50 border border-violet-200 rounded-xl">
                <summary className="cursor-pointer px-4 py-3 flex items-center gap-2 text-sm font-semibold text-violet-900">
                  <GitBranch className="w-4 h-4 text-violet-600" />
                  상위 조직 목표 참조 ({parentObjectives.length}개)
                </summary>
                <div className="px-4 pb-3 space-y-1.5">
                  {parentObjectives.map(po => (
                    <div key={po.id} className="flex items-center gap-2 bg-white/60 rounded-lg px-3 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getBIIColor(po.biiType as BIIType).bg} ${getBIIColor(po.biiType as BIIType).text}`}>
                        {po.biiType}
                      </span>
                      <span className="text-xs text-violet-600 font-medium">{po.orgName}</span>
                      <span className="text-xs text-slate-400">›</span>
                      <span className="text-sm text-slate-800">{po.name}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="grid grid-cols-2 gap-4">
              {objectives.map((obj) => {
                const biiColor = getBIIColor(obj.biiType);
                const isEditing = editingObjId === obj.id;
                return (
                  <div
                    key={obj.id}
                    className={`border-2 rounded-xl p-4 transition-all ${
                      obj.selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={obj.selected}
                        onChange={() => toggleObjective(obj.id)}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={obj.name}
                              onChange={(e) => setObjectives(prev => prev.map(o => 
                                o.id === obj.id ? { ...o, name: e.target.value } : o
                              ))}
                              className="w-full px-2 py-1.5 border border-blue-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="목표명을 입력하세요"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <select
                                value={obj.biiType}
                                onChange={(e) => setObjectives(prev => prev.map(o => 
                                  o.id === obj.id ? { ...o, biiType: e.target.value as BIIType } : o
                                ))}
                                className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
                              >
                                <option value="Build">Build</option>
                                <option value="Innovate">Innovate</option>
                                <option value="Improve">Improve</option>
                              </select>
                              <select
                                value={obj.perspective}
                                onChange={(e) => setObjectives(prev => prev.map(o => 
                                  o.id === obj.id ? { ...o, perspective: e.target.value } : o
                                ))}
                                className="flex-1 px-2 py-1 border border-slate-300 rounded text-xs"
                              >
                                <option value="재무">재무</option>
                                <option value="고객">고객</option>
                                <option value="프로세스">프로세스</option>
                                <option value="학습성장">학습성장</option>
                              </select>
                            </div>
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => setEditingObjId(null)}
                                className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                              >
                                완료
                              </button>
                              <button
                                onClick={() => {
                                  setObjectives(prev => prev.filter(o => o.id !== obj.id));
                                  setEditingObjId(null);
                                }}
                                className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-xs font-medium"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            onClick={() => toggleObjective(obj.id)}
                            className="cursor-pointer"
                          >
                            <h3 className="font-medium text-slate-900 mb-2">{obj.name || '(이름 없음)'}</h3>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                                {obj.biiType}
                              </span>
                              <span className="text-xs text-slate-600">{obj.perspective} 관점</span>
                            </div>
                            {/* 상위 목표 연결 배지 */}
                            {(() => {
                              const parentObj = parentObjectives.find(po => po.id === obj.parentObjId);
                              return parentObj ? (
                                <div className="flex items-center gap-1.5 mt-2 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1">
                                  <Link2 className="w-3 h-3 text-violet-500 flex-shrink-0" />
                                  <span className="text-xs text-violet-700 truncate">
                                    ← {parentObj.orgName}: {parentObj.name}
                                  </span>
                                </div>
                              ) : obj.source === 'ai_draft' ? (
                                <div className="flex items-center gap-1 mt-2">
                                  <span className="text-xs text-slate-400">독립 목표</span>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                      {!isEditing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingObjId(obj.id);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="수정"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleAIGenerateObjectives}
                disabled={isAIGenerating}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isAIGenerating ? 'animate-spin' : ''}`} />
                {isAIGenerating ? '생성 중...' : 'AI 재생성'}
              </button>
              <button 
                onClick={() => {
                  const newId = `obj-new-${Date.now()}`;
                  const newObj: ObjectiveCandidate = {
                    id: newId,
                    name: '',
                    biiType: 'Improve',
                    perspective: '재무',
                    selected: true
                  };
                  setObjectives(prev => [...prev, newObj]);
                  setEditingObjId(newId);
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                직접 추가
              </button>
            </div>
          </div>
        )}

        {/* Step 2: OKR 검토 및 수정 — Objective별 통합 카드 */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* AI 초안 안내 배너 */}
            {hasDraft && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Bot className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-blue-900 font-semibold text-sm">CEO가 배포한 AI 초안이 로딩되었습니다</p>
                  <p className="text-blue-700 text-xs mt-1">
                    각 목표와 KR을 검토한 후 자유롭게 수정하세요. 수정이 완료되면 "최종 확인" 단계에서 제출합니다.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">OKR 검토 및 수정</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleAddKR}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> KR 추가
                </button>
                <button
                  onClick={handleOpenPoolModal}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Pool
                </button>
              </div>
            </div>

            {/* ── Objective별 통합 카드 ── */}
            {objectives.filter(o => o.selected).map((obj, objIdx) => {
              const biiColor = getBIIColor(obj.biiType);
              const parentObj = parentObjectives.find(po => po.id === obj.parentObjId);
              const objKRs = krs.filter(kr => kr.objectiveId === obj.id && kr.selected !== false);
              const isEditingObj = editingObjId === obj.id;

              return (
                <div key={obj.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  
                  {/* ── 상위 연결 헤더 ── */}
                  {parentObj && (
                    <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-violet-200 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5 text-violet-500" />
                        <span className="text-xs font-medium text-violet-600">상위 목표에서 계승</span>
                        <span className="text-xs text-violet-400">|</span>
                        <span className="text-xs text-violet-500">{parentObj.orgName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs font-bold text-violet-500 bg-violet-100 px-1.5 py-0.5 rounded">
                          O{parentObjectives.filter(po => po.orgName === parentObj.orgName).indexOf(parentObj) + 1}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getBIIColor(parentObj.biiType as BIIType).bg} ${getBIIColor(parentObj.biiType as BIIType).text}`}>
                          {parentObj.biiType}
                        </span>
                        <span className="text-sm text-violet-900">{parentObj.name}</span>
                      </div>
                    </div>
                  )}

                  {/* ── Objective 본문 ── */}
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* 넘버링 */}
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                          O{objIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          {isEditingObj ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={obj.name}
                                onChange={(e) => setObjectives(prev => prev.map(o =>
                                  o.id === obj.id ? { ...o, name: e.target.value } : o
                                ))}
                                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                              />
                              <div className="flex gap-2 items-center">
                                <select
                                  value={obj.biiType}
                                  onChange={(e) => setObjectives(prev => prev.map(o =>
                                    o.id === obj.id ? { ...o, biiType: e.target.value as BIIType } : o
                                  ))}
                                  className="px-2 py-1 border border-slate-300 rounded text-xs"
                                >
                                  <option value="Build">Build</option>
                                  <option value="Innovate">Innovate</option>
                                  <option value="Improve">Improve</option>
                                </select>
                                <select
                                  value={obj.perspective}
                                  onChange={(e) => setObjectives(prev => prev.map(o =>
                                    o.id === obj.id ? { ...o, perspective: e.target.value } : o
                                  ))}
                                  className="px-2 py-1 border border-slate-300 rounded text-xs"
                                >
                                  <option value="재무">재무</option>
                                  <option value="고객">고객</option>
                                  <option value="프로세스">프로세스</option>
                                  <option value="학습성장">학습성장</option>
                                </select>
                                <button
                                  onClick={() => setEditingObjId(null)}
                                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                                >
                                  완료
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <h3 className="font-bold text-slate-900 text-base leading-snug">{obj.name}</h3>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                                  {obj.biiType}
                                </span>
                                <span className="text-xs text-slate-500">{obj.perspective} 관점</span>
                                {!parentObj && obj.source === 'ai_draft' && (
                                  <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">독립</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      {!isEditingObj && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setEditingObjId(obj.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="목표 수정"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('이 목표를 삭제하시겠습니까? 하위 KR도 함께 삭제됩니다.')) {
                                setObjectives(prev => prev.map(o =>
                                  o.id === obj.id ? { ...o, selected: false } : o
                                ));
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="목표 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── KR 리스트 ── */}
                  <div className="px-5 pb-4 space-y-2">
                    {objKRs.length === 0 ? (
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-slate-400">KR이 없습니다</p>
                        <button
                          onClick={() => {
                            setSelectedObjectiveTab(obj.id);
                            handleAddKR();
                          }}
                          className="mt-2 text-xs text-blue-600 hover:underline"
                        >
                          + KR 추가
                        </button>
                      </div>
                    ) : (
                      objKRs.map((kr, krIdx) => {
                        const krBiiColor = getBIIColor(kr.biiType);
                        const categoryColor = getKPICategoryColor(kr.kpiCategory);
                        const isEditing = editingKRId === kr.id;

                        return (
                          <div
                            key={kr.id}
                            className={`border rounded-xl transition-all ${
                              isEditing ? 'border-blue-300 bg-blue-50/30' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                            }`}
                          >
                            {/* KR 헤더 (항상 표시) */}
                            <div className="flex items-center gap-3 px-4 py-3">
                              <span className="text-xs font-bold text-blue-500 w-7 flex-shrink-0">
                                KR{krIdx + 1}
                              </span>
                              
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={kr.name}
                                  onChange={(e) => handleKRChange(kr.id, 'name', e.target.value)}
                                  className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              ) : (
                                <span className="flex-1 text-sm font-medium text-slate-800 min-w-0 truncate">
                                  {kr.name}
                                </span>
                              )}

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${krBiiColor.bg} ${krBiiColor.text}`}>
                                  {kr.biiType}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${categoryColor}`}>
                                  {kr.kpiCategory}
                                </span>
                                <span className="text-xs text-slate-500 font-medium w-16 text-right">
                                  {kr.targetValue.toLocaleString()}{kr.unit}
                                </span>
                                <span className="text-xs text-slate-400 w-10 text-right">{kr.weight}%</span>

                                {isEditing ? (
                                  <button
                                    onClick={() => setEditingKRId(null)}
                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                    title="완료"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setEditingKRId(kr.id)}
                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                    title="수정"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setKrs(krs.filter(k => k.id !== kr.id))}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                  title="삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* KR 상세 (편집 모드일 때만) */}
                            {isEditing && (
                              <div className="px-4 pb-4 pt-1 space-y-3 border-t border-blue-200">
                                {/* 정의 & 산식 */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">정의</label>
                                    <input
                                      type="text"
                                      value={kr.definition}
                                      onChange={(e) => handleKRChange(kr.id, 'definition', e.target.value)}
                                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">산식</label>
                                    <input
                                      type="text"
                                      value={kr.formula}
                                      onChange={(e) => handleKRChange(kr.id, 'formula', e.target.value)}
                                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                </div>

                                {/* 목표값, 단위, 유형, 주기, 관점, 가중치 */}
                                <div className="grid grid-cols-6 gap-2">
                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">목표값</label>
                                    <input
                                      type="number"
                                      value={kr.targetValue}
                                      onChange={(e) => handleKRChange(kr.id, 'targetValue', parseInt(e.target.value) || 0)}
                                      className="w-full border border-blue-300 bg-blue-50 rounded px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">단위</label>
                                    <input
                                      type="text"
                                      value={kr.unit}
                                      onChange={(e) => handleKRChange(kr.id, 'unit', e.target.value)}
                                      className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">유형</label>
                                    <select
                                      value={kr.indicatorType}
                                      onChange={(e) => handleKRChange(kr.id, 'indicatorType', e.target.value)}
                                      className="w-full border border-slate-300 rounded px-1 py-1.5 text-sm"
                                    >
                                      <option>투입</option><option>과정</option><option>산출</option><option>결과</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">주기</label>
                                    <select
                                      value={kr.measurementCycle}
                                      onChange={(e) => handleKRChange(kr.id, 'measurementCycle', e.target.value)}
                                      className="w-full border border-slate-300 rounded px-1 py-1.5 text-sm"
                                    >
                                      <option>월</option><option>분기</option><option>반기</option><option>연</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">관점</label>
                                    <select
                                      value={kr.perspective}
                                      onChange={(e) => handleKRChange(kr.id, 'perspective', e.target.value)}
                                      className="w-full border border-slate-300 rounded px-1 py-1.5 text-sm"
                                    >
                                      <option>재무</option><option>고객</option><option>프로세스</option><option>학습성장</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs text-slate-500 mb-1">가중치</label>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={kr.weight}
                                        onChange={(e) => handleKRChange(kr.id, 'weight', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                                        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-center"
                                      />
                                      <span className="text-xs text-slate-500">%</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 등급 구간 */}
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">등급 구간 (S / A / B / C / D)</label>
                                  <div className="flex gap-2">
                                    {(['S', 'A', 'B', 'C', 'D'] as const).map((grade) => (
                                      <div key={grade} className="flex-1">
                                        <div className="text-center text-xs text-slate-400 mb-0.5">{grade}</div>
                                        <input
                                          type="number"
                                          value={kr.gradeCriteria[grade]}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setKrs(prev => prev.map(k =>
                                              k.id === kr.id
                                                ? { ...k, gradeCriteria: { ...k.gradeCriteria, [grade]: val } }
                                                : k
                                            ));
                                          }}
                                          className="w-full border border-slate-200 rounded px-1 py-1 text-xs text-center"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* AI 보조 버튼 */}
                                <div className="flex gap-2">
                                  <button className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-violet-700 flex items-center gap-1">
                                    <Bot className="w-3.5 h-3.5" />
                                    AI가 완성해줘
                                  </button>
                                  <button className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50">
                                    📊 전년실적 참조
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* Objective 내 KR 추가 버튼 */}
                    <button
                      onClick={() => {
                        setSelectedObjectiveTab(obj.id);
                        handleAddKR();
                      }}
                      className="w-full border border-dashed border-slate-300 rounded-xl py-2.5 text-xs text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> KR 추가
                    </button>

                    {/* Objective별 가중치 합계 */}
                    {objKRs.length > 0 && (
                      <div className="flex items-center justify-between px-1 pt-1">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{objKRs.length}개 KR</span>
                        </div>
                        {(() => {
                          const sum = objKRs.reduce((s, k) => s + k.weight, 0);
                          return (
                            <span className={`text-xs font-medium ${sum === 100 ? 'text-green-600' : 'text-red-500'}`}>
                              가중치: {sum}% {sum === 100 ? '✅' : sum > 100 ? `(${sum - 100}% 초과)` : `(${100 - sum}% 부족)`}
                            </span>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 하단 액션 */}
            <div className="flex gap-2">
              <button
                onClick={handleAIRegenerateKRs}
                disabled={isAIGenerating}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isAIGenerating ? 'animate-spin' : ''}`} />
                {isAIGenerating ? '생성 중...' : 'AI KR 재추천'}
              </button>
              <button
                onClick={handleOpenPoolModal}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center gap-2"
              >
                <Database className="w-4 h-4" /> Pool에서 선택
              </button>
            </div>
          </div>
        )}
        {/* Step 3: 세부 설정 */}
        {currentStep === 3 && (() => {
          const selectedObjs = objectives.filter(o => o.selected);
          const activeKRs = krs.filter(kr => kr.selected !== false);
          
          // Objective별 가중치 합계 검증
          const objWeightMap = selectedObjs.map(obj => {
            const objKRs = activeKRs.filter(kr => kr.objectiveId === obj.id);
            const sum = objKRs.reduce((s, k) => s + k.weight, 0);
            return { objId: obj.id, objName: obj.name, sum, valid: sum === 100, krCount: objKRs.length };
          });
          const allValid = objWeightMap.every(o => o.valid);

          return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">세부 설정</h2>
            <p className="text-slate-600">각 Objective 내 KR 가중치를 100%로 배분하고, Cascading·분기목표를 설정합니다</p>

            {/* 섹션 1: Objective별 KR 가중치 배분 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  ⚖️ KR 가중치 배분
                  <span className="text-xs text-slate-400 font-normal">(Objective별 합계 100%)</span>
                </h3>
                <button
                  onClick={() => {
                    // 모든 Objective에 대해 균등배분
                    setKrs(prev => {
                      const next = [...prev];
                      selectedObjs.forEach(obj => {
                        const objKRIds = next.filter(kr => kr.objectiveId === obj.id && kr.selected !== false).map(kr => kr.id);
                        const count = objKRIds.length;
                        if (count === 0) return;
                        const base = Math.floor(100 / count);
                        const remainder = 100 - base * count;
                        let idx = 0;
                        for (let i = 0; i < next.length; i++) {
                          if (objKRIds.includes(next[i].id)) {
                            next[i] = { ...next[i], weight: base + (idx < remainder ? 1 : 0) };
                            idx++;
                          }
                        }
                      });
                      return next;
                    });
                  }}
                  className="px-3 py-1.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg text-xs font-medium hover:bg-blue-100"
                >
                  🔄 전체 균등배분
                </button>
              </div>

              <div className="space-y-5">
                {selectedObjs.map((obj, objIdx) => {
                  const objKRs = activeKRs.filter(kr => kr.objectiveId === obj.id);
                  const info = objWeightMap.find(o => o.objId === obj.id)!;
                  const biiColor = getBIIColor(obj.biiType);
                  
                  return (
                    <div key={obj.id} className={`border rounded-xl overflow-hidden ${info.valid ? 'border-slate-200' : 'border-red-300'}`}>
                      {/* Objective 헤더 */}
                      <div className={`px-4 py-3 flex items-center justify-between ${info.valid ? 'bg-slate-50' : 'bg-red-50'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 w-6">O{objIdx + 1}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                            {obj.biiType}
                          </span>
                          <span className="font-medium text-slate-900 text-sm">{obj.name}</span>
                          <span className="text-xs text-slate-400">({info.krCount}개 KR)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${info.valid ? 'text-green-600' : 'text-red-600'}`}>
                            {info.sum}% {info.valid ? '✅' : '❌'}
                          </span>
                          <button
                            onClick={() => {
                              // 이 Objective만 균등배분
                              setKrs(prev => {
                                const next = [...prev];
                                const objKRIds = next.filter(kr => kr.objectiveId === obj.id && kr.selected !== false).map(kr => kr.id);
                                const count = objKRIds.length;
                                if (count === 0) return next;
                                const base = Math.floor(100 / count);
                                const remainder = 100 - base * count;
                                let idx = 0;
                                for (let i = 0; i < next.length; i++) {
                                  if (objKRIds.includes(next[i].id)) {
                                    next[i] = { ...next[i], weight: base + (idx < remainder ? 1 : 0) };
                                    idx++;
                                  }
                                }
                                return next;
                              });
                            }}
                            className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                          >
                            균등
                          </button>
                        </div>
                      </div>

                      {/* KR 가중치 슬라이더 */}
                      <div className="p-4 space-y-3">
                        {objKRs.map((kr, krIdx) => (
                          <div key={kr.id} className="flex items-center gap-4">
                            <span className="text-xs font-bold text-blue-400 w-8 flex-shrink-0">KR{krIdx + 1}</span>
                            <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">{kr.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={kr.weight}
                                onChange={(e) => {
                                  const newWeight = parseInt(e.target.value);
                                  setKrs(prev => prev.map(k => 
                                    k.id === kr.id ? { ...k, weight: newWeight } : k
                                  ));
                                }}
                                className="w-28 accent-blue-600"
                              />
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={kr.weight}
                                onChange={(e) => {
                                  const newWeight = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                  setKrs(prev => prev.map(k => 
                                    k.id === kr.id ? { ...k, weight: newWeight } : k
                                  ));
                                }}
                                className="w-14 text-center border border-slate-300 rounded py-1 text-sm font-medium"
                              />
                              <span className="text-xs text-slate-500">%</span>
                            </div>
                          </div>
                        ))}
                        {objKRs.length === 0 && (
                          <p className="text-sm text-slate-400 italic">이 목표에 KR이 없습니다</p>
                        )}

                        {/* Objective별 가중치 바 */}
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex mt-2">
                          {objKRs.map((kr, i) => {
                            const krColors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-cyan-500'];
                            return kr.weight > 0 ? (
                              <div
                                key={kr.id}
                                className={`${krColors[i % krColors.length]} transition-all`}
                                style={{ width: `${kr.weight}%` }}
                                title={`${kr.name}: ${kr.weight}%`}
                              />
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 섹션 2: Cascading (Alignment) */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                🔗 Cascading 확인 (Alignment)
              </h3>
              <div className="space-y-3">
                {selectedObjs.map(obj => {
                  const parentOrg = organizations.find(o => {
                    const currentOrg = organizations.find(c => c.id === orgId);
                    return currentOrg?.parentId && o.id === currentOrg.parentId;
                  });
                  
                  return (
                    <div key={obj.id} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getBIIColor(obj.biiType).bg} ${getBIIColor(obj.biiType).text}`}>
                            {obj.biiType}
                          </span>
                          <span className="text-sm font-medium text-slate-900 truncate">{obj.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-slate-400">←</span>
                        <select
                          className="border border-slate-300 rounded px-2 py-1 text-xs min-w-[140px]"
                          defaultValue=""
                        >
                          <option value="">상위 목표 선택 (선택사항)</option>
                          {parentOrg && (
                            <option value="parent-cascade">📌 {parentOrg.name} 목표 계승</option>
                          )}
                          <option value="independent">독립 목표</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                💡 상위 조직 목표가 설정된 후 연결하면 정렬도가 자동 계산됩니다
              </p>
            </div>

            {/* 섹션 3: 분기별 목표 일괄 설정 */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  📅 분기별 목표 배분
                </h3>
                <button
                  onClick={() => {
                    // 연간 목표의 25%씩 균등 배분
                    setKrs(prev => prev.map(kr => ({
                      ...kr,
                      quarterlyTargets: {
                        Q1: Math.round(kr.targetValue * 0.25),
                        Q2: Math.round(kr.targetValue * 0.50),
                        Q3: Math.round(kr.targetValue * 0.75),
                        Q4: kr.targetValue
                      }
                    })));
                  }}
                  className="px-3 py-1.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg text-xs font-medium hover:bg-blue-100"
                >
                  📊 누적형 균등배분
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 pr-4 text-xs font-medium text-slate-500">KR명</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-slate-500 w-20">연간</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-slate-500 w-20">Q1</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-slate-500 w-20">Q2</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-slate-500 w-20">Q3</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-slate-500 w-20">Q4</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeKRs.map(kr => (
                      <tr key={kr.id}>
                        <td className="py-2 pr-4 text-slate-700 truncate max-w-[200px]">
                          {kr.name}
                          <span className="text-xs text-slate-400 ml-1">({kr.unit})</span>
                        </td>
                        <td className="py-2 px-2 text-center font-medium text-slate-900">{kr.targetValue}</td>
                        {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => (
                          <td key={q} className="py-2 px-1">
                            <input
                              type="number"
                              value={kr.quarterlyTargets[q]}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setKrs(prev => prev.map(k => 
                                  k.id === kr.id 
                                    ? { ...k, quarterlyTargets: { ...k.quarterlyTargets, [q]: val } }
                                    : k
                                ));
                              }}
                              className="w-full text-center border border-slate-200 rounded py-1 text-xs"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 경고/안내 */}
            {!allValid && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-700 mb-2">⚠️ 가중치가 100%가 아닌 Objective가 있습니다</p>
                <div className="space-y-1">
                  {objWeightMap.filter(o => !o.valid).map(o => (
                    <p key={o.objId} className="text-xs text-red-600">
                      • {o.objName}: 현재 {o.sum}% ({o.sum > 100 ? `${o.sum - 100}% 초과` : `${100 - o.sum}% 부족`})
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* Step 4: 최종 확인 */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">최종 확인 & 확정</h2>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">BII 밸런스</div>
                <div className="text-xs text-green-700">
                  B:{krs.filter(k => k.biiType === 'Build').length} I:{krs.filter(k => k.biiType === 'Innovate').length} Im:{krs.filter(k => k.biiType === 'Improve').length}
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">가중치 검증</div>
                <div className="text-xs text-green-700">
                  {objectives.filter(o => o.selected).map(obj => {
                    const sum = krs.filter(k => k.objectiveId === obj.id && k.selected !== false).reduce((s, k) => s + k.weight, 0);
                    return `${obj.name.substring(0, 6)}:${sum}%`;
                  }).join(' / ')} ✅
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">Alignment</div>
                <div className="text-xs text-green-700">수직 ✅ 수평 ✅</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">BII 체크리스트</div>
                <div className="text-xs text-green-700">평균 10.2/12 ✅</div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">목표</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">KR</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">가중치</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">목표값</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">등급구간</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">BII</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">유형</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {objectives.filter(o => o.selected).map((obj) => {
                    const objKrs = krs.filter(kr => kr.objectiveId === obj.id && kr.selected !== false);
                    return objKrs.map((kr, idx) => {
                      const biiColor = getBIIColor(kr.biiType);
                      const categoryColor = getKPICategoryColor(kr.kpiCategory);
                      return (
                        <tr key={kr.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-700">
                            {idx === 0 ? obj.name.substring(0, 20) + '...' : ''}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-slate-900">{kr.name}</div>
                            <div className="text-xs text-slate-500">{kr.definition.substring(0, 30)}...</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-semibold text-slate-900">{kr.weight}%</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-medium text-slate-900">{kr.targetValue.toLocaleString()}</span>
                            <span className="text-xs text-slate-500 ml-1">{kr.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="text-xs text-slate-600">
                              <span className="text-blue-600">S:{kr.gradeCriteria.S}</span>
                              <span className="mx-1">/</span>
                              <span className="text-green-600">A:{kr.gradeCriteria.A}</span>
                              <span className="mx-1">/</span>
                              <span className="text-lime-600">B:{kr.gradeCriteria.B}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                              {kr.biiType}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${categoryColor}`}>
                              {kr.kpiCategory}
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-medium text-slate-700">합계</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-green-600">{krs.filter(k => k.selected !== false).reduce((s, k) => s + k.weight, 0)}%</span>
                    </td>
                    <td colSpan={4} className="px-4 py-3 text-right text-sm text-slate-600">
                      총 {krs.filter(k => k.selected !== false).length}개 KR
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? '저장 중...' : '✅ KR 세트 확정 (DB 저장)'}
              </button>
              <button 
                onClick={() => setShowReviewRequestModal(true)}
                className="px-6 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors"
              >
                📨 리뷰 요청 발송
              </button>
              <button className="px-6 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors">
                📥 엑셀 다운로드
              </button>
            </div>

            {/* OKR 토론/코멘트 패널 */}
            <div className="mt-6">
              <OKRCommentPanel
                objectiveId={objectives.filter(o => o.selected)[0]?.id}
                compact={false}
              />
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* Step 5: 제출 & 승인 워크플로우 */}
        {/* ============================================================ */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">제출 & 승인</h2>

            {/* 승인 상태 카드 */}
            <div className={`border-2 rounded-xl p-6 ${
              approvalStatus === 'draft' ? 'border-slate-300 bg-slate-50' :
              approvalStatus === 'submitted' ? 'border-blue-300 bg-blue-50' :
              approvalStatus === 'approved' ? 'border-green-300 bg-green-50' :
              approvalStatus === 'rejected' ? 'border-red-300 bg-red-50' :
              approvalStatus === 'revision_requested' ? 'border-amber-300 bg-amber-50' :
              'border-slate-300 bg-slate-50'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <FileCheck className={`w-6 h-6 ${
                    approvalStatus === 'approved' ? 'text-green-600' :
                    approvalStatus === 'rejected' ? 'text-red-600' :
                    approvalStatus === 'submitted' ? 'text-blue-600' :
                    'text-slate-400'
                  }`} />
                  <div>
                    <h3 className="font-semibold text-slate-900">승인 상태</h3>
                    <p className="text-sm text-slate-600">
                      {approvalStatus === 'draft' && '초안 작성 중 - 제출 전입니다'}
                      {approvalStatus === 'submitted' && `제출 완료 - ${parentOrgName || '상위 조직장'} 검토 대기 중`}
                      {approvalStatus === 'approved' && '✅ 승인 완료'}
                      {approvalStatus === 'rejected' && '❌ 반려됨 - 수정 후 재제출 필요'}
                      {approvalStatus === 'revision_requested' && '⚠️ 수정 요청됨'}
                    </p>
                  </div>
                </div>
                {submittedAt && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(submittedAt).toLocaleString('ko-KR')}
                  </div>
                )}
              </div>

              {/* 승인 프로세스 타임라인 */}
              <div className="flex items-center gap-0 mb-6">
                {[
                  { key: 'draft', label: '초안', icon: '📝' },
                  { key: 'submitted', label: '제출', icon: '📤' },
                  { key: 'under_review', label: '검토중', icon: '🔍' },
                  { key: 'approved', label: '승인', icon: '✅' },
                ].map((step, idx) => {
                  const stages = ['draft', 'submitted', 'under_review', 'approved'];
                  const currentIdx = stages.indexOf(approvalStatus === 'rejected' || approvalStatus === 'revision_requested' ? 'submitted' : approvalStatus);
                  const stepIdx = stages.indexOf(step.key);
                  const isActive = stepIdx <= currentIdx;
                  const isCurrent = step.key === approvalStatus;
                  return (
                    <div key={step.key} className="flex items-center flex-1">
                      <div className={`flex flex-col items-center ${isCurrent ? 'scale-110' : ''}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'
                        } ${isCurrent ? 'ring-4 ring-blue-200' : ''}`}>
                          {step.icon}
                        </div>
                        <span className={`text-xs mt-1 ${isActive ? 'text-blue-700 font-medium' : 'text-slate-400'}`}>
                          {step.label}
                        </span>
                      </div>
                      {idx < 3 && (
                        <div className={`flex-1 h-0.5 mx-1 ${stepIdx < currentIdx ? 'bg-blue-400' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 반려/수정요청 코멘트 */}
              {(approvalStatus === 'rejected' || approvalStatus === 'revision_requested') && reviewComment && (
                <div className="bg-white border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-red-800">검토 의견</span>
                  </div>
                  <p className="text-sm text-red-700">{reviewComment}</p>
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="space-y-3">
              {(approvalStatus === 'draft' || approvalStatus === 'revision_requested' || approvalStatus === 'rejected') && (
                <div className="flex gap-3">
                  <button onClick={handleSubmitForApproval} className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    {approvalStatus === 'draft' ? '상위 조직에 제출' : '수정 후 재제출'}
                  </button>
                  <button onClick={handleSave} disabled={isSaving} className="px-6 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors">
                    💾 임시 저장
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setShowReviewRequestModal(true)} className="flex-1 border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-lg py-3 font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />유관부서 검토 요청
                </button>
                <button className="flex-1 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                  <Link2 className="w-4 h-4" />Alignment 현황 보기
                </button>
              </div>
            </div>

            {/* Cascading 상태 요약 */}
            {parentOKRs.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Cascading 연결 현황</span>
                </div>
                <div className="space-y-2">
                  {objectives.filter(o => o.selected).map(obj => {
                    const linked = cascadingLinked[obj.id];
                    const parentObj = parentOKRs.find(p => p.objective.id === linked);
                    return (
                      <div key={obj.id} className="flex items-center gap-2 text-sm">
                        <span className="text-slate-600">{obj.name.substring(0, 25)}...</span>
                        {parentObj ? (
                          <>
                            <span className="text-blue-400">←</span>
                            <span className="text-blue-600 text-xs bg-blue-50 px-2 py-0.5 rounded">{parentObj.objective.name.substring(0, 20)}...</span>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">독립</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* OKR 토론/코멘트 패널 (승인 과정 논의용) */}
            <OKRCommentPanel
              objectiveId={objectives.filter(o => o.selected)[0]?.id}
              compact={false}
            />
          </div>
        )}

        {/* 유관부서 검토 요청 모달 */}
        {showReviewRequestModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900">유관부서 검토 요청</h3>
                <button onClick={() => setShowReviewRequestModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-slate-600 mb-4">검토를 요청할 조직을 선택하고 메시지를 작성해주세요.</p>
              <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
                {organizations.filter(o => o.id !== orgId && o.level !== '전사').map(org => (
                  <label key={org.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={reviewRequestOrgs.includes(org.id)} onChange={(e) => { if (e.target.checked) setReviewRequestOrgs(prev => [...prev, org.id]); else setReviewRequestOrgs(prev => prev.filter(id => id !== org.id)); }} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                    <div><span className="text-sm font-medium text-slate-900">{org.name}</span><span className="text-xs text-slate-500 ml-2">{org.level}</span></div>
                  </label>
                ))}
              </div>
              <textarea value={reviewRequestMessage} onChange={(e) => setReviewRequestMessage(e.target.value)} placeholder="검토 요청 메시지를 작성해주세요..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4 resize-none" rows={3} />
              <div className="flex gap-3">
                <button onClick={handleSendReviewRequest} disabled={reviewRequestOrgs.length === 0} className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <Send className="w-4 h-4" />{reviewRequestOrgs.length}개 조직에 요청 발송
                </button>
                <button onClick={() => setShowReviewRequestModal(false)} className="px-4 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-50">취소</button>
              </div>
            </div>
          </div>
        )}

        {/* 네비게이션 버튼 */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </button>
          <button
            onClick={() => {
              if (currentStep === 3) {
                const selObjs = objectives.filter(o => o.selected);
                const actKRs = krs.filter(kr => kr.selected !== false);
                const invalid = selObjs.filter(obj => {
                  const sum = actKRs.filter(kr => kr.objectiveId === obj.id).reduce((s, k) => s + k.weight, 0);
                  return sum !== 100;
                });
                if (invalid.length > 0) {
                  alert(`다음 Objective의 KR 가중치 합계가 100%가 아닙니다:\n${invalid.map(o => `• ${o.name}`).join('\n')}`);
                  return;
                }
              }
              setCurrentStep(Math.min(5, currentStep + 1));
            }}
            disabled={currentStep === 5}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            다음
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}