// src/components/PeriodStatusWidget.tsx
// 대시보드에 표시되는 현재 기간 상태 및 요약 위젯

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, CheckCircle2, AlertTriangle, TrendingUp,
  ChevronRight, BarChart3, Target, Lock, Play, Archive,
  Loader2, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useStore } from '../store/useStore';
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
  const config = PERIOD_STATUS_CONFIG[status as keyof typeof PERIOD_STATUS_CONFIG];
  if (!config) return null;
  
  const Icon = status === 'active' ? Play :
               status === 'closing' ? Lock :
               status === 'closed' ? CheckCircle2 :
               status === 'archived' ? Archive : Clock;
  
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
  const company = useStore(state => state.company);
  
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<FiscalPeriod | null>(null);
  const [previousPeriodSummary, setPreviousPeriodSummary] = useState<CompanyPeriodSummary | null>(null);
  const [recentPeriods, setRecentPeriods] = useState<FiscalPeriod[]>([]);

  useEffect(() => {
    if (!company?.id) return;
    
    const loadData = async () => {
      setLoading(true);
      try {
        // 활성 기간 조회
        const active = await fetchActivePeriod(company.id, 'half');
        setActivePeriod(active);
        
        // 전체 기간 목록 (최근 것들)
        const periods = await fetchFiscalPeriods(company.id);
        const recentHalves = periods
          .filter(p => p.periodType === 'half')
          .slice(0, 4);
        setRecentPeriods(recentHalves);
        
        // 직전 마감 기간의 요약 조회
        const lastClosed = periods.find(p => p.status === 'closed' || p.status === 'archived');
        if (lastClosed) {
          const summary = await fetchCompanyPeriodSummary(lastClosed.id, company.id);
          setPreviousPeriodSummary(summary);
        }
      } catch (err) {
        console.error('기간 위젯 데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [company?.id]);

  if (loading) {
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
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            현재 기간
          </h3>
          {activePeriod && <StatusBadge status={activePeriod.status} />}
        </div>
        
        {activePeriod ? (
          <>
            <p className="text-lg font-bold text-slate-900 mb-2">{activePeriod.periodName}</p>
            <PeriodProgressBar period={activePeriod} />
          </>
        ) : (
          <p className="text-slate-500 text-sm">활성화된 기간이 없습니다</p>
        )}
      </div>
    );
  }

  // Full 버전
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          기간 현황
        </h3>
        <button
          onClick={() => navigate('/admin?tab=periods')}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          전체 보기
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      {/* Active Period */}
      <div className="p-6">
        {activePeriod ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-xs text-slate-500">현재 활성 기간</span>
                <h4 className="text-xl font-bold text-slate-900">{activePeriod.periodName}</h4>
              </div>
              <StatusBadge status={activePeriod.status} />
            </div>
            <PeriodProgressBar period={activePeriod} />
            
            {/* Quick Actions */}
            <div className="flex gap-2 mt-4">
              {activePeriod.status === 'active' && (
                <button
                  onClick={() => navigate(`/period-close/${activePeriod.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-sm font-medium transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  마감 시작
                </button>
              )}
              <button
                onClick={() => navigate('/wizard')}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors"
              >
                <Target className="w-4 h-4" />
                OKR 수립
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 mb-6 bg-slate-50 rounded-lg">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500">활성화된 기간이 없습니다</p>
            <button
              onClick={() => navigate('/admin?tab=periods')}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              기간 생성하기
            </button>
          </div>
        )}
        
        {/* Previous Period Summary */}
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
                <p className="text-xl font-bold text-slate-900">
                  {previousPeriodSummary.totalObjectives}
                </p>
                <p className="text-xs text-slate-600">총 목표</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xl font-bold text-slate-900">
                  {previousPeriodSummary.totalOrgs}
                </p>
                <p className="text-xs text-slate-600">참여 조직</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Recent Periods List */}
        {recentPeriods.length > 0 && (
          <div className="border-t border-slate-100 pt-4 mt-4">
            <h4 className="text-sm font-medium text-slate-700 mb-3">최근 기간</h4>
            <div className="space-y-2">
              {recentPeriods.slice(0, 3).map(period => (
                <div 
                  key={period.id}
                  className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                  onClick={() => {
                    if (['closed', 'archived'].includes(period.status)) {
                      navigate(`/period-history/${period.id}`);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      PERIOD_STATUS_CONFIG[period.status]?.bgColor.replace('bg-', 'bg-') || 'bg-slate-300'
                    }`} />
                    <span className="text-sm text-slate-700">{period.periodName}</span>
                  </div>
                  <StatusBadge status={period.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}