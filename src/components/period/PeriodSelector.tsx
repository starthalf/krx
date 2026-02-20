// src/components/period/PeriodSelector.tsx
// OKR 수립 시 기간 선택 컴포넌트

import { useState, useEffect } from 'react';
import { Calendar, ChevronDown, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchFiscalPeriods, fetchActivePeriod } from '../../lib/period-api';
import { FiscalPeriod, PERIOD_STATUS_CONFIG } from '../../types/period.types';

interface PeriodSelectorProps {
  value: string | null;
  onChange: (periodId: string, periodCode: string) => void;
  periodType?: 'quarter' | 'half' | 'all';
  showOnlyActive?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function PeriodSelector({
  value,
  onChange,
  periodType = 'quarter',
  showOnlyActive = false,
  disabled = false,
  className = '',
}: PeriodSelectorProps) {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<FiscalPeriod | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    
    const loadPeriods = async () => {
      setLoading(true);
      try {
        const data = await fetchFiscalPeriods(companyId);
        
        // 필터링
        let filtered = data;
        if (periodType !== 'all') {
          filtered = data.filter(p => p.periodType === periodType);
        }
        if (showOnlyActive) {
          filtered = filtered.filter(p => p.status === 'active');
        } else {
          // 활성 또는 예정인 것만 (마감된 건 제외)
          filtered = filtered.filter(p => ['active', 'upcoming'].includes(p.status));
        }
        
        setPeriods(filtered);
        
        // 기본값 설정
        if (!value) {
          // 활성 기간 우선 선택
          const active = filtered.find(p => p.status === 'active');
          if (active) {
            setSelectedPeriod(active);
            onChange(active.id, active.periodCode);
          } else if (filtered.length > 0) {
            setSelectedPeriod(filtered[0]);
            onChange(filtered[0].id, filtered[0].periodCode);
          }
        } else {
          const found = filtered.find(p => p.id === value || p.periodCode === value);
          if (found) {
            setSelectedPeriod(found);
          }
        }
      } catch (err) {
        console.error('기간 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadPeriods();
  }, [companyId, periodType, showOnlyActive]);
  
  // value 변경 시 selectedPeriod 업데이트
  useEffect(() => {
    if (value && periods.length > 0) {
      const found = periods.find(p => p.id === value || p.periodCode === value);
      if (found) {
        setSelectedPeriod(found);
      }
    }
  }, [value, periods]);

  const handleSelect = (period: FiscalPeriod) => {
    setSelectedPeriod(period);
    onChange(period.id, period.periodCode);
    setIsOpen(false);
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
        <span className="text-sm text-slate-500">기간 로딩 중...</span>
      </div>
    );
  }

  if (periods.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg ${className}`}>
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="text-sm text-amber-700">선택 가능한 기간이 없습니다</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border rounded-lg text-sm transition-colors ${
          disabled 
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed' 
            : 'border-slate-300 hover:border-blue-400 cursor-pointer'
        } ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          {selectedPeriod ? (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">{selectedPeriod.periodName}</span>
              {selectedPeriod.status === 'active' && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                  진행 중
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-500">기간 선택</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {periods.map((period) => {
            const isSelected = selectedPeriod?.id === period.id;
            const statusConfig = PERIOD_STATUS_CONFIG[period.status];
            
            return (
              <button
                key={period.id}
                onClick={() => handleSelect(period)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
                      {period.periodName}
                    </span>
                    <span className={`px-1.5 py-0.5 text-xs rounded ${statusConfig.bgColor} ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(period.startsAt).toLocaleDateString('ko-KR')} ~ {new Date(period.endsAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 간단한 훅 버전
export function useActivePeriod(periodType: 'quarter' | 'half' = 'quarter') {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  
  const [activePeriod, setActivePeriod] = useState<FiscalPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!companyId) return;
    
    const load = async () => {
      setLoading(true);
      try {
        const period = await fetchActivePeriod(companyId, periodType);
        setActivePeriod(period);
      } catch (err) {
        console.error('활성 기간 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    
    load();
  }, [companyId, periodType]);
  
  return { activePeriod, loading };
}