// src/components/admin/FiscalPeriodManager.tsx
// 관리자 설정 > 기간 관리 탭

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Plus, ChevronRight, CheckCircle2, Clock,
  AlertTriangle, Archive, Play, Lock, Loader2,
  ChevronDown, Building2, BarChart3, History
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../store/useStore';
import {
  fetchFiscalPeriods,
  fetchPeriodHierarchy,
  createFiscalYear,
  activatePeriod,
} from '../../lib/period-api';
import {
  FiscalPeriod,
  PERIOD_STATUS_CONFIG,
  PERIOD_TYPE_LABELS,
} from '../../types/period.types';

// ─────────────────────────────────────────────────────────────
// Period Card Component
// ─────────────────────────────────────────────────────────────
interface PeriodCardProps {
  period: FiscalPeriod;
  childPeriods?: FiscalPeriod[];
  onAction: (period: FiscalPeriod, action: string) => void;
  level?: number;
}

function PeriodCard({ period, childPeriods, onAction, level = 0 }: PeriodCardProps) {
  const [expanded, setExpanded] = useState(level === 0);
  const statusConfig = PERIOD_STATUS_CONFIG[period.status] || {
    label: period.status,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  };
  
  const hasChildren = childPeriods && childPeriods.length > 0;
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  
  const getActions = () => {
    const actions: { label: string; icon: any; action: string; color: string }[] = [];
    
    switch (period.status) {
      case 'upcoming':
        actions.push({
          label: '활성화',
          icon: Play,
          action: 'activate',
          color: 'bg-blue-600 hover:bg-blue-700 text-white',
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
        actions.push({
          label: '아카이브',
          icon: Archive,
          action: 'archive',
          color: 'bg-purple-600 hover:bg-purple-700 text-white',
        });
        actions.push({
          label: '성과 보기',
          icon: BarChart3,
          action: 'view_snapshot',
          color: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
        });
        break;
      case 'archived':
        actions.push({
          label: '히스토리 조회',
          icon: History,
          action: 'view_history',
          color: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
        });
        break;
    }
    
    return actions;
  };
  
  const actions = getActions();
  const indentStyle = { marginLeft: `${level * 24}px` };
  
  return (
    <div style={indentStyle}>
      <div className={`bg-white rounded-lg border ${
        period.status === 'active' ? 'border-blue-300 ring-2 ring-blue-100' :
        period.status === 'closing' ? 'border-amber-300' :
        'border-slate-200'
      } overflow-hidden mb-2`}>
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
                <span className="text-xs text-slate-400 font-medium">
                  {PERIOD_TYPE_LABELS[period.periodType] || period.periodType}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {period.forceClosed && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    강제마감
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-slate-900 mt-0.5">{period.periodName}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatDate(period.startsAt)} ~ {formatDate(period.endsAt)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => onAction(period, action.action)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${action.color}`}
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
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
      
      {expanded && hasChildren && (
        <div className="ml-4 border-l-2 border-slate-200 pl-2">
          {childPeriods!.map((child) => (
            <PeriodCard
              key={child.id}
              period={child}
              childPeriods={child.childPeriods}
              onAction={onAction}
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
  const { user } = useAuth();
  const company = useStore(state => state.company);
  
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [hierarchyByYear, setHierarchyByYear] = useState<Map<number, FiscalPeriod>>(new Map());
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1);
  const [error, setError] = useState<string | null>(null);
  
  // 중복 로드 방지
  const loadedRef = useRef(false);
  const companyIdRef = useRef<string | null>(null);

  // ─────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadPeriods = async () => {
      // company가 없으면 스킵
      if (!company?.id) {
        setLoading(false);
        return;
      }
      
      // 이미 같은 company로 로드했으면 스킵
      if (companyIdRef.current === company.id && loadedRef.current) {
        return;
      }
      
      companyIdRef.current = company.id;
      loadedRef.current = true;
      setLoading(true);
      setError(null);
      
      try {
        const data = await fetchFiscalPeriods(company.id);
        setPeriods(data);
        
        // 연도별로 그룹핑하여 계층 구조 로드
        const years = new Set(data
          .filter(p => p.periodType === 'year')
          .map(p => parseInt(p.periodCode))
        );
        
        const hierarchyMap = new Map<number, FiscalPeriod>();
        for (const year of years) {
          try {
            const hierarchy = await fetchPeriodHierarchy(company.id, year);
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
    
    loadPeriods();
  }, [company?.id]);
  
  // 데이터 새로고침 함수
  const refreshPeriods = async () => {
    if (!company?.id) return;
    
    loadedRef.current = false;
    companyIdRef.current = null;
    setLoading(true);
    
    try {
      const data = await fetchFiscalPeriods(company.id);
      setPeriods(data);
      
      const years = new Set(data
        .filter(p => p.periodType === 'year')
        .map(p => parseInt(p.periodCode))
      );
      
      const hierarchyMap = new Map<number, FiscalPeriod>();
      for (const year of years) {
        const hierarchy = await fetchPeriodHierarchy(company.id, year);
        if (hierarchy) {
          hierarchyMap.set(year, hierarchy);
        }
      }
      setHierarchyByYear(hierarchyMap);
      loadedRef.current = true;
      companyIdRef.current = company.id;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────
  const handleCreateYear = async () => {
    if (!company?.id || !user?.id) return;
    
    setActionLoading(true);
    try {
      const result = await createFiscalYear(company.id, newYear, user.id);
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
    
    switch (action) {
      case 'activate':
        if (!confirm(`${period.periodName}을 활성화하시겠습니까?\n\n활성화 후 OKR 수립/실행이 가능합니다.`)) return;
        setActionLoading(true);
        try {
          const result = await activatePeriod(period.id, user.id);
          if (!result.success) {
            alert(result.error || '활성화 실패');
            return;
          }
          refreshPeriods();
        } catch (err: any) {
          alert(`오류: ${err.message}`);
        } finally {
          setActionLoading(false);
        }
        break;
        
      case 'start_close':
      case 'continue_close':
        navigate(`/period-close/${period.id}`);
        break;
        
      case 'archive':
        alert('아카이브 기능은 준비 중입니다.');
        break;
        
      case 'view_snapshot':
      case 'view_history':
        navigate(`/period-history/${period.id}`);
        break;
    }
  };

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
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
  
  if (!company?.id) {
    return (
      <div className="text-center py-12 text-slate-500">
        회사 정보를 불러오는 중...
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
            연도/반기/분기별 기간을 관리하고 마감 프로세스를 진행합니다
          </p>
        </div>
        
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
      
      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 mb-3">신규 연도 기간 생성</h3>
          <p className="text-sm text-blue-700 mb-4">
            연도를 선택하면 해당 연도 + 반기 2개 + 분기 4개가 자동으로 생성됩니다.
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
      
      {/* 안내 */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700">
            <p className="font-medium mb-1">기간 상태 안내</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(PERIOD_STATUS_CONFIG).map(([status, config]) => (
                <span key={status} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${config.bgColor}`}></span>
                  <span className={config.color}>{config.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
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
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}