// ============================================================
// Wizard.tsx 수정 패치 - showOneClickModal 완전 제거
// ============================================================

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 삭제 1: state 선언 제거 (약 67번째 줄)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ❌ 삭제:
const [showOneClickModal, setShowOneClickModal] = useState(!urlOrgId);


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 삭제 2: 조직 선택 effect 내 모달 관련 코드 (약 133번째 줄)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ❌ 이전:
useEffect(() => {
  if (selectedOrgId && showOrgSelector) {
    setShowOrgSelector(false);
    setShowOneClickModal(true);
  }
}, [selectedOrgId, showOrgSelector]);

// ✅ 수정:
useEffect(() => {
  if (selectedOrgId && showOrgSelector) {
    setShowOrgSelector(false);
  }
}, [selectedOrgId, showOrgSelector]);


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 삭제 3: loadDraftFromDB 내 모달 관련 코드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 삭제할 줄들:
setShowOneClickModal(false);  // ← 삭제
if (!urlOrgId && !isCeoPreparing) setShowOneClickModal(true);  // ← 삭제


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 삭제 4: handleOneClickGenerate 함수 내 (약 450번째 줄)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 삭제할 줄들:
setShowOneClickModal(false);  // ← 삭제
setShowOneClickModal(true);   // ← catch 블록 내 삭제


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 삭제 5: handleStartWizard 함수 (약 510번째 줄) - 함수 자체 삭제 가능
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ❌ 삭제:
const handleStartWizard = () => {
  setShowOneClickModal(false);
  setCurrentStep(0);
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 삭제 6: 모달 렌더링 JSX 전체 삭제 (약 780~840번째 줄)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ❌ 이 전체 블록 삭제:
{/* 모달: 수립 방식 선택 (초안이 없을 때만) */}
{showOneClickModal && !hasDraft && !ceoDraftInProgress && (
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


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 요약: 검색해서 삭제할 키워드
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 1. "showOneClickModal" - 모든 참조 삭제
// 2. "setShowOneClickModal" - 모든 참조 삭제  
// 3. "handleStartWizard" - 함수 정의 및 참조 삭제
// 4. "handleOneClickGenerate" - 함수는 유지하되 내부의 setShowOneClickModal 줄만 삭제

// 총 삭제 대상:
// - state 선언 1개
// - setShowOneClickModal 호출 약 4-5개
// - handleStartWizard 함수 1개
// - 모달 JSX 블록 1개 (약 50줄)