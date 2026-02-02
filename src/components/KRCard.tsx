import { useState } from 'react';
import { MessageSquare, MoreVertical, CheckSquare, Link as LinkIcon, FileText, History } from 'lucide-react';
import { calculateGrade, getGradeColor, getBIIColor, getKPICategoryColor, formatNumber, getMilestoneProgress } from '../utils/helpers';
import type { DynamicKR } from '../types';
import { useStore } from '../store/useStore';

interface KRCardProps {
  kr: DynamicKR;
}

export default function KRCard({ kr }: KRCardProps) {
  const [showCFR, setShowCFR] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [cfrMessage, setCfrMessage] = useState('');
  const [cfrType, setCfrType] = useState<'Conversation' | 'Feedback' | 'Recognition'>('Conversation');

  const getCFRsByKRId = useStore(state => state.getCFRsByKRId);
  const addCFRThread = useStore(state => state.addCFRThread);

  const grade = calculateGrade(kr);
  const gradeColor = getGradeColor(grade);
  const biiColor = getBIIColor(kr.biiType);
  const categoryColor = getKPICategoryColor(kr.kpiCategory);

  const cfrThreads = getCFRsByKRId(kr.id);

  const progress = kr.milestones ? getMilestoneProgress(kr) : kr.progressPct;

  const handleSendCFR = () => {
    if (!cfrMessage.trim()) return;

    addCFRThread({
      id: `cfr-${Date.now()}`,
      krId: kr.id,
      type: cfrType,
      content: cfrMessage,
      author: '관리자',
      createdAt: new Date().toISOString()
    });

    setCfrMessage('');
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
              {kr.biiType}
            </span>
            <h3 className="text-base font-semibold text-slate-900">{kr.name}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">가중치 {kr.weight}%</span>
            <span className={`px-2 py-1 rounded text-xs font-medium border ${categoryColor}`}>
              {kr.kpiCategory}
            </span>
            <button
              onClick={() => setShowMore(!showMore)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {!kr.milestones ? (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span className="text-sm text-slate-600">목표: </span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatNumber(kr.targetValue)}{kr.unit}
                </span>
              </div>
              <div>
                <span className="text-sm text-slate-600">현재: </span>
                <span className="text-lg font-semibold text-slate-900">
                  {formatNumber(kr.currentValue)}{kr.unit}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">{progress}%</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${gradeColor}`}>
                  {grade}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex gap-4 mb-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckSquare className="w-4 h-4 text-green-600" />
                <span className="text-slate-600">Q1</span>
                <span className="font-medium">{formatNumber(kr.quarterlyActuals.Q1 || 0)}{kr.unit}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckSquare className="w-4 h-4 text-green-600" />
                <span className="text-slate-600">Q2</span>
                <span className="font-medium">{formatNumber(kr.quarterlyActuals.Q2 || 0)}{kr.unit}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-600">Q3→</span>
                <span className="font-medium">{formatNumber(kr.quarterlyTargets.Q3)}{kr.unit}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-600">Q4</span>
                <span className="font-medium">{formatNumber(kr.quarterlyTargets.Q4)}{kr.unit}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {kr.milestones.map((milestone) => (
                <div key={milestone.id} className="flex items-center gap-2">
                  {milestone.completed ? (
                    <CheckSquare className="w-5 h-5 text-green-600" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-slate-300 rounded" />
                  )}
                  <span className={`text-sm ${milestone.completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                    {milestone.text}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto">{milestone.quarter}</span>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">진행률 {progress}%</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${gradeColor}`}>
                  {grade}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </>
        )}

        {kr.cascadingType && (
          <div className="mb-3 flex items-center gap-2 text-sm">
            <LinkIcon className="w-4 h-4 text-blue-600" />
            <span className="text-slate-600">상위: [전사] 지속적 규모성장</span>
          </div>
        )}

        {kr.dataSource === 'auto' && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-600">데이터: {kr.dataSourceDetail} (마지막 동기화: 3.15)</span>
          </div>
        )}

        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            체크인
          </button>
          <button
            onClick={() => setShowCFR(true)}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-1"
          >
            <MessageSquare className="w-4 h-4" />
            피드백 {cfrThreads.length}
          </button>
        </div>

        {showMore && (
          <div className="absolute right-6 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10">
            <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
              편집
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
              BII 체크
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
              Alignment 보기
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
              변경 이력
            </button>
            <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
              엑셀 다운로드
            </button>
          </div>
        )}
      </div>

      {showCFR && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-end">
          <div className="w-96 h-full bg-white shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{kr.name}</h3>
              <button
                onClick={() => setShowCFR(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cfrThreads.map((thread) => (
                <div key={thread.id} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {thread.type === 'Feedback' && <span className="text-lg">💬</span>}
                    {thread.type === 'Recognition' && <span className="text-lg">🎉</span>}
                    {thread.type === 'Conversation' && <span className="text-lg">💭</span>}
                    <span className="font-medium text-slate-900 text-sm">{thread.type}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-700 mb-1">
                    {thread.author} {new Date(thread.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                  </div>
                  <p className="text-sm text-slate-600">{thread.content}</p>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-200">
              <textarea
                value={cfrMessage}
                onChange={(e) => setCfrMessage(e.target.value)}
                placeholder="메시지 입력..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-2 resize-none"
                rows={3}
              />
              <div className="flex gap-2 mb-2">
                {(['Conversation', 'Feedback', 'Recognition'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCfrType(type)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      cfrType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {type === 'Conversation' && '💬 대화'}
                    {type === 'Feedback' && '📝 피드백'}
                    {type === 'Recognition' && '🎉 인정'}
                  </button>
                ))}
              </div>
              <button
                onClick={handleSendCFR}
                className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                전송
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
