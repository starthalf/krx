// src/pages/Checkin.tsx — 목표 리스트 → 목표 상세(인라인 실적 입력)
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor, calculateGrade, getGradeColor, formatNumber } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getMyRoleLevel, checkCanManageOrg, ROLE_LEVELS } from '../lib/permissions';
import type { DynamicKR } from '../types';
import {
  Loader2, TrendingUp, CheckCircle2, AlertCircle,
  ChevronRight, History, Save, X, User,
  BarChart3, Target, ArrowLeft, Pencil, Activity
} from 'lucide-react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 타입
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface CheckinLog {
  id: string;
  kr_id: string;
  quarter: string;
  previous_value: number;
  new_value: number;
  progress_pct: number;
  grade: string;
  comment: string;
  checked_by_name: string;
  is_delegated: boolean;
  created_at: string;
}

function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

function progressBarColor(pct: number) {
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 70) return 'bg-blue-500';
  if (pct >= 40) return 'bg-amber-400';
  return 'bg-red-400';
}

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

  // ★ 뷰 모드
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);

  // 인라인 실적 입력
  const [editingKrId, setEditingKrId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editComment, setEditComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 이력 모달
  const [historyModal, setHistoryModal] = useState<{ krId: string; krName: string } | null>(null);
  const [historyLogs, setHistoryLogs] = useState<CheckinLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── 1. 권한 체크 ──
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
      } catch (e) {
        console.error('Permission check failed:', e);
      } finally {
        setPermLoading(false);
      }
    };
    if (organizations.length > 0) check();
    else setPermLoading(false);
  }, [organizations.map(o => o.id).join(',')]);

  // ── 2. 초기 조직 선택 ──
  useEffect(() => {
    if (permLoading || organizations.length === 0 || roleLevel === 0) return;
    const current = organizations.find(o => o.id === selectedOrgId);
    const needsReselect = !selectedOrgId
      || (roleLevel < ROLE_LEVELS.COMPANY_ADMIN && current?.level === '전사');
    if (!needsReselect) return;

    let defaultOrg;
    if (roleLevel >= ROLE_LEVELS.COMPANY_ADMIN) {
      defaultOrg = organizations.find(o => managableOrgs.includes(o.id)) || organizations[0];
    } else if (managableOrgs.length > 0) {
      defaultOrg = organizations.find(o => managableOrgs.includes(o.id) && o.level !== '전사');
    }
    if (!defaultOrg) defaultOrg = organizations.find(o => o.level !== '전사') || organizations[0];
    if (defaultOrg) setSelectedOrgId(defaultOrg.id);
  }, [permLoading, managableOrgs.join(','), roleLevel]);

  // ── 3. 조직 변경 시 데이터 로딩 ──
  useEffect(() => {
    if (!selectedOrgId) return;
    fetchObjectives(selectedOrgId);
    fetchKRs(selectedOrgId);
    checkCanManageOrg(selectedOrgId).then(setCanManageOrg);
    setViewMode('list');
    setSelectedObjId(null);
  }, [selectedOrgId]);

  // ── 4. CFR 로딩 ──
  useEffect(() => {
    if (selectedOrgId && krs.length > 0) {
      krs.filter(k => k.orgId === selectedOrgId).forEach(kr => fetchCFRs(kr.id));
    }
  }, [selectedOrgId, krs.length]);

  // ── 데이터 ──
  const orgObjectives = objectives.filter(o => o.orgId === selectedOrgId);
  const orgKRs = krs.filter(k => k.orgId === selectedOrgId);
  const selectedObj = selectedObjId ? orgObjectives.find(o => o.id === selectedObjId) : null;
  const selectedObjKRs = selectedObjId ? krs.filter(k => k.objectiveId === selectedObjId) : [];

  const summary = useMemo(() => {
    const total = orgKRs.length;
    const checkedIn = orgKRs.filter(kr => {
      const actual = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals];
      return actual !== null && actual !== undefined;
    }).length;
    return { total, checkedIn, notCheckedIn: total - checkedIn, rate: total > 0 ? Math.round((checkedIn / total) * 100) : 0 };
  }, [orgKRs, selectedQuarter]);

  const canCheckin = roleLevel >= ROLE_LEVELS.ORG_LEADER && canManageOrg;

  const selectableOrgs = roleLevel >= ROLE_LEVELS.COMPANY_ADMIN
    ? organizations
    : organizations.filter(o => managableOrgs.includes(o.id) && o.level !== '전사');

  // ── 네비게이션 ──
  const openObjective = (objId: string) => { setSelectedObjId(objId); setViewMode('detail'); setEditingKrId(null); };
  const backToList = () => { setViewMode('list'); setSelectedObjId(null); setEditingKrId(null); };

  // ── 인라인 입력 ──
  const startEdit = (kr: DynamicKR) => {
    const currentActual = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals];
    setEditingKrId(kr.id);
    setEditValue(currentActual?.toString() || '');
    setEditComment('');
  };
  const cancelEdit = () => { setEditingKrId(null); setEditValue(''); setEditComment(''); };

  const submitCheckin = async (kr: DynamicKR) => {
    if (!user) return;
    const newValue = parseFloat(editValue);
    if (isNaN(newValue)) return;
    setIsSaving(true);
    try {
      const previousActual = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] || 0;
      const newActuals = { ...kr.quarterlyActuals, [selectedQuarter]: newValue };
      const cumulative = (['Q1', 'Q2', 'Q3', 'Q4'] as const)
        .map(q => newActuals[q]).filter((v): v is number => v != null).reduce((s, v) => s + v, 0);
      const newProgress = kr.targetValue > 0 ? Math.round((cumulative / kr.targetValue) * 100) : 0;
      const newGrade = calculateGrade({ ...kr, currentValue: cumulative });

      const { error } = await supabase.from('key_results').update({
        quarterly_actuals: newActuals, current_value: cumulative,
        progress_pct: newProgress, last_checkin_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', kr.id);
      if (error) throw error;

      await supabase.from('checkin_logs').insert({
        kr_id: kr.id, org_id: kr.orgId, checkin_period: `2025-${selectedQuarter}`, quarter: selectedQuarter,
        previous_value: previousActual || 0, new_value: newValue,
        target_value: kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || kr.targetValue,
        progress_pct: newProgress, grade: newGrade, comment: editComment || null,
        checked_by: user.id, checked_by_name: (user as any).user_metadata?.full_name || user.email || '사용자',
        is_delegated: roleLevel < ROLE_LEVELS.ORG_LEADER,
      }).then(({ error: e }) => { if (e) console.warn('checkin_logs:', e.message); });

      updateKR(kr.id, { quarterlyActuals: newActuals, currentValue: cumulative, progressPct: newProgress });
      cancelEdit();
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
    } finally { setIsSaving(false); }
  };

  // ── 이력 ──
  const openHistory = async (krId: string, krName: string) => {
    setHistoryModal({ krId, krName });
    setHistoryLoading(true);
    try {
      const { data } = await supabase.from('checkin_logs').select('*').eq('kr_id', krId).order('created_at', { ascending: false }).limit(20);
      setHistoryLogs(data || []);
    } catch { setHistoryLogs([]); }
    finally { setHistoryLoading(false); }
  };

  // ── 목표별 통계 ──
  const getObjStats = (objId: string) => {
    const objKRs = krs.filter(k => k.objectiveId === objId);
    const total = objKRs.length;
    const checkedIn = objKRs.filter(kr => kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] != null).length;
    const avgProgress = total > 0 ? Math.round(objKRs.reduce((s, k) => s + (k.progressPct || 0), 0) / total) : 0;
    return { total, checkedIn, avgProgress };
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (permLoading || roleLevel === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {viewMode === 'detail' && (
            <button onClick={backToList} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{viewMode === 'list' ? '체크인' : selectedObj?.name || '목표 상세'}</h1>
            {viewMode === 'list' && <p className="text-slate-500 text-sm mt-0.5">조직 KR의 분기별 실적을 점검합니다.</p>}
          </div>
        </div>
        <div className="flex gap-3">
          <select value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
            {selectableOrgs.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
          </select>
          <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="Q1">Q1 (1~3월)</option>
            <option value="Q2">Q2 (4~6월)</option>
            <option value="Q3">Q3 (7~9월)</option>
            <option value="Q4">Q4 (10~12월)</option>
          </select>
        </div>
      </div>

      {/* 요약 카드 (리스트) */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SummaryCard icon={Target} bg="bg-blue-100" color="text-blue-600" value={summary.total} label="전체 KR" />
          <SummaryCard icon={CheckCircle2} bg="bg-green-100" color="text-green-600" value={summary.checkedIn} label="입력 완료" vColor="text-green-700" />
          <SummaryCard icon={AlertCircle} bg="bg-orange-100" color="text-orange-600" value={summary.notCheckedIn} label="미입력" vColor="text-orange-700" />
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center"><BarChart3 className="w-5 h-5 text-indigo-600" /></div>
              <div className="flex-1"><div className="text-2xl font-bold text-indigo-700">{summary.rate}%</div><div className="text-xs text-slate-500">체크인율</div></div>
            </div>
            <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${summary.rate}%` }} /></div>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}
      {!loading && orgObjectives.length === 0 && <EmptyState />}

      {/* ━━━━ 리스트 뷰 ━━━━ */}
      {!loading && viewMode === 'list' && orgObjectives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orgObjectives.map(obj => {
            const stats = getObjStats(obj.id);
            const bii = getBIIColor(obj.biiType);
            const allDone = stats.total > 0 && stats.checkedIn === stats.total;
            return (
              <div key={obj.id} onClick={() => openObjective(obj.id)}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${bii.bg} ${bii.text}`}>{obj.biiType}</span>
                    {allDone && <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium"><CheckCircle2 className="w-3 h-3" />완료</span>}
                    {!allDone && stats.checkedIn > 0 && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">{stats.checkedIn}/{stats.total}</span>}
                    {stats.checkedIn === 0 && stats.total > 0 && <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">미시작</span>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors shrink-0" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 line-clamp-2 leading-snug">{obj.name}</h3>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>KR {stats.total}개</span>
                  <span>달성률 <strong className="text-slate-700">{stats.avgProgress}%</strong></span>
                </div>
                <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${progressBarColor(stats.avgProgress)}`} style={{ width: `${Math.min(100, stats.avgProgress)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ━━━━ 상세 뷰 ━━━━ */}
      {!loading && viewMode === 'detail' && selectedObj && (
        <div className="space-y-4">
          {/* 목표 요약 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2.5 py-1 rounded text-xs font-semibold ${getBIIColor(selectedObj.biiType).bg} ${getBIIColor(selectedObj.biiType).text}`}>{selectedObj.biiType}</span>
              <span className="text-xs text-slate-400">KR {selectedObjKRs.length}개</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">{selectedObj.name}</h2>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <span>{selectedQuarter} 체크인: <strong className="text-slate-700">{selectedObjKRs.filter(kr => kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] != null).length}/{selectedObjKRs.length}</strong></span>
              <span>평균 달성률: <strong className="text-slate-700">{selectedObjKRs.length > 0 ? Math.round(selectedObjKRs.reduce((s, k) => s + (k.progressPct || 0), 0) / selectedObjKRs.length) : 0}%</strong></span>
            </div>
          </div>

          {selectedObjKRs.length === 0 && <div className="text-center py-12 text-slate-400">연결된 KR이 없습니다</div>}

          {/* KR 카드들 */}
          {selectedObjKRs.map(kr => {
            const grade = calculateGrade(kr);
            const isEditing = editingKrId === kr.id;
            const quarterActual = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals];
            const quarterTarget = kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || 0;
            const isCheckedIn = quarterActual != null;

            const previewValue = isEditing ? (parseFloat(editValue) || 0) : 0;
            const previewActuals = isEditing ? { ...kr.quarterlyActuals, [selectedQuarter]: previewValue } : kr.quarterlyActuals;
            const previewCumulative = isEditing
              ? (['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => previewActuals?.[q]).filter((v): v is number => v != null).reduce((s, v) => s + v, 0)
              : kr.currentValue;
            const previewProgress = isEditing && kr.targetValue > 0 ? Math.round((previewCumulative / kr.targetValue) * 100) : kr.progressPct;
            const previewGrade = isEditing ? calculateGrade({ ...kr, currentValue: previewCumulative }) : grade;

            return (
              <div key={kr.id} className={`bg-white rounded-xl border ${isEditing ? 'border-blue-300 shadow-lg ring-2 ring-blue-100' : 'border-slate-200'} overflow-hidden transition-all`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getGradeColor(isEditing ? previewGrade : grade)}`}>{isEditing ? previewGrade : grade}</span>
                        <span className="text-xs text-slate-400">가중치 {kr.weight}%</span>
                        {isCheckedIn && !isEditing && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5" />입력완료</span>}
                        {!isCheckedIn && !isEditing && <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-medium">미입력</span>}
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 mb-2">{kr.name}</h3>
                      <div className="flex gap-2">
                        {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
                          const target = kr.quarterlyTargets?.[q] || 0;
                          const actual = isEditing && q === selectedQuarter ? previewValue : kr.quarterlyActuals?.[q];
                          const isCurrent = q === selectedQuarter;
                          const filled = actual != null;
                          return (
                            <div key={q} className={`flex-1 text-center py-1.5 px-1 rounded text-xs ${isCurrent ? 'bg-blue-50 border border-blue-200' : filled ? 'bg-slate-50 border border-slate-100' : 'bg-slate-50/50'}`}>
                              <div className={`font-semibold ${isCurrent ? 'text-blue-700' : 'text-slate-500'}`}>{q}</div>
                              <div className={filled ? 'text-slate-900 font-medium' : 'text-slate-300'}>{filled ? formatNumber(actual as number) : '—'}</div>
                              <div className="text-slate-400 text-[10px]">/{formatNumber(target)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="text-xs text-slate-400 mb-1">누적</div>
                      <div className="text-xl font-bold text-slate-900">{formatNumber(isEditing ? previewCumulative : kr.currentValue)}</div>
                      <div className="text-xs text-slate-400">/ {formatNumber(kr.targetValue)} {kr.unit}</div>
                      <div className={`text-lg font-bold mt-1 ${(isEditing ? previewProgress : kr.progressPct) >= 100 ? 'text-green-600' : (isEditing ? previewProgress : kr.progressPct) >= 70 ? 'text-blue-600' : (isEditing ? previewProgress : kr.progressPct) >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                        {isEditing ? previewProgress : kr.progressPct}%
                      </div>
                      {!isEditing && (
                        <div className="flex gap-1.5 mt-3 justify-end">
                          {canCheckin && (
                            <button onClick={() => startEdit(kr)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${isCheckedIn ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                              <Pencil className="w-3 h-3" />{isCheckedIn ? '수정' : '입력'}
                            </button>
                          )}
                          <button onClick={() => openHistory(kr.id, kr.name)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center gap-1">
                            <History className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ★ 인라인 입력 폼 */}
                {isEditing && (
                  <div className="border-t border-blue-200 bg-blue-50/30 p-5">
                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-slate-600 block mb-1">{selectedQuarter} 실적값 ({kr.unit})</label>
                        <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                          placeholder={`목표: ${formatNumber(quarterTarget)}`}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                          autoFocus />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-medium text-slate-600 block mb-1">코멘트 (선택)</label>
                        <input type="text" value={editComment} onChange={e => setEditComment(e.target.value)}
                          placeholder="메모나 특이사항"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white" />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={cancelEdit} disabled={isSaving}
                          className="px-4 py-2.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-100 text-sm font-medium">취소</button>
                        <button onClick={() => submitCheckin(kr)} disabled={isSaving || !editValue}
                          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-1.5 disabled:opacity-50">
                          <Save className="w-3.5 h-3.5" />{isSaving ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                    {quarterActual != null && <p className="text-xs text-slate-400 mt-2">이전 입력값: {formatNumber(quarterActual as number)} {kr.unit}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 이력 모달 */}
      {historyModal && <HistoryModal krName={historyModal.krName} logs={historyLogs} loading={historyLoading} onClose={() => setHistoryModal(null)} />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SummaryCard({ icon: Icon, bg, color, value, label, vColor }: { icon: any; bg: string; color: string; value: number; label: string; vColor?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}><Icon className={`w-5 h-5 ${color}`} /></div>
        <div><div className={`text-2xl font-bold ${vColor || 'text-slate-900'}`}>{value}</div><div className="text-xs text-slate-500">{label}</div></div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200">
      <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500">이 조직에 등록된 목표가 없습니다.</p>
      <p className="text-xs text-slate-400 mt-1">OKR 수립 후 체크인을 시작할 수 있습니다.</p>
    </div>
  );
}

function HistoryModal({ krName, logs, loading, onClose }: { krName: string; logs: CheckinLog[]; loading: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div><h3 className="text-base font-bold text-slate-900">체크인 이력</h3><p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{krName}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>}
          {!loading && logs.length === 0 && (
            <div className="text-center py-10 text-slate-400"><Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" /><p className="text-sm">아직 체크인 이력이 없습니다.</p></div>
          )}
          {!loading && logs.length > 0 && (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center"><User className="w-3 h-3 text-slate-500" /></div>
                      <span className="text-sm font-medium text-slate-900">{log.checked_by_name}</span>
                      {log.is_delegated && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">위임</span>}
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleDateString('ko-KR')} {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-400 text-xs">{log.quarter}</span>
                    <span className="text-slate-400">{formatNumber(log.previous_value)}</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-bold text-slate-900">{formatNumber(log.new_value)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getGradeColor(log.grade as any)}`}>{log.grade}</span>
                    <span className="text-xs text-slate-400 ml-auto">{log.progress_pct}%</span>
                  </div>
                  {log.comment && <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg p-2">{log.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}