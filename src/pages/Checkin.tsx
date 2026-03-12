// src/pages/Checkin.tsx — v4 피드 중심 체크인
import { useEffect, useState, useMemo, useRef } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor, calculateGrade, getGradeColor, formatNumber } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getMyRoleLevel, checkCanManageOrg, ROLE_LEVELS } from '../lib/permissions';
import type { DynamicKR } from '../types';
import {
  Loader2, TrendingUp, CheckCircle2, AlertCircle,
  ChevronRight, ChevronDown, Save, X, User, BarChart3,
  Target, ArrowLeft, Pencil, Clock, Send, MessageCircle,
  Hash, ThumbsUp, AtSign, AlertTriangle, Zap,
  CircleDot, Shield, Flag
} from 'lucide-react';

// ━━━ 타입 ━━━
interface CheckinLog {
  id: string; kr_id: string; quarter: string;
  previous_value: number; new_value: number; progress_pct: number;
  grade: string; comment: string; checked_by_name: string;
  is_delegated: boolean; created_at: string;
}

interface FeedItem {
  id: string;
  type: 'checkin' | 'comment' | 'status_change';
  timestamp: string;
  author: string;
  krId?: string; krName?: string;
  prevValue?: number; newValue?: number;
  grade?: string; progressPct?: number;
  content?: string;
  isDelegated?: boolean;
  tags?: string[];
  statusSignal?: 'on_track' | 'at_risk' | 'blocked' | 'achieved';
}

// 상태 신호
const STATUS_SIGNALS = {
  on_track: { label: '순항', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  at_risk: { label: '주의', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  blocked: { label: '차단', icon: X, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  achieved: { label: '달성', icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
};

// 태그 옵션
const FEED_TAGS = [
  { key: 'issue', label: '이슈', color: 'bg-red-100 text-red-700' },
  { key: 'win', label: '성과', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'request', label: '요청', color: 'bg-violet-100 text-violet-700' },
  { key: 'decision', label: '결정', color: 'bg-blue-100 text-blue-700' },
  { key: 'plan', label: '계획', color: 'bg-slate-100 text-slate-700' },
];

function getCurrentQuarter(): string {
  const m = new Date().getMonth() + 1;
  return m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
}
function pBar(p: number) { return p >= 100 ? 'bg-emerald-500' : p >= 70 ? 'bg-blue-500' : p >= 40 ? 'bg-amber-400' : 'bg-red-400'; }
function pTxt(p: number) { return p >= 100 ? 'text-emerald-600' : p >= 70 ? 'text-blue-600' : p >= 40 ? 'text-amber-600' : 'text-red-500'; }
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const days = Math.floor(h / 24);
  return days < 7 ? `${days}일 전` : new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Checkin() {
  const { user } = useAuth();
  const { organizations, objectives, krs, fetchObjectives, fetchKRs, fetchCFRs, updateKR, loading } = useStore();

  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [roleLevel, setRoleLevel] = useState(0);
  const [canManageOrg, setCanManageOrg] = useState(false);
  const [permLoading, setPermLoading] = useState(true);
  const [managableOrgs, setManagableOrgs] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [selectedObjId, setSelectedObjId] = useState<string | null>(null);

  // KR 실적 입력
  const [editingKrId, setEditingKrId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editSignal, setEditSignal] = useState<string>('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 피드
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'all' | 'checkin' | 'comment'>('all');

  // 코멘트 입력
  const [commentText, setCommentText] = useState('');
  const [commentTags, setCommentTags] = useState<string[]>([]);
  const [commentSending, setCommentSending] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // ── 권한 ──
  useEffect(() => {
    const check = async () => {
      setPermLoading(true);
      try {
        const level = await getMyRoleLevel();
        setRoleLevel(level);
        let mgbl: string[];
        if (level >= ROLE_LEVELS.COMPANY_ADMIN) mgbl = organizations.map(o => o.id);
        else {
          const r = await Promise.all(organizations.map(async o => ({ id: o.id, can: await checkCanManageOrg(o.id) })));
          mgbl = r.filter(x => x.can).map(x => x.id);
        }
        setManagableOrgs(mgbl);
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

  // ── 피드 로드 ──
  useEffect(() => {
    if (!selectedObjId) return;
    loadFeed();
  }, [selectedObjId, krs.length]);

  const loadFeed = async () => {
    if (!selectedObjId) return;
    setFeedLoading(true);
    try {
      const ids = krs.filter(k => k.objectiveId === selectedObjId).map(k => k.id);
      if (ids.length === 0) { setFeedItems([]); return; }
      const { data: logs } = await supabase.from('checkin_logs').select('*').in('kr_id', ids).order('created_at', { ascending: false }).limit(50);
      let cfrs: any[] = [];
      try { const { data } = await supabase.from('cfr_threads').select('*').in('kr_id', ids).order('created_at', { ascending: false }).limit(30); cfrs = data || []; } catch {}

      const krMap = new Map<string, string>();
      krs.filter(k => k.objectiveId === selectedObjId).forEach(k => krMap.set(k.id, k.name));

      const items: FeedItem[] = [
        ...(logs || []).map((l: any) => ({
          id: `log-${l.id}`, type: 'checkin' as const, timestamp: l.created_at,
          author: l.checked_by_name, krId: l.kr_id, krName: krMap.get(l.kr_id) || 'KR',
          prevValue: l.previous_value, newValue: l.new_value,
          grade: l.grade, progressPct: l.progress_pct, content: l.comment,
          isDelegated: l.is_delegated,
        })),
        ...cfrs.map((c: any) => ({
          id: `cfr-${c.id}`, type: 'comment' as const,
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

  const filteredFeed = feedFilter === 'all' ? feedItems : feedItems.filter(f => f.type === feedFilter);

  // ── 액션 ──
  const openObjective = (id: string) => { setSelectedObjId(id); setViewMode('detail'); setEditingKrId(null); setFeedFilter('all'); };
  const backToList = () => { setViewMode('list'); setSelectedObjId(null); };
  const startEdit = (kr: DynamicKR) => {
    setEditingKrId(kr.id); setEditSignal(''); setEditTags([]);
    setEditValue(kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals]?.toString() || '');
    setEditComment('');
  };
  const cancelEdit = () => { setEditingKrId(null); };

  const submitCheckin = async (kr: DynamicKR) => {
    if (!user) return;
    const nv = parseFloat(editValue); if (isNaN(nv)) return;
    setIsSaving(true);
    try {
      const prev = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] || 0;
      const na = { ...kr.quarterlyActuals, [selectedQuarter]: nv };
      const cum = (['Q1','Q2','Q3','Q4'] as const).map(q => na[q]).filter((v): v is number => v != null).reduce((s,v) => s+v, 0);
      const prog = kr.targetValue > 0 ? Math.round((cum / kr.targetValue) * 100) : 0;
      const grade = calculateGrade({ ...kr, currentValue: cum });

      // 코멘트에 태그/신호 포함
      const fullComment = [
        editTags.length > 0 ? editTags.map(t => `#${t}`).join(' ') : '',
        editSignal ? `[${STATUS_SIGNALS[editSignal as keyof typeof STATUS_SIGNALS]?.label || editSignal}]` : '',
        editComment,
      ].filter(Boolean).join(' ');

      const { error } = await supabase.from('key_results').update({
        quarterly_actuals: na, current_value: cum, progress_pct: prog,
        last_checkin_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', kr.id);
      if (error) throw error;

      await supabase.from('checkin_logs').insert({
        kr_id: kr.id, org_id: kr.orgId, checkin_period: `2025-${selectedQuarter}`, quarter: selectedQuarter,
        previous_value: prev || 0, new_value: nv,
        target_value: kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || kr.targetValue,
        progress_pct: prog, grade, comment: fullComment || null,
        checked_by: user.id, checked_by_name: (user as any).user_metadata?.full_name || user.email || '사용자',
        is_delegated: roleLevel < ROLE_LEVELS.ORG_LEADER,
      });

      updateKR(kr.id, { quarterlyActuals: na, currentValue: cum, progressPct: prog });

      setFeedItems(p => [{
        id: `log-new-${Date.now()}`, type: 'checkin', timestamp: new Date().toISOString(),
        author: (user as any).user_metadata?.full_name || user.email || '사용자',
        krId: kr.id, krName: kr.name, prevValue: (prev as number) || 0, newValue: nv,
        grade, progressPct: prog, content: fullComment || undefined,
        tags: editTags, statusSignal: editSignal as any,
      }, ...p]);
      cancelEdit();
    } catch (err: any) { alert(`저장 실패: ${err.message}`); }
    finally { setIsSaving(false); }
  };

  const sendComment = async () => {
    if (!commentText.trim() || !user || !selectedObjId) return;
    setCommentSending(true);
    try {
      const firstKr = selectedObjKRs[0]?.id;
      const fullText = [
        commentTags.length > 0 ? commentTags.map(t => `#${t}`).join(' ') : '',
        commentText.trim(),
      ].filter(Boolean).join(' ');

      if (firstKr) {
        await supabase.from('cfr_threads').insert({
          kr_id: firstKr, type: 'conversation', content: fullText,
          author_id: user.id, author_name: (user as any).user_metadata?.full_name || user.email || '사용자',
        }).then(({ error }) => { if (error) console.warn('cfr:', error.message); });
      }
      setFeedItems(p => [{
        id: `cmt-${Date.now()}`, type: 'comment', timestamp: new Date().toISOString(),
        author: (user as any).user_metadata?.full_name || user.email || '사용자',
        content: fullText, tags: commentTags,
      }, ...p]);
      setCommentText(''); setCommentTags([]); setShowTagPicker(false);
    } catch {}
    finally { setCommentSending(false); }
  };

  const getObjStats = (objId: string) => {
    const ok = krs.filter(k => k.objectiveId === objId);
    const t = ok.length; const c = ok.filter(kr => kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] != null).length;
    return { total: t, checkedIn: c, avg: t > 0 ? Math.round(ok.reduce((s,k)=>s+(k.progressPct||0),0)/t) : 0 };
  };

  const toggleTag = (tag: string, current: string[], setter: (v: string[]) => void) => {
    setter(current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]);
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
            {viewMode === 'list' && <p className="text-slate-500 text-sm mt-0.5">실적을 점검하고 팀과 소통합니다.</p>}
          </div>
        </div>
        <div className="flex gap-3">
          <select value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)} className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium outline-none">
            {selectableOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={selectedQuarter} onChange={e => setSelectedQuarter(e.target.value)} className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium outline-none">
            {['Q1','Q2','Q3','Q4'].map(q => <option key={q} value={q}>{q}</option>)}
          </select>
        </div>
      </div>

      {/* 요약 */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SC icon={Target} bg="bg-blue-50" ic="text-blue-600" v={summary.total} l="전체 KR" />
          <SC icon={CheckCircle2} bg="bg-emerald-50" ic="text-emerald-600" v={summary.checkedIn} l="입력 완료" vc="text-emerald-700" />
          <SC icon={AlertCircle} bg="bg-orange-50" ic="text-orange-500" v={summary.total - summary.checkedIn} l="미입력" vc="text-orange-600" />
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center"><BarChart3 className="w-5 h-5 text-indigo-600" /></div><div><div className="text-2xl font-bold text-indigo-700">{summary.rate}%</div><div className="text-xs text-slate-500">체크인율</div></div></div>
            <div className="h-1.5 bg-slate-100 rounded-full"><div className="bg-indigo-500 h-1.5 rounded-full" style={{width:`${summary.rate}%`}} /></div>
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>}
      {!loading && orgObjectives.length === 0 && <div className="text-center py-20 bg-slate-50 rounded-xl border"><Target className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">목표가 없습니다.</p></div>}

      {/* ━━ 리스트 ━━ */}
      {!loading && viewMode === 'list' && orgObjectives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orgObjectives.map(obj => {
            const s = getObjStats(obj.id); const bii = getBIIColor(obj.biiType);
            const done = s.total > 0 && s.checkedIn === s.total;
            return (
              <div key={obj.id} onClick={() => openObjective(obj.id)} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all group">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${bii.bg} ${bii.text}`}>{obj.biiType}</span>
                    {done ? <span className="text-[11px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>완료</span>
                      : s.checkedIn > 0 ? <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">{s.checkedIn}/{s.total}</span>
                      : s.total > 0 && <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">미시작</span>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 shrink-0" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 line-clamp-2">{obj.name}</h3>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2"><span>KR {s.total}개</span><span className={`font-bold ${pTxt(s.avg)}`}>{s.avg}%</span></div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pBar(s.avg)}`} style={{width:`${Math.min(100,s.avg)}%`}} /></div>
              </div>
            );
          })}
        </div>
      )}

      {/* ━━ 상세: 2/5 좌 + 3/5 우 (피드 중심) ━━ */}
      {!loading && viewMode === 'detail' && selectedObj && (
        <div className="grid grid-cols-5 gap-6">
          {/* ═══ 왼쪽 (2/5) — 컴팩트 진행 현황 ═══ */}
          <div className="col-span-2 space-y-4">
            {/* 목표 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${getBIIColor(selectedObj.biiType).bg} ${getBIIColor(selectedObj.biiType).text}`}>{selectedObj.biiType}</span>
                <span className="text-[11px] text-slate-400">{selectedObjKRs.length} KRs · {selectedQuarter}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug mb-3">{selectedObj.name}</h2>
              {/* 게이지 */}
              {(() => {
                const avg = selectedObjKRs.length > 0 ? Math.round(selectedObjKRs.reduce((s,k)=>s+(k.progressPct||0),0)/selectedObjKRs.length) : 0;
                const ck = selectedObjKRs.filter(k => k.quarterlyActuals?.[selectedQuarter as keyof typeof k.quarterlyActuals] != null).length;
                return (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-end justify-between mb-1">
                      <span className={`text-2xl font-black ${pTxt(avg)}`}>{avg}<span className="text-sm font-medium">%</span></span>
                      <span className="text-[11px] text-slate-400">{ck}/{selectedObjKRs.length} 입력</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full"><div className={`h-full rounded-full ${pBar(avg)}`} style={{width:`${Math.min(100,avg)}%`}} /></div>
                  </div>
                );
              })()}
            </div>

            {/* KR 리스트 — 컴팩트 */}
            <div className="space-y-2">
              {selectedObjKRs.map(kr => {
                const g = calculateGrade(kr);
                const isEd = editingKrId === kr.id;
                const qA = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals];
                const qT = kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || 0;
                const done = qA != null;

                const pv = isEd ? (parseFloat(editValue) || 0) : 0;
                const pa = isEd ? { ...kr.quarterlyActuals, [selectedQuarter]: pv } : kr.quarterlyActuals;
                const cum = isEd ? (['Q1','Q2','Q3','Q4'] as const).map(q => pa?.[q]).filter((v): v is number => v != null).reduce((s,v)=>s+v,0) : kr.currentValue;
                const prog = isEd && kr.targetValue > 0 ? Math.round((cum/kr.targetValue)*100) : kr.progressPct;
                const pg = isEd ? calculateGrade({...kr, currentValue: cum}) : g;

                return (
                  <div key={kr.id} className={`bg-white rounded-xl border ${isEd ? 'border-blue-400 ring-2 ring-blue-100 shadow-lg' : 'border-slate-200'} transition-all`}>
                    {/* KR 요약 행 */}
                    <div className="p-4 flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${getGradeColor(isEd ? pg : g)}`}>{isEd ? pg : g}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-slate-900 truncate">{kr.name}</div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{formatNumber(isEd ? cum : kr.currentValue)}/{formatNumber(kr.targetValue)} {kr.unit}</span>
                          <span>·</span>
                          <span className={`font-bold ${pTxt(isEd ? prog : kr.progressPct)}`}>{isEd ? prog : kr.progressPct}%</span>
                          {done && !isEd && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        </div>
                      </div>
                      {!isEd && canCheckin && (
                        <button onClick={() => startEdit(kr)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 ${done ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                          {done ? '수정' : '입력'}
                        </button>
                      )}
                    </div>

                    {/* 인라인 입력 */}
                    {isEd && (
                      <div className="border-t border-blue-200 bg-gradient-to-b from-blue-50/60 to-white p-4 space-y-3">
                        {/* 실적 */}
                        <div className="flex items-center gap-2">
                          <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                            placeholder={`${selectedQuarter} 실적 (목표: ${formatNumber(qT)})`}
                            className="flex-1 border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus />
                          <span className="text-xs text-slate-400 shrink-0">{kr.unit}</span>
                        </div>
                        {/* 상태 신호 */}
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 mb-1.5">상태 신호</div>
                          <div className="flex gap-1.5">
                            {Object.entries(STATUS_SIGNALS).map(([key, sig]) => {
                              const Icon = sig.icon;
                              const active = editSignal === key;
                              return (
                                <button key={key} onClick={() => setEditSignal(active ? '' : key)}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${active ? `${sig.bg} ${sig.color} ${sig.border} border` : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent'}`}>
                                  <Icon className="w-3 h-3" />{sig.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* 메모 */}
                        <textarea value={editComment} onChange={e => setEditComment(e.target.value)}
                          placeholder="이슈, 원인분석, 다음 계획 등을 기록하세요..."
                          rows={3}
                          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                        {/* 태그 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {FEED_TAGS.map(t => (
                            <button key={t.key} onClick={() => toggleTag(t.key, editTags, setEditTags)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${editTags.includes(t.key) ? t.color : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                              #{t.label}
                            </button>
                          ))}
                        </div>
                        {/* 버튼 */}
                        <div className="flex gap-2 pt-1">
                          <button onClick={cancelEdit} className="flex-1 py-2 border border-slate-300 text-slate-600 rounded-xl text-sm">취소</button>
                          <button onClick={() => submitCheckin(kr)} disabled={isSaving || !editValue}
                            className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                            <Save className="w-3.5 h-3.5" />{isSaving ? '저장 중...' : '체크인'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ═══ 오른쪽 (3/5) — 피드 중심 ═══ */}
          <div className="col-span-3">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden sticky top-6">
              {/* 헤더 */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><MessageCircle className="w-4 h-4 text-blue-500" /> 활동 피드</h3>
                <div className="flex gap-1">
                  {(['all','checkin','comment'] as const).map(f => (
                    <button key={f} onClick={() => setFeedFilter(f)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${feedFilter === f ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:bg-slate-50'}`}>
                      {f === 'all' ? '전체' : f === 'checkin' ? '체크인' : '코멘트'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 코멘트 입력 */}
              <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/50">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <textarea ref={commentRef} value={commentText} onChange={e => setCommentText(e.target.value)}
                      placeholder="의견, 피드백, 요청사항을 남겨보세요... (@로 멘션)"
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white"
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && commentText.trim()) { e.preventDefault(); sendComment(); }}} />
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {FEED_TAGS.map(t => (
                          <button key={t.key} onClick={() => toggleTag(t.key, commentTags, setCommentTags)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${commentTags.includes(t.key) ? t.color : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                            #{t.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={sendComment} disabled={!commentText.trim() || commentSending}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1">
                        <Send className="w-3 h-3" /> 전송
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 피드 목록 */}
              <div className="max-h-[600px] overflow-y-auto">
                {feedLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>}

                {!feedLoading && filteredFeed.length === 0 && (
                  <div className="text-center py-12 px-5">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">아직 활동이 없습니다.</p>
                    <p className="text-xs text-slate-300 mt-1">실적을 입력하거나 코멘트를 남겨보세요.</p>
                  </div>
                )}

                {!feedLoading && filteredFeed.length > 0 && (
                  <div className="divide-y divide-slate-50">
                    {filteredFeed.map(item => (
                      <div key={item.id} className="px-5 py-4 hover:bg-slate-50/30 transition-colors">
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            item.type === 'checkin' ? 'bg-blue-100' : 'bg-slate-100'
                          }`}>
                            {item.type === 'checkin' ? <TrendingUp className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-slate-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-slate-900">{item.author}</span>
                              {item.type === 'checkin' && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">체크인</span>}
                              {item.isDelegated && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded">위임</span>}
                              <span className="text-[10px] text-slate-400 ml-auto">{timeAgo(item.timestamp)}</span>
                            </div>

                            {/* 체크인 카드 */}
                            {item.type === 'checkin' && (
                              <div className="bg-slate-50 rounded-xl p-3 mb-1.5">
                                <div className="text-xs text-slate-500 mb-1.5 truncate">{item.krName}</div>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm text-slate-400">{formatNumber(item.prevValue || 0)}</span>
                                    <span className="text-blue-400">→</span>
                                    <span className="text-sm font-bold text-slate-900">{formatNumber(item.newValue || 0)}</span>
                                  </div>
                                  <div className="ml-auto flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getGradeColor(item.grade || 'D')}`}>{item.grade}</span>
                                    <span className={`text-xs font-semibold ${pTxt(item.progressPct || 0)}`}>{item.progressPct}%</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 내용/메모 */}
                            {item.content && (
                              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                            )}

                            {/* 태그 */}
                            {item.tags && item.tags.length > 0 && (
                              <div className="flex gap-1 mt-1.5">
                                {item.tags.map(t => {
                                  const tag = FEED_TAGS.find(ft => ft.key === t);
                                  return tag && <span key={t} className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${tag.color}`}>#{tag.label}</span>;
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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

function SC({ icon: I, bg, ic, v, l, vc }: { icon: any; bg: string; ic: string; v: number; l: string; vc?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3"><div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}><I className={`w-5 h-5 ${ic}`} /></div><div><div className={`text-2xl font-bold ${vc||'text-slate-900'}`}>{v}</div><div className="text-xs text-slate-500">{l}</div></div></div>
    </div>
  );
}