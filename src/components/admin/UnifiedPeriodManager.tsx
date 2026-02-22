// src/components/admin/UnifiedPeriodManager.tsx
// 기간 관리 + 수립 모니터링 + 마감 관리
// ✅ 수립 설정/시작은 CEO 수립 플로우(/ceo-okr-setup)에서 처리
// ✅ 이 컴포넌트는 기간 생성/삭제, 수립 현황 모니터링, 수립 마감/확정, 성과 마감에 집중

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Plus, Play, Square, CheckCircle2, Clock, Edit3, Trash2,
  ChevronDown, ChevronRight, AlertCircle, Info, Users, FileText,
  Timer, Target, TrendingUp, Archive,
  MessageSquare, RefreshCw, X, ExternalLink, Rocket
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────

interface FiscalPeriod {
  id: string;
  company_id: string;
  period_code: string;
  period_name: string;
  period_type: 'quarter' | 'half' | 'year';
  starts_at: string;
  ends_at: string;
  parent_period_id: string | null;
  status: 'upcoming' | 'planning' | 'active' | 'closing' | 'closed' | 'archived';
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
  closing_started_at: string | null;
  closing_started_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type TabType = 'periods' | 'planning' | 'closing';

// ─── Helpers ─────────────────────────────────────────────

function getYearFromCode(code: string): number { return parseInt(code.substring(0, 4)); }

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

const STATUS_CFG: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  upcoming:  { label: '예정',   color: 'text-slate-600',  icon: Clock,    bg: 'bg-slate-100' },
  planning:  { label: '수립중', color: 'text-blue-600',   icon: Edit3,    bg: 'bg-blue-100' },
  active:    { label: '실행중', color: 'text-green-600',  icon: Play,     bg: 'bg-green-100' },
  closing:   { label: '마감중', color: 'text-orange-600', icon: Square,   bg: 'bg-orange-100' },
  closed:    { label: '완료',   color: 'text-gray-600',   icon: Archive,  bg: 'bg-gray-100' },
  archived:  { label: '보관',   color: 'text-purple-600', icon: Archive,  bg: 'bg-purple-100' },
};

const PLAN_CFG: Record<string, { label: string; color: string }> = {
  not_started: { label: '미시작',   color: 'text-slate-500' },
  setup:       { label: '설정중',   color: 'text-blue-500' },
  drafting:    { label: '초안작성', color: 'text-indigo-500' },
  in_progress: { label: '진행중',   color: 'text-green-600' },
  closing:     { label: '마감중',   color: 'text-orange-600' },
  completed:   { label: '완료',     color: 'text-gray-600' },
};

// ═════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════

export default function UnifiedPeriodManager() {
  const { user, profile } = useAuth();
  const companyId = profile?.company_id;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('periods');
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateYear, setShowCreateYear] = useState(false);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

  // ─── Fetch ─────────────────────────────────────────────

  const fetchPeriods = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('fiscal_periods').select('*').eq('company_id', companyId).order('period_code', { ascending: false });
      if (error) throw error;
      setPeriods(data || []);
    } catch (err: any) { alert(`기간 로드 실패: ${err.message}`); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

  // ─── Create Year ───────────────────────────────────────

  const handleCreateYear = async () => {
    if (!companyId || !user?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_fiscal_year_with_hierarchy', { p_company_id: companyId, p_year: newYear });
      if (error) throw error;
      alert(`${newYear}년도 및 하위 기간이 생성되었습니다.`);
      setShowCreateYear(false);
      fetchPeriods();
      setExpandedYears(prev => new Set(prev).add(newYear));
    } catch (err: any) {
      alert(err.message?.includes('duplicate') ? `${newYear}년도가 이미 존재합니다.` : `연도 생성 실패: ${err.message}`);
    } finally { setLoading(false); }
  };

  // ─── Planning: Close / Finalize (모니터링 후속 조치) ───

  const handleClosePlanning = async (p: FiscalPeriod) => {
    if (!user?.id || !confirm(`수립을 마감하시겠습니까?\n마감 후에는 신규 제출이 불가합니다.\n\n기간: ${p.period_code}`)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('close_planning_period', { p_period_id: p.id, p_user_id: user.id });
      if (error) throw error;
      if (data?.success) { alert(data.message || '수립이 마감되었습니다.'); fetchPeriods(); }
      else alert(data?.message || '수립을 마감할 수 없습니다.');
    } catch (err: any) { alert(`수립 마감 실패: ${err.message}`); }
    finally { setLoading(false); }
  };

  const handleFinalizePlanning = async (p: FiscalPeriod) => {
    if (!user?.id || !confirm(`수립을 최종 확정하시겠습니까?\n확정 후 실행/체크인 모드로 전환됩니다.\n\n기간: ${p.period_code}`)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('finalize_planning_period', { p_period_id: p.id, p_user_id: user.id });
      if (error) throw error;
      if (data?.success) { alert(data.message || '수립이 확정되었습니다.'); fetchPeriods(); }
      else alert(data?.message || '수립을 확정할 수 없습니다.');
    } catch (err: any) { alert(`수립 확정 실패: ${err.message}`); }
    finally { setLoading(false); }
  };

  // ─── Closing: Start / Finalize ─────────────────────────

  const handleStartClosing = async (p: FiscalPeriod) => {
    if (!user?.id || !confirm(`성과 마감을 시작하시겠습니까?\n\n기간: ${p.period_code}`)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('start_closing_period', { p_period_id: p.id, p_user_id: user.id });
      if (error) throw error;
      if (data?.success) { alert(data.message || '마감이 시작되었습니다.'); fetchPeriods(); }
      else alert(data?.message || '마감을 시작할 수 없습니다.');
    } catch (err: any) { alert(`마감 시작 실패: ${err.message}`); }
    finally { setLoading(false); }
  };

  const handleFinalizeClosing = async (p: FiscalPeriod) => {
    if (!user?.id || !confirm(`성과 마감을 완료하시겠습니까?\n완료 후에는 수정할 수 없습니다.\n\n기간: ${p.period_code}`)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('finalize_closing_period', { p_period_id: p.id, p_user_id: user.id });
      if (error) throw error;
      if (data?.success) { alert(data.message || '마감이 완료되었습니다.'); fetchPeriods(); }
      else alert(data?.message || '마감을 완료할 수 없습니다.');
    } catch (err: any) { alert(`마감 완료 실패: ${err.message}`); }
    finally { setLoading(false); }
  };

  // ─── Delete ────────────────────────────────────────────

  const handleDeletePeriod = async (p: FiscalPeriod) => {
    const year = getYearFromCode(p.period_code);
    const msg = p.period_type === 'year'
      ? `${year}년도 전체를 삭제하시겠습니까?\n하위 반기/분기도 모두 삭제됩니다.`
      : `${p.period_code}를 삭제하시겠습니까?`;
    if (!confirm(msg + '\n\n삭제된 데이터는 복구할 수 없습니다.')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('fiscal_periods').delete().eq('id', p.id);
      if (error) throw error;
      alert('삭제되었습니다.');
      fetchPeriods();
    } catch (err: any) { alert(`삭제 실패: ${err.message}`); }
    finally { setLoading(false); }
  };

  // ─── Hierarchy ─────────────────────────────────────────

  const toggleYear = (y: number) => {
    const s = new Set(expandedYears);
    s.has(y) ? s.delete(y) : s.add(y);
    setExpandedYears(s);
  };

  const hierarchy = (() => {
    const years = [...new Set(periods.map(p => getYearFromCode(p.period_code)))].sort((a, b) => b - a);
    return years.map(year => ({
      year,
      yearPeriod: periods.find(p => p.period_code === `${year}-Y`),
      halves: periods.filter(p => p.period_code.startsWith(`${year}-H`)).sort((a, b) => a.period_code.localeCompare(b.period_code)),
      quarters: periods.filter(p => p.period_code.startsWith(`${year}-Q`)).sort((a, b) => a.period_code.localeCompare(b.period_code)),
    }));
  })();

  const goSetup = () => navigate('/ceo-okr-setup');

  // ═════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6" />기간 &amp; 수립 관리
          </h2>
          <p className="text-sm text-slate-600 mt-1">기간 생성/삭제, 수립 현황 모니터링, 마감 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goSetup} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-lg hover:from-blue-700 hover:to-violet-700 transition flex items-center gap-2">
            <Rocket className="w-4 h-4" />전사 OKR 수립
          </button>
          <button onClick={() => setShowCreateYear(true)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition flex items-center gap-2">
            <Plus className="w-4 h-4" />연도 생성
          </button>
        </div>
      </div>

      {/* 수립 안내 배너 */}
      <div className="bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Rocket className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">OKR 수립은 "전사 OKR 수립" 페이지에서 시작됩니다</p>
          <p className="text-xs text-blue-700 mt-1">기간 선택 → 경영 컨텍스트 → 전사 OKR 생성 → 조직 초안 → 사이클 시작까지 한 곳에서 진행합니다. 이 페이지에서는 기간 생성, 수립 현황 모니터링, 마감 관리를 수행합니다.</p>
        </div>
        <button onClick={goSetup} className="px-3 py-1.5 text-sm text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 flex items-center gap-1 flex-shrink-0">
          이동 <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          {([
            { id: 'periods' as TabType, label: '기간 목록', icon: Calendar },
            { id: 'planning' as TabType, label: '수립 현황', icon: Edit3 },
            { id: 'closing' as TabType, label: '마감 관리', icon: Archive },
          ]).map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`pb-3 px-1 flex items-center gap-2 border-b-2 transition ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-slate-500"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />로딩 중...</div>
      ) : (
        <>
          {/* ═══ 기간 목록 ═══ */}
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
                    {yearPeriod && (
                      <div className="bg-slate-50 p-4 flex items-center justify-between border-b border-slate-200">
                        <button onClick={() => toggleYear(year)} className="flex items-center gap-3 flex-1">
                          {expandedYears.has(year) ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                          <div className="flex items-center gap-3">
                            <div className="text-xl font-bold text-slate-900">{yearPeriod.period_name}</div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_CFG[yearPeriod.status].bg} ${STATUS_CFG[yearPeriod.status].color}`}>{STATUS_CFG[yearPeriod.status].label}</span>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">{formatDate(yearPeriod.starts_at)} ~ {formatDate(yearPeriod.ends_at)}</span>
                          {yearPeriod.status === 'upcoming' && (
                            <button onClick={() => handleDeletePeriod(yearPeriod)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="삭제"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </div>
                    )}
                    {expandedYears.has(year) && (
                      <div className="p-4 space-y-3">
                        {halves.map(half => {
                          const hq = quarters.filter(q => q.parent_period_id === half.id);
                          return (
                            <div key={half.id} className="space-y-2">
                              <PeriodCard period={half} onClosePlanning={handleClosePlanning} onFinalizePlanning={handleFinalizePlanning} onStartClosing={handleStartClosing} onFinalizeClosing={handleFinalizeClosing} onDelete={handleDeletePeriod} onGoSetup={goSetup} />
                              <div className="ml-8 space-y-2">
                                {hq.map(q => <PeriodCard key={q.id} period={q} onClosePlanning={handleClosePlanning} onFinalizePlanning={handleFinalizePlanning} onStartClosing={handleStartClosing} onFinalizeClosing={handleFinalizeClosing} onDelete={handleDeletePeriod} onGoSetup={goSetup} />)}
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

          {/* ═══ 수립 현황 ═══ */}
          {activeTab === 'planning' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">수립 현황 모니터링</p>
                  <p className="text-blue-700">진행 중인 수립의 현황을 확인하고, 마감/확정 작업을 수행할 수 있습니다.</p>
                </div>
              </div>
              {periods.filter(p => ['setup', 'drafting', 'in_progress', 'closing'].includes(p.planning_status)).map(p => (
                <PlanningStatusCard key={p.id} period={p} onClosePlanning={handleClosePlanning} onFinalizePlanning={handleFinalizePlanning} onGoSetup={goSetup} />
              ))}
              {periods.filter(p => ['setup', 'drafting', 'in_progress', 'closing'].includes(p.planning_status)).length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>수립 진행 중인 기간이 없습니다.</p>
                  <p className="text-sm mt-2 text-slate-400">"전사 OKR 수립" 페이지에서 수립을 시작할 수 있습니다.</p>
                  <button onClick={goSetup} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2 mx-auto">
                    <Rocket className="w-4 h-4" /> 전사 OKR 수립으로 이동
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══ 마감 관리 ═══ */}
          {activeTab === 'closing' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-900">
                  <p className="font-medium mb-1">마감 관리</p>
                  <p className="text-orange-700">실행 중이거나 마감 중인 기간의 성과를 최종 마감할 수 있습니다.</p>
                </div>
              </div>
              {periods.filter(p => ['active', 'closing'].includes(p.status)).map(p => (
                <ClosingCard key={p.id} period={p} onStartClosing={handleStartClosing} onFinalizeClosing={handleFinalizeClosing} />
              ))}
              {periods.filter(p => ['active', 'closing'].includes(p.status)).length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>마감 대상 기간이 없습니다.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Year Modal */}
      {showCreateYear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">연도 생성</h3>
              <button onClick={() => setShowCreateYear(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">연도</label>
              <input type="number" value={newYear} onChange={e => setNewYear(parseInt(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg" min={2020} max={2050} />
              <p className="text-xs text-slate-500 mt-1">연도를 생성하면 자동으로 반기(H1, H2)와 분기(Q1~Q4)가 생성됩니다.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleCreateYear} disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? '생성 중...' : '생성'}</button>
              <button onClick={() => setShowCreateYear(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// Sub Components
// ═════════════════════════════════════════════════════════

interface PeriodCardProps {
  period: FiscalPeriod;
  onClosePlanning: (p: FiscalPeriod) => void;
  onFinalizePlanning: (p: FiscalPeriod) => void;
  onStartClosing: (p: FiscalPeriod) => void;
  onFinalizeClosing: (p: FiscalPeriod) => void;
  onDelete: (p: FiscalPeriod) => void;
  onGoSetup: () => void;
}

function PeriodCard({ period: p, onClosePlanning, onFinalizePlanning, onStartClosing, onFinalizeClosing, onDelete, onGoSetup }: PeriodCardProps) {
  const dl = daysUntil(p.planning_deadline_at);
  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-semibold text-slate-900">{p.period_name}</h4>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CFG[p.status].bg} ${STATUS_CFG[p.status].color}`}>{STATUS_CFG[p.status].label}</span>
            {p.planning_status !== 'not_started' && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium bg-slate-100 ${PLAN_CFG[p.planning_status].color}`}>수립: {PLAN_CFG[p.planning_status].label}</span>
            )}
          </div>
          <div className="text-sm text-slate-600 space-y-1">
            <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /><span>{formatDate(p.starts_at)} ~ {formatDate(p.ends_at)}</span></div>
            {p.planning_deadline_at && (
              <div className="flex items-center gap-2"><Timer className="w-4 h-4" /><span>수립 마감: {formatDate(p.planning_deadline_at)}{dl !== null && dl >= 0 && <span className="ml-2 text-orange-600 font-medium">(D-{dl})</span>}</span></div>
            )}
            {p.company_okr_finalized && (
              <div className="flex items-center gap-2 text-green-600"><CheckCircle2 className="w-4 h-4" /><span>전사 OKR 확정 ({formatDateTime(p.company_okr_finalized_at)})</span></div>
            )}
            {p.all_orgs_draft_generated && (
              <div className="flex items-center gap-2 text-indigo-600"><CheckCircle2 className="w-4 h-4" /><span>전체 조직 초안 완료 ({formatDateTime(p.all_orgs_draft_generated_at)})</span></div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 수립 미시작/설정중/초안 → CEO 수립 플로우 안내 */}
          {['not_started', 'setup', 'drafting'].includes(p.planning_status) && !['closed', 'archived'].includes(p.status) && (
            <button onClick={onGoSetup} className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded hover:bg-blue-50 flex items-center gap-1"><Rocket className="w-4 h-4" />OKR 수립</button>
          )}
          {p.planning_status === 'in_progress' && (
            <button onClick={() => onClosePlanning(p)} className="px-3 py-1.5 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 flex items-center gap-1"><Square className="w-4 h-4" />수립 마감</button>
          )}
          {p.planning_status === 'closing' && (
            <button onClick={() => onFinalizePlanning(p)} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />수립 확정</button>
          )}
          {p.status === 'active' && (
            <button onClick={() => onStartClosing(p)} className="px-3 py-1.5 text-sm border border-orange-600 text-orange-600 rounded hover:bg-orange-50 flex items-center gap-1"><Archive className="w-4 h-4" />성과 마감</button>
          )}
          {p.status === 'closing' && (
            <button onClick={() => onFinalizeClosing(p)} className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />마감 완료</button>
          )}
          {p.status === 'upcoming' && p.planning_status === 'not_started' && (
            <button onClick={() => onDelete(p)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="삭제"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
      </div>
      {p.planning_message && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-start gap-2 text-sm"><MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" /><p className="text-slate-600 italic">{p.planning_message}</p></div>
        </div>
      )}
    </div>
  );
}

// ─── Planning Status Card ────────────────────────────────

interface PlanningStatusCardProps {
  period: FiscalPeriod;
  onClosePlanning: (p: FiscalPeriod) => void;
  onFinalizePlanning: (p: FiscalPeriod) => void;
  onGoSetup: () => void;
}

function PlanningStatusCard({ period: p, onClosePlanning, onFinalizePlanning, onGoSetup }: PlanningStatusCardProps) {
  const dl = daysUntil(p.planning_deadline_at);

  const steps = [
    { label: '전사 OKR', done: p.company_okr_finalized, icon: Target },
    { label: '조직 초안', done: p.all_orgs_draft_generated, icon: Users },
    { label: '수립 진행', done: ['in_progress', 'closing', 'completed'].includes(p.planning_status), icon: Play },
  ];

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h4 className="font-bold text-slate-900">{p.period_name}</h4>
          <span className={`px-2 py-1 rounded-full text-xs font-medium bg-white ${PLAN_CFG[p.planning_status].color}`}>{PLAN_CFG[p.planning_status].label}</span>
        </div>
        {dl !== null && dl >= 0 && <div className="text-sm text-orange-600 font-semibold">마감까지 D-{dl}</div>}
      </div>

      {/* 진행 단계 인디케이터 */}
      <div className="flex items-center gap-4 mb-3 py-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-0.5 ${s.done ? 'bg-green-400' : 'bg-slate-300'}`} />}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${s.done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {s.done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
        <div><div className="text-slate-600">수립 기간</div><div className="font-medium text-slate-900">{formatDate(p.planning_starts_at)} ~ {formatDate(p.planning_deadline_at)}</div></div>
        <div><div className="text-slate-600">수립 시작</div><div className="font-medium text-slate-900">{formatDateTime(p.planning_started_at)}</div></div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-blue-200">
        {['setup', 'drafting'].includes(p.planning_status) && (
          <button onClick={onGoSetup} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center justify-center gap-1">
            <Rocket className="w-4 h-4" /> 전사 OKR 수립 계속하기
          </button>
        )}
        {p.planning_status === 'in_progress' && (
          <>
            <button className="flex-1 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 text-sm"><Users className="w-4 h-4 inline mr-1" />수립 현황 보기</button>
            <button onClick={() => onClosePlanning(p)} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm">수립 마감</button>
          </>
        )}
        {p.planning_status === 'closing' && (
          <>
            <button className="flex-1 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 text-sm"><Users className="w-4 h-4 inline mr-1" />수립 현황 보기</button>
            <button onClick={() => onFinalizePlanning(p)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">수립 확정</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Closing Status Card ─────────────────────────────────

interface ClosingCardProps {
  period: FiscalPeriod;
  onStartClosing: (p: FiscalPeriod) => void;
  onFinalizeClosing: (p: FiscalPeriod) => void;
}

function ClosingCard({ period: p, onStartClosing, onFinalizeClosing }: ClosingCardProps) {
  return (
    <div className="border border-orange-200 bg-orange-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h4 className="font-bold text-slate-900">{p.period_name}</h4>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CFG[p.status].bg} ${STATUS_CFG[p.status].color}`}>{STATUS_CFG[p.status].label}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
        <div><div className="text-slate-600">기간</div><div className="font-medium text-slate-900">{formatDate(p.starts_at)} ~ {formatDate(p.ends_at)}</div></div>
        {p.closing_started_at && <div><div className="text-slate-600">마감 시작</div><div className="font-medium text-slate-900">{formatDateTime(p.closing_started_at)}</div></div>}
      </div>
      <div className="flex items-center gap-2 pt-3 border-t border-orange-200">
        <button className="flex-1 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 text-sm"><TrendingUp className="w-4 h-4 inline mr-1" />성과 현황 보기</button>
        {p.status === 'active' && <button onClick={() => onStartClosing(p)} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm">마감 시작</button>}
        {p.status === 'closing' && <button onClick={() => onFinalizeClosing(p)} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">마감 완료</button>}
      </div>
    </div>
  );
}