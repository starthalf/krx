// src/components/PeriodStatusWidget.tsx
// 대시보드에 표시되는 현재 기간 상태 및 요약 위젯

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, CheckCircle2, AlertTriangle, TrendingUp,
  ChevronRight, BarChart3, Target, Lock, Play, Archive,
  Loader2, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchFiscalPeriods,
  fetchActivePeriod,
  fetchCompanyPeriodSummary,
} from '../lib/period-api';
import {
  FiscalPeriod,
  CompanyPeriodSummary,
  PERIOD_STATUS_CONFIG,
} from '../types/period.types';

// ─────────────────────────────────────────────────────────────
// Period Progress Bar
// ─────────────────────────────────────────────────────────────
function PeriodProgressBar({ period }: { period: FiscalPeriod }) {
  const now = new Date();
  const start = new Date(period.startsAt);
  const end = new Date(period.endsAt);
  
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  const remainingDays = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>{new Date(period.startsAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
        <span>{remainingDays > 0 ? `${remainingDays}일 남음` : '종료'}</span>
        <span>{new Date(period.endsAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${
            progress >= 90 ? 'bg-red-500' :
            progress >= 70 ? 'bg-amber-500' :
            'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config = PERIOD_STATUS_CONFIG[status] || {
    label: status,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
  };
  
  const Icon = status === 'active' ? Play :
               status === 'closing' ? Lock :
               status === 'closed' ? CheckCircle2 :
               status === 'archived' ? Archive :
               Clock;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Widget Component
// ─────────────────────────────────────────────────────────────
interface PeriodStatusWidgetProps {
  variant?: 'compact' | 'full';
}

export default function PeriodStatusWidget({ variant = 'full' }: PeriodStatusWidgetProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<FiscalPeriod | null>(null);
  const [previousPeriodSummary, setPreviousPeriodSummary] = useState<CompanyPeriodSummary | null>(null);
  const [recentPeriods, setRecentPeriods] = useState<FiscalPeriod[]>([]);
  
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    
    if (loadedRef.current === companyId) return;
    loadedRef.current = companyId;
    
    const loadData = async () => {
      setLoading(true);
      try {
        // 활성 기간 조회
        const active = await fetchActivePeriod(companyId, 'half');
        setActivePeriod(active);
        
        // 전체 기간 목록 (최근 것들)
        const periods = await fetchFiscalPeriods(companyId);
        const recentHalves = periods
          .filter(p => p.periodType === 'half')
          .slice(0, 4);
        setRecentPeriods(recentHalves);
        
        // 직전 마감 기간의 요약 조회
        const lastClosed = periods.find(p => p.status === 'closed' || p.status === 'archived');
        if (lastClosed) {
          try {
            const summary = await fetchCompanyPeriodSummary(lastClosed.id, companyId);
            setPreviousPeriodSummary(summary);
          } catch (e) {
            // 요약 없을 수 있음
          }
        }
      } catch (err) {
        console.error('기간 위젯 데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [companyId]);

  if (!companyId || loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  // Compact 버전
  if (variant === 'compact') {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-slate-900">현재 기간</span>
          </div>
          {activePeriod && <StatusBadge status={activePeriod.status} />}
        </div>
        
        {activePeriod ? (
          <>
            <h3 className="font-semibold text-slate-900 mb-2">{activePeriod.periodName}</h3>
            <PeriodProgressBar period={activePeriod} />
          </>
        ) : (
          <p className="text-slate-500 text-sm">활성 기간이 없습니다</p>
        )}
        
        <button
          onClick={() => navigate('/admin?tab=periods')}
          className="mt-3 w-full text-sm text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
        >
          기간 관리 <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Full 버전
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-slate-900">기간 현황</h2>
        </div>
        <button
          onClick={() => navigate('/admin?tab=periods')}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          기간 관리 <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 활성 기간 */}
      {activePeriod ? (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg text-slate-900">{activePeriod.periodName}</h3>
            <StatusBadge status={activePeriod.status} />
          </div>
          <PeriodProgressBar period={activePeriod} />
          
          {/* 빠른 액션 */}
          <div className="flex gap-2 mt-4">
            {activePeriod.status === 'active' && (
              <button
                onClick={() => navigate(`/period-close/${activePeriod.id}`)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm"
              >
                <Lock className="w-4 h-4" />
                마감 시작
              </button>
            )}
            <button
              onClick={() => navigate('/wizard')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
            >
              <Target className="w-4 h-4" />
              OKR 수립
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-slate-50 rounded-lg text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="text-slate-600">활성 기간이 없습니다</p>
          <button
            onClick={() => navigate('/admin?tab=periods')}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            기간 설정하기
          </button>
        </div>
      )}

      {/* 직전 기간 성과 요약 */}
      {previousPeriodSummary && (
        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            직전 기간 성과
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-xl font-bold text-blue-600">
                {previousPeriodSummary.companyAvgAchievement.toFixed(0)}%
              </p>
              <p className="text-xs text-blue-700">평균 달성률</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xl font-bold text-slate-700">{previousPeriodSummary.totalObjectives}</p>
              <p className="text-xs text-slate-500">목표</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xl font-bold text-slate-700">{previousPeriodSummary.totalOrgs}</p>
              <p className="text-xs text-slate-500">참여 조직</p>
            </div>
          </div>
          
          <button
            onClick={() => navigate('/period-history')}
            className="mt-3 w-full text-sm text-slate-600 hover:text-slate-800 flex items-center justify-center gap-1"
          >
            히스토리 보기 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 최근 기간 목록 */}
      {recentPeriods.length > 0 && !previousPeriodSummary && (
        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-sm font-medium text-slate-700 mb-3">최근 기간</h4>
          <div className="space-y-2">
            {recentPeriods.map(period => (
              <div
                key={period.id}
                onClick={() => {
                  if (['closed', 'archived'].includes(period.status)) {
                    navigate(`/period-history/${period.id}`);
                  }
                }}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  ['closed', 'archived'].includes(period.status) 
                    ? 'hover:bg-slate-50 cursor-pointer' 
                    : ''
                }`}
              >
                <span className="text-sm text-slate-700">{period.periodName}</span>
                <StatusBadge status={period.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}