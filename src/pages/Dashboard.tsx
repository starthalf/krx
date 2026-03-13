// src/pages/Dashboard.tsx — CEO 대시보드 고도화 + 조직장 뷰 유지
import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getBIIColor, calculateGrade, getGradeColor, formatNumber } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import {
  TrendingUp, Target, CheckSquare, AlertTriangle, Bot,
  Calendar, ArrowUpRight, Trophy, AlertCircle, Activity,
  Shield, Crown, User, MessageSquare, Clock, ChevronDown,
  ChevronRight, Building2, ArrowDown, ArrowUp
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import { getMyRoleLevel, checkCanManageOrg, ROLE_LEVELS } from '../lib/permissions';
import PeriodStatusWidget from '../components/PeriodStatusWidget';

// ━━━ 타입 ━━━
interface CheckinStatRow { org_id: string; org_name: string; total_krs: number; checked_in_krs: number; checkin_rate: number; last_checkin_at: string | null; }
interface ActivityRow { activity_type: string; actor_name: string; description: string; entity_name: string; org_name: string; created_at: string; }
interface Insight { type: 'warning' | 'alert' | 'success'; icon: typeof AlertCircle; text: string; }

// Top/Bottom KR용
interface RankedKR { id: string; name: string; orgId: string; orgName: string; progressPct: number; grade: string; targetValue: number; currentValue: number; unit: string; }

export default function Dashboard() {
  const navigate = useNavigate();
  const { organizations, objectives, krs, dashboardStats, fetchObjectives, fetchKRs, fetchDashboardStats, loading } = useStore();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [roleLevel, setRoleLevel] = useState<number>(0);
  const [managableOrgs, setManagableOrgs] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [checkinStats, setCheckinStats] = useState<CheckinStatRow[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityRow[]>([]);
  const [objApprovalCounts, setObjApprovalCounts] = useState<{ approved: number; draft: number; bii: { Build: number; Innovate: number; Improve: number } }>({ approved: 0, draft: 0, bii: { Build: 0, Innovate: 0, Improve: 0 } });

  // CEO 전용
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [allCompanyKRs, setAllCompanyKRs] = useState<RankedKR[]>([]);

  const orgIds = organizations.map(o => o.id).join(',');
  const permCheckVersionRef = useRef(0);

  // ── 1. 권한 ──
  useEffect(() => {
    if (organizations.length === 0) { setPermissionsLoading(false); return; }
    const v = ++permCheckVersionRef.current;
    const check = async () => {
      setPermissionsLoading(true);
      const level = await getMyRoleLevel();
      if (v !== permCheckVersionRef.current) return;
      setRoleLevel(level);
      let mgbl: string[];
      if (level >= ROLE_LEVELS.COMPANY_ADMIN) mgbl = organizations.map(o => o.id);
      else {
        const r = await Promise.all(organizations.map(async o => ({ id: o.id, can: await checkCanManageOrg(o.id) })));
        mgbl = r.filter(x => x.can).map(x => x.id);
      }
      if (v !== permCheckVersionRef.current) return;
      setManagableOrgs(prev => prev.join(',') === mgbl.join(',') ? prev : mgbl);
      setPermissionsLoading(false);
    };
    check();
  }, [orgIds]);

  const managableOrgsKey = managableOrgs.join(',');

  // ── 2a. 초기 조직 ──
  useEffect(() => {
    if (organizations.length === 0 || permissionsLoading || roleLevel === 0) return;
    const cur = organizations.find(o => o.id === selectedOrgId);
    const needsReselect = !selectedOrgId || (roleLevel < ROLE_LEVELS.COMPANY_ADMIN && cur?.level === '전사');
    if (!needsReselect) return;
    let def;
    if (roleLevel >= ROLE_LEVELS.COMPANY_ADMIN) def = organizations.find(o => !o.parentOrgId) || organizations[0];
    else if (managableOrgs.length > 0) def = organizations.find(o => managableOrgs.includes(o.id) && o.level !== '전사');
    if (!def) def = organizations.find(o => o.level !== '전사') || organizations[0];
    if (def && def.id !== selectedOrgId) setSelectedOrgId(def.id);
  }, [orgIds, managableOrgsKey, permissionsLoading, roleLevel]);

  // ── 2b. 통계 ──
  useEffect(() => {
    if (organizations.length > 0 && !permissionsLoading && roleLevel > 0) {
      const cid = organizations[0]?.companyId;
      if (cid) { fetchDashboardStats(cid); loadCheckinStats(cid); loadRecentActivities(cid); }
    }
  }, [orgIds, permissionsLoading, roleLevel]);

  // ── 3. 선택 조직 데이터 ──
  useEffect(() => {
    if (selectedOrgId) { fetchObjectives(selectedOrgId); fetchKRs(selectedOrgId); loadObjApprovalCounts(selectedOrgId); }
  }, [selectedOrgId]);

  // ── CEO: 전사 KR 로딩 (Top/Bottom용) ──
  const isCEO = roleLevel >= ROLE_LEVELS.COMPANY_ADMIN;
  useEffect(() => {
    if (!isCEO || organizations.length === 0) return;
    loadAllCompanyKRs();
  }, [isCEO, orgIds]);

  const loadAllCompanyKRs = async () => {
    try {
      const cid = organizations[0]?.companyId;
      if (!cid) return;

      // ★ 자사 조직 ID 목록으로 필터링
      const myOrgIds = organizations.map(o => o.id);
      const { data } = await supabase
        .from('key_results')
        .select('id, name, org_id, progress_pct, target_value, current_value, unit, grade_criteria, objective_id')
        .eq('is_latest', true)
        .in('org_id', myOrgIds)
        .limit(500);

      if (!data) return;

      const orgMap = new Map(organizations.map(o => [o.id, o.name]));
      const ranked: RankedKR[] = data
        .filter(kr => kr.current_value > 0 && orgMap.has(kr.org_id)) // 실적 있고 자사 조직만
        .map(kr => ({
          id: kr.id,
          name: kr.name,
          orgId: kr.org_id,
          orgName: orgMap.get(kr.org_id) || '',
          progressPct: kr.progress_pct || 0,
          grade: '',
          targetValue: kr.target_value,
          currentValue: kr.current_value,
          unit: kr.unit || '%',
        }));

      ranked.forEach(kr => {
        const pct = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
        if (pct >= 120) kr.grade = 'S';
        else if (pct >= 110) kr.grade = 'A';
        else if (pct >= 100) kr.grade = 'B';
        else if (pct >= 90) kr.grade = 'C';
        else kr.grade = 'D';
      });

      setAllCompanyKRs(ranked);
    } catch (e) { console.warn('loadAllCompanyKRs:', e); }
  };

  const loadObjApprovalCounts = async (orgId: string) => {
    try {
      const { count: ac } = await supabase.from('objectives').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_latest', true).in('approval_status', ['finalized','approved','ceo_approved','manager_approved']);
      const { count: dc } = await supabase.from('objectives').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_latest', true).in('approval_status', ['draft','ai_draft','submitted','under_review','revision_requested']);
      const { data: ao } = await supabase.from('objectives').select('bii_type').eq('org_id', orgId).eq('is_latest', true).in('approval_status', ['finalized','approved','ceo_approved','manager_approved']);
      const bii = { Build: 0, Innovate: 0, Improve: 0 };
      (ao || []).forEach((o: any) => { if (o.bii_type in bii) bii[o.bii_type as keyof typeof bii]++; });
      setObjApprovalCounts({ approved: ac || 0, draft: dc || 0, bii });
    } catch {}
  };

  const loadCheckinStats = async (cid: string) => { try { const { data } = await supabase.rpc('get_checkin_stats', { target_company_id: cid }); if (data) setCheckinStats(data); } catch {} };
  const loadRecentActivities = async (cid: string) => { try { const { data } = await supabase.rpc('get_recent_activities', { target_company_id: cid, limit_count: 8 }); if (data) setRecentActivities(data); } catch {} };

  // ── 범위 ──
  const scopeOrgIds = useMemo(() => {
    if (roleLevel >= ROLE_LEVELS.COMPANY_ADMIN) return new Set(organizations.map(o => o.id));
    const r = new Set<string>();
    const add = (pid: string) => { r.add(pid); organizations.filter(o => o.parentOrgId === pid).forEach(c => add(c.id)); };
    if (selectedOrgId) add(selectedOrgId);
    return r;
  }, [selectedOrgId, roleLevel, orgIds]);

  // ── 집계 ──
  const currentOrg = organizations.find(o => o.id === selectedOrgId);
  const allKRs = (krs || []).filter(kr => kr.orgId === selectedOrgId);
  const totalProgress = allKRs.length > 0 ? Math.round(allKRs.reduce((s, kr) => s + (kr.progressPct || 0), 0) / allKRs.length) : 0;
  const approvedObjectiveCount = objApprovalCounts.approved;
  const draftObjectiveCount = objApprovalCounts.draft;
  const biiStats = objApprovalCounts.bii;

  const gradeDistribution = { S: allKRs.filter(kr => calculateGrade(kr) === 'S').length, A: allKRs.filter(kr => calculateGrade(kr) === 'A').length, B: allKRs.filter(kr => calculateGrade(kr) === 'B').length, C: allKRs.filter(kr => calculateGrade(kr) === 'C').length, D: allKRs.filter(kr => calculateGrade(kr) === 'D').length };
  const gradeTotal = Object.values(gradeDistribution).reduce((s,v)=>s+v, 0);
  const gradeChartData = [
    { name: 'S', value: gradeDistribution.S, color: '#3B82F6' }, { name: 'A', value: gradeDistribution.A, color: '#10B981' },
    { name: 'B', value: gradeDistribution.B, color: '#84CC16' }, { name: 'C', value: gradeDistribution.C, color: '#F59E0B' }, { name: 'D', value: gradeDistribution.D, color: '#EF4444' },
  ];

  const warningKRs = allKRs.filter(kr => { const g = calculateGrade(kr); return (g === 'C' || g === 'D') && kr.currentValue > 0; });

  const scopedCheckinStats = useMemo(() => checkinStats.filter(s => scopeOrgIds.has(s.org_id)), [checkinStats, scopeOrgIds]);
  const checkinRate = useMemo(() => {
    if (scopedCheckinStats.length > 0) { const t = scopedCheckinStats.reduce((s,r)=>s+(r.total_krs||0),0); const c = scopedCheckinStats.reduce((s,r)=>s+(r.checked_in_krs||0),0); return t > 0 ? Math.round((c/t)*100) : 0; }
    return allKRs.length > 0 ? Math.round((allKRs.filter(kr => kr.currentValue > 0).length / allKRs.length) * 100) : 0;
  }, [scopedCheckinStats, allKRs]);
  const checkinSummaryText = useMemo(() => {
    if (scopedCheckinStats.length > 0) { const c = scopedCheckinStats.filter(s => s.checkin_rate >= 100).length; return `${scopedCheckinStats.length}개 조직 중 ${c}개 완료`; }
    return `${allKRs.length}개 KR 중 ${allKRs.filter(kr => kr.currentValue > 0).length}개 입력`;
  }, [scopedCheckinStats, allKRs]);

  // ── 조직별 성과 ──
  const orgProgressList = useMemo(() => {
    return (dashboardStats || []).filter((o: any) => scopeOrgIds.has(o.org_id)).map((o: any) => {
      const tc = Number(o.kr_count) || 0;
      const s = Number(o.grade_s_count ?? o.grade_s) || 0, a = Number(o.grade_a_count ?? o.grade_a) || 0;
      const b = Number(o.grade_b_count ?? o.grade_b) || 0, c = Number(o.grade_c_count ?? o.grade_c) || 0;
      const d = Number(o.grade_d_count ?? o.grade_d) || 0;
      const ws = tc === 0 ? 0 : Math.round(((s*120)+(a*110)+(b*100)+(c*80)+(d*50))/tc);
      const allD = tc > 0 && d === tc;
      let st = { label: '순항', color: 'text-emerald-600', bg: 'bg-emerald-50' };
      if (tc === 0) st = { label: '수립 전', color: 'text-slate-400', bg: 'bg-slate-50' };
      else if (allD) st = { label: '체크인 전', color: 'text-slate-500', bg: 'bg-slate-100' };
      else if (ws >= 110) st = { label: '탁월', color: 'text-blue-600', bg: 'bg-blue-50' };
      else if (ws >= 90) st = { label: '순항', color: 'text-emerald-600', bg: 'bg-emerald-50' };
      else if (ws >= 70) st = { label: '주의', color: 'text-amber-600', bg: 'bg-amber-50' };
      else st = { label: '위험', color: 'text-red-600', bg: 'bg-red-50' };
      return { name: o.org_name || o.name || '', orgId: o.org_id, score: ws, status: st, S: s, A: a, B: b, C: c, D: d, total: tc, level: o.org_level || '' };
    }).sort((a: any, b: any) => b.score - a.score);
  }, [dashboardStats, scopeOrgIds]);

  // ── CEO 전용 데이터 ──
  const companyOrg = organizations.find(o => !o.parentOrgId);
  const topLevelOrgs = useMemo(() => {
    if (!companyOrg) return [];
    return organizations.filter(o => o.parentOrgId === companyOrg.id).sort((a,b) => (a.sortOrder||0)-(b.sortOrder||0));
  }, [organizations, companyOrg]);

  const getOrgStat = (orgId: string) => orgProgressList.find((o: any) => o.orgId === orgId);
  const getChildOrgs = (parentId: string) => organizations.filter(o => o.parentOrgId === parentId);
  const getChildStats = (parentId: string) => {
    const children = getChildOrgs(parentId);
    return children.map(c => ({ org: c, stat: getOrgStat(c.id) })).filter(x => x.stat);
  };

  // Top/Bottom KR
  const topKRs = useMemo(() => [...allCompanyKRs].sort((a,b) => b.progressPct - a.progressPct).slice(0, 5), [allCompanyKRs]);
  const bottomKRs = useMemo(() => [...allCompanyKRs].sort((a,b) => a.progressPct - b.progressPct).slice(0, 5), [allCompanyKRs]);

  // 조직 상태 분포 (CEO)
  const statusDist = useMemo(() => {
    const d = { excellent: 0, onTrack: 0, atRisk: 0, danger: 0, notStarted: 0 };
    orgProgressList.forEach((o: any) => {
      if (o.status.label === '탁월') d.excellent++;
      else if (o.status.label === '순항') d.onTrack++;
      else if (o.status.label === '주의') d.atRisk++;
      else if (o.status.label === '위험') d.danger++;
      else d.notStarted++;
    });
    return d;
  }, [orgProgressList]);

  // ── 인사이트 ──
  const insights = useMemo<Insight[]>(() => {
    const r: Insight[] = [];
    if (warningKRs.length > 0) r.push({ type: 'warning', icon: AlertCircle, text: `${warningKRs.length}개 KR이 C/D 등급으로 집중 관리가 필요합니다.` });
    const delayed = scopedCheckinStats.filter(s => s.total_krs > 0 && s.checkin_rate < 50);
    if (delayed.length > 0) { const n = delayed.slice(0,3).map(o => o.org_name).join(', '); r.push({ type: 'alert', icon: Clock, text: `${n}${delayed.length>3?` 외 ${delayed.length-3}개`:''} 조직 체크인율 50% 미만.` }); }
    const top = orgProgressList.filter((o: any) => o.score >= 110);
    if (top.length > 0) r.push({ type: 'success', icon: Trophy, text: `${top[0].name}이(가) 탁월한 성과를 보이고 있습니다.` });
    if (draftObjectiveCount > 0 && approvedObjectiveCount === 0) r.push({ type: 'alert', icon: Target, text: `${draftObjectiveCount}개 목표가 수립 중입니다.` });
    if (r.length === 0) r.push({ type: 'success', icon: Target, text: 'OKR 데이터가 축적되면 AI 인사이트가 생성됩니다.' });
    return r;
  }, [warningKRs, scopedCheckinStats, orgProgressList, draftObjectiveCount, approvedObjectiveCount]);

  const feed = useMemo(() => recentActivities.map((a,i) => ({
    id: i, user: a.actor_name || '시스템',
    message: a.activity_type === 'checkin' ? `${a.description} 실적 입력 (${a.entity_name})` : `${a.entity_name}에 ${a.activity_type} 작성`,
    org: a.org_name, timestamp: formatRelativeTime(a.created_at),
  })), [recentActivities]);

  const selectableOrgs = isCEO ? organizations : organizations.filter(o => managableOrgs.includes(o.id) && o.level !== '전사');
  const toggleOrg = (id: string) => setExpandedOrgs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (permissionsLoading || roleLevel === 0) return (
    <div className="flex items-center justify-center h-screen"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" /><p className="text-slate-600">권한 확인 중...</p></div></div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CEO / 관리자 대시보드
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (isCEO) return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">전사 대시보드</h1>
            {roleLevel >= 90 && <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1"><Crown className="w-3 h-3" /> CEO</span>}
            {roleLevel >= 80 && roleLevel < 90 && <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full flex items-center gap-1"><Shield className="w-3 h-3" /> 관리자</span>}
          </div>
          <p className="text-slate-500 mt-1">{companyOrg?.name || '전사'} · {new Date().toLocaleDateString('ko-KR', { year:'numeric', month:'long' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodStatusWidget variant="compact" showManageLink={true} />
        </div>
      </div>

      {/* ── 상단: 전사 핵심 지표 4개 ── */}
      <div className="grid grid-cols-4 gap-4">
        {/* 전사 달성률 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">전사 달성률</span>
            <div className="p-1.5 bg-blue-50 rounded-lg"><TrendingUp className="w-4 h-4 text-blue-600" /></div>
          </div>
          <div className={`text-4xl font-black ${totalProgress >= 80 ? 'text-emerald-600' : totalProgress >= 50 ? 'text-blue-600' : totalProgress > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
            {totalProgress > 0 ? totalProgress : '—'}<span className="text-xl">%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full mt-3"><div className={`h-full rounded-full ${totalProgress >= 80 ? 'bg-emerald-500' : totalProgress >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`} style={{width:`${Math.min(100,totalProgress)}%`}} /></div>
          <p className="text-[11px] text-slate-400 mt-2">{allKRs.length}개 KR 기준</p>
        </div>

        {/* 활성 목표 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">활성 목표</span>
            <div className="p-1.5 bg-purple-50 rounded-lg"><Target className="w-4 h-4 text-purple-600" /></div>
          </div>
          <div className="text-4xl font-black text-slate-900">{approvedObjectiveCount}</div>
          {draftObjectiveCount > 0 && <p className="text-[11px] text-orange-600 mt-1">+ 수립 중 {draftObjectiveCount}개</p>}
          <div className="flex gap-1.5 mt-2">{Object.entries(biiStats).filter(([_,c])=>c>0).map(([k,c])=><span key={k} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getBIIColor(k as any).bg} ${getBIIColor(k as any).text}`}>{k} {c}</span>)}</div>
        </div>

        {/* 조직 상태 분포 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">조직 상태</span>
            <div className="p-1.5 bg-slate-50 rounded-lg"><Building2 className="w-4 h-4 text-slate-600" /></div>
          </div>
          <div className="space-y-1.5">
            {[
              { l: '탁월', c: statusDist.excellent, bg: 'bg-blue-500', tc: 'text-blue-700' },
              { l: '순항', c: statusDist.onTrack, bg: 'bg-emerald-500', tc: 'text-emerald-700' },
              { l: '주의', c: statusDist.atRisk, bg: 'bg-amber-400', tc: 'text-amber-700' },
              { l: '위험', c: statusDist.danger, bg: 'bg-red-500', tc: 'text-red-700' },
            ].map(x => (
              <div key={x.l} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${x.bg}`} />
                <span className="text-[11px] text-slate-500 w-7">{x.l}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full"><div className={`h-full ${x.bg} rounded-full`} style={{width: orgProgressList.length > 0 ? `${(x.c/orgProgressList.length)*100}%` : '0%'}} /></div>
                <span className={`text-xs font-bold ${x.tc} w-5 text-right`}>{x.c}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 주의 필요 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">주의 필요</span>
            <div className="p-1.5 bg-orange-50 rounded-lg"><AlertTriangle className="w-4 h-4 text-orange-600" /></div>
          </div>
          <div className="text-4xl font-black text-slate-900">{warningKRs.length}<span className="text-xl font-bold text-slate-400">건</span></div>
          <div className="mt-2 space-y-1">
            {warningKRs.slice(0,2).map(kr => (
              <div key={kr.id} className="flex items-center gap-1.5 text-[11px] text-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" /><span className="truncate">{kr.name}</span></div>
            ))}
            {warningKRs.length === 0 && <p className="text-[11px] text-slate-400">{approvedObjectiveCount === 0 ? 'OKR 수립 후 표시됩니다.' : '정상 궤도입니다.'}</p>}
          </div>
        </div>
      </div>

      {/* ── 조직별 성과 현황 (아코디언) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Building2 className="w-5 h-5 text-slate-400" /> 조직별 성과 현황</h2>
          <div className="flex items-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />S</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />A</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-lime-500" />B</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />C</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />D</span>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {topLevelOrgs.map(topOrg => {
            const stat = getOrgStat(topOrg.id);
            const children = getChildStats(topOrg.id);
            const isExp = expandedOrgs.has(topOrg.id);
            const hasKids = children.length > 0;
            return (
              <div key={topOrg.id}>
                <div className={`px-6 py-3.5 flex items-center gap-4 ${hasKids ? 'cursor-pointer hover:bg-slate-50' : ''} ${isExp ? 'bg-slate-50/50' : ''}`} onClick={() => hasKids && toggleOrg(topOrg.id)}>
                  <div className="w-5 shrink-0">{hasKids ? (isExp ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />) : <div className="w-4" />}</div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{topOrg.name}</span>
                    {stat && <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${stat.status.bg} ${stat.status.color}`}>{stat.status.label}</span>}
                    {hasKids && <span className="text-[10px] text-slate-400">하위 {children.length}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {stat && stat.total > 0 && stat.status.label !== '체크인 전' && stat.status.label !== '수립 전' ? (
                      <>
                        <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden flex">
                          {['S','A','B','C','D'].map(g => {
                            const v = stat[g as keyof typeof stat] as number;
                            return v > 0 ? <div key={g} className={`h-full ${g==='S'?'bg-blue-500':g==='A'?'bg-emerald-500':g==='B'?'bg-lime-500':g==='C'?'bg-amber-400':'bg-red-400'}`} style={{width:`${(v/stat.total)*100}%`}} /> : null;
                          })}
                        </div>
                        <span className="text-sm font-bold text-slate-700 w-10 text-right">{stat.score}점</span>
                      </>
                    ) : <span className="text-[11px] text-slate-400 w-38 text-right">{stat?.total || 0} KR</span>}
                    <span className="text-[10px] text-slate-400 w-10 text-right">{stat?.total || 0} KR</span>
                  </div>
                </div>
                {isExp && hasKids && (
                  <div className="bg-slate-50/50 border-t border-slate-100">
                    {children.map(({ org: child, stat: cs }) => (
                      <div key={child.id} className="px-6 py-2.5 flex items-center gap-4 ml-9 border-b border-slate-50 last:border-0">
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="text-[13px] text-slate-700">{child.name}</span>
                          {cs && <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${cs.status.bg} ${cs.status.color}`}>{cs.status.label}</span>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {cs && cs.total > 0 && cs.status.label !== '체크인 전' && cs.status.label !== '수립 전' ? (
                            <>
                              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                                {['S','A','B','C','D'].map(g => { const v = cs[g as keyof typeof cs] as number; return v > 0 ? <div key={g} className={`h-full ${g==='S'?'bg-blue-500':g==='A'?'bg-emerald-500':g==='B'?'bg-lime-500':g==='C'?'bg-amber-400':'bg-red-400'}`} style={{width:`${(v/cs.total)*100}%`}} /> : null; })}
                              </div>
                              <span className="text-xs font-bold text-slate-600 w-8 text-right">{cs.score}</span>
                            </>
                          ) : <span className="text-[10px] text-slate-400 w-28 text-right">{cs?.total || 0} KR</span>}
                          <span className="text-[10px] text-slate-400 w-8 text-right">{cs?.total || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Top / Bottom KR + 등급 분포 ── */}
      <div className="grid grid-cols-3 gap-6">
        {/* Top 성과 KR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4"><ArrowUp className="w-4 h-4 text-emerald-500" /> 높은 달성률 KR</h3>
          {topKRs.length > 0 ? (
            <div className="space-y-2.5">
              {topKRs.map((kr, i) => (
                <div key={kr.id} onClick={() => navigate('/okr', { state: { orgId: kr.orgId } })} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                  <span className="text-[11px] font-bold text-slate-400 w-4 shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-slate-900 truncate">{kr.name}</div>
                    <div className="text-[10px] text-blue-500">{kr.orgName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-bold ${kr.progressPct >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{kr.progressPct}%</span>
                    <span className={`ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold ${getGradeColor(kr.grade)}`}>{kr.grade}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 py-4 text-center">실적 입력 후 표시됩니다.</p>}
        </div>

        {/* Bottom 성과 KR */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4"><ArrowDown className="w-4 h-4 text-red-500" /> 낮은 달성률 KR</h3>
          {bottomKRs.length > 0 ? (
            <div className="space-y-2.5">
              {bottomKRs.map((kr, i) => (
                <div key={kr.id} onClick={() => navigate('/okr', { state: { orgId: kr.orgId } })} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
                  <span className="text-[11px] font-bold text-slate-400 w-4 shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-slate-900 truncate">{kr.name}</div>
                    <div className="text-[10px] text-blue-500">{kr.orgName}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-sm font-bold ${kr.progressPct < 50 ? 'text-red-600' : 'text-amber-600'}`}>{kr.progressPct}%</span>
                    <span className={`ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold ${getGradeColor(kr.grade)}`}>{kr.grade}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-slate-400 py-4 text-center">실적 입력 후 표시됩니다.</p>}
        </div>

        {/* 등급 분포 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">전사 등급 분포</h3>
          {gradeTotal > 0 ? (
            <>
              <div className="h-6 bg-slate-100 rounded-lg overflow-hidden flex mb-3">
                {gradeChartData.filter(g => g.value > 0).map(g => (
                  <div key={g.name} className="h-full flex items-center justify-center text-[10px] font-bold text-white" style={{width:`${(g.value/gradeTotal)*100}%`, backgroundColor: g.color}}>{g.value > 1 ? g.name : ''}</div>
                ))}
              </div>
              <div className="space-y-1.5">
                {gradeChartData.map(g => (
                  <div key={g.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{backgroundColor: g.color}} />
                    <span className="text-xs text-slate-600 w-8">{g.name}등급</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full"><div className="h-full rounded-full" style={{width:`${gradeTotal > 0 ? (g.value/gradeTotal)*100 : 0}%`, backgroundColor: g.color}} /></div>
                    <span className="text-xs font-bold text-slate-700 w-8 text-right">{g.value}개</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-sm text-slate-400 py-8 text-center">데이터가 축적되면 표시됩니다.</p>}
        </div>
      </div>

      {/* ── 하단: 최근 활동 + AI 인사이트 ── */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">최근 활동</h2>
          {feed.length > 0 ? (
            <div className="space-y-3">{feed.slice(0,6).map((a,i) => (
              <div key={i} className="flex gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">{a.user[0]}</div>
                <div className="flex-1 min-w-0"><p className="text-sm text-slate-700"><span className="font-semibold text-slate-900">{a.user}</span> {a.message}</p><div className="flex items-center gap-2 mt-0.5">{a.org && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{a.org}</span>}<span className="text-[10px] text-slate-400">{a.timestamp}</span></div></div>
              </div>
            ))}</div>
          ) : <div className="text-center py-8 text-slate-400"><Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" /><p className="text-sm">활동이 표시됩니다.</p></div>}
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4"><Bot className="w-5 h-5 text-indigo-600" /><h2 className="font-bold text-indigo-900">AI 인사이트</h2></div>
          <div className="space-y-2.5">{insights.map((ins,i) => { const Icon = ins.icon; const ic = ins.type === 'warning' ? 'text-amber-500' : ins.type === 'alert' ? 'text-red-500' : 'text-emerald-500'; return <div key={i} className="bg-white/80 backdrop-blur p-3 rounded-xl border border-indigo-100/50"><div className="flex items-start gap-2"><Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ic}`} /><p className="text-sm text-slate-700">{ins.text}</p></div></div>; })}</div>
        </div>
      </div>
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 조직장/구성원 대시보드 (기존 유지)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
            {roleLevel >= 70 && roleLevel < 80 && <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">조직장</span>}
          </div>
          <p className="text-slate-500 mt-1">{currentOrg?.name || '조직을 선택하세요'}</p>
        </div>
        <select className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 shadow-sm" value={selectedOrgId} onChange={e => setSelectedOrgId(e.target.value)}>
          {selectableOrgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-1"><PeriodStatusWidget variant="compact" showManageLink={false} /></div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4"><span className="text-sm font-medium text-slate-600">전체 달성률</span><div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div></div>
          <span className="text-3xl font-bold text-slate-900">{totalProgress}%</span>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3"><div className="bg-blue-500 h-2 rounded-full" style={{width:`${Math.min(100,totalProgress)}%`}} /></div>
          <p className="text-xs text-slate-500 mt-2">{allKRs.length}개 KR 기준</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4"><span className="text-sm font-medium text-slate-600">활성 목표</span><div className="p-2 bg-purple-50 rounded-lg"><Target className="w-5 h-5 text-purple-600" /></div></div>
          <div className="text-3xl font-bold text-slate-900">{approvedObjectiveCount}</div>
          {draftObjectiveCount > 0 && <p className="text-xs text-orange-600 mt-1">+ 수립 중 {draftObjectiveCount}개</p>}
          <div className="flex gap-2 mt-3">{Object.entries(biiStats).filter(([_,c])=>c>0).map(([k,c])=><span key={k} className={`px-2 py-1 rounded text-xs font-medium ${getBIIColor(k as any).bg} ${getBIIColor(k as any).text}`}>{k}: {c}</span>)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4"><span className="text-sm font-medium text-slate-600">체크인 현황</span><div className="p-2 bg-emerald-50 rounded-lg"><CheckSquare className="w-5 h-5 text-emerald-600" /></div></div>
          <span className="text-2xl font-bold text-slate-900">{checkinRate}%</span>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3"><div className="bg-emerald-500 h-2 rounded-full" style={{width:`${checkinRate}%`}} /></div>
          <p className="text-xs text-slate-500 mt-2">{checkinSummaryText}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4"><span className="text-sm font-medium text-slate-600">주의 필요</span><div className="p-2 bg-orange-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-orange-600" /></div></div>
          <div className="text-2xl font-bold text-slate-900">{warningKRs.length}건</div>
          <div className="mt-3 space-y-2">
            {warningKRs.length > 0 ? warningKRs.slice(0,2).map(kr => <div key={kr.id} className="flex items-center gap-2 text-sm text-slate-700"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /><span className="truncate flex-1">{kr.name}</span></div>)
              : <p className="text-sm text-slate-500">{approvedObjectiveCount === 0 && draftObjectiveCount > 0 ? 'OKR 승인 후 추적합니다.' : allKRs.length === 0 ? 'KR이 없습니다.' : '정상 궤도입니다.'}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6"><h2 className="text-lg font-bold text-slate-900">조직별 성과 현황</h2><span className="text-xs text-slate-400">{orgProgressList.length}개 조직</span></div>
          {orgProgressList.length === 0 ? <div className="text-center py-10 text-slate-500">표시할 데이터가 없습니다.</div> : (
            <div className="space-y-5">{orgProgressList.map((o: any,i: number) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3"><span className="text-sm font-semibold text-slate-900">{o.name}</span><span className={`px-2 py-0.5 rounded text-xs font-medium ${o.status.bg} ${o.status.color}`}>{o.status.label}</span></div><div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-900">{o.status.label==='체크인 전'||o.status.label==='수립 전'?'—':`${o.score}점`}</span><span className="text-xs text-slate-500">({o.total}개 KR)</span></div></div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">{o.total>0&&o.status.label!=='체크인 전'&&o.status.label!=='수립 전'&&<><div className="h-full bg-blue-500" style={{width:`${(o.S/o.total)*100}%`}}/><div className="h-full bg-emerald-500" style={{width:`${(o.A/o.total)*100}%`}}/><div className="h-full bg-lime-500" style={{width:`${(o.B/o.total)*100}%`}}/><div className="h-full bg-amber-400" style={{width:`${(o.C/o.total)*100}%`}}/><div className="h-full bg-red-400" style={{width:`${(o.D/o.total)*100}%`}}/></>}</div>
              </div>
            ))}</div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 mb-4">등급 분포</h2>
          <div className="flex-1 min-h-[200px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={gradeChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">{gradeChartData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div>
          <div className="grid grid-cols-2 gap-2 mt-4">{gradeChartData.map(item=><div key={item.name} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded-lg"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:item.color}}/><span className="text-slate-600 font-medium">{item.name}등급</span></div><span className="font-bold text-slate-900">{item.value}개</span></div>)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">최근 활동</h2>
          {feed.length > 0 ? <div className="space-y-4">{feed.map((a,i)=><div key={i} className="flex gap-4 pb-4 border-b border-slate-50 last:border-0 last:pb-0"><div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold shrink-0">{a.user[0]}</div><div className="flex-1"><p className="text-sm text-slate-900"><span className="font-bold">{a.user}</span>님이 {a.message}</p><div className="flex items-center gap-2 mt-1">{a.org&&<span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{a.org}</span>}<span className="text-xs text-slate-400">{a.timestamp}</span></div></div></div>)}</div>
            : <div className="text-center py-10 text-slate-400"><Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" /><p className="text-sm">활동이 표시됩니다.</p></div>}
        </div>
        {roleLevel >= 70 ? (
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4"><Bot className="w-6 h-6 text-indigo-600" /><h2 className="text-lg font-bold text-indigo-900">AI 인사이트</h2></div>
            <div className="space-y-3">{insights.map((ins,i)=>{const Icon=ins.icon;const ic=ins.type==='warning'?'text-amber-500':ins.type==='alert'?'text-red-500':'text-emerald-500';return<div key={i} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm"><div className="flex items-start gap-2"><Icon className={`w-4 h-4 mt-0.5 ${ic}`}/><p className="text-sm text-slate-700">{ins.text}</p></div></div>;})}</div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6"><div className="text-center py-8"><Activity className="w-12 h-12 text-slate-400 mx-auto mb-3" /><h3 className="text-sm font-semibold text-slate-700 mb-2">구성원 모드</h3><p className="text-xs text-slate-500">조직장 이상에게 인사이트가 제공됩니다.</p></div></div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms/60000); if (m < 1) return '방금 전'; if (m < 60) return `${m}분 전`;
  const h = Math.floor(ms/3600000); if (h < 24) return `${h}시간 전`;
  const days = Math.floor(ms/86400000); return days < 7 ? `${days}일 전` : new Date(d).toLocaleDateString('ko-KR');
}