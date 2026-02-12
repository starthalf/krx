// src/components/CycleBanner.tsx
// Layout 상단에 표시되는 얇은 띠 배너 - OKR 수립 기간 알림
// 활성 사이클이 없으면 렌더링하지 않음

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock, ArrowRight, Clock, CheckCircle2,
  AlertTriangle, Users, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface BannerInfo {
  cycleId: string;
  period: string;
  title: string;
  status: string;
  deadlineAt: string;
  daysRemaining: number;
  isOverdue: boolean;
  totalOrgs: number;
  submittedOrgs: number;
  approvedOrgs: number;
  completionPct: number;
}

export default function CycleBanner() {
  const navigate = useNavigate();
  const company = useStore(state => state.company);
  const [banner, setBanner] = useState<BannerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!company?.id) {
      setLoading(false);
      return;
    }

    const fetchBanner = async () => {
      try {
        const { data, error } = await supabase.rpc('get_cycle_banner_info', {
          p_company_id: company.id,
        });

        if (error) throw error;

        if (data && data.length > 0) {
          const row = data[0];
          setBanner({
            cycleId: row.cycle_id,
            period: row.period,
            title: row.title,
            status: row.status,
            deadlineAt: row.deadline_at,
            daysRemaining: row.days_remaining,
            isOverdue: row.is_overdue,
            totalOrgs: row.total_orgs,
            submittedOrgs: row.submitted_orgs,
            approvedOrgs: row.approved_orgs,
            completionPct: row.completion_pct,
          });
        } else {
          setBanner(null);
        }
      } catch (err) {
        console.error('배너 조회 실패:', err);
        setBanner(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBanner();
  }, [company?.id]);

  if (loading || !banner || dismissed) return null;

  const { daysRemaining, isOverdue, status } = banner;

  // 테마 결정
  const theme = isOverdue
    ? { bg: 'bg-red-600', text: 'text-white', muted: 'text-red-100', btn: 'bg-white/20 hover:bg-white/30 text-white', dot: 'bg-red-300' }
    : daysRemaining <= 3
    ? { bg: 'bg-amber-500', text: 'text-white', muted: 'text-amber-100', btn: 'bg-white/20 hover:bg-white/30 text-white', dot: 'bg-amber-300' }
    : status === 'planning'
    ? { bg: 'bg-slate-700', text: 'text-white', muted: 'text-slate-300', btn: 'bg-white/15 hover:bg-white/25 text-white', dot: 'bg-slate-400' }
    : { bg: 'bg-blue-600', text: 'text-white', muted: 'text-blue-100', btn: 'bg-white/20 hover:bg-white/30 text-white', dot: 'bg-blue-300' };

  // D-day 텍스트
  const dDayText = isOverdue
    ? `마감 ${Math.abs(daysRemaining)}일 초과`
    : daysRemaining === 0
    ? '오늘 마감!'
    : `D-${daysRemaining}`;

  // 아이콘
  const Icon = isOverdue ? AlertTriangle : status === 'planning' ? Clock : CalendarClock;

  return (
    <div className={`${theme.bg} transition-colors duration-300`}>
      <div className="flex items-center justify-center gap-3 px-4 py-2 text-sm">
        {/* 아이콘 */}
        <Icon className={`w-4 h-4 ${theme.text} shrink-0`} />

        {/* 메인 텍스트 */}
        <span className={`font-medium ${theme.text}`}>
          {banner.title}
        </span>

        {/* 구분점 */}
        <span className={`w-1 h-1 rounded-full ${theme.dot}`} />

        {/* D-day */}
        <span className={`font-bold ${theme.text}`}>
          {dDayText}
        </span>

        {/* 제출 현황 (in_progress일 때만) */}
        {status === 'in_progress' && banner.totalOrgs > 0 && (
          <>
            <span className={`w-1 h-1 rounded-full ${theme.dot}`} />
            <span className={`flex items-center gap-1 ${theme.muted}`}>
              <Users className="w-3.5 h-3.5" />
              제출 {banner.submittedOrgs}/{banner.totalOrgs}
            </span>
            <span className={`flex items-center gap-1 ${theme.muted}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              승인 {banner.approvedOrgs}/{banner.totalOrgs}
            </span>
          </>
        )}

        {/* 수립 현황 버튼 */}
        <button
          onClick={() => navigate('/okr-setup')}
          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${theme.btn}`}
        >
          수립 현황
          <ArrowRight className="w-3 h-3" />
        </button>

        {/* 닫기 */}
        <button
          onClick={() => setDismissed(true)}
          className={`p-0.5 rounded ${theme.text} opacity-50 hover:opacity-100 transition-opacity ml-1`}
          title="숨기기"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}