// src/pages/PeriodHistory.tsx
// 기간별 성과 히스토리 조회 페이지 (아카이브 데이터 열람)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar, ChevronLeft, Building2, Target, TrendingUp,
  BarChart3, Users, Award, Loader2, ChevronDown, ChevronRight,
  Lock, Archive, Clock, AlertTriangle, CheckCircle2,
  PieChart, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { useStore } from '../store/useStore';
import {
  fetchFiscalPeriod,
  fetchPeriodSnapshots,
  fetchCompanyPeriodSummary,
  fetchArchivedPeriods,
  fetchPeriodCloseLogs,
} from '../lib/period-api';
import {
  FiscalPeriod,
  PeriodSnapshot,
  CompanyPeriodSummary,
  PERIOD_STATUS_CONFIG,
  GradeDistribution,
} from '../types/period.types';

// ─────────────────────────────────────────────────────────────
// Grade Badge Component
// ─────────────────────────────────────────────────────────────
function GradeBadge({ grade, count }: { grade: string; count: number }) {
  const colors: Record<string, string> = {
    S: 'bg-purple-100 text-purple-700 border-purple-200',
    A: 'bg-green-100 text-green-700 border-green-200',
    B: 'bg-blue-100 text-blue-700 border-blue-200',
    C: 'bg-amber-100 text-amber-700 border-amber-200',
    D: 'bg-red-100 text-red-700 border-red-200',
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${colors[grade] || 'bg-slate-100'}`}>
      {grade}: {count}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Achievement Rate Display
// ─────────────────────────────────────────────────────────────
function AchievementDisplay({ rate, size = 'md' }: { rate: number; size?: 'sm' | 'md' | 'lg' }) {
  const getColor = (r: number) => {
    if (r >= 100) return 'text-green-600';
    if (r >= 80) return 'text-blue-600';
    if (r >= 60) return 'text-amber-600';
    return 'text-red-600';
  };
  
  const getIcon = (r: number) => {
    if (r >= 100) return <ArrowUpRight className="w-4 h-4" />;
    if (r >= 80) return <Minus className="w-4 h-4" />;
    return <ArrowDownRight className="w-4 h-4" />;
  };
  
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };
  
  return (
    <div className={`flex items-center gap-1 ${getColor(rate)}`}>
      <span className={`font-bold ${sizeClasses[size]}`}>{rate.toFixed(1)}%</span>
      {getIcon(rate)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Org Snapshot Card
// ─────────────────────────────────────────────────────────────
interface OrgSnapshotCardProps {
  snapshot: PeriodSnapshot;
  orgName: string;
  orgLevel: string;
  onViewDetails: () => void;
}

function OrgSnapshotCard({ snapshot, orgName, orgLevel, onViewDetails }: OrgSnapshotCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-slate-400" />
          <div>
            <h4 className="font-medium text-slate-900">{orgName}</h4>
            <p className="text-xs text-slate-500">{orgLevel}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <AchievementDisplay rate={snapshot.avgAchievementRate} size="sm" />
          
          <div className="flex gap-1">
            {Object.entries(snapshot.gradeDistribution).map(([grade, count]) => (
              <GradeBadge key={grade} grade={grade} count={count as number} />
            ))}
          </div>
          
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>
      
      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <Target className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-slate-900">{snapshot.totalObjectives}</p>
              <p className="text-xs text-slate-500">목표</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-slate-900">{snapshot.totalKrs}</p>
              <p className="text-xs text-slate-500">핵심결과</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-slate-900">{snapshot.totalCheckins}</p>
              <p className="text-xs text-slate-500">체크인</p>
            </div>
          </div>
          
          {/* BII 분포 */}
          {Object.keys(snapshot.biiDistribution).length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-slate-500 mb-2">BII 분포</p>
              <div className="flex gap-2">
                {Object.entries(snapshot.biiDistribution).map(([type, count]) => (
                  <span 
                    key={type}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      type === 'Build' ? 'bg-blue-100 text-blue-700' :
                      type === 'Innovate' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}
                  >
                    {type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <button
            onClick={onViewDetails}
            className="w-full mt-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            상세 OKR 보기
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function PeriodHistory() {
  const navigate = useNavigate();
  const { periodId } = useParams<{ periodId: string }>();
  const company = useStore(state => state.company);
  const organizations = useStore(state => state.organizations);

  // State
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<FiscalPeriod | null>(null);
  const [snapshots, setSnapshots] = useState<PeriodSnapshot[]>([]);
  const [companySummary, setCompanySummary] = useState<CompanyPeriodSummary | null>(null);
  const [archivedPeriods, setArchivedPeriods] = useState<FiscalPeriod[]>([]);
  const [closeLogs, setCloseLogs] = useState<any[]>([]);
  
  // 선택된 조직 스냅샷 상세
  const [selectedSnapshot, setSelectedSnapshot] = useState<PeriodSnapshot | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // ─────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!periodId || !company?.id) return;
    
    setLoading(true);
    try {
      // 기간 정보
      const periodData = await fetchFiscalPeriod(periodId);
      setPeriod(periodData);
      
      if (periodData && ['closed', 'archived'].includes(periodData.status)) {
        // 스냅샷 목록
        const snapshotData = await fetchPeriodSnapshots(periodId);
        setSnapshots(snapshotData);
        
        // 전사 요약
        const summaryData = await fetchCompanyPeriodSummary(periodId, company.id);
        setCompanySummary(summaryData);
        
        // 마감 로그
        const logs = await fetchPeriodCloseLogs(periodId);
        setCloseLogs(logs);
      }
      
      // 아카이브된 기간 목록 (사이드바용)
      const archived = await fetchArchivedPeriods(company.id);
      setArchivedPeriods(archived);
    } catch (err) {
      console.error('데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [periodId, company?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 조직 이름 찾기
  const getOrgInfo = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    return {
      name: org?.name || '알 수 없는 조직',
      level: org?.level || '',
    };
  };

  // ─────────────────────────────────────────────────────────
  // Loading State
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>데이터 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (!period) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">기간 정보를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/admin?tab=periods')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            기간 관리로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const statusConfig = PERIOD_STATUS_CONFIG[period.status];

  // ─────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/admin?tab=periods')}
            className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1 mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            기간 관리로 돌아가기
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-900">{period.periodName}</h1>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {period.status === 'archived' && <Archive className="w-3 h-3 inline mr-1" />}
                  {statusConfig.label}
                </span>
                {period.forceClosed && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    강제마감
                  </span>
                )}
              </div>
              <p className="text-slate-500">
                {new Date(period.startsAt).toLocaleDateString('ko-KR')} ~ {' '}
                {new Date(period.endsAt).toLocaleDateString('ko-KR')}
                {period.closedAt && (
                  <span className="ml-3 text-slate-400">
                    마감일: {new Date(period.closedAt).toLocaleDateString('ko-KR')}
                  </span>
                )}
              </p>
            </div>
            
            {/* 기간 선택 드롭다운 */}
            {archivedPeriods.length > 1 && (
              <select
                value={periodId}
                onChange={(e) => navigate(`/period-history/${e.target.value}`)}
                className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-sm"
              >
                {archivedPeriods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.periodName} ({PERIOD_STATUS_CONFIG[p.status].label})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 아직 마감 안 된 기간 */}
        {!['closed', 'archived'].includes(period.status) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <Clock className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-amber-800 mb-2">아직 마감되지 않은 기간입니다</h2>
            <p className="text-amber-700 mb-4">
              마감이 완료되면 성과 스냅샷을 조회할 수 있습니다.
            </p>
            {period.status === 'active' && (
              <button
                onClick={() => navigate(`/period-close/${period.id}`)}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                마감 시작하기
              </button>
            )}
          </div>
        )}

        {/* 마감된 기간 - 성과 데이터 */}
        {['closed', 'archived'].includes(period.status) && (
          <>
            {/* 강제 마감 알림 */}
            {period.forceClosed && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-800 font-medium">강제 마감된 기간</p>
                  <p className="text-red-700 text-sm mt-1">
                    사유: {period.forceCloseReason || '사유 없음'}
                  </p>
                  {period.incompleteItems && (
                    <p className="text-red-600 text-xs mt-1">
                      미완료 OKR: {(period.incompleteItems as any).incomplete_okr_sets || 0}개 조직, 
                      미입력 체크인: {(period.incompleteItems as any).incomplete_checkins || 0}개
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* 전사 요약 카드 */}
            {companySummary && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  전사 성과 요약
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-3xl font-bold text-blue-600">{companySummary.companyAvgAchievement.toFixed(1)}%</p>
                    <p className="text-sm text-blue-700">평균 달성률</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <p className="text-3xl font-bold text-slate-900">{companySummary.totalOrgs}</p>
                    <p className="text-sm text-slate-600">참여 조직</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <p className="text-3xl font-bold text-slate-900">{companySummary.totalObjectives}</p>
                    <p className="text-sm text-slate-600">총 목표</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <p className="text-3xl font-bold text-slate-900">{companySummary.totalKrs}</p>
                    <p className="text-sm text-slate-600">총 KR</p>
                  </div>
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <div className="flex justify-center gap-1 mb-1">
                      {Object.entries(companySummary.companyGradeDistribution).map(([grade, count]) => (
                        <GradeBadge key={grade} grade={grade} count={count as number} />
                      ))}
                    </div>
                    <p className="text-sm text-slate-600">등급 분포</p>
                  </div>
                </div>

                {/* Top/Low Performers */}
                <div className="grid md:grid-cols-2 gap-4">
                  {companySummary.topPerformers.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                        <Award className="w-4 h-4 text-green-500" />
                        우수 조직
                      </h3>
                      <div className="space-y-2">
                        {companySummary.topPerformers.slice(0, 3).map((org, idx) => (
                          <div key={org.org_id} className="flex items-center justify-between bg-green-50 rounded px-3 py-2">
                            <span className="text-sm text-slate-700">
                              <span className="font-medium text-green-700 mr-2">{idx + 1}.</span>
                              {org.org_name}
                            </span>
                            <span className="text-sm font-semibold text-green-600">{org.rate.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {companySummary.lowPerformers.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        개선 필요 조직
                      </h3>
                      <div className="space-y-2">
                        {companySummary.lowPerformers.slice(0, 3).map((org) => (
                          <div key={org.org_id} className="flex items-center justify-between bg-amber-50 rounded px-3 py-2">
                            <span className="text-sm text-slate-700">{org.org_name}</span>
                            <span className="text-sm font-semibold text-amber-600">{org.rate.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 조직별 스냅샷 목록 */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                조직별 성과 ({snapshots.length}개 조직)
              </h2>
              
              {snapshots.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  스냅샷 데이터가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {snapshots.map(snapshot => {
                    const orgInfo = getOrgInfo(snapshot.orgId);
                    return (
                      <OrgSnapshotCard
                        key={snapshot.id}
                        snapshot={snapshot}
                        orgName={orgInfo.name}
                        orgLevel={orgInfo.level}
                        onViewDetails={() => {
                          setSelectedSnapshot(snapshot);
                          setShowDetailModal(true);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* 마감 로그 */}
            {closeLogs.length > 0 && (
              <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-500" />
                  마감 이력
                </h2>
                <div className="space-y-2">
                  {closeLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-4 text-sm py-2 border-b border-slate-100 last:border-0">
                      <span className="text-slate-400 w-36">
                        {new Date(log.createdAt).toLocaleString('ko-KR')}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                        {log.action}
                      </span>
                      <span className="text-slate-600">{log.actorName || '시스템'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 상세 OKR 모달 */}
      {showDetailModal && selectedSnapshot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {getOrgInfo(selectedSnapshot.orgId).name} - OKR 상세
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Objectives */}
              {selectedSnapshot.objectivesSnapshot.map((obj: any, idx: number) => (
                <div key={obj.id || idx} className="mb-6 last:mb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      obj.bii_type === 'Build' ? 'bg-blue-100 text-blue-700' :
                      obj.bii_type === 'Innovate' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {obj.bii_type}
                    </span>
                    <h4 className="font-semibold text-slate-900">{obj.name}</h4>
                  </div>
                  
                  {/* KRs */}
                  <div className="ml-4 space-y-2">
                    {selectedSnapshot.krsSnapshot
                      .filter((kr: any) => kr.objective_id === obj.id)
                      .map((kr: any, krIdx: number) => {
                        const achievement = kr.target_value > 0 
                          ? (kr.current_value / kr.target_value * 100) 
                          : 0;
                        return (
                          <div key={kr.id || krIdx} className="bg-slate-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-slate-700">{kr.name}</span>
                              <AchievementDisplay rate={achievement} size="sm" />
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>현재: {kr.current_value} {kr.unit}</span>
                              <span>목표: {kr.target_value} {kr.unit}</span>
                              <span>가중치: {kr.weight}%</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}