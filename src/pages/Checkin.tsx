// src/pages/Checkin.tsx — 목표 리스트 → 좌우 2컬럼 상세 (실적 + 활동)
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor, calculateGrade, getGradeColor, formatNumber } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getMyRoleLevel, checkCanManageOrg, ROLE_LEVELS } from '../lib/permissions';
import type { DynamicKR } from '../types';
import {
  Loader2, TrendingUp, CheckCircle2, AlertCircle,
  ChevronRight, ChevronDown, History, Save, X, User,
  BarChart3, Target, ArrowLeft, Pencil, Activity,
  MessageSquare, Clock, Send
} from 'lucide-react';

// ━━━ 타입 ━━━
interface CheckinLog {
  id: string; kr_id: string; quarter: string;
  previous_value: number; new_value: number; progress_pct: number;
  grade: string; comment: string; checked_by_name: string;
  is_delegated: boolean; created_at: string;
}

function getCurrentQuarter(): string {
  const m = new Date().getMonth() + 1;
  return m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
}
function pColor(p: number) { return p >= 100 ? 'bg-green-500' : p >= 70 ? 'bg-blue-500' : p >= 40 ? 'bg-amber-400' : 'bg-red-400'; }
function pText(p: number) { return p >= 100 ? 'text-green-600' : p >= 70 ? 'text-blue-600' : p >= 40 ? 'text-amber-600' : 'text-red-500'; }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Checkin() {
  const { user } = useAuth();
  const {
    organizations, objectives, krs,
    fetchObjectives, fetchKRs, fetchCFRs,
    updateKR, loading
  } = useStore();

  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [roleLevel, setRoleLevel] = useState(0);
  const [canManageOrg, setCanManageOrg] = useState(false);
  const [permLoading, setPermLoading] = useState(true);
  const [managableOrgs, setManagableOrgs] = useState<string[]>([]);

  // 뷰
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);

  // 인라인 입력
  const [editingKrId, setEditingKrId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editComment, setEditComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 활동 피드 (오른쪽 패널)
  const [objLogs, setObjLogs] = useState<CheckinLog[]>([]);
  const [objLogsLoading, setObjLogsLoading] = useState(false);
  const [feedTab, setFeedTab] = useState<'timeline' | 'quarter'>('timeline');

  // ── 1. 권한 ──
  useEffect(() => {
    const check = async () => {
      setPermLoading(true);
      try {
        const level = await getMyRoleLevel();
        setRoleLevel(level);
        let managable: string[];
        if (level >= ROLE_LEVELS.COMPANY_ADMIN) {
          managable = organizations.map(o => o.id);
        } else {
          const results = await Promise.all(
            organizations.map(async (org) => ({ id: org.id, can: await checkCanManageOrg(org.id) }))
          );
          managable = results.filter(r => r.can).map(r => r.id);
        }
        setManagableOrgs(managable);
      } catch (e) { console.error(e); }
      finally { setPermLoading(false); }
    };
    if (organizations.length > 0) check();
    else setPermLoading(false);
  }, [organizations.map(o => o.id).join(',')]);

  // ── 2. 초기 조직 ──
  useEffect(() => {
    if (permLoading || organizations.length === 0 || roleLevel === 0) return;
    const cur = organizations.find(o => o.id === selectedOrgId);
    if (selectedOrgId && !(roleLevel < ROLE_LEVELS.COMPANY_ADMIN && cur?.level === '전사')) return;
    let def;
    if (roleLevel >= ROLE_LEVELS.COMPANY_ADMIN) def = organizations.find(o => managableOrgs.includes(o.id)) || organizations[0];
    else if (managableOrgs.length > 0) def = organizations.find(o => managableOrgs.includes(o.id) && o.level !== '전사');
    if (!def) def = organizations.find(o => o.level !== '전사') || organizations[0];
    if (def) setSelectedOrgId(def.id);
  }, [permLoading, managableOrgs.join(','), roleLevel]);

  // ── 3. 데이터 ──
  useEffect(() => {
    if (!selectedOrgId) return;
    fetchObjectives(selectedOrgId);
    fetchKRs(selectedOrgId);
    checkCanManageOrg(selectedOrgId).then(setCanManageOrg);
    setViewMode('list'); setSelectedObjId(null);
  }, [selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId && krs.length > 0)
      krs.filter(k => k.orgId === selectedOrgId).forEach(kr => fetchCFRs(kr.id));
  }, [selectedOrgId, krs.length]);

  // ── 목표 상세 진입 시 → 해당 목표의 모든 KR 이력 로드 ──
  useEffect(() => {
    if (!selectedObjId) return;
    const loadObjLogs = async () => {
      setObjLogsLoading(true);
      try {
        const objKRIds = krs.filter(k => k.objectiveId === selectedObjId).map(k => k.id);
        if (objKRIds.length === 0) { setObjLogs([]); return; }
        const { data } = await supabase
          .from('checkin_logs')
          .select('*')
          .in('kr_id', objKRIds)
          .order('created_at', { ascending: false })
          .limit(30);
        setObjLogs(data || []);
      } catch { setObjLogs([]); }
      finally { setObjLogsLoading(false); }
    };
    loadObjLogs();
  }, [selectedObjId, krs.length]);

  const orgObjectives = objectives.filter(o => o.orgId === selectedOrgId);
  const orgKRs = krs.filter(k => k.orgId === selectedOrgId);
  const selectedObj = selectedObjId ? orgObjectives.find(o => o.id === selectedObjId) : null;
  const selectedObjKRs = selectedObjId ? krs.filter(k => k.objectiveId === selectedObjId) : [];

  const summary = useMemo(() => {
    const total = orgKRs.length;
    const checkedIn = orgKRs.filter(kr => kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] != null).length;
    return { total, checkedIn, notCheckedIn: total - checkedIn, rate: total > 0 ? Math.round((checkedIn / total) * 100) : 0 };
  }, [orgKRs, selectedQuarter]);

  const canCheckin = roleLevel >= ROLE_LEVELS.ORG_LEADER && canManageOrg;
  const selectableOrgs = roleLevel >= ROLE_LEVELS.COMPANY_ADMIN
    ? organizations
    : organizations.filter(o => managableOrgs.includes(o.id) && o.level !== '전사');

  // ── 네비게이션 ──
  const openObjective = (id: string) => { setSelectedObjId(id); setViewMode('detail'); setEditingKrId(null); setFeedTab('timeline'); };
  const backToList = () => { setViewMode('list'); setSelectedObjId(null); setEditingKrId(null); };

  // ── 인라인 입력 ──
  const startEdit = (kr: DynamicKR) => {
    setEditingKrId(kr.id);
    setEditValue(kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals]?.toString() || '');
    setEditComment('');
  };
  const cancelEdit = () => { setEditingKrId(null); setEditValue(''); setEditComment(''); };

  const submitCheckin = async (kr: DynamicKR) => {
    if (!user) return;
    const newValue = parseFloat(editValue);
    if (isNaN(newValue)) return;
    setIsSaving(true);
    try {
      const prev = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] || 0;
      const newActuals = { ...kr.quarterlyActuals, [selectedQuarter]: newValue };
      const cum = (['Q1','Q2','Q3','Q4'] as const).map(q => newActuals[q]).filter((v): v is number => v != null).reduce((s,v) => s+v, 0);
      const prog = kr.targetValue > 0 ? Math.round((cum / kr.targetValue) * 100) : 0;
      const grade = calculateGrade({ ...kr, currentValue: cum });

      const { error } = await supabase.from('key_results').update({
        quarterly_actuals: newActuals, current_value: cum, progress_pct: prog,
        last_checkin_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', kr.id);
      if (error) throw error;

      const logEntry = {
        kr_id: kr.id, org_id: kr.orgId, checkin_period: `2025-${selectedQuarter}`, quarter: selectedQuarter,
        previous_value: prev || 0, new_value: newValue,
        target_value: kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || kr.targetValue,
        progress_pct: prog, grade, comment: editComment || null,
        checked_by: user.id, checked_by_name: (user as any).user_metadata?.full_name || user.email || '사용자',
        is_delegated: roleLevel < ROLE_LEVELS.ORG_LEADER,
      };
      const { data: logData } = await supabase.from('checkin_logs').insert(logEntry).select().single();
      if (logData) setObjLogs(prev => [logData as CheckinLog, ...prev]);

      updateKR(kr.id, { quarterlyActuals: newActuals, currentValue: cum, progressPct: prog });
      cancelEdit();
    } catch (err: any) { alert(`저장 실패: ${err.message}`); }
    finally { setIsSaving(false); }
  };

  // ── 목표 통계 ──
  const getObjStats = (objId: string) => {
    const ok = krs.filter(k => k.objectiveId === objId);
    const t = ok.length;
    const c = ok.filter(kr => kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] != null).length;
    return { total: t, checkedIn: c, avg: t > 0 ? Math.round(ok.reduce((s,k) => s + (k.progressPct||0), 0) / t) : 0 };
  };

  // ── KR 이름 매핑 (피드용) ──
  const krNameMap = useMemo(() => {
    const m = new Map<string, string>();
    selectedObjKRs.forEach(kr => m.set(kr.id, kr.name));
    return m;
  }, [selectedObjKRs]);

  // ── 분기별 추이 데이터 ──
  const quarterTrend = useMemo(() => {
    return (['Q1','Q2','Q3','Q4'] as const).map(q => {
      const values = selectedObjKRs.map(kr => {
        const actual = kr.quarterlyActuals?.[q];
        const target = kr.quarterlyTargets?.[q] || 0;
        return { actual: actual ?? null, target };
      });
      const filled = values.filter(v => v.actual !== null);
      const avgPct = filled.length > 0
        ? Math.round(filled.reduce((s, v) => s + (v.target > 0 ? ((v.actual as number) / v.target) * 100 : 0), 0) / filled.length)
        : null;
      return { quarter: q, avgPct, filled: filled.length, total: values.length };
    });
  }, [selectedObjKRs]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (permLoading || roleLevel === 0) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {viewMode === 'detail' && (
            <button onClick={backToList} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{viewMode === 'list' ? '체크인' : '목표 상세'}</h1>
            {viewMode === 'list' && <p className="text-slate-500 text-sm mt-0.5">조직 KR의 분기별 실적을 점검합니다.</p>}
          </div>
        </div>
        <div className="flex gap-3">
          <select value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
            {selectableOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
            {['Q1','Q2','Q3','Q4'].map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
      </div>

      {/* 요약 카드 (리스트) */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard icon={Target} bg="bg-blue-100" color="text-blue-600" value={summary.total} label="전체 KR" />
          <StatCard icon={CheckCircle2} bg="bg-green-100" color="text-green-600" value={summary.checkedIn} label="입력 완료" vc="text-green-700" />
          <StatCard icon={AlertCircle} bg="bg-orange-100" color="text-orange-600" value={summary.notCheckedIn} label="미입력" vc="text-orange-700" />
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center"><BarChart3 className="w-5 h-5 text-indigo-600" /></div>
              <div><div className="text-2xl font-bold text-indigo-700">{summary.rate}%</div><div className="text-xs text-slate-500">체크인율</div></div>
            </div>
            <div className="mt-2 h-1.5 bg-slate-100 rounded-full"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${summary.rate}%` }} /></div>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}
      {!loading && orgObjectives.length === 0 && <Empty />}

      {/* ━━━━ 리스트 뷰 ━━━━ */}
      {!loading && viewMode === 'list' && orgObjectives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orgObjectives.map(obj => {
            const s = getObjStats(obj.id);
            const bii = getBIIColor(obj.biiType);
            const done = s.total > 0 && s.checkedIn === s.total;
            return (
              <div key={obj.id} onClick={() => openObjective(obj.id)}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${bii.bg} ${bii.text}`}>{obj.biiType}</span>
                    {done && <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium"><CheckCircle2 className="w-3 h-3" />완료</span>}
                    {!done && s.checkedIn > 0 && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">{s.checkedIn}/{s.total}</span>}
                    {s.checkedIn === 0 && s.total > 0 && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">미시작</span>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 line-clamp-2 leading-snug">{obj.name}</h3>
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                  <span>KR {s.total}개</span>
                  <span>달성률 <strong className="text-slate-700">{s.avg}%</strong></span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pColor(s.avg)}`} style={{ width: `${Math.min(100, s.avg)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ━━━━ 상세 뷰 — 좌우 2컬럼 ━━━━ */}
      {!loading && viewMode === 'detail' && selectedObj && (
        <div className="grid grid-cols-5 gap-6">
          {/* ══ 왼쪽: KR 실적 (3/5) ══ */}
          <div className="col-span-3 space-y-4">
            {/* 목표 헤더 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2.5 py-1 rounded text-xs font-semibold ${getBIIColor(selectedObj.biiType).bg} ${getBIIColor(selectedObj.biiType).text}`}>{selectedObj.biiType}</span>
                <span className="text-xs text-slate-400">KR {selectedObjKRs.length}개</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-3">{selectedObj.name}</h2>
              {/* 전체 진행률 바 */}
              {(() => {
                const avg = selectedObjKRs.length > 0 ? Math.round(selectedObjKRs.reduce((s,k) => s+(k.progressPct||0), 0) / selectedObjKRs.length) : 0;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-slate-500">전체 진행률</span>
                      <span className={`text-lg font-bold ${pText(avg)}`}>{avg}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pColor(avg)}`} style={{ width: `${Math.min(100, avg)}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* KR 카드들 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-400" /> 핵심 성과 (Key Results)
              </h3>

              {selectedObjKRs.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">연결된 KR이 없습니다</div>}

              {selectedObjKRs.map(kr => {
                const grade = calculateGrade(kr);
                const isEd = editingKrId === kr.id;
                const qActual = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals];
                const qTarget = kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || 0;
                const done = qActual != null;

                // 미리보기
                const pv = isEd ? (parseFloat(editValue) || 0) : 0;
                const pa = isEd ? { ...kr.quarterlyActuals, [selectedQuarter]: pv } : kr.quarterlyActuals;
                const cum = isEd ? (['Q1','Q2','Q3','Q4'] as const).map(q => pa?.[q]).filter((v): v is number => v != null).reduce((s,v) => s+v, 0) : kr.currentValue;
                const prog = isEd && kr.targetValue > 0 ? Math.round((cum / kr.targetValue) * 100) : kr.progressPct;
                const pg = isEd ? calculateGrade({ ...kr, currentValue: cum }) : grade;

                return (
                  <div key={kr.id} className={`bg-white rounded-xl border ${isEd ? 'border-blue-300 ring-2 ring-blue-100 shadow-md' : 'border-slate-200'} transition-all`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* 배지 */}
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getGradeColor(isEd ? pg : grade)}`}>{isEd ? pg : grade}</span>
                            <span className="text-[10px] text-slate-400">가중치 {kr.weight}%</span>
                            {done && !isEd && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">✓ 완료</span>}
                            {!done && !isEd && <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded font-medium">미입력</span>}
                          </div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-2">{kr.name}</h4>
                          {/* 분기 미니 */}
                          <div className="flex gap-1.5">
                            {(['Q1','Q2','Q3','Q4'] as const).map(q => {
                              const t = kr.quarterlyTargets?.[q] || 0;
                              const a = isEd && q === selectedQuarter ? pv : kr.quarterlyActuals?.[q];
                              const cur = q === selectedQuarter;
                              const f = a != null;
                              return (
                                <div key={q} className={`flex-1 text-center py-1 rounded text-[11px] ${cur ? 'bg-blue-50 border border-blue-200' : f ? 'bg-slate-50 border border-slate-100' : 'bg-slate-50/50 border border-transparent'}`}>
                                  <div className={`font-semibold ${cur ? 'text-blue-700' : 'text-slate-500'}`}>{q}</div>
                                  <div className={f ? 'text-slate-800 font-medium' : 'text-slate-300'}>{f ? formatNumber(a as number) : '—'}</div>
                                  <div className="text-[9px] text-slate-400">/{formatNumber(t)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* 오른쪽 */}
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-slate-400">누적</div>
                          <div className="text-lg font-bold text-slate-900">{formatNumber(isEd ? cum : kr.currentValue)}</div>
                          <div className="text-[10px] text-slate-400">/ {formatNumber(kr.targetValue)} {kr.unit}</div>
                          <div className={`text-base font-bold ${pText(isEd ? prog : kr.progressPct)}`}>{isEd ? prog : kr.progressPct}%</div>
                          {!isEd && (
                            <div className="flex gap-1 mt-2 justify-end">
                              {canCheckin && (
                                <button onClick={() => startEdit(kr)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 ${done ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                                  <Pencil className="w-3 h-3" />{done ? '수정' : '입력'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* 인라인 폼 */}
                    {isEd && (
                      <div className="border-t border-blue-200 bg-gradient-to-b from-blue-50/50 to-white p-4">
                        <div className="flex items-end gap-3">
                          <div className="flex-1">
                            <label className="text-[11px] font-medium text-slate-500 mb-1 block">{selectedQuarter} 실적 ({kr.unit})</label>
                            <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                              placeholder={`목표: ${formatNumber(qTarget)}`}
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              autoFocus />
                          </div>
                          <div className="flex-1">
                            <label className="text-[11px] font-medium text-slate-500 mb-1 block">코멘트 (선택)</label>
                            <input type="text" value={editComment} onChange={e => setEditComment(e.target.value)}
                              placeholder="메모"
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              onKeyDown={e => { if (e.key === 'Enter' && editValue) submitCheckin(kr); }} />
                          </div>
                          <button onClick={cancelEdit} disabled={isSaving}
                            className="px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm shrink-0">취소</button>
                          <button onClick={() => submitCheckin(kr)} disabled={isSaving || !editValue}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-1 disabled:opacity-50 shrink-0">
                            <Save className="w-3.5 h-3.5" />{isSaving ? '...' : '저장'}
                          </button>
                        </div>
                        {qActual != null && <p className="text-[10px] text-slate-400 mt-1.5">이전값: {formatNumber(qActual as number)}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══ 오른쪽: 활동 피드 (2/5) ══ */}
          <div className="col-span-2 space-y-4">
            {/* 분기 추이 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-400" /> 분기별 추이
              </h3>
              <div className="flex gap-2">
                {quarterTrend.map(qt => (
                  <div key={qt.quarter} className={`flex-1 rounded-lg p-3 text-center ${qt.quarter === selectedQuarter ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-100'}`}>
                    <div className={`text-xs font-bold ${qt.quarter === selectedQuarter ? 'text-blue-700' : 'text-slate-500'}`}>{qt.quarter}</div>
                    <div className={`text-lg font-bold mt-1 ${qt.avgPct !== null ? pText(qt.avgPct) : 'text-slate-300'}`}>
                      {qt.avgPct !== null ? `${qt.avgPct}%` : '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">{qt.filled}/{qt.total} 입력</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 탭 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-100">
                <button onClick={() => setFeedTab('timeline')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${feedTab === 'timeline' ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700'}`}>
                  체크인 이력
                </button>
                <button onClick={() => setFeedTab('quarter')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${feedTab === 'quarter' ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:text-slate-700'}`}>
                  KR 현황
                </button>
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                {/* 체크인 타임라인 */}
                {feedTab === 'timeline' && (
                  <div className="p-4">
                    {objLogsLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>}
                    {!objLogsLoading && objLogs.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">아직 체크인 기록이 없습니다.</p>
                        <p className="text-xs text-slate-300 mt-1">실적을 입력하면 여기에 기록됩니다.</p>
                      </div>
                    )}
                    {!objLogsLoading && objLogs.length > 0 && (
                      <div className="space-y-0">
                        {objLogs.map((log, i) => (
                          <div key={log.id} className="relative pl-6 pb-4">
                            {/* 타임라인 라인 */}
                            {i < objLogs.length - 1 && <div className="absolute left-[9px] top-6 bottom-0 w-px bg-slate-200" />}
                            {/* 도트 */}
                            <div className="absolute left-0 top-1 w-[18px] h-[18px] rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            </div>
                            <div className="ml-2">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-medium text-slate-900">{log.checked_by_name}</span>
                                <span className="text-[10px] text-slate-400">{log.quarter}</span>
                                {log.is_delegated && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded">위임</span>}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs mb-0.5">
                                <span className="text-slate-500 truncate max-w-[150px]">{krNameMap.get(log.kr_id) || 'KR'}</span>
                                <span className="text-slate-300">:</span>
                                <span className="text-slate-400">{formatNumber(log.previous_value)}</span>
                                <span className="text-slate-300">→</span>
                                <span className="font-bold text-slate-900">{formatNumber(log.new_value)}</span>
                                <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${getGradeColor(log.grade as any)}`}>{log.grade}</span>
                              </div>
                              {log.comment && <p className="text-[11px] text-slate-500 bg-slate-50 rounded px-2 py-1 mt-1">{log.comment}</p>}
                              <span className="text-[10px] text-slate-400">
                                {new Date(log.created_at).toLocaleDateString('ko-KR')} {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* KR 현황 탭 */}
                {feedTab === 'quarter' && (
                  <div className="p-4 space-y-3">
                    {selectedObjKRs.map(kr => {
                      const g = calculateGrade(kr);
                      const qa = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals];
                      return (
                        <div key={kr.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${getGradeColor(g)}`}>{g}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-slate-900 truncate">{kr.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {selectedQuarter}: {qa != null ? formatNumber(qa as number) : '—'} / {formatNumber(kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || 0)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-sm font-bold ${pText(kr.progressPct)}`}>{kr.progressPct}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━ 서브 컴포넌트 ━━━
function StatCard({ icon: I, bg, color, value, label, vc }: { icon: any; bg: string; color: string; value: number; label: string; vc?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}><I className={`w-5 h-5 ${color}`} /></div>
        <div><div className={`text-2xl font-bold ${vc || 'text-slate-900'}`}>{value}</div><div className="text-xs text-slate-500">{label}</div></div>
      </div>
    </div>
  );
}
function Empty() {
  return (
    <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200">
      <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500">등록된 목표가 없습니다.</p>
    </div>
  );
}