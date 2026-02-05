// src/pages/Wizard.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Bot, Target, RefreshCw, Pencil, Trash2, ChevronDown, BookOpen, Plus, X, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase'; // Supabase 클라이언트
import { useStore } from '../store/useStore'; // Store (조직정보, 리프레시용)
import { getBIIColor, getKPICategoryColor } from '../utils/helpers';
import type { BIIType } from '../types';

interface ObjectiveCandidate {
  id: string;
  name: string;
  biiType: BIIType;
  perspective: string;
  selected: boolean;
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
  const { orgId: urlOrgId } = useParams<{ orgId: string }>();  // 변수명 변경
  const { fetchObjectives, fetchKRs, organizations } = useStore();

  // 조직 선택 state 추가
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(urlOrgId || null);
  const [showOrgSelector, setShowOrgSelector] = useState(!urlOrgId);

  const [currentStep, setCurrentStep] = useState(0);
  const [showOneClickModal, setShowOneClickModal] = useState(!urlOrgId); // 조건 변경
  
  // 로딩 상태들
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [mission, setMission] = useState('고객 중심의 마케팅 전략을 통한 시장 점유율 확대');
  const [selectedObjectiveTab, setSelectedObjectiveTab] = useState('1');
  const [expandedKR, setExpandedKR] = useState<string | null>(null);

 // 조직 ID는 선택된 ID 사용
  const orgId = selectedOrgId;
  const currentOrg = organizations.find(o => o.id === orgId);
  const currentOrgName = currentOrg?.name || '우리 조직';

  // 조직이 선택되면 모달 표시
  useEffect(() => {
    if (selectedOrgId && showOrgSelector) {
      setShowOrgSelector(false);
      setShowOneClickModal(true);
    }
  }, [selectedOrgId, showOrgSelector]);

  // 조직 선택 핸들러
  const handleSelectOrg = (selectOrgId: string) => {
    setSelectedOrgId(selectOrgId);
    navigate(`/wizard/${selectOrgId}`, { replace: true });
  };

  // 목표(Objective) 후보군 State
  const [objectives, setObjectives] = useState<ObjectiveCandidate[]>([
    { id: '1', name: '시장 선도형 신제품 수주 확대를 통한 매출 성장 달성', biiType: 'Improve', perspective: '재무', selected: true },
    { id: '2', name: '고객 중심 영업 프로세스 혁신', biiType: 'Innovate', perspective: '프로세스', selected: true },
    { id: '3', name: '조직 역량 강화 기반 구축', biiType: 'Build', perspective: '학습성장', selected: true },
    { id: '4', name: '디지털 마케팅 채널 다각화', biiType: 'Build', perspective: '고객', selected: false },
    { id: '5', name: '브랜드 인지도 제고를 통한 시장 확대', biiType: 'Improve', perspective: '고객', selected: false },
  ]);

  // KR 후보군 State
  const [krs, setKrs] = useState<KRCandidate[]>([
    {
      id: 'kr-1', objectiveId: '1', name: '매출 목표달성도', definition: '사업계획 대비 실제 매출 달성 정도',
      formula: '당해년도 매출액 / 계획상 매출액 × 100', unit: '억원', weight: 25, targetValue: 3528,
      biiType: 'Improve', kpiCategory: '전략', perspective: '재무', indicatorType: '결과', measurementCycle: '월',
      previousYear: 3200, poolMatch: 96,
      gradeCriteria: { S: 4234, A: 3881, B: 3528, C: 3175, D: 0 },
      quarterlyTargets: { Q1: 843, Q2: 953, Q3: 868, Q4: 864 }
    },
    {
      id: 'kr-2', objectiveId: '1', name: '영업이익액', definition: '매출에서 영업비용을 제외한 순이익',
      formula: '영업이익액 실적', unit: '억원', weight: 20, targetValue: 287,
      biiType: 'Improve', kpiCategory: '전략', perspective: '재무', indicatorType: '결과', measurementCycle: '월',
      previousYear: 260, poolMatch: 92,
      gradeCriteria: { S: 344, A: 316, B: 287, C: 258, D: 0 },
      quarterlyTargets: { Q1: 68, Q2: 75, Q3: 72, Q4: 72 }
    },
    {
      id: 'kr-3', objectiveId: '1', name: '수주금액', definition: '신규 계약 체결 금액의 합계',
      formula: '신규 계약 금액의 총합', unit: '억원', weight: 15, targetValue: 3555,
      biiType: 'Improve', kpiCategory: '전략', perspective: '고객', indicatorType: '결과', measurementCycle: '월',
      previousYear: 3230, poolMatch: 88,
      gradeCriteria: { S: 4266, A: 3911, B: 3555, C: 3200, D: 0 },
      quarterlyTargets: { Q1: 850, Q2: 960, Q3: 875, Q4: 870 }
    },
    {
      id: 'kr-4', objectiveId: '2', name: '매출채권회전일', definition: '매출채권이 현금으로 회수되는데 걸리는 평균 일수',
      formula: '(평균 매출채권 / 매출액) × 365', unit: '일', weight: 15, targetValue: 46,
      biiType: 'Innovate', kpiCategory: '고유업무', perspective: '프로세스', indicatorType: '결과', measurementCycle: '월',
      previousYear: 52, poolMatch: 94,
      gradeCriteria: { S: 37, A: 41, B: 46, C: 51, D: 999 },
      quarterlyTargets: { Q1: 46, Q2: 46, Q3: 46, Q4: 46 }
    },
    {
      id: 'kr-5', objectiveId: '2', name: '중점거래처 품목증가율', definition: '주요 거래처 대상 신규 품목 계약 확대',
      formula: '정성 마일스톤 기반 평가', unit: '%', weight: 10, targetValue: 100,
      biiType: 'Innovate', kpiCategory: '전략', perspective: '고객', indicatorType: '과정', measurementCycle: '분기',
      previousYear: 0, poolMatch: 0,
      gradeCriteria: { S: 120, A: 110, B: 100, C: 80, D: 0 },
      quarterlyTargets: { Q1: 25, Q2: 50, Q3: 75, Q4: 100 }
    },
    {
      id: 'kr-6', objectiveId: '3', name: '인재유지율', definition: '핵심 인재의 조직 잔류율',
      formula: '(기말 인원 / 기초 인원) × 100', unit: '%', weight: 5, targetValue: 95,
      biiType: 'Build', kpiCategory: '공통', perspective: '학습성장', indicatorType: '결과', measurementCycle: '월',
      previousYear: 93, poolMatch: 98,
      gradeCriteria: { S: 98, A: 96, B: 95, C: 93, D: 0 },
      quarterlyTargets: { Q1: 95, Q2: 95, Q3: 95, Q4: 95 }
    },
    {
      id: 'kr-7', objectiveId: '3', name: '교육이수율', definition: '필수 교육과정 이수 완료율',
      formula: '(교육 이수 인원 / 전체 인원) × 100', unit: '%', weight: 5, targetValue: 100,
      biiType: 'Build', kpiCategory: '공통', perspective: '학습성장', indicatorType: '결과', measurementCycle: '월',
      previousYear: 88, poolMatch: 95,
      gradeCriteria: { S: 110, A: 105, B: 100, C: 90, D: 0 },
      quarterlyTargets: { Q1: 25, Q2: 50, Q3: 75, Q4: 100 }
    },
  ]);

  // ----------------------------------------------------
  // [Phase 4] AI 목표 생성 핸들러 (Step 1)
  // ----------------------------------------------------
  const handleAIGenerateObjectives = async () => {
    setIsAIGenerating(true);
    
    try {
      // Edge Function 호출
      const { data, error } = await supabase.functions.invoke('generate-objectives', {
        body: {
          orgName: currentOrgName,
          orgMission: mission, // 현재 입력된 미션 사용
          orgType: currentOrg?.orgType || 'Front',
          functionTags: currentOrg?.functionTags || [],
          industry: 'IT 서비스'
        }
      });

      if (error) throw error;

      if (data && data.objectives) {
        // AI 응답을 ObjectiveCandidate 형식으로 변환
        const newObjectives = data.objectives.map((obj: any, index: number) => ({
          id: String(index + 1), 
          name: obj.name,
          biiType: obj.biiType || 'Improve',
          perspective: obj.perspective || '재무',
          selected: index < 3 // 상위 3개 자동 선택
        }));
        
        setObjectives(newObjectives);
        // alert('AI가 새로운 목표를 제안했습니다!');
      }

    } catch (error: any) {
      console.error('AI Error:', error);
      alert(`AI 생성 실패: ${error.message}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  // ----------------------------------------------------
  // [Phase 3] 실제 DB 저장 핸들러 (Step 4)
  // ----------------------------------------------------
  const handleSave = async () => {
    if (!orgId) {
      alert('조직 ID가 없습니다. 다시 시도해주세요.');
      return;
    }

    if (!confirm('목표를 최종 확정하고 저장하시겠습니까?')) return;

    setIsSaving(true);
    try {
      const selectedObjectives = objectives.filter(o => o.selected);
      
      for (const obj of selectedObjectives) {
        // 1. 목표(Objective) 저장
        const { data: savedObj, error: objError } = await supabase
          .from('objectives')
          .insert({
            org_id: orgId,
            name: obj.name,
            bii_type: obj.biiType,
            period: '2025-H1',
            status: 'active',
            sort_order: parseInt(obj.id) || 0
          })
          .select()
          .single();

        if (objError) throw new Error(`목표 저장 실패: ${objError.message}`);
        if (!savedObj) continue;

        // 2. KR 저장
        const relatedKRs = krs.filter(k => k.objectiveId === obj.id);
        
        for (const kr of relatedKRs) {
          const { error: krError } = await supabase
            .from('key_results')
            .insert({
              objective_id: savedObj.id,
              org_id: orgId,
              name: kr.name,
              definition: kr.definition,
              formula: kr.formula,
              unit: kr.unit,
              weight: kr.weight,
              target_value: kr.targetValue,
              current_value: 0,
              bii_type: kr.biiType,
              kpi_category: kr.kpiCategory,
              perspective: kr.perspective,
              indicator_type: kr.indicatorType,
              measurement_cycle: kr.measurementCycle,
              grade_criteria: kr.gradeCriteria,
              quarterly_targets: kr.quarterlyTargets,
              status: 'active'
            });

          if (krError) throw new Error(`KR 저장 실패: ${krError.message}`);
        }
      }

      // 3. 성공 후 데이터 리프레시 및 이동
      await fetchObjectives(orgId);
      await fetchKRs(orgId);
      
      alert('성공적으로 저장되었습니다!');
      navigate('/okr/team'); 

    } catch (error: any) {
      console.error(error);
      alert(`저장 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ----------------------------------------------------
  // Helper Functions
  // ----------------------------------------------------
  const updateKRWeight = (krId: string, newWeight: number) => {
    setKrs(krs.map(kr => kr.id === krId ? { ...kr, weight: newWeight } : kr));
  };

  const toggleObjective = (id: string) => {
    setObjectives(objectives.map(obj =>
      obj.id === id ? { ...obj, selected: !obj.selected } : obj
    ));
  };

  // 모달용 핸들러 (원클릭 생성은 아직 구현 전이므로 페이크 처리)
  const handleOneClickGenerate = () => {
    setIsAIGenerating(true);
    setTimeout(() => {
      setIsAIGenerating(false);
      setShowOneClickModal(false);
      setCurrentStep(4);
    }, 2000);
  };

  const handleStartWizard = () => {
    setShowOneClickModal(false);
    setCurrentStep(0);
  };

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

// ========== 조직 선택 화면 ==========
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

          {/* 전사 */}
          {organizations.filter(o => o.level === '전사').length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">전사</h3>
              <div className="grid grid-cols-1 gap-3">
                {organizations
                  .filter(o => o.level === '전사')
                  .map(org => (
                    <button
                      key={org.id}
                      onClick={() => handleSelectOrg(org.id)}
                      className="text-left border-2 border-slate-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-slate-500">{org.level} • {org.orgType}</div>
                          <div className="text-lg font-semibold text-slate-900 mt-1">{org.name}</div>
                          {org.mission && (
                            <div className="text-sm text-slate-600 mt-1">{org.mission}</div>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
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

  // ========== 조직 ID 검증 ==========
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
  
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 상단 헤더 */}
      {!showOneClickModal && (
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
            title="뒤로 가기"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">목표 수립 ({currentOrgName})</h1>
        </div>
      )}

      {/* 시작 모달 */}
      {showOneClickModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-3xl w-full mx-4 relative">
            <button 
              onClick={() => navigate(-1)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-slate-900 mb-6">{currentOrgName} 목표 수립</h2>
            <p className="text-slate-600 mb-6">어떤 방법으로 수립하시겠습니까?</p>

            <div className="grid grid-cols-2 gap-6">
              <div className="border-2 border-slate-200 rounded-xl p-6 hover:border-blue-600 transition-all cursor-pointer">
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">원클릭 전체 생성</h3>
                <p className="text-sm text-slate-600 mb-4">
                  AI가 조직정보를 분석하여 목표+KR+가중치+목표값+등급구간을 한번에 생성합니다.
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
                  5단계를 따라가며 직접 수립합니다. AI가 각 단계에서 80%를 채워줍니다.
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

      {/* AI 로딩 오버레이 */}
      {isAIGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">AI가 분석 중입니다...</h3>
            <p className="text-slate-600 mb-4">조직의 미션과 기능을 바탕으로 최적의 목표를 고민하고 있습니다.</p>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      )}

      {/* 저장 로딩 오버레이 */}
      {isSaving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">저장 중입니다...</h3>
            <p className="text-slate-600">DB에 데이터를 기록하고 있습니다.</p>
          </div>
        </div>
      )}

      {/* Stepper (진행 단계) */}
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

      {/* 메인 컨텐츠 영역 */}
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

        {/* Step 1: 목표 수립 (여기에 AI 연결됨) */}
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

            <p className="text-slate-600">🤖 AI가 5개 목표 후보를 생성했습니다. 3~5개를 선택해주세요.</p>

            <div className="grid grid-cols-2 gap-4">
              {objectives.map((obj) => {
                const biiColor = getBIIColor(obj.biiType);
                return (
                  <div
                    key={obj.id}
                    onClick={() => toggleObjective(obj.id)}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      obj.selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={obj.selected}
                        onChange={() => {}}
                        className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 mb-2">{obj.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                            {obj.biiType}
                          </span>
                          <span className="text-xs text-slate-600">{obj.perspective} 관점</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">💡 "조직 미션 달성을 위한 핵심 목표입니다"</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleAIGenerateObjectives} // [연결됨] AI 호출
                disabled={isAIGenerating}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isAIGenerating ? 'animate-spin' : ''}`} />
                {isAIGenerating ? '생성 중...' : 'AI 재생성'}
              </button>
              <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                직접 추가
              </button>
            </div>
          </div>
        )}

        {/* Step 2: KR 설정 (수정됨) */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">KR(핵심결과) 설정</h2>

            {/* 탭 영역 (수정됨) */}
            <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
              {objectives.filter(o => o.selected).map((obj, idx) => {
                const biiColor = getBIIColor(obj.biiType);
                
                return (
                  <button
                    key={obj.id}
                    onClick={() => setSelectedObjectiveTab(obj.id)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      selectedObjectiveTab === obj.id
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                        {obj.biiType}
                      </span>
                      <span className="font-semibold">목표{idx + 1}</span>
                      <span className="text-xs">
                        {selectedObjectiveTab === obj.id ? '●' : '○'}
                      </span>
                    </div>
                    <div className={`text-xs mt-1 ${
                      selectedObjectiveTab === obj.id ? 'text-blue-600' : 'text-slate-500'
                    }`}>
                      {obj.name.length > 30 ? obj.name.substring(0, 30) + '...' : obj.name}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* KR 목록 */}
            <div className="space-y-4">
              {krs.filter(kr => kr.objectiveId === selectedObjectiveTab).map((kr) => {
                const biiColor = getBIIColor(kr.biiType);
                const categoryColor = getKPICategoryColor(kr.kpiCategory);
                const isExpanded = expandedKR === kr.id;

                return (
                  <div key={kr.id} className="border border-slate-200 rounded-xl p-5 bg-white">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                          {kr.biiType}
                        </span>
                        <h3 className="font-semibold text-slate-900">{kr.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">가중치 {kr.weight}%</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium border ${categoryColor}`}>
                          {kr.kpiCategory}
                        </span>
                        <button className="p-1 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4 text-slate-500" /></button>
                        <button className="p-1 hover:bg-slate-100 rounded"><Trash2 className="w-4 h-4 text-slate-500" /></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span className="text-slate-500">정의:</span>
                        <span className="ml-2 text-slate-700">{kr.definition}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">산식:</span>
                        <span className="ml-2 text-slate-700">{kr.formula}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">목표값</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={kr.targetValue}
                            className="w-24 border border-slate-300 rounded px-2 py-1 text-sm"
                            readOnly
                          />
                          <span className="text-sm text-slate-600">{kr.unit}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">유형</label>
                        <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={kr.indicatorType}>
                          <option>투입</option><option>과정</option><option>산출</option><option>결과</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">측정주기</label>
                        <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={kr.measurementCycle}>
                          <option>월</option><option>분기</option><option>반기</option><option>연</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">관점</label>
                        <select className="w-full border border-slate-300 rounded px-2 py-1 text-sm" value={kr.perspective}>
                          <option>재무</option><option>고객</option><option>프로세스</option><option>학습성장</option>
                        </select>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs text-slate-500 mb-2">가중치</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={kr.weight}
                          onChange={(e) => updateKRWeight(kr.id, parseInt(e.target.value))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-sm font-medium text-slate-900 w-12">{kr.weight}%</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => setExpandedKR(isExpanded ? null : kr.id)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        🎯 원클릭 목표설정
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      <button className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        📊 전년실적
                      </button>
                      <button className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-1">
                        <Bot className="w-4 h-4" />
                        AI가 완성해줘
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-semibold text-slate-900 mb-3">목표 자동 설정 결과</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-slate-600">📊 전년 실적:</span>
                            <span className="ml-2 font-medium">{kr.previousYear.toLocaleString()}{kr.unit}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">📈 전사 성장 방침:</span>
                            <span className="ml-2 font-medium text-green-600">+10%</span>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm mb-4">
                          <div className="font-medium">목표(B등급): {kr.gradeCriteria.B.toLocaleString()}{kr.unit} (+{((kr.gradeCriteria.B / kr.previousYear - 1) * 100).toFixed(1)}%)</div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                            <div>S등급: {kr.gradeCriteria.S.toLocaleString()}{kr.unit}↑</div>
                            <div>A등급: {kr.gradeCriteria.A.toLocaleString()}~{kr.gradeCriteria.S.toLocaleString()}{kr.unit}</div>
                            <div>B등급: {kr.gradeCriteria.B.toLocaleString()}~{kr.gradeCriteria.A.toLocaleString()}{kr.unit}</div>
                            <div>C등급: {kr.gradeCriteria.C.toLocaleString()}~{kr.gradeCriteria.B.toLocaleString()}{kr.unit}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                            ✅ 적용하기
                          </button>
                          <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">
                            수정하기
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="text-purple-700 font-medium">전략 {krs.filter(k => k.kpiCategory === '전략').reduce((s, k) => s + k.weight, 0)}%</span>
                  <span className="mx-2 text-slate-400">+</span>
                  <span className="text-blue-700 font-medium">고유업무 {krs.filter(k => k.kpiCategory === '고유업무').reduce((s, k) => s + k.weight, 0)}%</span>
                  <span className="mx-2 text-slate-400">+</span>
                  <span className="text-slate-700 font-medium">공통 {krs.filter(k => k.kpiCategory === '공통').reduce((s, k) => s + k.weight, 0)}%</span>
                  <span className="mx-2">=</span>
                  <span className={`font-bold ${krs.reduce((s, k) => s + k.weight, 0) === 100 ? 'text-green-600' : 'text-red-600'}`}>
                    {krs.reduce((s, k) => s + k.weight, 0)}% {krs.reduce((s, k) => s + k.weight, 0) === 100 ? '✅' : '❌'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
                <Plus className="w-4 h-4" />
                KR 추가
              </button>
              <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                AI 재추천
              </button>
              <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Pool에서 선택
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 세부 설정 (기존 UI 유지) */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">세부 설정</h2>
            <p className="text-slate-600">Cascading 및 공통 KPI를 설정합니다</p>

            <div className="bg-white border border-slate-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-slate-900 mb-4">Cascading 확인 (Alignment)</h3>
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="bg-white border border-slate-200 rounded p-3 shadow-sm">
                    <div className="text-xs text-slate-500 mb-1">상위 조직 (전사)</div>
                    <div className="font-medium text-slate-900">지속적 규모성장</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xs text-blue-600 font-medium mb-1">Full (전체계승)</span>
                    <div className="w-16 h-px bg-blue-300 relative">
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t border-r border-blue-300 rotate-45"></div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 shadow-sm">
                    <div className="text-xs text-blue-600 mb-1">우리 조직 ({currentOrgName})</div>
                    <div className="font-medium text-slate-900">매출 목표달성도</div>
                  </div>
                </div>
                <button className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 rounded text-sm hover:bg-slate-50">
                  🔄 연결 수정
                </button>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 mb-4">공통 KPI (감점형)</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                  <span className="text-sm text-slate-700">인재유지율 (가중치 5%)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                  <span className="text-sm text-slate-700">교육이수율 (가중치 5%)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                  <span className="text-sm text-slate-700">협업만족도</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: 최종 확인 (저장 로직 연결됨) */}
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
                <div className="text-sm text-green-600 mb-1">가중치 합계</div>
                <div className="text-lg font-bold text-green-700">{krs.reduce((s, k) => s + k.weight, 0)}% ✅</div>
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
                    const objKrs = krs.filter(kr => kr.objectiveId === obj.id);
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
                      <span className="text-sm font-bold text-green-600">{krs.reduce((s, k) => s + k.weight, 0)}%</span>
                    </td>
                    <td colSpan={4} className="px-4 py-3 text-right text-sm text-slate-600">
                      총 {krs.length}개 KR
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
              <button className="px-6 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors">
                📨 리뷰 요청 발송
              </button>
              <button className="px-6 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors">
                📥 엑셀 다운로드
              </button>
              <button className="px-6 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors">
                🔄 하위조직 Cascading
              </button>
            </div>
          </div>
        )}

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
            onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            disabled={currentStep === 4}
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