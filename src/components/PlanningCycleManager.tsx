// src/components/PlanningCycleManager.tsx
// AdminSettings의 '수립 사이클' 탭에서 사용하는 컴포넌트
// 대표/성과관리자가 OKR 수립 기간을 선언하고 관리

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarClock, Plus, Play, Square, CheckCircle2, Clock, Pause,
  AlertTriangle, ChevronRight, Edit3, Trash2, ArrowRight,
  Megaphone, X, Calendar, FileText, Users, Timer, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { fetchActivePeriod } from '../lib/period-api';

// ─── Types ───────────────────────────────────────────────
interface PlanningCycle {
  id: string;
  company_id: string;
  period: string;
  title: string;
  status: 'planning' | 'in_progress' | 'paused' | 'closed' | 'finalized' | 'cancelled';
  starts_at: string;
  deadline_at: string;
  grace_period_at: string | null;
  company_okr_finalized: boolean;
  company_okr_finalized_at: string | null;
  all_orgs_draft_generated: boolean;
  all_orgs_draft_generated_at: string | null;
  cycle_started_at: string | null;
  message: string | null;
  target_org_levels: string[] | null;
  auto_remind_days: number[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CycleFormData {
  period: string;
  title: string;
  starts_at: string;
  deadline_at: string;
  grace_period_at: string;
  message: string;
  auto_remind_days: number[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock; bgColor: string }> = {
  planning: { label: '준비중', color: 'text-slate-600', icon: Clock, bgColor: 'bg-slate-100' },
  in_progress: { label: '수립 진행중', color: 'text-blue-600', icon: Play, bgColor: 'bg-blue-100' },
  paused: { label: '일시중지', color: 'text-amber-600', icon: Pause, bgColor: 'bg-amber-100' },
  closed: { label: '마감', color: 'text-orange-600', icon: Square, bgColor: 'bg-orange-100' },
  finalized: { label: '확정', color: 'text-green-600', icon: CheckCircle2, bgColor: 'bg-green-100' },
  cancelled: { label: '취소됨', color: 'text-red-600', icon: Trash2, bgColor: 'bg-red-100' },
};

const PERIOD_OPTIONS = [
  { value: '2025-Q1', label: '2025년 1분기' },
  { value: '2025-Q2', label: '2025년 2분기' },
  { value: '2025-Q3', label: '2025년 3분기' },
  { value: '2025-Q4', label: '2025년 4분기' },
  { value: '2025-H1', label: '2025년 상반기' },
  { value: '2025-H2', label: '2025년 하반기' },
  { value: '2025-Y', label: '2025년 연간' },
  { value: '2026-Q1', label: '2026년 1분기' },
  { value: '2026-Q2', label: '2026년 2분기' },
  { value: '2026-H1', label: '2026년 상반기' },
];

// ─── 날짜 포맷 헬퍼 ─────────────────────────────────────
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function toInputDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().slice(0, 10);
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Main Component ──────────────────────────────────────
export default function PlanningCycleManager() {
  const { user } = useAuth();
  const company = useStore(state => state.company);

  const [cycles, setCycles] = useState<PlanningCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCycle, setEditingCycle] = useState<PlanningCycle | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [defaultPeriodCode, setDefaultPeriodCode] = useState<string>('');

  const [form, setForm] = useState<CycleFormData>({
    period: '2025-H1',
    title: '',
    starts_at: '',
    deadline_at: '',
    grace_period_at: '',
    message: '',
    auto_remind_days: [7, 3, 1],
  });

  // ─── 데이터 로드 ─────────────────────────────────────
  const fetchCycles = useCallback(async () => {
    if (!company?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('okr_planning_cycles')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCycles(data || []);
    } catch (err: any) {
      console.warn('사이클 조회:', err.message);
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  // ─── 기본 기간 로드 ─────────────────────────────────────
  useEffect(() => {
    const loadDefaultPeriod = async () => {
      if (!company?.id) return;
      
      try {
        // 반기 기준 활성 기간 가져오기
        const activePeriod = await fetchActivePeriod(company.id, 'half');
        if (activePeriod) {
          setDefaultPeriodCode(activePeriod.periodCode);
        } else {
          // 반기가 없으면 분기 확인
          const activeQuarter = await fetchActivePeriod(company.id, 'quarter');
          if (activeQuarter) {
            setDefaultPeriodCode(activeQuarter.periodCode);
          }
        }
      } catch (err) {
        console.error('기본 기간 로드 실패:', err);
      }
    };

    loadDefaultPeriod();
  }, [company?.id]);

  // ─── 폼 초기화 ───────────────────────────────────────
  const resetForm = () => {
    setForm({
      period: defaultPeriodCode || '2025-H1',
      title: '',
      starts_at: '',
      deadline_at: '',
      grace_period_at: '',
      message: '',
      auto_remind_days: [7, 3, 1],
    });
    setEditingCycle(null);
    setShowForm(false);
  };

  const openEditForm = (cycle: PlanningCycle) => {
    setEditingCycle(cycle);
    setForm({
      period: cycle.period,
      title: cycle.title,
      starts_at: toInputDate(cycle.starts_at),
      deadline_at: toInputDate(cycle.deadline_at),
      grace_period_at: cycle.grace_period_at ? toInputDate(cycle.grace_period_at) : '',
      message: cycle.message || '',
      auto_remind_days: cycle.auto_remind_days || [7, 3, 1],
    });
    setShowForm(true);
  };

  const handlePeriodChange = (period: string) => {
    const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label || period;
    setForm(prev => ({
      ...prev,
      period,
      title: prev.title || `${periodLabel} OKR 수립`,
    }));
  };

  // ─── 사이클 생성/수정 ────────────────────────────────
  const handleSubmit = async () => {
    if (!company?.id || !user?.id) return;
    if (!form.period || !form.title || !form.starts_at || !form.deadline_at) {
      alert('기간, 제목, 시작일, 마감일은 필수입니다.');
      return;
    }

    if (new Date(form.deadline_at) <= new Date(form.starts_at)) {
      alert('마감일은 시작일보다 이후여야 합니다.');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        company_id: company.id,
        period: form.period,
        title: form.title,
        starts_at: new Date(form.starts_at).toISOString(),
        deadline_at: new Date(form.deadline_at + 'T23:59:59').toISOString(),
        grace_period_at: form.grace_period_at
          ? new Date(form.grace_period_at + 'T23:59:59').toISOString()
          : null,
        message: form.message || null,
        auto_remind_days: form.auto_remind_days,
        created_by: user.id,
      };

      if (editingCycle) {
        const { error } = await supabase
          .from('okr_planning_cycles')
          .update(payload)
          .eq('id', editingCycle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('okr_planning_cycles')
          .insert(payload);
        if (error) throw error;
      }

      resetForm();
      fetchCycles();
    } catch (err: any) {
      if (err.message?.includes('unique_active_cycle')) {
        alert('이미 해당 기간의 사이클이 존재합니다.');
      } else {
        alert(`저장 실패: ${err.message}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ─── 상태 전환 (직접 update) ─────────────────────────
  const handleStatusChange = async (cycleId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('okr_planning_cycles')
        .update({ status: newStatus })
        .eq('id', cycleId);

      if (error) throw error;
      fetchCycles();
    } catch (err: any) {
      alert(`상태 전환 실패: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── 상태 전환 (RPC 사용 - 알림 포함) ────────────────
  const handleTransition = async (cycleId: string, newStatus: string) => {
    const confirmMessages: Record<string, string> = {
      in_progress: '수립을 시작(재개)하시겠습니까?\n\n모든 조직에 수립 시작 알림이 발송됩니다.',
      paused: '사이클을 일시중지하시겠습니까?\n\n조직장에게 일시중지 알림이 발송됩니다.\n초안 재생성이 필요한 경우 전사 OKR 수립 페이지에서 진행하세요.',
      closed: '수립 기간을 마감하시겠습니까?\n\n마감 후에는 신규 제출이 불가합니다.',
      finalized: '사이클을 최종 확정하시겠습니까?\n\n확정 후에는 실행/체크인 모드로 전환됩니다.',
    };

    if (!confirm(confirmMessages[newStatus] || `상태를 '${newStatus}'로 변경하시겠습니까?`)) return;

    // paused 관련 전환은 RPC에 정의되어 있지 않으므로 직접 update
    if (newStatus === 'paused') {
      await handleStatusChange(cycleId, 'paused');
      return;
    }

    // paused에서 재개하는 경우도 직접 update
    const currentCycle = cycles.find(c => c.id === cycleId);
    if (currentCycle?.status === 'paused') {
      await handleStatusChange(cycleId, newStatus);
      return;
    }

    setActionLoading(true);
    try {
      // RPC가 있으면 사용, 없으면 직접 update
      const { error: rpcError } = await supabase.rpc('transition_cycle_status', {
        p_cycle_id: cycleId,
        p_new_status: newStatus,
      });

      if (rpcError) {
        // RPC가 없는 경우 fallback으로 직접 update
        if (rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
          await handleStatusChange(cycleId, newStatus);
        } else {
          throw rpcError;
        }
      }
      fetchCycles();
    } catch (err: any) {
      alert(`상태 전환 실패: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── 삭제 ────────────────────────────────────────────
  const handleDelete = async (cycleId: string) => {
    if (!confirm('이 수립 사이클을 삭제하시겠습니까?\n\n삭제하면 복구할 수 없습니다.')) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('okr_planning_cycles')
        .delete()
        .eq('id', cycleId);
      if (error) throw error;
      fetchCycles();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── 하위 조직 OKR 전체 삭제 ────────────────────────
  const handleDeleteAllChildOKRs = async (cycle: PlanningCycle) => {
    if (!company?.id) return;

    const msg =
      `🚨 하위 조직 OKR 전체 삭제\n\n` +
      `기간: ${cycle.period}\n\n` +
      `• 전사 OKR을 제외한 모든 하위 조직의 Objectives와 KR이 삭제됩니다\n` +
      `• 조직장이 수정·제출한 내용도 모두 삭제됩니다\n\n` +
      `이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?`;

    if (!confirm(msg)) return;
    if (!confirm('정말 삭제하시겠습니까? 마지막 확인입니다.')) return;

    setActionLoading(true);
    try {
      // SECURITY DEFINER RPC로 RLS 우회하여 삭제
      const { data, error } = await supabase.rpc('delete_child_org_okrs', {
        p_company_id: company.id,
        p_period: cycle.period,
      });

      if (error) throw error;

      const result = data || { deleted_objectives: 0, deleted_key_results: 0, org_count: 0 };
      alert(
        `✅ 삭제 완료\n\n` +
        `${result.org_count}개 조직에서 ${result.deleted_objectives}개 목표, ${result.deleted_key_results}개 KR이 삭제되었습니다.\n\n` +
        `전사 OKR 수립 페이지에서 초안을 다시 생성하세요.`
      );
      fetchCycles();
    } catch (err: any) {
      alert(`삭제 실패: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ─── 상태별 액션 버튼들 ──────────────────────────────
  const getActions = (cycle: PlanningCycle) => {
    const actions: { label: string; action: () => void; icon: typeof Play; color: string; variant?: 'primary' | 'secondary' | 'danger' }[] = [];

    switch (cycle.status) {
      case 'planning':
        actions.push({
          label: '수립 시작',
          action: () => handleTransition(cycle.id, 'in_progress'),
          icon: Play,
          color: 'bg-blue-600 hover:bg-blue-700 text-white',
          variant: 'primary',
        });
        break;

      case 'in_progress':
        actions.push({
          label: '일시중지',
          action: () => handleTransition(cycle.id, 'paused'),
          icon: Pause,
          color: 'border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100',
          variant: 'secondary',
        });
        actions.push({
          label: '수립 마감',
          action: () => handleTransition(cycle.id, 'closed'),
          icon: Square,
          color: 'bg-orange-600 hover:bg-orange-700 text-white',
          variant: 'primary',
        });
        break;

      case 'paused':
        actions.push({
          label: '수립 재개',
          action: () => handleTransition(cycle.id, 'in_progress'),
          icon: Play,
          color: 'bg-blue-600 hover:bg-blue-700 text-white',
          variant: 'primary',
        });
        break;

      case 'closed':
        actions.push({
          label: '재오픈',
          action: () => handleTransition(cycle.id, 'in_progress'),
          icon: RefreshCw,
          color: 'border border-slate-300 text-slate-600 hover:bg-slate-50',
          variant: 'secondary',
        });
        actions.push({
          label: '최종 확정',
          action: () => handleTransition(cycle.id, 'finalized'),
          icon: CheckCircle2,
          color: 'bg-green-600 hover:bg-green-700 text-white',
          variant: 'primary',
        });
        break;
    }

    return actions;
  };

  // ─── 렌더링 ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const activeCycles = cycles.filter(c => !['finalized', 'cancelled'].includes(c.status));
  const pastCycles = cycles.filter(c => ['finalized', 'cancelled'].includes(c.status));

  return (
    <div className="space-y-6">
      {/* 헤더 + 새 사이클 버튼 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">OKR 수립 사이클</h2>
          <p className="text-sm text-slate-500 mt-1">
            OKR 수립 기간을 선언하고 진행 상황을 관리합니다
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            새 사이클
          </button>
        )}
      </div>

      {/* ─── 생성/수정 폼 ───────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">
              {editingCycle ? '사이클 수정' : '새 수립 사이클 만들기'}
            </h3>
            <button onClick={resetForm} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                수립 대상 기간 *
              </label>
              <select
                value={form.period}
                onChange={e => handlePeriodChange(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {PERIOD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <FileText className="w-3.5 h-3.5 inline mr-1" />
                사이클 제목 *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="예: 2025년 상반기 OKR 수립"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">수립 시작일 *</label>
              <input
                type="date"
                value={form.starts_at}
                onChange={e => setForm(prev => ({ ...prev, starts_at: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">수립 마감일 *</label>
              <input
                type="date"
                value={form.deadline_at}
                onChange={e => setForm(prev => ({ ...prev, deadline_at: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                유예 마감일 <span className="text-slate-400">(선택)</span>
              </label>
              <input
                type="date"
                value={form.grace_period_at}
                onChange={e => setForm(prev => ({ ...prev, grace_period_at: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-slate-400 mt-1">마감 후에도 제출을 허용할 추가 기한</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                <Timer className="w-3.5 h-3.5 inline mr-1" />
                자동 알림 (마감 N일 전)
              </label>
              <div className="flex items-center gap-2">
                {[7, 5, 3, 1].map(day => (
                  <label key={day} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={form.auto_remind_days.includes(day)}
                      onChange={e => {
                        setForm(prev => ({
                          ...prev,
                          auto_remind_days: e.target.checked
                            ? [...prev.auto_remind_days, day].sort((a, b) => b - a)
                            : prev.auto_remind_days.filter(d => d !== day),
                        }));
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600">D-{day}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              <Megaphone className="w-3.5 h-3.5 inline mr-1" />
              수립 안내 메시지 <span className="text-slate-400">(선택)</span>
            </label>
            <textarea
              value={form.message}
              onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
              placeholder="예: 이번 분기는 수익성 중심으로 목표를 수립해 주세요."
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={actionLoading}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {actionLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : editingCycle ? (
                <Edit3 className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {editingCycle ? '수정 저장' : '사이클 생성'}
            </button>
          </div>
        </div>
      )}

      {/* ─── 활성 사이클 목록 ─────────────────────────── */}
      {activeCycles.length === 0 && !showForm && (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-1">등록된 수립 사이클이 없습니다</p>
          <p className="text-sm text-slate-400">
            '새 사이클' 버튼을 눌러 OKR 수립 기간을 선언하세요
          </p>
        </div>
      )}

      {activeCycles.map(cycle => {
        const statusConf = STATUS_CONFIG[cycle.status] || STATUS_CONFIG['planning'];
        const StatusIcon = statusConf.icon;
        const actions = getActions(cycle);
        const days = daysUntil(cycle.deadline_at);
        const isOverdue = days < 0;

        return (
          <div key={cycle.id} className={`bg-white rounded-xl border overflow-hidden ${
            cycle.status === 'paused' ? 'border-amber-300' : 'border-slate-200'
          }`}>
            {/* 일시중지 배너 */}
            {cycle.status === 'paused' && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-2">
                <Pause className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">사이클 일시중지됨</span>
              </div>
            )}

            {/* 사이클 헤더 */}
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${statusConf.bgColor}`}>
                    <StatusIcon className={`w-5 h-5 ${statusConf.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{cycle.title}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConf.bgColor} ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      기간: {cycle.period} · 생성: {formatDate(cycle.created_at)}
                    </p>
                  </div>
                </div>

                {/* 편집/삭제 (planning 또는 paused 상태에서) */}
                {['planning', 'paused'].includes(cycle.status) && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditForm(cycle)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="수정"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cycle.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 사이클 상세 정보 */}
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">시작일</p>
                  <p className="text-sm font-medium text-slate-900">{formatDate(cycle.starts_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">마감일</p>
                  <p className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-slate-900'}`}>
                    {formatDate(cycle.deadline_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">D-day</p>
                  <p className={`text-sm font-bold ${
                    isOverdue ? 'text-red-600' :
                    days <= 3 ? 'text-amber-600' :
                    days <= 7 ? 'text-blue-600' :
                    'text-slate-900'
                  }`}>
                    {cycle.status === 'paused' ? '⏸ 중지됨' :
                     isOverdue ? `마감 ${Math.abs(days)}일 초과` :
                     days === 0 ? '오늘 마감' :
                     `D-${days}`}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">전사 OKR</p>
                  <p className={`text-sm font-medium ${cycle.company_okr_finalized ? 'text-green-600' : 'text-slate-400'}`}>
                    {cycle.company_okr_finalized ? '✓ 확정됨' : '미확정'}
                  </p>
                </div>
              </div>

              {cycle.grace_period_at && (
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  유예 마감: {formatDate(cycle.grace_period_at)}
                </div>
              )}

              {cycle.message && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                  <p className="text-sm text-blue-800 flex items-start gap-2">
                    <Megaphone className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                    {cycle.message}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Timer className="w-3.5 h-3.5" />
                자동 알림:
                {cycle.auto_remind_days?.length > 0
                  ? cycle.auto_remind_days.map(d => `D-${d}`).join(', ')
                  : '없음'}
              </div>
            </div>

            {/* 상태 전환 프로세스 바 + 액션 */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center justify-between">
                {/* 프로세스 스텝 */}
                <div className="flex items-center gap-0">
                  {(['planning', 'in_progress', 'closed', 'finalized'] as const).map((step, idx) => {
                    const stepConf = STATUS_CONFIG[step];
                    const StepIcon = stepConf.icon;
                    const stages = ['planning', 'in_progress', 'closed', 'finalized'];
                    // paused는 in_progress와 같은 위치
                    const currentStage = cycle.status === 'paused' ? 'in_progress' : cycle.status;
                    const currentIdx = stages.indexOf(currentStage);
                    const stepIdx = stages.indexOf(step);
                    const isCompleted = stepIdx < currentIdx;
                    const isCurrent = stepIdx === currentIdx;
                    const isPaused = cycle.status === 'paused' && step === 'in_progress';

                    return (
                      <div key={step} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isCompleted ? 'bg-green-100 text-green-600' :
                            isPaused ? 'bg-amber-500 text-white ring-2 ring-amber-200' :
                            isCurrent ? 'bg-blue-600 text-white ring-2 ring-blue-200' :
                            'bg-slate-200 text-slate-400'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : isPaused ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <StepIcon className="w-4 h-4" />
                            )}
                          </div>
                          <span className={`text-xs mt-1 ${
                            isPaused ? 'font-medium text-amber-600' :
                            isCurrent ? 'font-medium text-blue-600' : 'text-slate-400'
                          }`}>
                            {isPaused ? '일시중지' : stepConf.label}
                          </span>
                        </div>
                        {idx < 3 && (
                          <div className={`w-8 h-0.5 mb-5 mx-1 ${
                            stepIdx < currentIdx ? 'bg-green-300' : 'bg-slate-200'
                          }`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 액션 버튼들 */}
                <div className="flex items-center gap-2">
                  {actions.map((action, idx) => (
                    <button
                      key={idx}
                      onClick={action.action}
                      disabled={actionLoading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${action.color}`}
                    >
                      <action.icon className="w-4 h-4" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 하위 조직 OKR 삭제 */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => handleDeleteAllChildOKRs(cycle)}
                  disabled={actionLoading || cycle.status !== 'paused'}
                  className={`text-xs flex items-center gap-1.5 transition-colors disabled:opacity-30 ${
                    cycle.status === 'paused'
                      ? 'text-red-400 hover:text-red-600 cursor-pointer'
                      : 'text-slate-300 cursor-not-allowed'
                  }`}
                  title={cycle.status !== 'paused' ? '일시중지 상태에서만 삭제할 수 있습니다' : ''}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  하위 조직 OKR 전체 삭제 (전사 OKR 유지)
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ─── 과거 사이클 ─────────────────────────────── */}
      {pastCycles.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            완료/취소된 사이클 ({pastCycles.length})
          </h3>
          <div className="space-y-2">
            {pastCycles.map(cycle => {
              const conf = STATUS_CONFIG[cycle.status] || STATUS_CONFIG['finalized'];
              return (
                <div key={cycle.id} className="bg-white rounded-lg border border-slate-200 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <conf.icon className={`w-5 h-5 ${conf.color}`} />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{cycle.title}</p>
                      <p className="text-xs text-slate-400">
                        {cycle.period} · {formatDate(cycle.starts_at)} ~ {formatDate(cycle.deadline_at)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${conf.bgColor} ${conf.color}`}>
                    {conf.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}