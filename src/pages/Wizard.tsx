// src/pages/Wizard.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, Bot, Target, RefreshCw, Pencil, Trash2, 
  ChevronDown, BookOpen, Plus, X, ArrowLeft, Loader2, Check, Upload, Download, FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { getBIIColor, getKPICategoryColor } from '../utils/helpers';
import { exportToExcel, readExcel } from '../utils/excel'; // 엑셀 유틸 임포트
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
  const { orgId: urlOrgId } = useParams<{ orgId: string }>();
  const { fetchObjectives, fetchKRs, organizations } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null); // 파일 입력 참조

  // ==================== State 관리 ====================
  
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(urlOrgId || null);
  const [showOrgSelector, setShowOrgSelector] = useState(!urlOrgId);

  const [currentStep, setCurrentStep] = useState(0);
  const [showOneClickModal, setShowOneClickModal] = useState(!urlOrgId);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // 업로드 로딩 상태
  
  const [mission, setMission] = useState('고객 중심의 마케팅 전략을 통한 시장 점유율 확대');
  const [selectedObjectiveTab, setSelectedObjectiveTab] = useState('1');
  const [expandedKR, setExpandedKR] = useState<string | null>(null);
  
  const [editingKRId, setEditingKRId] = useState<string | null>(null);

  const orgId = selectedOrgId;
  const currentOrg = organizations.find(o => o.id === orgId);
  const currentOrgName = currentOrg?.name || '우리 조직';

  // ==================== Effects ====================

  useEffect(() => {
    if (selectedOrgId && showOrgSelector) {
      setShowOrgSelector(false);
      setShowOneClickModal(true);
    }
  }, [selectedOrgId, showOrgSelector]);

  // ==================== Data States (초기값은 빈 배열로 시작하거나 예시 유지) ====================

  const [objectives, setObjectives] = useState<ObjectiveCandidate[]>([
    { id: '1', name: '시장 선도형 신제품 수주 확대를 통한 매출 성장 달성', biiType: 'Improve', perspective: '재무', selected: true },
    { id: '2', name: '고객 중심 영업 프로세스 혁신', biiType: 'Innovate', perspective: '프로세스', selected: true },
    { id: '3', name: '조직 역량 강화 기반 구축', biiType: 'Build', perspective: '학습성장', selected: true },
  ]);

  const [krs, setKrs] = useState<(KRCandidate & { selected?: boolean })[]>([
    {
      id: 'kr-1', objectiveId: '1', name: '매출 목표달성도', definition: '사업계획 대비 실제 매출 달성 정도',
      formula: '당해년도 매출액 / 계획상 매출액 × 100', unit: '억원', weight: 50, targetValue: 3528,
      biiType: 'Improve', kpiCategory: '전략', perspective: '재무', indicatorType: '결과', measurementCycle: '월',
      previousYear: 3200, poolMatch: 96,
      gradeCriteria: { S: 4234, A: 3881, B: 3528, C: 3175, D: 0 },
      quarterlyTargets: { Q1: 843, Q2: 953, Q3: 868, Q4: 864 },
      selected: true
    },
    // ... (기타 예시 데이터는 생략하거나 유지)
  ]);

  // ==================== Handlers ====================

  const handleSelectOrg = (selectOrgId: string) => {
    setSelectedOrgId(selectOrgId);
    navigate(`/wizard/${selectOrgId}`, { replace: true });
  };

  const toggleKR = (krId: string) => {
    setKrs(krs.map(kr => 
      kr.id === krId ? { ...kr, selected: !kr.selected } : kr
    ));
  };

  const handleKRChange = (krId: string, field: string, value: any) => {
    setKrs(prev => prev.map(kr => 
      kr.id === krId ? { ...kr, [field]: value } : kr
    ));
  };

  const updateKRWeight = (krId: string, newWeight: number) => {
    setKrs(krs.map(kr => kr.id === krId ? { ...kr, weight: newWeight } : kr));
  };

  const toggleObjective = (id: string) => {
    setObjectives(objectives.map(obj =>
      obj.id === id ? { ...obj, selected: !obj.selected } : obj
    ));
  };

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
    setEditingKRId(newKR.id);
  };

  // ------------------------------------------------------------------
  // [New] 엑셀 업로드 관련 핸들러
  // ------------------------------------------------------------------

  // 1. 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const guideSheet = [
      { 항목: '목표명', 설명: 'Objective 이름을 입력하세요. (같은 목표명이면 하나의 목표로 묶입니다)' },
      { 항목: '목표유형', 설명: 'Build, Innovate, Improve 중 하나' },
      { 항목: '관점', 설명: '재무, 고객, 프로세스, 학습성장 중 하나' },
      { 항목: 'KR명', 설명: '핵심결과 이름을 입력하세요' },
      { 항목: '가중치', 설명: '숫자만 입력 (예: 30)' },
      { 항목: '단위', 설명: '%, 원, 건 등' },
      { 항목: '목표값', 설명: '숫자만 입력' },
      { 항목: '산식', 설명: '측정 산식 입력' }
    ];

    const inputSheet = [
      {
        목표명: '신규 시장 점유율 확대',
        목표유형: 'Innovate',
        관점: '재무',
        KR명: '신규 고객 유입 수',
        가중치: 50,
        단위: '명',
        목표값: 1000,
        산식: 'CRM 신규 등록 기준',
        정의: '신규로 유입된 고객의 총합'
      },
      {
        목표명: '신규 시장 점유율 확대', // 같은 목표명 -> 같은 목표로 묶임
        목표유형: 'Innovate',
        관점: '재무',
        KR명: '신규 매출액',
        가중치: 50,
        단위: '억원',
        목표값: 10,
        산식: 'ERP 매출 기준',
        정의: '신규 고객으로부터 발생한 매출'
      }
    ];

    exportToExcel(
      { 'OKR입력서식': inputSheet, '작성가이드': guideSheet },
      'OKR_일괄등록_템플릿'
    );
  };

  // 2. 파일 업로드 처리
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const jsonData = await readExcel(file);
      
      if (jsonData.length === 0) {
        throw new Error('데이터가 없습니다.');
      }

      // 데이터 파싱 및 구조화
      const newObjectives: ObjectiveCandidate[] = [];
      const newKRs: (KRCandidate & { selected: boolean })[] = [];
      
      // 목표명으로 그룹화하기 위한 맵
      const objMap = new Map<string, string>(); // Name -> ID

      jsonData.forEach((row: any, idx) => {
        const objName = row['목표명'] || `목표 ${idx + 1}`;
        let objId = objMap.get(objName);

        // 새로운 목표면 생성
        if (!objId) {
          objId = `obj-excel-${idx}`; // 임시 ID
          objMap.set(objName, objId);
          
          newObjectives.push({
            id: objId,
            name: objName,
            biiType: (row['목표유형'] as BIIType) || 'Improve',
            perspective: row['관점'] || '재무',
            selected: true
          });
        }

        // KR 생성
        if (row['KR명']) {
          newKRs.push({
            id: `kr-excel-${idx}`,
            objectiveId: objId,
            name: row['KR명'],
            definition: row['정의'] || '',
            formula: row['산식'] || '',
            unit: row['단위'] || '건',
            weight: row['가중치'] || 0,
            targetValue: row['목표값'] || 100,
            biiType: (row['목표유형'] as BIIType) || 'Improve', // 목표 유형 상속
            kpiCategory: '전략',
            perspective: row['관점'] || '재무',
            indicatorType: '결과',
            measurementCycle: '월',
            previousYear: 0,
            poolMatch: 0,
            gradeCriteria: { S: 120, A: 110, B: 100, C: 90, D: 0 }, // 기본값
            quarterlyTargets: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
            selected: true
          });
        }
      });

      // State 업데이트
      setObjectives(newObjectives);
      setKrs(newKRs);

      // 모달 닫고 Step 4(최종확인)로 바로 이동
      setShowOneClickModal(false);
      setCurrentStep(4);
      
      alert(`✅ 엑셀 업로드 완료!\n목표 ${newObjectives.length}개, KR ${newKRs.length}개를 불러왔습니다.\n내용을 확인 후 '저장' 버튼을 눌러주세요.`);

    } catch (error: any) {
      console.error('Excel Error:', error);
      alert(`엑셀 읽기 실패: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ------------------------------------------------------------------

  const handleAIRegenerateKRs = async () => { /* ... 기존 코드 유지 ... */ };
  
  const handleOneClickGenerate = async () => {
    setIsAIGenerating(true);
    setShowOneClickModal(false);
    // ... 기존 코드 유지 ... (mock 로직이나 실제 로직)
    setTimeout(() => {
        setIsAIGenerating(false);
        setCurrentStep(4);
    }, 1500);
  };

  const handleStartWizard = () => {
    setShowOneClickModal(false);
    setCurrentStep(0);
  };

  const handleAIGenerateObjectives = async () => { /* ... 기존 코드 유지 ... */ };

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

        const relatedKRs = krs.filter(k => k.objectiveId === obj.id && k.selected !== false);
        
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

  if (showOrgSelector) {
    // ... (기존 조직 선택 화면 코드 유지)
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
          <div className="grid grid-cols-1 gap-3">
             {organizations.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleSelectOrg(org.id)}
                  className="text-left border-2 border-slate-200 rounded-xl p-4 hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <div className="text-sm text-slate-500">{org.level}</div>
                  <div className="text-lg font-semibold text-slate-900 mt-1">{org.name}</div>
                </button>
             ))}
          </div>
        </div>
      </div>
    );
  }

  if (!orgId) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
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

      {/* 숨겨진 파일 입력 */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleExcelUpload} 
        accept=".xlsx, .xls" 
        hidden 
      />

      {showOneClickModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-5xl w-full mx-4 relative">
            <button 
              onClick={() => navigate(-1)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-slate-900 mb-6">{currentOrgName} 목표 수립</h2>
            <p className="text-slate-600 mb-6">어떤 방법으로 수립하시겠습니까?</p>

            <div className="grid grid-cols-3 gap-6">
              {/* 1. AI 원클릭 */}
              <div className="border-2 border-slate-200 rounded-xl p-6 hover:border-blue-600 transition-all cursor-pointer">
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">원클릭 전체 생성</h3>
                <p className="text-sm text-slate-600 mb-4 h-12">
                  AI가 조직정보를 분석하여 목표+KR+가중치까지 한번에 생성합니다.
                </p>
                <button
                  onClick={handleOneClickGenerate}
                  className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors"
                >
                  🚀 전체 생성
                </button>
              </div>

              {/* 2. 엑셀 업로드 (New) */}
              <div className="border-2 border-slate-200 rounded-xl p-6 hover:border-green-600 transition-all cursor-pointer">
                <div className="text-3xl mb-3">📊</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">엑셀 일괄 등록</h3>
                <p className="text-sm text-slate-600 mb-4 h-12">
                  기존에 작성된 엑셀 파일을 업로드하여 빠르게 등록합니다.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex-1 bg-green-600 text-white rounded-lg py-3 font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />}
                    업로드
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-3 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
                    title="템플릿 다운로드"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 3. 위저드 (수동) */}
              <div className="border-2 border-slate-200 rounded-xl p-6 hover:border-slate-400 transition-all cursor-pointer">
                <div className="text-3xl mb-3">📝</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">위저드로 직접 수립</h3>
                <p className="text-sm text-slate-600 mb-4 h-12">
                  5단계를 따라가며 직접 수립합니다. AI가 각 단계에서 보조합니다.
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

      {/* 로딩 오버레이들 */}
      {(isAIGenerating || isUploading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            {isUploading ? (
               <FileSpreadsheet className="w-16 h-16 text-green-600 mx-auto mb-4 animate-bounce" />
            ) : (
               <Bot className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
            )}
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {isUploading ? '엑셀 데이터를 분석 중입니다...' : 'AI가 생성 중입니다...'}
            </h3>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mt-4">
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

      {/* Main Content Area */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        
        {/* Step 0 ~ Step 3: 기존 코드 유지 (생략) */}
        {currentStep === 0 && (
           <div className="text-center py-10">
              <h2 className="text-xl font-bold mb-4">전략 방향 확인</h2>
              <button onClick={() => setCurrentStep(1)} className="px-6 py-2 bg-blue-600 text-white rounded">다음</button>
           </div>
        )}
        {currentStep === 1 && (
           <div className="text-center py-10">
              <h2 className="text-xl font-bold mb-4">목표 수립</h2>
              <button onClick={() => setCurrentStep(2)} className="px-6 py-2 bg-blue-600 text-white rounded">다음</button>
           </div>
        )}
        {currentStep === 2 && (
           <div className="text-center py-10">
              <h2 className="text-xl font-bold mb-4">KR 설정</h2>
              <button onClick={() => setCurrentStep(3)} className="px-6 py-2 bg-blue-600 text-white rounded">다음</button>
           </div>
        )}
        {currentStep === 3 && (
           <div className="text-center py-10">
              <h2 className="text-xl font-bold mb-4">세부 설정</h2>
              <button onClick={() => setCurrentStep(4)} className="px-6 py-2 bg-blue-600 text-white rounded">다음</button>
           </div>
        )}

        {/* Step 4: 최종 확인 (엑셀 업로드 결과가 여기로 옴) */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">최종 확인 & 확정</h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800 text-sm">
                ℹ️ 엑셀로 업로드된 내용을 확인해주세요. 문제가 없다면 하단의 '저장' 버튼을 눌러 DB에 반영합니다.
              </p>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {objectives.filter(o => o.selected).map((obj) => {
                    const objKrs = krs.filter(kr => kr.objectiveId === obj.id && kr.selected !== false);
                    return objKrs.map((kr, idx) => (
                      <tr key={kr.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-700 border-r">
                          {idx === 0 ? (
                             <div>
                               <div className="font-semibold">{obj.name}</div>
                               <span className="text-xs bg-slate-100 px-1 rounded">{obj.biiType}</span>
                             </div>
                          ) : ''}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-900">{kr.name}</div>
                          <div className="text-xs text-slate-500">{kr.definition || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-semibold text-slate-900">{kr.weight}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-medium text-slate-900">{kr.targetValue.toLocaleString()}</span>
                          <span className="text-xs text-slate-500 ml-1">{kr.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-slate-500">
                          S:{kr.gradeCriteria.S} / A:{kr.gradeCriteria.A} / B:{kr.gradeCriteria.B}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
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
            </div>
          </div>
        )}

        {/* 하단 네비게이션 */}
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </button>
          {currentStep < 4 && (
            <button
                onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
                다음
                <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}