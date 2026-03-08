// src/pages/Dashboard.tsx — 버그 수정: draft 제외, 조직 범위 제한, NaN 방어
import { useEffect, useState, useRef, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor, calculateGrade } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import {
  TrendingUp, Target, CheckSquare, AlertTriangle, Bot,
  MoreHorizontal, Calendar, ArrowUpRight, Trophy, AlertCircle, Activity,
  Shield, Crown, User, MessageSquare, Clock
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import { getMyRoleLevel, checkCanManageOrg, ROLE_LEVELS } from '../lib/permissions';
import PeriodStatusWidget from '../components/PeriodStatusWidget';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 타입
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface CheckinStatRow {
  org_id: string;
  org_name: string;
  total_krs: number;
  checked_in_krs: number;
  checkin_rate: number;
  last_checkin_at: string | null;
}

interface ActivityRow {
  activity_type: string;
  actor_name: string;
  description: string;
  entity_name: string;
  org_name: string;
  created_at: string;
}

interface Insight {
  type: 'warning' | 'alert' | 'success';
  icon: typeof AlertCircle;
  text: string;
}

export default function Dashboard() {
  const {
    organizations, objectives, krs,
    dashboardStats,
    fetchObjectives, fetchKRs, fetchDashboardStats,
    loading
  } = useStore();

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // 권한
  const [roleLevel, setRoleLevel] = useState<number>(0);
  const [managableOrgs, setManagableOrgs] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // 실데이터 state
  const [checkinStats, setCheckinStats] = useState<CheckinStatRow[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityRow[]>([]);

  const orgIds = organizations.map(o => o.id).join(',');
  const permCheckVersionRef = useRef(0);

  // ── 1. 권한 체크 ──
  useEffect(() => {
    if (organizations.length === 0) {
      setPermissionsLoading(false);
      return;
    }
    const thisVersion = ++permCheckVersionRef.current;
    const checkPermissions = async () => {
      try {
        setPermissionsLoading(true);
        const level = await getMyRoleLevel();
        if (thisVersion !== permCheckVersionRef.current) return;
        setRoleLevel(level);

        const managable: string[] = [];
        for (const org of organizations) {
          const canManage = await checkCanManageOrg(org.id);
          if (canManage) managable.push(org.id);
        }
        if (thisVersion !== permCheckVersionRef.current) return;
        setManagableOrgs(prev => {
          const key = managable.join(',');
          return prev.join(',') === key ? prev : managable;
        });
      } catch (error) {
        console.error('Failed to check permissions:', error);
      } finally {
        if (thisVersion === permCheckVersionRef.current) setPermissionsLoading(false);
      }
    };
    checkPermissions();
  }, [orgIds]);

  const managableOrgsKey = managableOrgs.join(',');

  // ── 2-a. 초기 조직 선택 ──
  useEffect(() => {
    if (organizations.length > 0 && !permissionsLoading && !selectedOrgId) {
      let defaultOrg;
      if (managableOrgs.length > 0) {
        defaultOrg = organizations.find(o => o.id === managableOrgs[0]);
      }
      if (!defaultOrg) {
        defaultOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
      }
      if (defaultOrg) setSelectedOrgId(defaultOrg.id);
    }
  }, [orgIds, managableOrgsKey, permissionsLoading]);

  // ── 2-b. 대시보드 통계 + 체크인 통계 + 최근 활동 로딩 ──
  useEffect(() => {
    if (organizations.length > 0 && !permissionsLoading) {
      const companyId = organizations[0]?.companyId;
      if (companyId) {
        fetchDashboardStats(companyId);
        loadCheckinStats(companyId);
        loadRecentActivities(companyId);
      }
    }
  }, [orgIds, permissionsLoading]);

  // ── 3. 선택된 조직 데이터 ──
  useEffect(() => {
    if (selectedOrgId) {
      fetchObjectives(selectedOrgId);
      fetchKRs(selectedOrgId);
    }
  }, [selectedOrgId]);

  // ── 실데이터 로딩 함수 ──
  const loadCheckinStats = async (companyId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_checkin_stats', { target_company_id: companyId });
      if (!error && data) setCheckinStats(data);
    } catch (e) {
      console.warn('get_checkin_stats not available yet:', e);
    }
  };

  const loadRecentActivities = async (companyId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_recent_activities', {
        target_company_id: companyId,
        limit_count: 8,
      });
      if (!error && data) setRecentActivities(data);
    } catch (e) {
      console.warn('get_recent_activities not available yet:', e);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ★ FIX 2: 조직 범위 — 선택 조직 + 하위 조직
  // CEO/관리자(80+) → 전사, 조직장(70+) → 담당+하위
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const scopeOrgIds = useMemo(() => {
    if (roleLevel >= ROLE_LEVELS.COMPANY_ADMIN) {
      return new Set(organizations.map(o => o.id));
    }
    const result = new Set<string>();
    const addDescendants = (parentId: string) => {
      result.add(parentId);
      organizations.filter(o => o.parentOrgId === parentId).forEach(child => {
        addDescendants(child.id);
      });
    };
    if (selectedOrgId) addDescendants(selectedOrgId);
    return result;
  }, [selectedOrgId, roleLevel, orgIds]);

  // ── 데이터 집계 ──
  const currentOrg = organizations.find(o => o.id === selectedOrgId);
  const allKRs = krs || [];
  const currentObjectives = objectives || [];

  const totalProgress = allKRs.length > 0
    ? Math.round(allKRs.reduce((sum, kr) => sum + (kr.progressPct || 0), 0) / allKRs.length)
    : 0;

  // ★ FIX 1: draft/review 상태 제외
  const activeObjectives = currentObjectives.filter(obj =>
    obj.status === 'active' || obj.status === 'agreed' || obj.status === 'completed'
  );
  const draftObjectives = currentObjectives.filter(obj =>
    obj.status === 'draft' || obj.status === 'review' || obj.status === 'reviewing'
  );

  const gradeDistribution = {
    S: allKRs.filter(kr => calculateGrade(kr) === 'S').length,
    A: allKRs.filter(kr => calculateGrade(kr) === 'A').length,
    B: allKRs.filter(kr => calculateGrade(kr) === 'B').length,
    C: allKRs.filter(kr => calculateGrade(kr) === 'C').length,
    D: allKRs.filter(kr => calculateGrade(kr) === 'D').length,
  };

  const gradeChartData = [
    { name: 'S', value: gradeDistribution.S, color: '#3B82F6' },
    { name: 'A', value: gradeDistribution.A, color: '#10B981' },
    { name: 'B', value: gradeDistribution.B, color: '#84CC16' },
    { name: 'C', value: gradeDistribution.C, color: '#F59E0B' },
    { name: 'D', value: gradeDistribution.D, color: '#EF4444' },
  ];

  const warningKRs = allKRs.filter(kr => {
    const g = calculateGrade(kr);
    return g === 'C' || g === 'D';
  });

  const biiStats = {
    Build: activeObjectives.filter(o => o.biiType === 'Build').length,
    Innovate: activeObjectives.filter(o => o.biiType === 'Innovate').length,
    Improve: activeObjectives.filter(o => o.biiType === 'Improve').length,
  };

  // ★ FIX 2: 체크인 현황 — scopeOrgIds로 범위 제한
  const scopedCheckinStats = useMemo(() => {
    if (checkinStats.length === 0) return [];
    return checkinStats.filter(s => scopeOrgIds.has(s.org_id));
  }, [checkinStats, scopeOrgIds]);

  const checkinRate = useMemo(() => {
    if (scopedCheckinStats.length > 0) {
      const total = scopedCheckinStats.reduce((s, r) => s + (r.total_krs || 0), 0);
      const checked = scopedCheckinStats.reduce((s, r) => s + (r.checked_in_krs || 0), 0);
      return total > 0 ? Math.round((checked / total) * 100) : 0;
    }
    if (allKRs.length === 0) return 0;
    const checked = allKRs.filter(kr => kr.currentValue > 0).length;
    return Math.round((checked / allKRs.length) * 100);
  }, [scopedCheckinStats, allKRs]);

  const checkinSummaryText = useMemo(() => {
    if (scopedCheckinStats.length > 0) {
      const completed = scopedCheckinStats.filter(s => s.checkin_rate >= 100).length;
      return `${scopedCheckinStats.length}개 조직 중 ${completed}개 완료`;
    }
    const checked = allKRs.filter(kr => kr.currentValue > 0).length;
    return `${allKRs.length}개 KR 중 ${checked}개 입력`;
  }, [scopedCheckinStats, allKRs]);

  // ★ FIX 3: NaN 방어 + 범위 제한
  const orgProgressList = useMemo(() => {
    return (dashboardStats || [])
      .filter((org: any) => scopeOrgIds.has(org.org_id || org.id))
      .map((org: any) => {
        const totalCount = Number(org.kr_count) || 0;
        const s = Number(org.grade_s) || 0;
        const a = Number(org.grade_a) || 0;
        const b = Number(org.grade_b) || 0;
        const c = Number(org.grade_c) || 0;
        const d = Number(org.grade_d) || 0;

        const weightedScore = totalCount === 0 ? 0 : Math.round(
          ((s * 120) + (a * 110) + (b * 100) + (c * 80) + (d * 50)) / totalCount
        );

        let status = { label: '순항', color: 'text-green-600', bg: 'bg-green-100' };
        if (weightedScore >= 110) status = { label: '탁월', color: 'text-blue-600', bg: 'bg-blue-100' };
        else if (weightedScore < 90 && totalCount > 0) status = { label: '주의', color: 'text-orange-600', bg: 'bg-orange-100' };
        if (weightedScore < 70 && totalCount > 0) status = { label: '위험', color: 'text-red-600', bg: 'bg-red-100' };
        if (totalCount === 0) status = { label: '수립 전', color: 'text-slate-400', bg: 'bg-slate-100' };

        return {
          name: org.name || org.org_name || '(이름 없음)',
          score: weightedScore, status,
          S: s, A: a, B: b, C: c, D: d, total: totalCount
        };
      })
      .sort((a: any, b: any) => b.score - a.score);
  }, [dashboardStats, scopeOrgIds]);

  // ── AI 인사이트 ──
  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];

    if (warningKRs.length > 0) {
      result.push({ type: 'warning', icon: AlertCircle, text: `${warningKRs.length}개 KR이 C/D 등급으로 집중 관리가 필요합니다.` });
    }

    const delayedOrgs = scopedCheckinStats.filter(s => s.total_krs > 0 && s.checkin_rate < 50);
    if (delayedOrgs.length > 0) {
      const names = delayedOrgs.slice(0, 3).map(o => o.org_name).join(', ');
      result.push({ type: 'alert', icon: Clock, text: `${names}${delayedOrgs.length > 3 ? ` 외 ${delayedOrgs.length - 3}개` : ''} 조직의 체크인율이 50% 미만입니다.` });
    }

    const topOrgs = orgProgressList.filter((o: any) => o.score >= 110);
    if (topOrgs.length > 0) {
      result.push({ type: 'success', icon: Trophy, text: `${topOrgs[0].name}이(가) 탁월한 성과를 보이고 있습니다! 🎉` });
    }

    if (draftObjectives.length > 0 && activeObjectives.length === 0) {
      result.push({ type: 'alert', icon: Target, text: `${draftObjectives.length}개 목표가 수립 중입니다. 승인 완료 후 성과 추적이 시작됩니다.` });
    }

    if (totalProgress >= 90 && allKRs.length > 0) {
      result.push({ type: 'success', icon: TrendingUp, text: '평균 달성률이 90%를 넘었습니다.' });
    } else if (totalProgress < 50 && allKRs.length > 3) {
      result.push({ type: 'alert', icon: AlertTriangle, text: '평균 달성률이 50% 미만입니다. 추진력 점검이 필요합니다.' });
    }

    if (result.length === 0) {
      result.push({ type: 'success', icon: Target, text: 'OKR 실적 데이터가 축적되면 AI 인사이트가 자동 생성됩니다.' });
    }
    return result;
  }, [warningKRs, scopedCheckinStats, orgProgressList, totalProgress, allKRs.length, draftObjectives.length, activeObjectives.length]);

  // ── 활동 피드 ──
  const feed = useMemo(() => {
    if (recentActivities.length > 0) {
      return recentActivities.map((a, idx) => ({
        id: idx,
        user: a.actor_name || '시스템',
        message: a.activity_type === 'checkin'
          ? `${a.description} 실적 입력 (${a.entity_name})`
          : `${a.entity_name}에 ${a.activity_type} 작성`,
        org: a.org_name,
        timestamp: formatRelativeTime(a.created_at),
      }));
    }
    return [];
  }, [recentActivities]);

  const selectableOrgs = roleLevel >= ROLE_LEVELS.COMPANY_ADMIN
    ? organizations
    : organizations.filter(o => managableOrgs.includes(o.id) || managableOrgs.length === 0);

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">권한을 확인하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
            {roleLevel >= 90 && (
              <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full flex items-center gap-1"><Crown className="w-3 h-3" /> CEO</span>
            )}
            {roleLevel >= 80 && roleLevel < 90 && (
              <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full flex items-center gap-1"><Shield className="w-3 h-3" /> 관리자</span>
            )}
            {roleLevel >= 70 && roleLevel < 80 && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">조직장</span>
            )}
          </div>
          <p className="text-slate-500 mt-1">{currentOrg?.name || '조직을 선택하세요'}</p>
        </div>
        <select className="bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 shadow-sm" value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
          {selectableOrgs.map(org => (<option key={org.id} value={org.id}>{org.name}</option>))}
        </select>
      </div>

      {/* 상단 카드 */}
      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-1"><PeriodStatusWidget variant="compact" /></div>

        {/* 전체 달성률 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">전체 달성률</span>
            <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
          </div>
          <span className="text-3xl font-bold text-slate-900">{totalProgress}%</span>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, totalProgress)}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">{allKRs.length}개 KR 기준</p>
        </div>

        {/* ★ 활성 목표 — draft 제외 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">활성 목표</span>
            <div className="p-2 bg-purple-50 rounded-lg"><Target className="w-5 h-5 text-purple-600" /></div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{activeObjectives.length}</div>
          {draftObjectives.length > 0 && (
            <p className="text-xs text-orange-600 mt-1">+ 수립 중 {draftObjectives.length}개</p>
          )}
          <div className="flex gap-2 mt-3">
            {Object.entries(biiStats).filter(([_, c]) => c > 0).map(([key, count]) => (
              <span key={key} className={`px-2 py-1 rounded text-xs font-medium ${getBIIColor(key as any).bg} ${getBIIColor(key as any).text}`}>{key}: {count}</span>
            ))}
          </div>
        </div>

        {/* ★ 체크인 현황 — 범위 제한 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">체크인 현황</span>
            <div className="p-2 bg-emerald-50 rounded-lg"><CheckSquare className="w-5 h-5 text-emerald-600" /></div>
          </div>
          <span className="text-2xl font-bold text-slate-900">{checkinRate}%</span>
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3">
            <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${checkinRate}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-2">{checkinSummaryText}</p>
        </div>

        {/* 주의 필요 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">주의 필요</span>
            <div className="p-2 bg-orange-50 rounded-lg"><AlertTriangle className="w-5 h-5 text-orange-600" /></div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{warningKRs.length}건</div>
          <div className="mt-3 space-y-2">
            {warningKRs.length > 0 ? warningKRs.slice(0, 2).map(kr => (
              <div key={kr.id} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="truncate flex-1">{kr.name}</span>
              </div>
            )) : <p className="text-sm text-slate-500">모든 KR이 정상 궤도입니다.</p>}
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-3 gap-6">
        {/* ★ 조직별 성과 — NaN 방어 + 범위 제한 */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">조직별 성과 현황</h2>
            <span className="text-xs text-slate-400">{orgProgressList.length}개 조직</span>
          </div>
          {orgProgressList.length === 0 ? (
            <div className="text-center py-10 text-slate-500">{loading ? '데이터를 불러오는 중...' : '표시할 조직 데이터가 없습니다.'}</div>
          ) : (
            <div className="space-y-5">
              {orgProgressList.map((org: any, i: number) => (
                <div key={`org-${i}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">{org.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${org.status.bg} ${org.status.color}`}>{org.status.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{org.score}점</span>
                      <span className="text-xs text-slate-500">({org.total}개 KR)</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                    {org.total > 0 && (<>
                      <div className="h-full bg-blue-500" style={{ width: `${(org.S / org.total) * 100}%` }} />
                      <div className="h-full bg-green-500" style={{ width: `${(org.A / org.total) * 100}%` }} />
                      <div className="h-full bg-lime-500" style={{ width: `${(org.B / org.total) * 100}%` }} />
                      <div className="h-full bg-yellow-400" style={{ width: `${(org.C / org.total) * 100}%` }} />
                      <div className="h-full bg-red-400" style={{ width: `${(org.D / org.total) * 100}%` }} />
                    </>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 등급 분포 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 mb-4">등급 분포</h2>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={gradeChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                  {gradeChartData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {gradeChartData.map(item => (
              <div key={item.name} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium">{item.name}등급</span>
                </div>
                <span className="font-bold text-slate-900">{item.value}개</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 피드 + 인사이트 */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">최근 활동</h2>
          {feed.length > 0 ? (
            <div className="space-y-4">
              {feed.map((a, i) => (
                <div key={i} className="flex gap-4 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold shrink-0">{a.user[0]}</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-900"><span className="font-bold">{a.user}</span>님이 {a.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {a.org && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{a.org}</span>}
                      <span className="text-xs text-slate-400">{a.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">
              <Activity className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">체크인 및 CFR 활동이 발생하면 여기에 표시됩니다.</p>
            </div>
          )}
        </div>

        {roleLevel >= 70 ? (
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-6 h-6 text-indigo-600" />
              <h2 className="text-lg font-bold text-indigo-900">AI 인사이트</h2>
            </div>
            <div className="space-y-3">
              {insights.map((ins, i) => {
                const Icon = ins.icon;
                const ic = ins.type === 'warning' ? 'text-orange-500' : ins.type === 'alert' ? 'text-red-500' : 'text-green-500';
                return (
                  <div key={i} className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                    <div className="flex items-start gap-2">
                      <Icon className={`w-4 h-4 mt-0.5 ${ic}`} />
                      <p className="text-sm text-slate-700">{ins.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 mb-2">구성원 모드</h3>
              <p className="text-xs text-slate-500">AI 인사이트는 조직장 이상에게만 제공됩니다.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString('ko-KR');
} 