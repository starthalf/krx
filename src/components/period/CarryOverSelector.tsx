// src/components/period/CarryOverSelector.tsx
// 이전 기간 목표를 선택하여 새 목표로 이어받는 컴포넌트

import { useState, useEffect } from 'react';
import {
  ArrowRight, RefreshCw, GitBranch, Combine, ChevronDown,
  ChevronRight, CheckCircle2, Target, TrendingUp, Loader2
} from 'lucide-react';
import {
  fetchCarryOverCandidates,
  createCarryOver,
} from '../../lib/period-api';
import {
  ContinuityType,
  CONTINUITY_TYPE_CONFIG,
  CarryOverCandidate,
} from '../../types/period.types';

interface CarryOverSelectorProps {
  companyId: string;
  previousPeriodCode: string;  // 이전 기간 코드 (예: '2024-H2')
  targetPeriodId: string;      // 새로 생성할 목표의 기간 ID
  orgId?: string;              // 특정 조직만 필터링
  onSelect: (candidate: CarryOverCandidate, continuityType: ContinuityType) => void;
  onClose: () => void;
}

export default function CarryOverSelector({
  companyId,
  previousPeriodCode,
  targetPeriodId,
  orgId,
  onSelect,
  onClose,
}: CarryOverSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CarryOverCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CarryOverCandidate | null>(null);
  const [selectedType, setSelectedType] = useState<ContinuityType>('carry_over');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 후보 목표 로드
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchCarryOverCandidates(companyId, previousPeriodCode, orgId);
        setCandidates(data);
      } catch (err) {
        console.error('Carry-over 후보 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [companyId, previousPeriodCode, orgId]);

  const handleConfirm = () => {
    if (!selectedCandidate) return;
    onSelect(selectedCandidate, selectedType);
  };

  // 달성률에 따른 색상
  const getAchievementColor = (rate: number) => {
    if (rate >= 100) return 'text-green-600';
    if (rate >= 80) return 'text-blue-600';
    if (rate >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">이전 기간 목표 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">이전 기간 목표 이어받기</h2>
          <p className="text-sm text-slate-500 mt-1">
            {previousPeriodCode} 기간의 목표 중 이어받을 목표를 선택하세요
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {candidates.length === 0 ? (
            <div className="text-center py-12">
              <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">이전 기간에 목표가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((candidate) => {
                const isSelected = selectedCandidate?.objective.id === candidate.objective.id;
                const isExpanded = expandedId === candidate.objective.id;
                
                return (
                  <div
                    key={candidate.objective.id}
                    className={`border rounded-lg transition-all ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Objective Header */}
                    <div
                      onClick={() => setSelectedCandidate(candidate)}
                      className="px-4 py-3 cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                        }`}>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              candidate.objective.biiType === 'Build' ? 'bg-blue-100 text-blue-700' :
                              candidate.objective.biiType === 'Innovate' ? 'bg-purple-100 text-purple-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {candidate.objective.biiType}
                            </span>
                            <span className={`text-sm font-medium ${getAchievementColor(candidate.objective.achievementRate)}`}>
                              달성률 {candidate.objective.achievementRate}%
                            </span>
                          </div>
                          <h4 className="font-medium text-slate-900 mt-1">{candidate.objective.name}</h4>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : candidate.objective.id);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                      >
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                    </div>
                    
                    {/* KR List (Expanded) */}
                    {isExpanded && candidate.krs.length > 0 && (
                      <div className="px-4 pb-3 border-t border-slate-100 mt-2 pt-3">
                        <p className="text-xs text-slate-500 mb-2 font-medium">핵심 결과 (KR)</p>
                        <div className="space-y-1.5">
                          {candidate.krs.map((kr) => (
                            <div key={kr.id} className="flex items-center justify-between text-sm bg-slate-50 rounded px-3 py-2">
                              <span className="text-slate-700">{kr.name}</span>
                              <span className={`font-medium ${getAchievementColor(kr.achievementRate)}`}>
                                {kr.achievementRate}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Continuity Type Selection */}
          {selectedCandidate && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h3 className="text-sm font-medium text-slate-700 mb-3">연속성 유형 선택</h3>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(CONTINUITY_TYPE_CONFIG) as ContinuityType[]).map((type) => {
                  const config = CONTINUITY_TYPE_CONFIG[type];
                  const isSelected = selectedType === type;
                  
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{config.icon}</span>
                        <span className="font-medium text-slate-900">{config.label}</span>
                      </div>
                      <p className="text-xs text-slate-500">{config.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCandidate}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowRight className="w-4 h-4" />
            선택한 목표 기반으로 생성
          </button>
        </div>
      </div>
    </div>
  );
}