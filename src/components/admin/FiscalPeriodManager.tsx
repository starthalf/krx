// src/components/admin/FiscalPeriodManager.tsx
// 관리자 설정 > 기간 관리 탭
// 분기 기준 운영 + 반기/연도 결산 구조

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Plus, ChevronRight, AlertTriangle, Archive, 
  Play, Lock, Loader2, ChevronDown, BarChart3, History,
  CheckCircle2, Clock, Calculator, Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchFiscalPeriods,
  fetchPeriodHierarchy,
  createFiscalYear,
  activatePeriod,
  checkChildPeriodsStatus,
  closeHalfYearWithAggregation,
  closeYearWithAggregation,
} from '../../lib/period-api';
import {
  FiscalPeriod,
  PERIOD_STATUS_CONFIG,
  PERIOD_TYPE_LABELS,
} from '../../types/period.types';

// ─────────────────────────────────────────────────────────────
// 기간 타입별 설명
// ─────────────────────────────────────────────────────────────
const PERIOD_TYPE_INFO = {
  year: {
    label: '연도',
    description: '상반기 + 하반기 결산 합산',
    color: 'border-purple-300 bg-purple-50',
    badge: 'bg-purple-100 text-purple-700',
  },
  half: {
    label: '반기',
    description: '분기 결산 합산 (1+2분기 또는 3+4분기)',
    color: 'border-blue-300 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
  },
  quarter: {
    label: '분기',
    description: 'OKR 수립/실행 단위',
    color: 'border-green-300 bg-green-50',
    badge: 'bg-green-100 text-green-700',
  },
};

// ─────────────────────────────────────────────────────────────
// Period Card Component
// ─────────────────────────────────────────────────────────────
interface PeriodCardProps {
  period: FiscalPeriod;
  childPeriods?: FiscalPeriod[];
  onAction: (period: FiscalPeriod, action: string) => void;
  onRefresh: () => void;
  level?: number;
}

function PeriodCard({ period, childPeriods, onAction, onRefresh, level = 0 }: PeriodCardProps) {
  const [expanded, setExpanded] = useState(level === 0);
  const [childStatus, setChildStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  
  const statusConfig = PERIOD_STATUS_CONFIG[period.status] || {
    label: period.status,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  };
  
  const typeInfo = PERIOD_TYPE_INFO[period.periodType] || PERIOD_TYPE_INFO.quarter;
  const hasChildren = childPeriods && childPeriods.length > 0;
  const isAggregatable = period.periodType === 'year' || period.periodType === 'half';
  
  // 하위 기간 상태 확인
  useEffect(() => {
    if (isAggregatable && period.status !== 'closed' && period.status !== 'archived') {
      loadChildStatus();
    }
  }, [period.id, period.status]);
  
  const loadChildStatus = async () => {
    setLoadingStatus(true);
    const status = await checkChildPeriodsStatus(period.id);
    setChildStatus(status);
    setLoadingStatus(false);
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  // 기간 타입에 따른 액션 버튼
  const getActions = () => {
    const actions: { label: string; icon: any; action: string; color: string; disabled?: boolean; tooltip?: string }[] = [];
    
    // 분기: 활성화 → 마감
    if (period.periodType === 'quarter') {
      switch (period.status) {
        case 'upcoming':
          actions.push({
            label: '활성화',
            icon: Play,
            action: 'activate',
            color: 'bg-green-600 hover:bg-green-700 text-white',
          });
          break;
        case 'active':
          actions.push({
            label: '마감 시작',
            icon: Lock,
            action: 'start_close',
            color: 'bg-amber-600 hover:bg-amber-700 text-white',
          });
          break;
        case 'closing':
          actions.push({
            label: '마감 계속',
            icon: ChevronRight,
            action: 'continue_close',
            color: 'bg-amber-600 hover:bg-amber-700 text-white',
          });
          break;
        case 'closed':
        case 'archived':
          actions.push({
            label: '성과 보기',
            icon: BarChart3,
            action: 'view_snapshot',
            color: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
          });
          break;
      }
    }
    
    // 반기: 하위 분기 모두 마감 시 결산 가능
    if (period.periodType === 'half') {
      if (period.status === 'closed' || period.status === 'archived') {
        actions.push({
          label: '결산 보기',
          icon: BarChart3,
          action: 'view_snapshot',
          color: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
        });
      } else if (childStatus?.canAggregate) {
        actions.push({
          label: '반기 결산',
          icon: Calculator,
          action: 'aggregate_half',
          color: 'bg-blue-600 hover:bg-blue-700 text-white',
        });
      } else if (childStatus && !childStatus.canAggregate) {
        actions.push({
          label: `결산 대기 (${childStatus.closedCount}/${childStatus.totalCount})`,
          icon: Clock,
          action: 'none',
          color: 'bg-slate-100 text-slate-400 cursor-not-allowed',
          disabled: true,
          tooltip: '모든 하위 분기가 마감되어야 결산 가능',
        });
      }
    }
    
    // 연도: 하위 반기 모두 마감 시 결산 가능
    if (period.periodType === 'year') {
      if (period.status === 'closed' || period.status === 'archived') {
        actions.push({
          label: '연간 결산 보기',
          icon: BarChart3,
          action: 'view_snapshot',
          color: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
        });
      } else if (childStatus?.canAggregate) {
        actions.push({
          label: '연도 결산',
          icon: Calculator,
          action: 'aggregate_year',
          color: 'bg-purple-600 hover:bg-purple-700 text-white',
        });
      } else if (childStatus && !childStatus.canAggregate) {
        actions.push({
          label: `결산 대기 (${childStatus.closedCount}/${childStatus.totalCount})`,
          icon: Clock,
          action: 'none',
          color: 'bg-slate-100 text-slate-400 cursor-not-allowed',
          disabled: true,
          tooltip: '모든 하위 반기가 마감되어야 결산 가능',
        });
      }
    }
    
    return actions;
  };
  
  const actions = getActions();
  const indentStyle = { marginLeft: `${level * 20}px` };
  
  return (
    <div style={indentStyle}>
      <div className={`bg-white rounded-lg border-2 ${
        period.status === 'active' ? 'border-green-400 ring-2 ring-green-100' :
        period.status === 'closing' ? 'border-amber-400 ring-2 ring-amber-100' :
        period.status === 'closed' ? 'border-slate-300' :
        'border-slate-200'
      } overflow-hidden mb-2`}>
        
        {/* 기간 타입 표시 바 */}
        <div className={`px-3 py-1 ${typeInfo.badge} text-xs font-medium flex items-center justify-between`}>
          <span>{typeInfo.label}</span>
          <span className="opacity-70">{typeInfo.description}</span>
        </div>
        
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {hasChildren && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{period.periodName}</h3>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {period.forceClosed && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    강제마감
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatDate(period.startsAt)} ~ {formatDate(period.endsAt)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {loadingStatus && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            
            {actions.map((act, idx) => (
              <button
                key={idx}
                onClick={() => !act.disabled && onAction(period, act.action)}
                disabled={act.disabled}
                title={act.tooltip}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${act.color}`}
              >
                <act.icon className="w-3.5 h-3.5" />
                {act.label}
              </button>
            ))}
          </div>
        </div>
        
        {period.forceClosed && period.forceCloseReason && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-100 text-xs text-red-700">
            <span className="font-medium">강제 마감 사유:</span> {period.forceCloseReason}
          </div>
        )}
      </div>
      
      {/* 하위 기간 */}
      {expanded && hasChildren && (
        <div className="ml-4 border-l-2 border-slate-200 pl-2">
          {childPeriods!.map((child) => (
            <PeriodCard
              key={child.id}
              period={child}
              childPeriods={child.childPeriods}
              onAction={onAction}
              onRefresh={onRefresh}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function FiscalPeriodManager() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const companyId = profile?.company_id;
  
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [hierarchyByYear, setHierarchyByYear] = useState<Map<number, FiscalPeriod>>(new Map());
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [error, setError] = useState<string | null>(null);
  
  const loadedCompanyIdRef = useRef<string | null>(null);

  // ─────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────
  const loadPeriods = async (force = false) => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    
    if (!force && loadedCompanyIdRef.current === companyId) {
      return;
    }
    
    loadedCompanyIdRef.current = companyId;
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchFiscalPeriods(companyId);
      setPeriods(data);
      
      const years = new Set(data
        .filter(p => p.periodType === 'year')
        .map(p => parseInt(p.periodCode))
      );
      
      const hierarchyMap = new Map<number, FiscalPeriod>();
      for (const year of years) {
        try {
          const hierarchy = await fetchPeriodHierarchy(companyId, year);
          if (hierarchy) {
            hierarchyMap.set(year, hierarchy);
          }
        } catch (err) {
          console.error(`연도 ${year} 계층 로드 실패:`, err);
        }
      }
      setHierarchyByYear(hierarchyMap);
    } catch (err: any) {
      console.error('기간 로드 실패:', err);
      setError(err.message || '기간 로드 실패');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadPeriods();
  }, [companyId]);
  
  const refreshPeriods = () => {
    loadedCompanyIdRef.current = null;
    loadPeriods(true);
  };

  // ─────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────
  const handleCreateYear = async () => {
    if (!companyId || !user?.id) return;
    
    setActionLoading(true);
    try {
      const result = await createFiscalYear(companyId, newYear, user.id);
      if (!result.success) {
        alert(result.error || '기간 생성 실패');
        return;
      }
      
      alert(`${newYear}년 기간이 생성되었습니다.\n(연도 + 반기 2개 + 분기 4개)`);
      setShowCreateForm(false);
      refreshPeriods();
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };
  
  const handleAction = async (period: FiscalPeriod, action: string) => {
    if (!user?.id) return;
    if (action === 'none') return;
    
    setActionLoading(true);
    
    try {
      switch (action) {
        case 'activate':
          if (!confirm(`${period.periodName}을 활성화하시겠습니까?\n\n활성화 후 OKR 수립/실행이 가능합니다.`)) {
            setActionLoading(false);
            return;
          }
          const activateResult = await activatePeriod(period.id, user.id);
          if (!activateResult.success) {
            alert(activateResult.error || '활성화 실패');
          } else {
            refreshPeriods();
          }
          break;
          
        case 'start_close':
        case 'continue_close':
          navigate(`/period-close/${period.id}`);
          break;
          
        case 'aggregate_half':
          if (!confirm(`${period.periodName} 결산을 진행하시겠습니까?\n\n하위 분기의 성과가 합산됩니다.`)) {
            setActionLoading(false);
            return;
          }
          const halfResult = await closeHalfYearWithAggregation(period.id, user.id);
          if (!halfResult.success) {
            alert(halfResult.error || '반기 결산 실패');
          } else {
            alert(`${period.periodName} 결산이 완료되었습니다.\n스냅샷 ${halfResult.snapshotCount}개 생성`);
            refreshPeriods();
          }
          break;
          
        case 'aggregate_year':
          if (!confirm(`${period.periodName} 연간 결산을 진행하시겠습니까?\n\n하위 반기의 성과가 합산됩니다.`)) {
            setActionLoading(false);
            return;
          }
          const yearResult = await closeYearWithAggregation(period.id, user.id);
          if (!yearResult.success) {
            alert(yearResult.error || '연도 결산 실패');
          } else {
            alert(`${period.periodName} 연간 결산이 완료되었습니다.\n스냅샷 ${yearResult.snapshotCount}개 생성`);
            refreshPeriods();
          }
          break;
          
        case 'view_snapshot':
        case 'view_history':
          navigate(`/period-history/${period.id}`);
          break;
          
        case 'archive':
          alert('아카이브 기능은 준비 중입니다.');
          break;
      }
    } catch (err: any) {
      alert(`오류: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  if (!companyId) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-slate-400" />
        회사 정보를 불러오는 중...
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={refreshPeriods}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    );
  }
  
  const sortedYears = Array.from(hierarchyByYear.keys()).sort((a, b) => b - a);
  const existingYears = periods.filter(p => p.periodType === 'year').map(p => parseInt(p.periodCode));
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">기간 관리</h2>
          <p className="text-sm text-slate-500 mt-1">
            분기별 OKR 운영 및 반기/연도 결산 관리
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {actionLoading && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
          
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              신규 연도 생성
            </button>
          )}
        </div>
      </div>
      
      {/* 운영 안내 */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-2">기간 운영 구조</p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="bg-white/60 rounded-lg p-2">
                <span className="font-medium text-green-700">▸ 분기</span>
                <p className="text-slate-600 mt-1">OKR 수립 → 실행 → 마감</p>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <span className="font-medium text-blue-700">▸ 반기</span>
                <p className="text-slate-600 mt-1">1+2분기 또는 3+4분기 합산 결산</p>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <span className="font-medium text-purple-700">▸ 연도</span>
                <p className="text-slate-600 mt-1">상반기 + 하반기 합산 결산</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 mb-3">신규 연도 기간 생성</h3>
          <p className="text-sm text-blue-700 mb-4">
            연도를 선택하면 연도 + 반기 2개 + 분기 4개가 자동으로 생성됩니다.
          </p>
          
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-1">연도 선택</label>
              <select
                value={newYear}
                onChange={(e) => setNewYear(parseInt(e.target.value))}
                className="px-4 py-2 border border-blue-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() + i;
                  const exists = existingYears.includes(year);
                  return (
                    <option key={year} value={year} disabled={exists}>
                      {year}년 {exists ? '(이미 존재)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            
            <button
              onClick={handleCreateYear}
              disabled={actionLoading || existingYears.includes(newYear)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              생성
            </button>
            
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}
      
      {/* 상태 범례 */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="text-slate-500">상태:</span>
        {Object.entries(PERIOD_STATUS_CONFIG).map(([status, config]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${config.bgColor}`}></span>
            <span className={config.color}>{config.label}</span>
          </span>
        ))}
      </div>
      
      {/* Period List */}
      {sortedYears.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">등록된 기간이 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">위 버튼을 눌러 신규 연도를 생성하세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedYears.map(year => {
            const yearPeriod = hierarchyByYear.get(year);
            if (!yearPeriod) return null;
            
            return (
              <div key={year} className="bg-slate-50 rounded-xl p-4">
                <PeriodCard
                  period={yearPeriod}
                  childPeriods={yearPeriod.childPeriods}
                  onAction={handleAction}
                  onRefresh={refreshPeriods}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}