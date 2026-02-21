// src/components/admin/UnifiedPeriodManager.tsx
// 기간(Period)과 수립(Planning) 관리를 단일 인터페이스로 통합
// CEO가 한 곳에서 모든 기간/수립 작업 수행

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Plus, Play, Square, CheckCircle2, Clock, Edit3, Trash2,
  ChevronDown, ChevronRight, AlertCircle, Info, Users, FileText,
  CalendarClock, Timer, Target, TrendingUp, Archive, Settings,
  MessageSquare, Bell, RefreshCw, X, Save, Pause
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../store/useStore';

// ─── Types ───────────────────────────────────────────────

interface FiscalPeriod {
  id: string;
  company_id: string;
  period_code: string;
  period_name: string; // ✅ period_name 추가
  period_type: 'quarter' | 'half' | 'year';
  // year, sequence 제거 (period_code에서 추출)
  starts_at: string;
  ends_at: string;
  parent_period_id: string | null;
  status: 'upcoming' | 'planning' | 'active' | 'closing' | 'closed' | 'archived';
  
  // Planning fields
  planning_starts_at: string | null;
  planning_deadline_at: string | null;
  planning_grace_deadline_at: string | null;
  planning_status: 'not_started' | 'setup' | 'drafting' | 'in_progress' | 'closing' | 'completed';
  planning_message: string | null;
  planning_target_org_levels: string[] | null;
  planning_auto_remind_days: number[];
  company_okr_finalized: boolean;
  company_okr_finalized_at: string | null;
  all_orgs_draft_generated: boolean;
  all_orgs_draft_generated_at: string | null;
  planning_started_at: string | null;
  planning_closed_at: string | null;
  planning_completed_at: string | null;
  
  // Closing fields
  closing_started_at: string | null;
  closing_started_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PlanningSetupForm {
  planning_starts_at: string;
  planning_deadline_at: string;
  planning_grace_deadline_at: string;
  planning_message: string;
  planning_auto_remind_days: number[];
}

type TabType = 'periods' | 'planning' | 'closing';

// ─── Helper Functions ────────────────────────────────────

function getYearFromCode(periodCode: string): number {
  return parseInt(periodCode.substring(0, 4));
}

function getSequenceFromCode(periodCode: string): number {
  if (periodCode.includes('-Q')) {
    return parseInt(periodCode.charAt(periodCode.length - 1));
  }
  if (periodCode.includes('-H')) {
    return parseInt(periodCode.charAt(periodCode.length - 1));
  }
  return 1; // Year
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toInputDate(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().slice(0, 10);
}

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── 상태/타입별 설정 ────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; bgColor: string }> = {
  upcoming: { label: '예정', color: 'text-slate-600', icon: Clock, bgColor: 'bg-slate-100' },
  planning: { label: '수립중', color: 'text-blue-600', icon: Edit3, bgColor: 'bg-blue-100' },
  active: { label: '실행중', color: 'text-green-600', icon: Play, bgColor: 'bg-green-100' },
  closing: { label: '마감중', color: 'text-orange-600', icon: Square, bgColor: 'bg-orange-100' },
  closed: { label: '완료', color: 'text-gray-600', icon: Archive, bgColor: 'bg-gray-100' },
  archived: { label: '보관', color: 'text-purple-600', icon: Archive, bgColor: 'bg-purple-100' },
};

const PLANNING_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_started: { label: '미시작', color: 'text-slate-500' },
  setup: { label: '설정중', color: 'text-blue-500' },
  drafting: { label: '초안작성', color: 'text-indigo-500' },
  in_progress: { label: '진행중', color: 'text-green-600' },
  closing: { label: '마감중', color: 'text-orange-600' },
  completed: { label: '완료', color: 'text-gray-600' },
};

const PERIOD_TYPE_LABELS: Record<string, string> = {
  quarter: '분기',
  half: '반기',
  year: '연도',
};

// ─── Main Component ──────────────────────────────────────

export default function UnifiedPeriodManager() {
  const { user } = useAuth();
  const company = useStore((state) => state.company);

  const [activeTab, setActiveTab] = useState<TabType>('periods');
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<FiscalPeriod | null>(null);
  const [showCreateYear, setShowCreateYear] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // Planning Setup Form
  const [showPlanningSetup, setShowPlanningSetup] = useState(false);
  const [planningForm, setPlanningForm] = useState<PlanningSetupForm>({
    planning_starts_at: '',
    planning_deadline_at: '',
    planning_grace_deadline_at: '',
    planning_message: '',
    planning_auto_remind_days: [7, 3, 1],
  });

  // ─── Data Fetching ───────────────────────────────────────

  const fetchPeriods = useCallback(async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fiscal_periods')
        .select('*')
        .eq('company_id', company.id)
        .order('period_code', { ascending: false });

      if (error) throw error;
      setPeriods(data || []);
    } catch (err: any) {
      console.error('기간 로드 실패:', err);
      alert(`기간 로드 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  // ─── 연도 생성 (자동 계층 생성) ──────────────────────────

  const handleCreateYear = async () => {
    if (!company?.id || !user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_fiscal_year_with_hierarchy', {
        p_company_id: company.id,
        p_year: newYear,
      });

      if (error) throw error;

      alert(`${newYear}년도 및 하위 기간이 생성되었습니다.`);
      setShowCreateYear(false);
      fetchPeriods();
      setExpandedYears((prev) => new Set(prev).add(newYear));
    } catch (err: any) {
      if (err.message?.includes('duplicate')) {
        alert(`${newYear}년도가 이미 존재합니다.`);
      } else {
        alert(`연도 생성 실패: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── 수립 설정 (Planning Setup) ──────────────────────────

  const handleOpenPlanningSetup = (period: FiscalPeriod) => {
    setSelectedPeriod(period);
    setPlanningForm({
      planning_starts_at: toInputDate(period.planning_starts_at) || toInputDate(period.starts_at),
      planning_deadline_at: toInputDate(period.planning_deadline_at) || toInputDate(period.ends_at),
      planning_grace_deadline_at: toInputDate(period.planning_grace_deadline_at) || '',
      planning_message: period.planning_message || '',
      planning_auto_remind_days: period.planning_auto_remind_days || [7, 3, 1],
    });
    setShowPlanningSetup(true);
  };

  const handleSavePlanningSetup = async () => {
    if (!selectedPeriod || !user?.id) return;

    if (!planningForm.planning_starts_at || !planningForm.planning_deadline_at) {
      alert('수립 시작일과 마감일을 입력해주세요.');
      return;
    }

    if (new Date(planningForm.planning_deadline_at) <= new Date(planningForm.planning_starts_at)) {
      alert('마감일은 시작일보다 이후여야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('fiscal_periods')
        .update({
          planning_starts_at: new Date(planningForm.planning_starts_at).toISOString(),
          planning_deadline_at: new Date(planningForm.planning_deadline_at + 'T23:59:59').toISOString(),
          planning_grace_deadline_at: planningForm.planning_grace_deadline_at
            ? new Date(planningForm.planning_grace_deadline_at + 'T23:59:59').toISOString()
            : null,
          planning_message: planningForm.planning_message || null,
          planning_auto_remind_days: planningForm.planning_auto_remind_days,
          planning_status: 'setup',
        })
        .eq('id', selectedPeriod.id);

      if (error) throw error;

      alert('수립 설정이 저장되었습니다.');
      setShowPlanningSetup(false);
      setSelectedPeriod(null);
      fetchPeriods();
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── 수립 시작 ───────────────────────────────────────────

  const handleStartPlanning = async (period: FiscalPeriod) => {
    if (!user?.id) return;

    if (period.planning_status === 'not_started') {
      alert('먼저 수립 설정을 완료해주세요.');
      return;
    }

    if (
      !confirm(
        '수립을 시작하시겠습니까?\n\n모든 조직장에게 수립 시작 알림이 발송됩니다.\n' +
          `\n기간: ${period.period_code}\n시작일: ${formatDate(period.planning_starts_at)}\n마감일: ${formatDate(
            period.planning_deadline_at
          )}`
      )
    )
      return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('start_planning_period', {
        p_period_id: period.id,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data?.success) {
        alert(data.message || '수립이 시작되었습니다.');
        fetchPeriods();
      } else {
        alert(data?.message || '수립을 시작할 수 없습니다.');
      }
    } catch (err: any) {
      alert(`수립 시작 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── 수립 마감 ───────────────────────────────────────────

  const handleClosePlanning = async (period: FiscalPeriod) => {
    if (!user?.id) return;

    if (!confirm(`수립을 마감하시겠습니까?\n\n마감 후에는 신규 제출이 불가합니다.\n\n기간: ${period.period_code}`))
      return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('close_planning_period', {
        p_period_id: period.id,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data?.success) {
        alert(data.message || '수립이 마감되었습니다.');
        fetchPeriods();
      } else {
        alert(data?.message || '수립을 마감할 수 없습니다.');
      }
    } catch (err: any) {
      alert(`수립 마감 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── 수립 확정 ───────────────────────────────────────────

  const handleFinalizePlanning = async (period: FiscalPeriod) => {
    if (!user?.id) return;

    if (
      !confirm(
        `수립을 최종 확정하시겠습니까?\n\n확정 후에는 실행/체크인 모드로 전환됩니다.\n\n기간: ${period.period_code}`
      )
    )
      return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('finalize_planning_period', {
        p_period_id: period.id,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data?.success) {
        alert(data.message || '수립이 확정되었습니다.');
        fetchPeriods();
      } else {
        alert(data?.message || '수립을 확정할 수 없습니다.');
      }
    } catch (err: any) {
      alert(`수립 확정 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── 성과 마감 시작 ──────────────────────────────────────

  const handleStartClosing = async (period: FiscalPeriod) => {
    if (!user?.id) return;

    if (
      !confirm(`성과 마감을 시작하시겠습니까?\n\n미완료 항목을 검토하고 마감 처리를 진행합니다.\n\n기간: ${period.period_code}`)
    )
      return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('start_closing_period', {
        p_period_id: period.id,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data?.success) {
        alert(data.message || '마감이 시작되었습니다.');
        fetchPeriods();
      } else {
        alert(data?.message || '마감을 시작할 수 없습니다.');
      }
    } catch (err: any) {
      alert(`마감 시작 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── 성과 마감 완료 ──────────────────────────────────────

  const handleFinalizeClosing = async (period: FiscalPeriod) => {
    if (!user?.id) return;

    if (!confirm(`성과 마감을 완료하시겠습니까?\n\n완료 후에는 수정할 수 없습니다.\n\n기간: ${period.period_code}`))
      return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('finalize_closing_period', {
        p_period_id: period.id,
        p_user_id: user.id,
      });

      if (error) throw error;

      if (data?.success) {
        alert(data.message || '마감이 완료되었습니다.');
        fetchPeriods();
      } else {
        alert(data?.message || '마감을 완료할 수 없습니다.');
      }
    } catch (err: any) {
      alert(`마감 완료 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── 기간 삭제 ───────────────────────────────────────────

  const handleDeletePeriod = async (period: FiscalPeriod) => {
    const year = getYearFromCode(period.period_code);
    
    if (period.period_type === 'year') {
      if (
        !confirm(
          `${year}년도 전체를 삭제하시겠습니까?\n\n연도를 삭제하면 하위 반기/분기도 모두 삭제됩니다.\n삭제된 데이터는 복구할 수 없습니다.`
        )
      )
        return;
    } else {
      if (!confirm(`${period.period_code}를 삭제하시겠습니까?\n\n삭제된 데이터는 복구할 수 없습니다.`)) return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('fiscal_periods').delete().eq('id', period.id);

      if (error) throw error;

      alert('삭제되었습니다.');
      fetchPeriods();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── UI 헬퍼 ─────────────────────────────────────────────

  const toggleYear = (year: number) => {
    const newSet = new Set(expandedYears);
    if (newSet.has(year)) {
      newSet.delete(year);
    } else {
      newSet.add(year);
    }
    setExpandedYears(newSet);
  };

  const getHierarchy = () => {
    // year를 period_code에서 추출
    const years = [
      ...new Set(periods.map((p) => getYearFromCode(p.period_code)))
    ].sort((a, b) => b - a);

    return years.map((year) => {
      const yearPeriod = periods.find(
        (p) => p.period_code === `${year}-Y`
      );
      const halves = periods
        .filter((p) => p.period_code.startsWith(`${year}-H`))
        .sort((a, b) => a.period_code.localeCompare(b.period_code));
      const quarters = periods
        .filter((p) => p.period_code.startsWith(`${year}-Q`))
        .sort((a, b) => a.period_code.localeCompare(b.period_code));

      return { year, yearPeriod, halves, quarters };
    });
  };

  // ─── Render ──────────────────────────────────────────────

  const hierarchy = getHierarchy();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            기간 & 수립 관리
          </h2>
          <p className="text-sm text-slate-600 mt-1">기간 생성, 수립 일정 설정, 진행 현황 관리를 한 곳에서</p>
        </div>
        <button
          onClick={() => setShowCreateYear(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          연도 생성
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          {[
            { id: 'periods', label: '기간 목록', icon: Calendar },
            { id: 'planning', label: '수립 현황', icon: Edit3 },
            { id: 'closing', label: '마감 관리', icon: Archive },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`pb-3 px-1 flex items-center gap-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          로딩 중...
        </div>
      ) : (
        <>
          {activeTab === 'periods' && (
            <div className="space-y-4">
              {hierarchy.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>생성된 기간이 없습니다.</p>
                  <p className="text-sm mt-2">상단의 "연도 생성" 버튼을 클릭하여 시작하세요.</p>
                </div>
              ) : (
                hierarchy.map(({ year, yearPeriod, halves, quarters }) => (
                  <div key={year} className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Year */}
                    {yearPeriod && (
                      <div className="bg-slate-50 p-4 flex items-center justify-between border-b border-slate-200">
                        <button onClick={() => toggleYear(year)} className="flex items-center gap-3 flex-1">
                          {expandedYears.has(year) ? (
                            <ChevronDown className="w-5 h-5 text-slate-500" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-500" />
                          )}
                          <div className="flex items-center gap-3">
                            <div className="text-xl font-bold text-slate-900">{yearPeriod.period_name}</div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[yearPeriod.status].bgColor} ${STATUS_CONFIG[yearPeriod.status].color}`}>
                              {STATUS_CONFIG[yearPeriod.status].label}
                            </span>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">
                            {formatDate(yearPeriod.starts_at)} ~ {formatDate(yearPeriod.ends_at)}
                          </span>
                          <button
                            onClick={() => handleDeletePeriod(yearPeriod)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Halves & Quarters */}
                    {expandedYears.has(year) && (
                      <div className="p-4 space-y-3">
                        {halves.map((half) => {
                          const halfQuarters = quarters.filter((q) => q.parent_period_id === half.id);
                          return (
                            <div key={half.id} className="space-y-2">
                              {/* Half */}
                              <PeriodCard
                                period={half}
                                onOpenPlanningSetup={handleOpenPlanningSetup}
                                onStartPlanning={handleStartPlanning}
                                onClosePlanning={handleClosePlanning}
                                onFinalizePlanning={handleFinalizePlanning}
                                onStartClosing={handleStartClosing}
                                onFinalizeClosing={handleFinalizeClosing}
                                onDelete={handleDeletePeriod}
                              />

                              {/* Quarters */}
                              <div className="ml-8 space-y-2">
                                {halfQuarters.map((quarter) => (
                                  <PeriodCard
                                    key={quarter.id}
                                    period={quarter}
                                    onOpenPlanningSetup={handleOpenPlanningSetup}
                                    onStartPlanning={handleStartPlanning}
                                    onClosePlanning={handleClosePlanning}
                                    onFinalizePlanning={handleFinalizePlanning}
                                    onStartClosing={handleStartClosing}
                                    onFinalizeClosing={handleFinalizeClosing}
                                    onDelete={handleDeletePeriod}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'planning' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">수립 진행 중인 기간</p>
                  <p className="text-blue-700">
                    각 기간의 수립 현황을 확인하고 관리할 수 있습니다. OKR 수립 현황은 "조직 OKR 현황" 메뉴에서 확인하세요.
                  </p>
                </div>
              </div>

              {periods
                .filter((p) => ['setup', 'in_progress', 'closing'].includes(p.planning_status))
                .map((period) => (
                  <PlanningStatusCard
                    key={period.id}
                    period={period}
                    onClosePlanning={handleClosePlanning}
                    onFinalizePlanning={handleFinalizePlanning}
                  />
                ))}

              {periods.filter((p) => ['setup', 'in_progress', 'closing'].includes(p.planning_status)).length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>수립 진행 중인 기간이 없습니다.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'closing' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-900">
                  <p className="font-medium mb-1">마감 관리</p>
                  <p className="text-orange-700">실행 중이거나 마감 중인 기간의 성과를 최종 마감할 수 있습니다.</p>
                </div>
              </div>

              {periods
                .filter((p) => ['active', 'closing'].includes(p.status))
                .map((period) => (
                  <ClosingStatusCard
                    key={period.id}
                    period={period}
                    onStartClosing={handleStartClosing}
                    onFinalizeClosing={handleFinalizeClosing}
                  />
                ))}

              {periods.filter((p) => ['active', 'closing'].includes(p.status)).length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>마감 대상 기간이 없습니다.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreateYear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">연도 생성</h3>
              <button onClick={() => setShowCreateYear(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">연도</label>
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                min={2020}
                max={2050}
              />
              <p className="text-xs text-slate-500 mt-1">연도를 생성하면 자동으로 반기(H1, H2)와 분기(Q1~Q4)가 생성됩니다.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreateYear}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '생성 중...' : '생성'}
              </button>
              <button
                onClick={() => setShowCreateYear(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanningSetup && selectedPeriod && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">수립 설정 - {selectedPeriod.period_name}</h3>
              <button onClick={() => setShowPlanningSetup(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    수립 시작일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={planningForm.planning_starts_at}
                    onChange={(e) => setPlanningForm({ ...planningForm, planning_starts_at: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    수립 마감일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={planningForm.planning_deadline_at}
                    onChange={(e) => setPlanningForm({ ...planningForm, planning_deadline_at: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">유예 마감일 (선택)</label>
                <input
                  type="date"
                  value={planningForm.planning_grace_deadline_at}
                  onChange={(e) => setPlanningForm({ ...planningForm, planning_grace_deadline_at: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
                <p className="text-xs text-slate-500 mt-1">정규 마감일 이후 추가 제출을 허용할 유예 기간</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">CEO 메시지</label>
                <textarea
                  value={planningForm.planning_message}
                  onChange={(e) => setPlanningForm({ ...planningForm, planning_message: e.target.value })}
                  rows={4}
                  placeholder="조직장들에게 전달할 메시지를 입력하세요..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">자동 알림 (마감 D-)</label>
                <div className="flex gap-2">
                  {[14, 7, 5, 3, 1].map((day) => (
                    <label key={day} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={planningForm.planning_auto_remind_days.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPlanningForm({
                              ...planningForm,
                              planning_auto_remind_days: [...planningForm.planning_auto_remind_days, day].sort(
                                (a, b) => b - a
                              ),
                            });
                          } else {
                            setPlanningForm({
                              ...planningForm,
                              planning_auto_remind_days: planningForm.planning_auto_remind_days.filter((d) => d !== day),
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-slate-700">D-{day}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1">선택한 D-day에 미제출 조직에 자동 알림 발송</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <button
                onClick={handleSavePlanningSetup}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => setShowPlanningSetup(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub Components ──────────────────────────────────────

interface PeriodCardProps {
  period: FiscalPeriod;
  onOpenPlanningSetup: (period: FiscalPeriod) => void;
  onStartPlanning: (period: FiscalPeriod) => void;
  onClosePlanning: (period: FiscalPeriod) => void;
  onFinalizePlanning: (period: FiscalPeriod) => void;
  onStartClosing: (period: FiscalPeriod) => void;
  onFinalizeClosing: (period: FiscalPeriod) => void;
  onDelete: (period: FiscalPeriod) => void;
}

function PeriodCard({
  period,
  onOpenPlanningSetup,
  onStartPlanning,
  onClosePlanning,
  onFinalizePlanning,
  onStartClosing,
  onFinalizeClosing,
  onDelete,
}: PeriodCardProps) {
  const StatusIcon = STATUS_CONFIG[period.status].icon;
  const daysLeft = daysUntil(period.planning_deadline_at);

  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-semibold text-slate-900">{period.period_name}</h4>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[period.status].bgColor} ${STATUS_CONFIG[period.status].color}`}>
              {STATUS_CONFIG[period.status].label}
            </span>
            {period.planning_status !== 'not_started' && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium bg-slate-100 ${PLANNING_STATUS_CONFIG[period.planning_status].color}`}>
                수립: {PLANNING_STATUS_CONFIG[period.planning_status].label}
              </span>
            )}
          </div>

          <div className="text-sm text-slate-600 space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>
                {formatDate(period.starts_at)} ~ {formatDate(period.ends_at)}
              </span>
            </div>

            {period.planning_deadline_at && (
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4" />
                <span>
                  수립 마감: {formatDate(period.planning_deadline_at)}
                  {daysLeft !== null && daysLeft >= 0 && (
                    <span className="ml-2 text-orange-600 font-medium">(D-{daysLeft})</span>
                  )}
                </span>
              </div>
            )}

            {period.company_okr_finalized && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>전사 OKR 확정 ({formatDateTime(period.company_okr_finalized_at)})</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 수립 관련 버튼 */}
          {period.planning_status === 'not_started' && (
            <button
              onClick={() => onOpenPlanningSetup(period)}
              className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50 flex items-center gap-1"
            >
              <Settings className="w-4 h-4" />
              수립 설정
            </button>
          )}

          {period.planning_status === 'setup' && (
            <>
              <button
                onClick={() => onOpenPlanningSetup(period)}
                className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded hover:bg-slate-50 flex items-center gap-1"
              >
                <Edit3 className="w-4 h-4" />
                수정
              </button>
              <button
                onClick={() => onStartPlanning(period)}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
              >
                <Play className="w-4 h-4" />
                수립 시작
              </button>
            </>
          )}

          {period.planning_status === 'in_progress' && (
            <button
              onClick={() => onClosePlanning(period)}
              className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 flex items-center gap-1"
            >
              <Square className="w-4 h-4" />
              수립 마감
            </button>
          )}

          {period.planning_status === 'closing' && (
            <button
              onClick={() => onFinalizePlanning(period)}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
            >
              <CheckCircle2 className="w-4 h-4" />
              수립 확정
            </button>
          )}

          {/* 성과 마감 버튼 */}
          {period.status === 'active' && (
            <button
              onClick={() => onStartClosing(period)}
              className="px-3 py-1.5 text-sm border border-orange-600 text-orange-600 rounded hover:bg-orange-50 flex items-center gap-1"
            >
              <Archive className="w-4 h-4" />
              성과 마감
            </button>
          )}

          {period.status === 'closing' && (
            <button
              onClick={() => onFinalizeClosing(period)}
              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-1"
            >
              <CheckCircle2 className="w-4 h-4" />
              마감 완료
            </button>
          )}

          {period.status === 'upcoming' && (
            <button
              onClick={() => onDelete(period)}
              className="p-2 text-red-600 hover:bg-red-50 rounded"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {period.planning_message && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-start gap-2 text-sm">
            <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <p className="text-slate-600 italic">{period.planning_message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface PlanningStatusCardProps {
  period: FiscalPeriod;
  onClosePlanning: (period: FiscalPeriod) => void;
  onFinalizePlanning: (period: FiscalPeriod) => void;
}

function PlanningStatusCard({ period, onClosePlanning, onFinalizePlanning }: PlanningStatusCardProps) {
  const daysLeft = daysUntil(period.planning_deadline_at);

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h4 className="font-bold text-slate-900">{period.period_name}</h4>
          <span className={`px-2 py-1 rounded-full text-xs font-medium bg-white ${PLANNING_STATUS_CONFIG[period.planning_status].color}`}>
            {PLANNING_STATUS_CONFIG[period.planning_status].label}
          </span>
        </div>

        {daysLeft !== null && daysLeft >= 0 && (
          <div className="text-sm text-orange-600 font-semibold">마감까지 D-{daysLeft}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
        <div>
          <div className="text-slate-600">수립 기간</div>
          <div className="font-medium text-slate-900">
            {formatDate(period.planning_starts_at)} ~ {formatDate(period.planning_deadline_at)}
          </div>
        </div>
        <div>
          <div className="text-slate-600">수립 시작</div>
          <div className="font-medium text-slate-900">{formatDateTime(period.planning_started_at)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-blue-200">
        <button className="flex-1 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 text-sm">
          <Users className="w-4 h-4 inline mr-1" />
          수립 현황 보기
        </button>

        {period.planning_status === 'in_progress' && (
          <button
            onClick={() => onClosePlanning(period)}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
          >
            수립 마감
          </button>
        )}

        {period.planning_status === 'closing' && (
          <button
            onClick={() => onFinalizePlanning(period)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
          >
            수립 확정
          </button>
        )}
      </div>
    </div>
  );
}

interface ClosingStatusCardProps {
  period: FiscalPeriod;
  onStartClosing: (period: FiscalPeriod) => void;
  onFinalizeClosing: (period: FiscalPeriod) => void;
}

function ClosingStatusCard({ period, onStartClosing, onFinalizeClosing }: ClosingStatusCardProps) {
  return (
    <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h4 className="font-bold text-slate-900">{period.period_name}</h4>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[period.status].bgColor} ${STATUS_CONFIG[period.status].color}`}>
            {STATUS_CONFIG[period.status].label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
        <div>
          <div className="text-slate-600">기간</div>
          <div className="font-medium text-slate-900">
            {formatDate(period.starts_at)} ~ {formatDate(period.ends_at)}
          </div>
        </div>
        {period.closing_started_at && (
          <div>
            <div className="text-slate-600">마감 시작</div>
            <div className="font-medium text-slate-900">{formatDateTime(period.closing_started_at)}</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-orange-200">
        <button className="flex-1 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 text-sm">
          <TrendingUp className="w-4 h-4 inline mr-1" />
          성과 현황 보기
        </button>

        {period.status === 'active' && (
          <button
            onClick={() => onStartClosing(period)}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
          >
            마감 시작
          </button>
        )}

        {period.status === 'closing' && (
          <button
            onClick={() => onFinalizeClosing(period)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
          >
            마감 완료
          </button>
        )}
      </div>
    </div>
  );
}