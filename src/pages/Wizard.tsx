import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Bot, Target, RefreshCw, Pencil, Trash2, ChevronDown, BookOpen, Plus, X, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase'; // Supabase 클라이언트 임포트
import { useStore } from '../store/useStore'; // Store 임포트 (데이터 리프레시용)
import { getBIIColor, getKPICategoryColor } from '../utils/helpers';
import type { BIIType } from '../types';

// ... (인터페이스 정의는 기존과 동일)
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
  const { orgId } = useParams<{ orgId: string }>(); // URL에서 조직 ID 가져오기
  const { fetchObjectives, fetchKRs, organizations } = useStore(); // 저장 후 갱신을 위해 가져옴

  const [currentStep, setCurrentStep] = useState(0);
  const [showOneClickModal, setShowOneClickModal] = useState(true);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // 저장 중 로딩 상태
  
  const [mission, setMission] = useState('고객 중심의 마케팅 전략을 통한 시장 점유율 확대');
  const [selectedObjectiveTab, setSelectedObjectiveTab] = useState('1');
  const [expandedKR, setExpandedKR] = useState<string | null>(null);

  // 현재 조직 이름 찾기 (UI 표시용)
  const currentOrgName = organizations.find(o => o.id === orgId)?.name || '우리 조직';

  // ... (초기 state 데이터는 기존 mock 유지 - Phase 4에서 AI 연결 예정)
  const [objectives, setObjectives] = useState<ObjectiveCandidate[]>([
    { id: '1', name: '시장 선도형 신제품 수주 확대를 통한 매출 성장 달성', biiType: 'Improve', perspective: '재무', selected: true },
    { id: '2', name: '고객 중심 영업 프로세스 혁신', biiType: 'Innovate', perspective: '프로세스', selected: true },
    { id: '3', name: '조직 역량 강화 기반 구축', biiType: 'Build', perspective: '학습성장', selected: true },
    { id: '4', name: '디지털 마케팅 채널 다각화', biiType: 'Build', perspective: '고객', selected: false },
    { id: '5', name: '브랜드 인지도 제고를 통한 시장 확대', biiType: 'Improve', perspective: '고객', selected: false },
  ]);

  const [krs, setKrs] = useState<KRCandidate[]>([
    // ... (기존 Mock 데이터 유지, 너무 길어서 생략 - 원본 코드 그대로 사용하세요)
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
    // ... 나머지 KRs (원본 코드 유지)
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

  // ... (기존 헬퍼 함수들 유지)
  const updateKRWeight = (krId: string, newWeight: number) => {
    setKrs(krs.map(kr => kr.id === krId ? { ...kr, weight: newWeight } : kr));
  };
  const toggleObjective = (id: string) => {
      setObjectives(objectives.map(obj =>
        obj.id === id ? { ...obj, selected: !obj.selected } : obj
      ));
  };
  const handleStartWizard = () => {
      setShowOneClickModal(false);
      setCurrentStep(0);
  };
  const handleOneClickGenerate = () => {
    setIsAIGenerating(true);
    setTimeout(() => {
      setIsAIGenerating(false);
      setShowOneClickModal(false);
      setCurrentStep(4);
    }, 2000);
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

  // --------------------------------------------------------------------------------
  // [NEW] 실제 DB 저장 로직
  // --------------------------------------------------------------------------------
  const handleSave = async () => {
    if (!orgId) {
      alert('조직 ID가 없습니다. 다시 시도해주세요.');
      return;
    }

    if (!confirm('목표를 최종 확정하고 저장하시겠습니까?')) return;

    setIsSaving(true);
    try {
      // 1. 선택된 목표(Objective) 순회하며 저장
      const selectedObjectives = objectives.filter(o => o.selected);
      
      for (const obj of selectedObjectives) {
        // (1) 목표 Insert
        const { data: savedObj, error: objError } = await supabase
          .from('objectives')
          .insert({
            org_id: orgId,
            name: obj.name,
            bii_type: obj.biiType,
            period: '2025-H1', // 임시 값, 추후 전역 설정 사용
            status: 'active',
            sort_order: parseInt(obj.id) || 0
          })
          .select()
          .single();

        if (objError) throw new Error(`목표 저장 실패: ${objError.message}`);
        if (!savedObj) continue;

        // (2) 해당 목표의 KR Insert
        const relatedKRs = krs.filter(k => k.objectiveId === obj.id);
        
        for (const kr of relatedKRs) {
          const { error: krError } = await supabase
            .from('key_results')
            .insert({
              objective_id: savedObj.id, // 방금 생성된 실제 Objective ID 사용
              org_id: orgId,
              name: kr.name,
              definition: kr.definition,
              formula: kr.formula,
              unit: kr.unit,
              weight: kr.weight,
              target_value: kr.targetValue,
              current_value: 0,
              bii_type: kr.biiType,
              
              // Enum 값 매핑
              kpi_category: kr.kpiCategory,
              perspective: kr.perspective,
              indicator_type: kr.indicatorType,
              measurement_cycle: kr.measurementCycle,

              // JSON 데이터 매핑
              grade_criteria: kr.gradeCriteria,
              quarterly_targets: kr.quarterlyTargets,
              
              status: 'active'
            });

          if (krError) throw new Error(`KR 저장 실패: ${krError.message}`);
        }
      }

      // 2. 저장 완료 후 Store 데이터 갱신 및 페이지 이동
      await fetchObjectives(orgId);
      await fetchKRs(orgId);
      
      alert('성공적으로 저장되었습니다!');
      navigate('/okr/team'); // OKR 현황 페이지로 이동

    } catch (error: any) {
      console.error(error);
      alert(`저장 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      {!showOneClickModal && (
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">목표 수립 ({currentOrgName})</h1>
        </div>
      )}

      {/* 모달 및 AI 로딩 UI 유지 (기존 코드와 동일) ... */}
      {showOneClickModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           {/* ... 모달 내용 유지 ... */}
           <div className="bg-white rounded-2xl p-8 max-w-3xl w-full mx-4 relative">
             <button onClick={() => navigate(-1)} className="absolute top-6 right-6 text-slate-400">
               <X className="w-6 h-6" />
             </button>
             <h2 className="text-2xl font-bold text-slate-900 mb-6">{currentOrgName} 목표 수립</h2>
             {/* ... 이하 동일 ... */}
             <div className="grid grid-cols-2 gap-6">
               <div className="border-2 border-slate-200 rounded-xl p-6 hover:border-blue-600 transition-all cursor-pointer">
                 <div className="text-3xl mb-3">🤖</div>
                 <h3 className="text-lg font-bold text-slate-900 mb-2">원클릭 전체 생성</h3>
                 <p className="text-sm text-slate-600 mb-4">AI가 조직정보를 분석하여 목표+KR+가중치+목표값+등급구간을 한번에 생성합니다.</p>
                 <button onClick={handleOneClickGenerate} className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700">🚀 전체 생성</button>
               </div>
               <div className="border-2 border-slate-200 rounded-xl p-6 hover:border-blue-600 transition-all cursor-pointer">
                 <div className="text-3xl mb-3">📝</div>
                 <h3 className="text-lg font-bold text-slate-900 mb-2">위저드로 직접 수립</h3>
                 <p className="text-sm text-slate-600 mb-4">5단계를 따라가며 직접 수립합니다.</p>
                 <button onClick={handleStartWizard} className="w-full bg-slate-100 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-200">📝 시작하기</button>
               </div>
             </div>
           </div>
        </div>
      )}

      {/* AI 로딩 화면 유지 */}
      {isAIGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">AI가 분석 중입니다...</h3>
            <p className="text-slate-600 mb-4">잠시만 기다려주세요</p>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      )}

      {/* 저장 로딩 화면 추가 */}
      {isSaving && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <Loader2 className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-spin" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">저장 중입니다...</h3>
            <p className="text-slate-600">DB에 데이터를 기록하고 있습니다.</p>
          </div>
        </div>
      )}

      {/* 단계 표시 줄 (Stepper) 유지 ... */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 mb-6">
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                  currentStep === index ? 'bg-blue-600 text-white' : currentStep > index ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'
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

      <div className="bg-white rounded-xl border border-slate-200 p-8">
        {/* Step 0~3 컨텐츠는 원본 코드와 동일하게 유지 (여기서는 생략하고 Step 4만 표시) */}
        {currentStep === 0 && (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900">전략 방향 확인</h2>
                {/* ... 내용 유지 ... */}
                 <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h3 className="font-semibold text-blue-900 mb-2">전사 전략방향</h3>
                  <p className="text-blue-700">디지털 혁신을 통한 지속 가능한 성장과 고객 가치 창출</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">우리 조직 미션</label>
                  <textarea value={mission} onChange={(e) => setMission(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none resize-none" rows={4} />
                  <button className="mt-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg text-sm font-medium flex items-center gap-2"><Bot className="w-4 h-4" />AI 미션 제안</button>
                </div>
            </div>
        )}
        {currentStep === 1 && (
             <div className="space-y-6">
             <div className="flex items-center justify-between">
               <h2 className="text-xl font-bold text-slate-900">목표(Objective) 수립</h2>
               {/* ... BII 밸런스 등 UI 유지 ... */}
             </div>
             {/* ... 목표 목록 렌더링 ... */}
             <div className="grid grid-cols-2 gap-4">
              {objectives.map((obj) => {
                const biiColor = getBIIColor(obj.biiType);
                return (
                  <div key={obj.id} onClick={() => toggleObjective(obj.id)} className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${obj.selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={obj.selected} onChange={() => {}} className="mt-1 w-4 h-4 text-blue-600" />
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900 mb-2">{obj.name}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>{obj.biiType}</span>
                          <span className="text-xs text-slate-600">{obj.perspective} 관점</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
           </div>
        )}
        {currentStep === 2 && (
             <div className="space-y-6">
             <h2 className="text-xl font-bold text-slate-900">KR(핵심결과) 설정</h2>
             {/* ... 탭 및 KR 상세 에디터 UI 유지 ... */}
             <div className="flex gap-2 border-b border-slate-200">
              {objectives.filter(o => o.selected).map((obj, idx) => (
                <button key={obj.id} onClick={() => setSelectedObjectiveTab(obj.id)} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${selectedObjectiveTab === obj.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                  목표{idx + 1} {selectedObjectiveTab === obj.id ? '●' : '○'}
                </button>
              ))}
            </div>
            {/* KR 카드 리스트 (렌더링 로직 유지) */}
            <div className="space-y-4">
              {krs.filter(kr => kr.objectiveId === selectedObjectiveTab).map((kr) => {
                 // ... 기존 코드와 동일 ...
                 return (
                    <div key={kr.id} className="border border-slate-200 rounded-xl p-5 bg-white">
                        <div className="flex items-start justify-between mb-4"><h3 className="font-semibold text-slate-900">{kr.name}</h3></div>
                        {/* 상세 입력 폼들 유지 */}
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div><label className="block text-xs text-slate-500 mb-1">목표값</label><input type="number" value={kr.targetValue} className="w-24 border border-slate-300 rounded px-2 py-1 text-sm" readOnly /></div>
                            {/* ... */}
                        </div>
                    </div>
                 )
              })}
            </div>
           </div>
        )}
        {currentStep === 3 && (
             <div className="space-y-6">
             <h2 className="text-xl font-bold text-slate-900">세부 설정</h2>
             {/* ... Cascading 및 공통 KPI 설정 UI 유지 ... */}
           </div>
        )}

        {/* [중요] Step 4에서 저장 버튼 연결 */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">최종 확인 & 확정</h2>

            {/* 요약 카드들 유지 */}
            <div className="grid grid-cols-4 gap-4">
               {/* ... */}
               <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">가중치 합계</div>
                <div className="text-lg font-bold text-green-700">{krs.reduce((s, k) => s + k.weight, 0)}% ✅</div>
              </div>
            </div>

            {/* 테이블 뷰 유지 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
               {/* ... 기존 테이블 코드 ... */}
               <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr><th className="px-4 py-3 text-left text-xs font-medium text-slate-600">목표</th><th className="px-4 py-3 text-left text-xs font-medium text-slate-600">KR</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                   {objectives.filter(o => o.selected).map((obj) => (
                       krs.filter(kr => kr.objectiveId === obj.id).map(kr => (
                           <tr key={kr.id}><td className="px-4 py-3 text-sm">{obj.name}</td><td className="px-4 py-3 text-sm">{kr.name}</td></tr>
                       ))
                   ))}
                </tbody>
               </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave} // [연결됨]
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
            </div>
          </div>
        )}

        {/* 이전/다음 버튼 */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
            disabled={currentStep === 4}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
          >
            다음
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}