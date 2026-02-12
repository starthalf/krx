// src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import { 
  TrendingUp, Target, CheckSquare, AlertTriangle, Bot, 
  MoreHorizontal, Calendar, ArrowUpRight, Trophy, AlertCircle, Activity,
  Shield
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer 
} from 'recharts';
import { getMyRoleLevel, checkCanManageOrg } from '../lib/permissions';
import CEONudgePanel from '../components/CEONudgePanel';

export default function Dashboard() {
  const { 
    organizations, 
    objectives, 
    krs,
    dashboardStats,
    fetchObjectives, 
    fetchKRs,
    fetchDashboardStats,
    loading 
  } = useStore();

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  
  // 권한 관련 state
  const [roleLevel, setRoleLevel] = useState<number>(0);
  const [managableOrgs, setManagableOrgs] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  // 1. 권한 체크
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        setPermissionsLoading(true);
        
        // 내 역할 레벨 가져오기
        const level = await getMyRoleLevel();
        setRoleLevel(level);

        // 관리 가능한 조직 목록 확인
        const managable: string[] = [];
        for (const org of organizations) {
          const canManage = await checkCanManageOrg(org.id);
          if (canManage) {
            managable.push(org.id);
          }
        }
        setManagableOrgs(managable);
      } catch (error) {
        console.error('Failed to check permissions:', error);
      } finally {
        setPermissionsLoading(false);
      }
    };

    if (organizations.length > 0) {
      checkPermissions();
    }
  }, [organizations]);

  // 2. 초기 데이터 로딩 및 조직 선택
  useEffect(() => {
    if (organizations.length > 0 && !permissionsLoading) {
      if (!selectedOrgId) {
        let defaultOrg;
        if (managableOrgs.length > 0) {
          defaultOrg = organizations.find(o => o.id === managableOrgs[0]);
        }
        if (!defaultOrg) {
          defaultOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
        }
        if (defaultOrg) setSelectedOrgId(defaultOrg.id);
      }

      const companyId = organizations[0].companyId;
      if (companyId) {
        fetchDashboardStats(companyId);
      }
    }
  }, [organizations, selectedOrgId, managableOrgs, permissionsLoading, fetchDashboardStats]);

  // 3. 선택된 조직의 상세 데이터 로딩
  useEffect(() => {
    if (selectedOrgId) {
      fetchObjectives(selectedOrgId);
      fetchKRs(selectedOrgId);
    }
  }, [selectedOrgId, fetchObjectives, fetchKRs]);

  // 데이터 집계
  const currentOrg = organizations.find(o => o.id === selectedOrgId);
  const allKRs = krs || []; 
  const currentObjectives = objectives || [];

  const totalProgress = allKRs.length > 0
    ? Math.round(allKRs.reduce((sum, kr) => sum + (kr.progressPct || 0), 0) / allKRs.length)
    : 0;

  const activeObjectives = currentObjectives.filter(obj => obj.status === 'active' || obj.status === 'agreed');

  const gradeDistribution = {
    S: allKRs.filter(kr => kr.grade === 'S').length,
    A: allKRs.filter(kr => kr.grade === 'A').length,
    B: allKRs.filter(kr => kr.grade === 'B').length,
    C: allKRs.filter(kr => kr.grade === 'C').length,
    D: allKRs.filter(kr => kr.grade === 'D' || !kr.grade).length,
  };

  const gradeChartData = [
    { name: 'S', value: gradeDistribution.S, color: '#3B82F6' },
    { name: 'A', value: gradeDistribution.A, color: '#10B981' },
    { name: 'B', value: gradeDistribution.B, color: '#84CC16' },
    { name: 'C', value: gradeDistribution.C, color: '#F59E0B' },
    { name: 'D', value: gradeDistribution.D, color: '#EF4444' }
  ];

  const warningKRs = allKRs.filter(kr => kr.grade === 'C' || kr.grade === 'D');

  const biiStats = {
    Build: currentObjectives.filter(o => o.biiType === 'Build').length,
    Innovate: currentObjectives.filter(o => o.biiType === 'Innovate').length,
    Improve: currentObjectives.filter(o => o.biiType === 'Improve').length,
  };

  const orgProgressList = (dashboardStats || []).map((org: any) => {
    const totalCount = org.kr_count || 0;
    const weightedScore = totalCount === 0 ? 0 : Math.round(
      ((org.grade_s * 120) + (org.grade_a * 110) + (org.grade_b * 100) + (org.grade_c * 80) + (org.grade_d * 50)) / totalCount
    );
    
    let status = { label: '순항', color: 'text-green-600', bg: 'bg-green-100' };
    if (weightedScore >= 110) status = { label: '탁월', color: 'text-blue-600', bg: 'bg-blue-100' };
    else if (weightedScore < 90) status = { label: '주의', color: 'text-orange-600', bg: 'bg-orange-100' };
    if (weightedScore < 70) status = { label: '위험', color: 'text-red-600', bg: 'bg-red-100' };

    return { 
      name: org.name, score: weightedScore, status,
      S: org.grade_s || 0, A: org.grade_a || 0, B: org.grade_b || 0, 
      C: org.grade_c || 0, D: org.grade_d || 0, total: totalCount
    };
  }).sort((a: any, b: any) => b.score - a.score);

  const checkinRate = 85;
  const feed = [
    { id: 1, user: '김철수', message: '영업이익 목표 달성률 105% 기록', timestamp: '10분 전' },
    { id: 2, user: '이영희', message: '신규 KR "고객 만족도" 등록', timestamp: '1시간 전' },
    { id: 3, user: '박민수', message: '마케팅 캠페인 결과 리포트 업로드', timestamp: '2시간 전' },
  ];

  const selectableOrgs = roleLevel >= 90 
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
            
            {/* 역할 배지 */}
            {roleLevel >= 90 && (
              <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full flex items-center gap-1">
                <Shield className="w-3 h-3" />
                관리자
              </span>
            )}
            {roleLevel >= 70 && roleLevel < 90 && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                본부장
              </span>
            )}
            {roleLevel >= 50 && roleLevel < 70 && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                팀장
              </span>
            )}
          </div>
          <p className="text-slate-600 mt-1">
            {currentOrg ? `${currentOrg.name}의 성과 현황입니다.` : '데이터를 불러오는 중...'}
          </p>
        </div>
        <div className="flex gap-3">
          <select 
            className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
          >
            {selectableOrgs.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            2025년 1분기
          </button>
        </div>
      </div>

      {/* KPI 카드들 */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">전체 진행률</span>
            <div className={`p-2 rounded-lg ${totalProgress >= 80 ? 'bg-green-50' : 'bg-blue-50'}`}>
              <TrendingUp className={`w-5 h-5 ${totalProgress >= 80 ? 'text-green-600' : 'text-blue-600'}`} />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-slate-900">{totalProgress}%</span>
            <span className="text-sm text-green-600 font-medium mb-1 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> 4%p
            </span>
          </div>
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${totalProgress >= 100 ? 'bg-green-500' : 'bg-blue-600'}`}
              style={{ width: `${Math.min(totalProgress, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">OKR 현황</span>
            <div className="p-2 bg-violet-50 rounded-lg">
              <Target className="w-5 h-5 text-violet-600" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-2xl font-bold text-slate-900">
              {activeObjectives.length} <span className="text-base font-normal text-slate-500">Goal</span> / {allKRs.length} <span className="text-base font-normal text-slate-500">KR</span>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs rounded font-medium">B {biiStats.Build}</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">I {biiStats.Innovate}</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">I {biiStats.Improve}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">체크인 현황</span>
            <div className="p-2 bg-emerald-50 rounded-lg">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-bold text-slate-900">{checkinRate}%</span>
              <span className="text-xs text-slate-500 mb-1">지난달 대비 +5%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${checkinRate}%` }}></div>
            </div>
            <p className="text-xs text-slate-500 mt-2">5개 팀 중 4개 팀 완료</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">주의 필요</span>
            <div className="p-2 bg-orange-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{warningKRs.length}건</div>
            <div className="mt-3 space-y-2">
              {warningKRs.length > 0 ? warningKRs.slice(0, 2).map(kr => (
                <div key={kr.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
                  <span className="truncate flex-1">{kr.name}</span>
                </div>
              )) : (
                <p className="text-sm text-slate-500">모든 KR이 정상 궤도입니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-900">조직별 성과 현황</h2>
            <button className="text-sm text-blue-600 font-medium hover:underline">전체보기</button>
          </div>
          
          {orgProgressList.length === 0 ? (
            <div className="text-center py-10 text-slate-500">데이터를 불러오는 중...</div>
          ) : (
            <div className="space-y-5">
              {orgProgressList.map((org: any) => (
                <div key={org.name}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">{org.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${org.status.bg} ${org.status.color}`}>
                        {org.status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{org.score}점</span>
                      <span className="text-xs text-slate-500">({org.total}개 KR)</span>
                    </div>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                    {org.total > 0 && (
                      <>
                        <div className="h-full bg-blue-500" style={{ width: `${(org.S / org.total) * 100}%` }} />
                        <div className="h-full bg-green-500" style={{ width: `${(org.A / org.total) * 100}%` }} />
                        <div className="h-full bg-lime-500" style={{ width: `${(org.B / org.total) * 100}%` }} />
                        <div className="h-full bg-yellow-400" style={{ width: `${(org.C / org.total) * 100}%` }} />
                        <div className="h-full bg-red-400" style={{ width: `${(org.D / org.total) * 100}%` }} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">등급 분포</h2>
            <MoreHorizontal className="w-5 h-5 text-slate-400 cursor-pointer" />
          </div>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={gradeChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value">
                  {gradeChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
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

      {/* CEO/본부장 OKR 수립 독촉 패널 */}
      {roleLevel >= 70 && (
        <CEONudgePanel />
      )}

      {/* 피드 및 AI 인사이트 */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">최근 활동 피드</h2>
          <div className="space-y-4">
            {feed.map((activity, idx) => (
              <div key={idx} className="flex gap-4 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold shrink-0">
                  {activity.user[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-900">
                    <span className="font-bold">{activity.user}</span>님이 {activity.message}
                  </p>
                  <span className="text-xs text-slate-400 mt-1">{activity.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI 인사이트 - 팀장 이상만 */}
        {roleLevel >= 50 ? (
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-6 h-6 text-indigo-600" />
              <h2 className="text-lg font-bold text-indigo-900">AI 인사이트</h2>
            </div>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    <span className="font-bold">영업이익률</span>이 목표 대비 8%p 하회 중입니다.
                  </p>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    4개 팀에서 <span className="font-bold">교육이수율</span>이 지연되고 있습니다.
                  </p>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                <div className="flex items-start gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    <span className="font-bold">마케팅본부</span>의 매출채권회전일 목표가 조기 달성! 👏
                  </p>
                </div> 
              </div>
            </div>
            <button className="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
              AI 리포트 전체보기
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 mb-2">팀원 모드</h3>
              <p className="text-xs text-slate-500">
                AI 인사이트는 팀장 이상에게만 제공됩니다.
              </p>
            </div>
          </div>
        )}
      </div> 
    </div>
  );
}