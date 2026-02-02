import { useState } from 'react';
import { ChevronLeft, ChevronRight, Bot, Target, RefreshCw } from 'lucide-react';
import { getBIIColor } from '../utils/helpers';
import type { BIIType } from '../types';

interface ObjectiveCandidate {
  id: string;
  name: string;
  biiType: BIIType;
  perspective: string;
  selected: boolean;
}

export default function Wizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showOneClickModal, setShowOneClickModal] = useState(true);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [mission, setMission] = useState('고객 중심의 마케팅 전략을 통한 시장 점유율 확대');

  const [objectives, setObjectives] = useState<ObjectiveCandidate[]>([
    { id: '1', name: '시장 선도형 신제품 수주 확대를 통한 매출 성장 달성', biiType: 'Improve', perspective: '재무', selected: true },
    { id: '2', name: '고객 중심 영업 프로세스 혁신', biiType: 'Innovate', perspective: '프로세스', selected: true },
    { id: '3', name: '조직 역량 강화 기반 구축', biiType: 'Build', perspective: '학습성장', selected: true },
    { id: '4', name: '디지털 마케팅 채널 다각화', biiType: 'Build', perspective: '고객', selected: false },
    { id: '5', name: '브랜드 인지도 제고를 통한 시장 확대', biiType: 'Improve', perspective: '고객', selected: false },
  ]);

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

  const handleOneClickGenerate = () => {
    setIsAIGenerating(true);
    setTimeout(() => {
      setIsAIGenerating(false);
      setShowOneClickModal(false);
      setCurrentStep(4);
    }, 3000);
  };

  const handleStartWizard = () => {
    setShowOneClickModal(false);
    setCurrentStep(0);
  };

  const toggleObjective = (id: string) => {
    setObjectives(objectives.map(obj =>
      obj.id === id ? { ...obj, selected: !obj.selected } : obj
    ));
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {showOneClickModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-3xl w-full mx-4">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">마케팅본부 목표 수립</h2>
            <p className="text-slate-600 mb-6">어떤 방법으로 수립하시겠습니까?</p>

            <div className="grid grid-cols-2 gap-6">
              <div className="border-2 border-slate-200 rounded-xl p-6 hover:border-blue-600 transition-all cursor-pointer">
                <div className="text-3xl mb-3">🤖</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">원클릭 전체 생성</h3>
                <p className="text-sm text-slate-600 mb-4">
                  AI가 조직정보를 분석하여 목표+KR+가중치+목표값+등급구간을 한번에 생성합니다.
                </p>
                <p className="text-xs text-slate-500 mb-4">약 30초 소요</p>
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
                <p className="text-xs text-slate-500 mb-4">약 30분 소요</p>
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

      <div className="bg-white rounded-xl border border-slate-200 p-8">
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
                        <p className="text-xs text-slate-500 mt-2">💡 "전사 매출 성장 전략과 직접 연계됩니다"</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                AI 재생성
              </button>
              <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
                <Target className="w-4 h-4" />
                직접 추가
              </button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">KR(핵심결과) 설정</h2>
            <p className="text-slate-600">목표별 핵심 결과 지표를 정의합니다</p>

            <div className="bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-200 rounded-xl p-6 text-center">
              <Bot className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <p className="text-slate-700">AI가 선택된 목표를 기반으로 최적의 KR을 생성합니다</p>
              <button className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
                KR 자동 생성
              </button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">세부 설정</h2>
            <p className="text-slate-600">Cascading 및 공통 KPI를 설정합니다</p>

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

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">최종 확인 & 확정</h2>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">BII 밸런스</div>
                <div className="text-xs text-green-700">B:1 I:1 Im:3</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">가중치 합계</div>
                <div className="text-lg font-bold text-green-700">100%</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">Alignment</div>
                <div className="text-xs text-green-700">수직 ✅ 수평 ✅</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-sm text-green-600 mb-1">BII 체크리스트</div>
                <div className="text-xs text-green-700">평균 10.2/12</div>
              </div>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 transition-colors">
                ✅ KR 세트 확정
              </button>
              <button className="px-6 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors">
                📨 리뷰 요청
              </button>
              <button className="px-6 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors">
                📥 엑셀 다운로드
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
