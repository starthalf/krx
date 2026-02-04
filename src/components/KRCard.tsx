// src/components/KRCard.tsx - 완전 수정본
import { useState } from 'react';
import { MessageSquare, MoreVertical, CheckSquare, Link as LinkIcon, FileText, History, Save, X } from 'lucide-react';
import { calculateGrade, getGradeColor, getBIIColor, getKPICategoryColor, formatNumber, getMilestoneProgress } from '../utils/helpers';
import type { DynamicKR } from '../types';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';

interface KRCardProps {
  kr: DynamicKR;
}

export default function KRCard({ kr }: KRCardProps) {
  const [showCFR, setShowCFR] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [cfrMessage, setCfrMessage] = useState('');
  const [cfrType, setCfrType] = useState<'Conversation' | 'Feedback' | 'Recognition'>('Conversation');
  
  // 실적 입력 관련 state
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(kr.currentValue?.toString() || '0');
  const [isSaving, setIsSaving] = useState(false);

  const getCFRsByKRId = useStore(state => state.getCFRsByKRId);
  const addCFRThread = useStore(state => state.addCFRThread);
  const updateKR = useStore(state => state.updateKR);

  const grade = calculateGrade(kr);
  const gradeColor = getGradeColor(grade);
  const biiColor = getBIIColor(kr.biiType);
  const categoryColor = getKPICategoryColor(kr.kpiCategory);

  const cfrThreads = getCFRsByKRId(kr.id);

  // 마일스톤 있으면 마일스톤 진행률, 없으면 일반 진행률
  const hasMilestones = kr.milestones && kr.milestones.length > 0;
  const progress = hasMilestones ? getMilestoneProgress(kr) : kr.progressPct;

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

  // 실적 입력 핸들러
  const handleSaveActual = async () => {
    const newValue = parseFloat(editValue);
    
    if (isNaN(newValue)) {
      alert('올바른 숫자를 입력해주세요');
      return;
    }

    setIsSaving(true);
    try {
      // 진행률 계산
      const newProgress = Math.round((newValue / kr.targetValue) * 100);

      // DB 업데이트
      const { error } = await supabase
        .from('key_results')
        .update({
          current_value: newValue,
          progress_pct: newProgress,
          updated_at: new Date().toISOString()
        })
        .eq('id', kr.id);

      if (error) throw error;

      // Store 업데이트
      updateKR(kr.id, {
        currentValue: newValue,
        progressPct: newProgress
      });

      setIsEditing(false);
      alert('실적이 저장되었습니다!');

    } catch (error: any) {
      console.error('Save error:', error);
      alert(`저장 실패: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditValue(kr.currentValue?.toString() || '0');
    setIsEditing(false);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {/* 헤더 */}
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

        {/* 정량 KR - 목표/현재/달성률 */}
        {!hasMilestones && (
          <div className="grid grid-cols-3 gap-4 mb-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">목표</div>
              <div className="text-lg font-bold text-slate-900">
                {formatNumber(kr.targetValue)} <span className="text-sm font-normal text-slate-600">{kr.unit}</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">현재</div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="w-28 px-3 py-1.5 border-2 border-blue-500 rounded-lg text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                  <span className="text-sm text-slate-600">{kr.unit}</span>
                </div>
              ) : (
                <div className="text-lg font-bold text-blue-600">
                  {formatNumber(kr.currentValue || 0)} <span className="text-sm font-normal text-slate-600">{kr.unit}</span>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">달성률</div>
              <div className="text-lg font-bold text-slate-900">{progress}%</div>
            </div>
          </div>
        )}

        {/* 정성 KR - 마일스톤 */}
        {hasMilestones && (
          <div className="mb-4 space-y-2 bg-slate-50 rounded-lg p-4 border border-slate-200">
            {kr.milestones!.map((milestone) => (
              <div key={milestone.id} className="flex items-center gap-3 text-sm">
                {milestone.completed ? (
                  <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 border-2 border-slate-300 rounded flex-shrink-0" />
                )}
                <span className={`flex-1 ${milestone.completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                  {milestone.text}
                </span>
                <span className="text-xs text-slate-500">{milestone.quarter}</span>
              </div>
            ))}
          </div>
        )}

        {/* 진행률 바 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">진행률 {progress}%</span>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${gradeColor}`}>
              등급: {grade}
            </span>
          </div>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>

        {/* Cascading 정보 */}
        {kr.cascadingType && (
          <div className="mb-3 flex items-center gap-2 text-sm">
            <LinkIcon className="w-4 h-4 text-blue-600" />
            <span className="text-slate-600">상위: [전사] 지속적 규모성장</span>
          </div>
        )}

        {/* 데이터 소스 */}
        {kr.dataSource === 'auto' && kr.dataSourceDetail && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-600">데이터: {kr.dataSourceDetail} (마지막 동기화: 3.15)</span>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveActual}
                disabled={isSaving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                실적 입력
              </button>
              <button
                onClick={() => setShowCFR(true)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                CFR ({cfrThreads.length})
              </button>
              <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
                <History className="w-4 h-4" />
                히스토리
              </button>
            </>
          )}
        </div>
      </div>

      {/* CFR 모달 */}
      {showCFR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">CFR 스레드</h3>
              <button
                onClick={() => setShowCFR(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
              {cfrThreads.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  아직 CFR 메시지가 없습니다
                </div>
              ) : (
                cfrThreads.map((thread) => (
                  <div key={thread.id} className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-900">{thread.author}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(thread.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        thread.type === 'Conversation' ? 'bg-blue-100 text-blue-700' :
                        thread.type === 'Feedback' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {thread.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{thread.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex gap-2 mb-3">
                {(['Conversation', 'Feedback', 'Recognition'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCfrType(type)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      cfrType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <textarea
                value={cfrMessage}
                onChange={(e) => setCfrMessage(e.target.value)}
                placeholder="메시지를 입력하세요..."
                className="w-full border border-slate-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                rows={3}
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleSendCFR}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  전송
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}