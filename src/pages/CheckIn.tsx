import { useState } from 'react';
import { Clock, CheckCircle, Bot } from 'lucide-react';
import { useStore } from '../store/useStore';
import { formatNumber } from '../utils/helpers';

export default function CheckIn() {
  const [showInsights, setShowInsights] = useState(false);
  const [comment, setComment] = useState('');
  const selectedOrgId = useStore(state => state.selectedOrgId);
  const getOrgById = useStore(state => state.getOrgById);
  const getKRsByOrgId = useStore(state => state.getKRsByOrgId);

  const org = getOrgById(selectedOrgId || 'org-marketing');
  const krs = getKRsByOrgId(selectedOrgId || 'org-marketing');

  const autoKRs = krs.filter(kr => kr.dataSource === 'auto');
  const manualKRs = krs.filter(kr => kr.dataSource === 'manual');

  const handleCompleteCheckIn = () => {
    setShowInsights(true);
  };

  if (!org) return <div className="p-6">조직을 찾을 수 없습니다</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">3월 체크인</h1>
            <p className="text-slate-600">{org.name}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="w-4 h-4" />
            <span>예상 소요: 15초</span>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-green-900">자동 수집 완료 ({autoKRs.length}/{krs.length})</h2>
        </div>
        <div className="space-y-3">
          {autoKRs.map((kr) => (
            <div key={kr.id} className="flex items-center justify-between bg-white rounded-lg p-4">
              <span className="font-medium text-slate-900">{kr.name}</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-600">
                  {formatNumber(kr.currentValue)} / {formatNumber(kr.targetValue)} {kr.unit}
                </span>
                <span className="font-medium text-slate-900">{kr.progressPct}%</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  kr.progressPct >= 100 ? 'bg-blue-600 text-white' :
                  kr.progressPct >= 90 ? 'bg-lime-600 text-white' :
                  kr.progressPct >= 80 ? 'bg-orange-500 text-white' : 'bg-red-600 text-white'
                }`}>
                  {kr.progressPct >= 100 ? 'A' : kr.progressPct >= 90 ? 'B' : kr.progressPct >= 80 ? 'C' : 'D'}
                </span>
                <span className="text-xs text-green-600 flex items-center gap-1">
                  🔗 자동
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {manualKRs.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              !
            </div>
            <h2 className="text-lg font-semibold text-yellow-900">입력 필요 ({manualKRs.length}/{krs.length})</h2>
          </div>
          <div className="space-y-4">
            {manualKRs.map((kr) => (
              <div key={kr.id} className="bg-white rounded-lg p-4">
                <div className="font-medium text-slate-900 mb-2">{kr.name}</div>
                {kr.milestones ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600 mb-3">마일스톤 체크:</p>
                    {kr.milestones.map((milestone) => (
                      <label key={milestone.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={milestone.completed}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-sm ${milestone.completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                          {milestone.text}
                        </span>
                      </label>
                    ))}
                    <p className="text-sm text-slate-600 mt-2">→ 진행률: {getMilestoneProgress(kr)}%</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="number"
                        placeholder="값 입력"
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <span className="text-slate-600">{kr.unit}</span>
                      <span className="text-slate-500">/ {formatNumber(kr.targetValue)}{kr.unit}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      💡 전월: {formatNumber(kr.currentValue)}{kr.unit} | 전년동월: {formatNumber(kr.currentValue * 0.9)}{kr.unit}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="font-medium text-slate-900 mb-3">💬 이번 달 한줄 (선택)</h3>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="이번 달 성과나 이슈를 간단히 공유해주세요..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          rows={3}
        />
      </div>

      <button
        onClick={handleCompleteCheckIn}
        className="w-full bg-blue-600 text-white rounded-xl py-4 text-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        ✅ 체크인 완료
      </button>

      {showInsights && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4">
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="text-2xl font-bold text-slate-900">3월 체크인 완료!</h2>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-6">
              <div className="text-center mb-4">
                <div className="text-3xl font-bold text-blue-600">78%</div>
                <div className="text-sm text-slate-600">전체 진행률 (전월 대비 +6%p)</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-6 h-6 text-blue-600" />
                <h3 className="font-semibold text-slate-900">AI 인사이트</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-green-700 mb-2">✅ 강점</h4>
                  <ul className="space-y-1 text-sm text-slate-700">
                    <li>· 매출채권회전일 목표 조기 달성</li>
                    <li>· 인재유지율 목표 초과 달성 중</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-orange-700 mb-2">⚠️ 개선 포인트</h4>
                  <ul className="space-y-1 text-sm text-slate-700">
                    <li>· 영업이익률 목표 대비 8%p 갭</li>
                    <li className="ml-4 text-slate-600">→ "원가 구조 점검 또는 고마진 제품 비중 확대 권장"</li>
                    <li>· 교육이수율 85%</li>
                    <li className="ml-4 text-slate-600">→ "잔여 2개월간 월 7.5%p씩 필요"</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-slate-700 mb-2">📊 등급 분포</h4>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium">S 0</span>
                    <span className="px-3 py-1 bg-emerald-600 text-white rounded text-sm font-medium">A 1</span>
                    <span className="px-3 py-1 bg-lime-600 text-white rounded text-sm font-medium">B 3</span>
                    <span className="px-3 py-1 bg-orange-500 text-white rounded text-sm font-medium">C 2</span>
                    <span className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium">D 0</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors"
              >
                📊 대시보드 보기
              </button>
              <button
                onClick={() => setShowInsights(false)}
                className="flex-1 border border-slate-300 text-slate-700 rounded-lg py-3 font-medium hover:bg-slate-50 transition-colors"
              >
                💬 팀장에게 공유
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getMilestoneProgress(kr: { milestones?: Array<{ completed: boolean }> }): number {
  if (!kr.milestones || kr.milestones.length === 0) return 0;
  const completed = kr.milestones.filter(m => m.completed).length;
  return Math.round((completed / kr.milestones.length) * 100);
}
