// src/pages/Checkin.tsx — 피드형 체크인 상세
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor, calculateGrade, getGradeColor, formatNumber } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getMyRoleLevel, checkCanManageOrg, ROLE_LEVELS } from '../lib/permissions';
import type { DynamicKR } from '../types';
import {
  Loader2, TrendingUp, CheckCircle2, AlertCircle,
  ChevronRight, Save, X, User, BarChart3, Target,
  ArrowLeft, Pencil, Clock, Send, MessageCircle,
  Hash, ArrowUp, Minus
} from 'lucide-react';

// ━━━ 타입 ━━━
interface CheckinLog {
  id: string; kr_id: string; quarter: string;
  previous_value: number; new_value: number; progress_pct: number;
  grade: string; comment: string; checked_by_name: string;
  is_delegated: boolean; created_at: string;
}

interface CFREntry {
  id: string; kr_id: string; type: string;
  content: string; author_name: string; created_at: string;
}

// 피드 통합 타입
interface FeedItem {
  id: string;
  type: 'checkin' | 'comment' | 'feedback';
  timestamp: string;
  author: string;
  // checkin
  krId?: string; krName?: string;
  prevValue?: number; newValue?: number;
  grade?: string; progressPct?: number;
  // comment/feedback
  content?: string;
  isDelegated?: boolean;
}

function getCurrentQuarter(): string {
  const m = new Date().getMonth() + 1;
  return m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
}
function pBarColor(p: number) { return p >= 100 ? 'bg-emerald-500' : p >= 70 ? 'bg-blue-500' : p >= 40 ? 'bg-amber-400' : 'bg-red-400'; }
function pTextColor(p: number) { return p >= 100 ? 'text-emerald-600' : p >= 70 ? 'text-blue-600' : p >= 40 ? 'text-amber-600' : 'text-red-500'; }

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

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

  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);

  // 인라인 입력
  const [editingKrId, setEditingKrId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editComment, setEditComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 피드 데이터
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  // 코멘트 입력
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  // ── 권한 ──
  useEffect(() => {
    const check = async () => {
      setPermLoading(true);
      try {
        const level = await getMyRoleLevel();
        setRoleLevel(level);
        let managable: string[];
        if (level >= ROLE_LEVELS.COMPANY_ADMIN) managable = organizations.map(o => o.id);
        else {
          const r = await Promise.all(organizations.map(async o => ({ id: o.id, can: await checkCanManageOrg(o.id) })));
          managable = r.filter(x => x.can).map(x => x.id);
        }
        setManagableOrgs(managable);
      } catch (e) { console.error(e); }
      finally { setPermLoading(false); }
    };
    if (organizations.length > 0) check(); else setPermLoading(false);
  }, [organizations.map(o => o.id).join(',')]);

  // ── 초기 조직 ──
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

  // ── 데이터 ──
  useEffect(() => {
    if (!selectedOrgId) return;
    fetchObjectives(selectedOrgId); fetchKRs(selectedOrgId);
    checkCanManageOrg(selectedOrgId).then(setCanManageOrg);
    setViewMode('list'); setSelectedObjId(null);
  }, [selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId && krs.length > 0)
      krs.filter(k => k.orgId === selectedOrgId).forEach(kr => fetchCFRs(kr.id));
  }, [selectedOrgId, krs.length]);

  // ── 목표 상세 → 피드 로드 ──
  useEffect(() => {
    if (!selectedObjId) return;
    loadFeed();
  }, [selectedObjId, krs.length]);

  const loadFeed = async () => {
    if (!selectedObjId) return;
    setFeedLoading(true);
    try {
      const objKRIds = krs.filter(k => k.objectiveId === selectedObjId).map(k => k.id);
      if (objKRIds.length === 0) { setFeedItems([]); return; }

      // 체크인 로그
      const { data: logs } = await supabase.from('checkin_logs').select('*')
        .in('kr_id', objKRIds).order('created_at', { ascending: false }).limit(50);

      // CFR 코멘트 (있으면)
      let cfrs: CFREntry[] = [];
      try {
        const { data: cfrData } = await supabase.from('cfr_threads').select('*')
          .in('kr_id', objKRIds).order('created_at', { ascending: false }).limit(30);
        cfrs = (cfrData || []) as CFREntry[];
      } catch { /* cfr_threads 없으면 무시 */ }

      const krMap = new Map<string, string>();
      krs.filter(k => k.objectiveId === selectedObjId).forEach(k => krMap.set(k.id, k.name));

      // 통합 피드 생성
      const items: FeedItem[] = [
        ...(logs || []).map((l: CheckinLog) => ({
          id: `log-${l.id}`, type: 'checkin' as const, timestamp: l.created_at,
          author: l.checked_by_name, krId: l.kr_id, krName: krMap.get(l.kr_id) || 'KR',
          prevValue: l.previous_value, newValue: l.new_value,
          grade: l.grade, progressPct: l.progress_pct, content: l.comment,
          isDelegated: l.is_delegated,
        })),
        ...cfrs.map(c => ({
          id: `cfr-${c.id}`, type: (c.type === 'feedback' ? 'feedback' : 'comment') as FeedItem['type'],
          timestamp: c.created_at, author: c.author_name, content: c.content,
          krId: c.kr_id, krName: krMap.get(c.kr_id) || '',
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setFeedItems(items);
    } catch { setFeedItems([]); }
    finally { setFeedLoading(false); }
  };

  const orgObjectives = objectives.filter(o => o.orgId === selectedOrgId);
  const orgKRs = krs.filter(k => k.orgId === selectedOrgId);
  const selectedObj = selectedObjId ? orgObjectives.find(o => o.id === selectedObjId) : null;
  const selectedObjKRs = selectedObjId ? krs.filter(k => k.objectiveId === selectedObjId) : [];

  const summary = useMemo(() => {
    const t = orgKRs.length;
    const c = orgKRs.filter(kr => kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] != null).length;
    return { total: t, checkedIn: c, rate: t > 0 ? Math.round((c / t) * 100) : 0 };
  }, [orgKRs, selectedQuarter]);

  const canCheckin = roleLevel >= ROLE_LEVELS.ORG_LEADER && canManageOrg;
  const selectableOrgs = roleLevel >= ROLE_LEVELS.COMPANY_ADMIN
    ? organizations : organizations.filter(o => managableOrgs.includes(o.id) && o.level !== '전사');

  // ── 네비게이션 ──
  const openObjective = (id: string) => { setSelectedObjId(id); setViewMode('detail'); setEditingKrId(null); };
  const backToList = () => { setViewMode('list'); setSelectedObjId(null); setEditingKrId(null); };

  // ── 실적 입력 ──
  const startEdit = (kr: DynamicKR) => {
    setEditingKrId(kr.id);
    setEditValue(kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals]?.toString() || '');
    setEditComment('');
  };
  const cancelEdit = () => { setEditingKrId(null); setEditValue(''); setEditComment(''); };

  const submitCheckin = async (kr: DynamicKR) => {
    if (!user) return;
    const nv = parseFloat(editValue);
    if (isNaN(nv)) return;
    setIsSaving(true);
    try {
      const prev = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] || 0;
      const na = { ...kr.quarterlyActuals, [selectedQuarter]: nv };
      const cum = (['Q1','Q2','Q3','Q4'] as const).map(q => na[q]).filter((v): v is number => v != null).reduce((s,v) => s+v, 0);
      const prog = kr.targetValue > 0 ? Math.round((cum / kr.targetValue) * 100) : 0;
      const grade = calculateGrade({ ...kr, currentValue: cum });

      const { error } = await supabase.from('key_results').update({
        quarterly_actuals: na, current_value: cum, progress_pct: prog,
        last_checkin_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', kr.id);
      if (error) throw error;

      await supabase.from('checkin_logs').insert({
        kr_id: kr.id, org_id: kr.orgId, checkin_period: `2025-${selectedQuarter}`, quarter: selectedQuarter,
        previous_value: prev || 0, new_value: nv,
        target_value: kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || kr.targetValue,
        progress_pct: prog, grade, comment: editComment || null,
        checked_by: user.id, checked_by_name: (user as any).user_metadata?.full_name || user.email || '사용자',
        is_delegated: roleLevel < ROLE_LEVELS.ORG_LEADER,
      });

      updateKR(kr.id, { quarterlyActuals: na, currentValue: cum, progressPct: prog });

      // 피드에 즉시 추가
      setFeedItems(prev => [{
        id: `log-new-${Date.now()}`, type: 'checkin', timestamp: new Date().toISOString(),
        author: (user as any).user_metadata?.full_name || user.email || '사용자',
        krId: kr.id, krName: kr.name, prevValue: (prev as any) || 0, newValue: nv,
        grade, progressPct: prog, content: editComment || undefined,
      }, ...prev]);

      cancelEdit();
    } catch (err: any) { alert(`저장 실패: ${err.message}`); }
    finally { setIsSaving(false); }
  };

  // ── 코멘트 전송 ──
  const sendComment = async () => {
    if (!commentText.trim() || !user || !selectedObjId) return;
    setCommentSending(true);
    try {
      // cfr_threads에 저장 시도
      const firstKrId = selectedObjKRs[0]?.id;
      if (firstKrId) {
        await supabase.from('cfr_threads').insert({
          kr_id: firstKrId, type: 'conversation',
          content: commentText.trim(),
          author_id: user.id,
          author_name: (user as any).user_metadata?.full_name || user.email || '사용자',
        }).then(({ error }) => { if (error) console.warn('cfr_threads:', error.message); });
      }

      // 피드에 즉시 추가
      setFeedItems(prev => [{
        id: `cmt-${Date.now()}`, type: 'comment', timestamp: new Date().toISOString(),
        author: (user as any).user_metadata?.full_name || user.email || '사용자',
        content: commentText.trim(),
      }, ...prev]);
      setCommentText('');
    } catch { }
    finally { setCommentSending(false); }
  };

  // ── 목표 통계 ──
  const getObjStats = (objId: string) => {
    const ok = krs.filter(k => k.objectiveId === objId);
    const t = ok.length;
    const c = ok.filter(kr => kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] != null).length;
    return { total: t, checkedIn: c, avg: t > 0 ? Math.round(ok.reduce((s,k) => s+(k.progressPct||0), 0)/t) : 0 };
  };

  // ━━━ 렌더링 ━━━
  if (permLoading || roleLevel === 0) return <div className="flex items-center justify-center h-screen"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {viewMode === 'detail' && <button onClick={backToList} className="p-2 hover:bg-slate-100 rounded-lg"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{viewMode === 'list' ? '체크인' : '목표 체크인'}</h1>
            {viewMode === 'list' && <p className="text-slate-500 text-sm mt-0.5">조직 KR의 실적을 점검하고 소통합니다.</p>}
          </div>
        </div>
        <div className="flex gap-3">
          <select value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium outline-none">
            {selectableOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium outline-none">
            {['Q1','Q2','Q3','Q4'].map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
      </div>

      {/* 요약 (리스트) */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SC icon={Target} bg="bg-blue-50" ic="text-blue-600" v={summary.total} l="전체 KR" />
          <SC icon={CheckCircle2} bg="bg-emerald-50" ic="text-emerald-600" v={summary.checkedIn} l="입력 완료" vc="text-emerald-700" />
          <SC icon={AlertCircle} bg="bg-orange-50" ic="text-orange-500" v={summary.total - summary.checkedIn} l="미입력" vc="text-orange-600" />
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center"><BarChart3 className="w-5 h-5 text-indigo-600" /></div>
              <div><div className="text-2xl font-bold text-indigo-700">{summary.rate}%</div><div className="text-xs text-slate-500">체크인율</div></div>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full"><div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${summary.rate}%` }} /></div>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}
      {!loading && orgObjectives.length === 0 && <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200"><Target className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">등록된 목표가 없습니다.</p></div>}

      {/* ━━━━ 리스트 ━━━━ */}
      {!loading && viewMode === 'list' && orgObjectives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orgObjectives.map(obj => {
            const s = getObjStats(obj.id);
            const bii = getBIIColor(obj.biiType);
            const done = s.total > 0 && s.checkedIn === s.total;
            return (
              <div key={obj.id} onClick={() => openObjective(obj.id)}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${bii.bg} ${bii.text}`}>{obj.biiType}</span>
                    {done ? <span className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />완료</span>
                      : s.checkedIn > 0 ? <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">{s.checkedIn}/{s.total}</span>
                      : s.total > 0 ? <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">미시작</span> : null}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 line-clamp-2">{obj.name}</h3>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>KR {s.total}개</span><span className={`font-bold ${pTextColor(s.avg)}`}>{s.avg}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pBarColor(s.avg)}`} style={{ width: `${Math.min(100,s.avg)}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}

      {/* ━━━━ 상세: 좌우 2컬럼 ━━━━ */}
      {!loading && viewMode === 'detail' && selectedObj && (
        <div className="grid grid-cols-5 gap-6">
          {/* ══ 왼쪽 (3) — 진행 현황 + KR 입력 ══ */}
          <div className="col-span-3 space-y-5">
            {/* 목표 카드 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getBIIColor(selectedObj.biiType).bg} ${getBIIColor(selectedObj.biiType).text}`}>{selectedObj.biiType}</span>
                <Hash className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-xs text-slate-400">KR {selectedObjKRs.length}개 · {selectedQuarter}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-4 leading-tight">{selectedObj.name}</h2>

              {/* 전체 게이지 */}
              {(() => {
                const avg = selectedObjKRs.length > 0 ? Math.round(selectedObjKRs.reduce((s,k)=>s+(k.progressPct||0),0)/selectedObjKRs.length) : 0;
                const checked = selectedObjKRs.filter(k => k.quarterlyActuals?.[selectedQuarter as keyof typeof k.quarterlyActuals] != null).length;
                return (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <div className="text-xs text-slate-500 mb-0.5">전체 진행률</div>
                        <div className={`text-3xl font-black ${pTextColor(avg)}`}>{avg}<span className="text-lg">%</span></div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">체크인</div>
                        <div className="text-sm font-bold text-slate-700">{checked}<span className="text-slate-400 font-normal">/{selectedObjKRs.length}</span></div>
                      </div>
                    </div>
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pBarColor(avg)}`} style={{ width: `${Math.min(100,avg)}%` }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* KR 카드들 */}
            {selectedObjKRs.map(kr => {
              const grade = calculateGrade(kr);
              const isEd = editingKrId === kr.id;
              const qA = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals];
              const qT = kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || 0;
              const done = qA != null;

              // 미리보기
              const pv = isEd ? (parseFloat(editValue) || 0) : 0;
              const prevActs = isEd ? { ...kr.quarterlyActuals, [selectedQuarter]: pv } : kr.quarterlyActuals;
              const cum = isEd ? (['Q1','Q2','Q3','Q4'] as const).map(q => prevActs?.[q]).filter((v): v is number => v != null).reduce((s,v)=>s+v,0) : kr.currentValue;
              const prog = isEd && kr.targetValue > 0 ? Math.round((cum/kr.targetValue)*100) : kr.progressPct;
              const pg = isEd ? calculateGrade({...kr, currentValue: cum}) : grade;

              return (
                <div key={kr.id} className={`bg-white rounded-2xl border ${isEd ? 'border-blue-400 ring-2 ring-blue-100 shadow-lg' : 'border-slate-200 hover:border-slate-300'} transition-all`}>
                  <div className="p-5">
                    {/* 상단: 등급 + 이름 + 달성 */}
                    <div className="flex items-start gap-4">
                      {/* 등급 원형 */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${getGradeColor(isEd ? pg : grade)}`}>
                        {isEd ? pg : grade}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 mb-1">{kr.name}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span>가중치 {kr.weight}%</span>
                          <span>·</span>
                          <span>{kr.unit}</span>
                          {done && !isEd && <span className="text-emerald-600 font-medium">✓ 입력완료</span>}
                          {!done && !isEd && <span className="text-orange-500 font-medium">미입력</span>}
                        </div>
                      </div>
                      {/* 달성률 */}
                      <div className="text-right shrink-0">
                        <div className={`text-2xl font-black ${pTextColor(isEd ? prog : kr.progressPct)}`}>{isEd ? prog : kr.progressPct}%</div>
                        <div className="text-[11px] text-slate-400">{formatNumber(isEd ? cum : kr.currentValue)} / {formatNumber(kr.targetValue)}</div>
                      </div>
                    </div>

                    {/* 분기 바 */}
                    <div className="flex gap-1.5 mt-4">
                      {(['Q1','Q2','Q3','Q4'] as const).map(q => {
                        const t = kr.quarterlyTargets?.[q] || 0;
                        const a = isEd && q === selectedQuarter ? pv : kr.quarterlyActuals?.[q];
                        const cur = q === selectedQuarter;
                        const f = a != null;
                        const pct = t > 0 && f ? Math.min(100, Math.round(((a as number) / t) * 100)) : 0;
                        return (
                          <div key={q} className={`flex-1 rounded-lg overflow-hidden ${cur ? 'ring-2 ring-blue-300' : ''}`}>
                            <div className={`text-center text-[10px] font-bold py-0.5 ${cur ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{q}</div>
                            <div className="bg-slate-50 p-2 text-center">
                              <div className={`text-xs font-bold ${f ? 'text-slate-900' : 'text-slate-300'}`}>{f ? formatNumber(a as number) : '—'}</div>
                              <div className="text-[9px] text-slate-400">/{formatNumber(t)}</div>
                              {f && <div className="mt-1 h-1 bg-slate-200 rounded-full"><div className={`h-full rounded-full ${pBarColor(pct)}`} style={{ width: `${pct}%` }} /></div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 입력 버튼 */}
                    {!isEd && canCheckin && (
                      <button onClick={() => startEdit(kr)}
                        className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          done ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        }`}>
                        {done ? `${selectedQuarter} 실적 수정` : `${selectedQuarter} 실적 입력`}
                      </button>
                    )}
                  </div>

                  {/* 인라인 입력 폼 */}
                  {isEd && (
                    <div className="border-t border-blue-200 bg-gradient-to-b from-blue-50 to-white p-5">
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">{selectedQuarter} 실적값</label>
                          <div className="flex items-center gap-2">
                            <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                              placeholder={`목표: ${formatNumber(qT)}`}
                              className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                              autoFocus />
                            <span className="text-sm text-slate-400 font-medium">{kr.unit}</span>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-600 mb-1 block">메모 · 코멘트</label>
                          <textarea value={editComment} onChange={e => setEditComment(e.target.value)}
                            placeholder="이번 분기 실적에 대한 설명, 이슈, 다음 계획 등을 기록하세요..."
                            rows={3}
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white resize-none" />
                        </div>
                        {/* 미리보기 */}
                        <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-slate-100">
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <ArrowUp className="w-3 h-3" /> 누적 <strong className="text-slate-900">{formatNumber(cum)}</strong>
                          </div>
                          <div className="text-xs text-slate-300">|</div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            달성률 <strong className={pTextColor(prog)}>{prog}%</strong>
                          </div>
                          <div className="text-xs text-slate-300">|</div>
                          <div className="flex items-center gap-1 text-xs">
                            등급 <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${getGradeColor(pg)}`}>{pg}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={cancelEdit} disabled={isSaving}
                            className="flex-1 py-2.5 border border-slate-300 text-slate-600 rounded-xl hover:bg-slate-50 text-sm font-medium">취소</button>
                          <button onClick={() => submitCheckin(kr)} disabled={isSaving || !editValue}
                            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                            <Save className="w-4 h-4" />{isSaving ? '저장 중...' : '저장'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ══ 오른쪽 (2) — 활동 피드 + 소통 ══ */}
          <div className="col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden sticky top-6">
              {/* 헤더 */}
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-500" /> 활동 피드
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">체크인 기록과 코멘트가 여기에 쌓입니다.</p>
              </div>

              {/* 코멘트 입력 */}
              <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/50">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                      placeholder="의견이나 피드백을 남겨보세요..."
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) { e.preventDefault(); sendComment(); }}} />
                    <div className="flex justify-end mt-1.5">
                      <button onClick={sendComment} disabled={!commentText.trim() || commentSending}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1">
                        <Send className="w-3 h-3" /> 전송
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 피드 타임라인 */}
              <div className="max-h-[600px] overflow-y-auto">
                {feedLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>}

                {!feedLoading && feedItems.length === 0 && (
                  <div className="text-center py-12 px-5">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">아직 활동이 없습니다.</p>
                    <p className="text-xs text-slate-300 mt-1">실적을 입력하거나 코멘트를 남겨보세요.</p>
                  </div>
                )}

                {!feedLoading && feedItems.length > 0 && (
                  <div className="divide-y divide-slate-50">
                    {feedItems.map(item => (
                      <div key={item.id} className="px-5 py-3 hover:bg-slate-50/50 transition-colors">
                        <div className="flex gap-3">
                          {/* 아바타 / 아이콘 */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            item.type === 'checkin' ? 'bg-blue-100' : item.type === 'feedback' ? 'bg-violet-100' : 'bg-slate-100'
                          }`}>
                            {item.type === 'checkin' ? <TrendingUp className="w-4 h-4 text-blue-600" /> :
                             item.type === 'feedback' ? <MessageCircle className="w-4 h-4 text-violet-600" /> :
                             <User className="w-4 h-4 text-slate-500" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* 작성자 + 시간 */}
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-slate-900">{item.author}</span>
                              {item.isDelegated && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded">위임</span>}
                              <span className="text-[10px] text-slate-400 ml-auto">{timeAgo(item.timestamp)}</span>
                            </div>

                            {/* 체크인 내용 */}
                            {item.type === 'checkin' && (
                              <>
                                <div className="flex items-center gap-1.5 text-xs mb-1">
                                  <span className="text-slate-500 truncate max-w-[180px]">{item.krName}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                                  <span className="text-sm text-slate-400">{formatNumber(item.prevValue || 0)}</span>
                                  <span className="text-blue-400">→</span>
                                  <span className="text-sm font-bold text-slate-900">{formatNumber(item.newValue || 0)}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ml-auto ${getGradeColor(item.grade || 'D')}`}>{item.grade}</span>
                                  <span className="text-[10px] text-slate-400">{item.progressPct}%</span>
                                </div>
                              </>
                            )}

                            {/* 코멘트 */}
                            {item.content && (
                              <p className={`text-sm text-slate-700 ${item.type === 'checkin' ? 'mt-1.5 text-xs text-slate-500 italic' : 'mt-0.5 leading-relaxed'}`}>
                                {item.content}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div ref={feedEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━ 서브 ━━━
function SC({ icon: I, bg, ic, v, l, vc }: { icon: any; bg: string; ic: string; v: number; l: string; vc?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}><I className={`w-5 h-5 ${ic}`} /></div>
        <div><div className={`text-2xl font-bold ${vc || 'text-slate-900'}`}>{v}</div><div className="text-xs text-slate-500">{l}</div></div>
      </div>
    </div>
  );
}