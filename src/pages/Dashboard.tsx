import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import { 
  TrendingUp, Target, CheckSquare, AlertTriangle, Bot, 
  MoreHorizontal, Calendar, ArrowUpRight, ArrowDownRight, Activity 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';

export default function Dashboard() {
  // 1. Store 데이터 가져오기
  const { 
    organizations, 
    objectives, 
    krs,
    // [Phase 5]에서 추가된 CFR 데이터가 있다면 여기서 가져옴 (현재는 mock/undefined 대비)
    // cfrThreads, 
    fetchObjectives, 
    fetchKRs,
    loading 
  } = useStore();

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // 2. 초기 로딩 및 조직 선택 로직
  useEffect(() => {
    // 조직이 있고 선택된 게 없으면 첫 번째 조직(전사 등) 선택
    if (organizations.length > 0 && !selectedOrgId) {
      const rootOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
      if (rootOrg) {
        setSelectedOrgId(rootOrg.id);
      }
    }
  }, [organizations, selectedOrgId]);

  // 3. 조직 데이터 Fetch
  useEffect(() => {
    if (selectedOrgId) {
      fetchObjectives(selectedOrgId);
      fetchKRs(selectedOrgId);
    }
  }, [selectedOrgId, fetchObjectives, fetchKRs]);

  // ==================== 데이터 집계 (Real-time) ====================

  // 현재 선택된 조직 정보
  const currentOrg = organizations.find(o => o.id === selectedOrgId);

  // KR 데이터 필터링 및 진행률 계산
  const allKRs = krs || []; // 안전장치
  const totalProgress = allKRs.length > 0
    ? Math.round(allKRs.reduce((sum, kr) => sum + (kr.progressPct || 0), 0) / allKRs.length)
    : 0;

  // 활성 목표 개수
  const activeObjectives = objectives ? objectives.filter(obj => obj.status === 'active' || obj.status === 'agreed') : [];

  // 등급 분포 계산 (S/A/B/C/D)
  // helper의 calculateGrade 대신 DB의 grade 값을 쓰거나 직접 계산
  const gradeDistribution = {
    S: allKRs.filter(kr => kr.grade === 'S').length,
    A: allKRs.filter(kr => kr.grade === 'A').length,
    B: allKRs.filter(kr => kr.grade === 'B').length,
    C: allKRs.filter(kr => kr.grade === 'C').length,
    D: allKRs.filter(kr => kr.grade === 'D' || !kr.grade).length, // 등급 없으면 D로 간주
  };

  // 차트용 데이터 변환
  const gradeChartData = [
    { name: 'S', value: gradeDistribution.S, color: '#2563EB' },
    { name: 'A', value: gradeDistribution.A, color: '#059669' },
    { name: 'B', value: gradeDistribution.B, color: '#65A30D' },
    { name: 'C', value: gradeDistribution.C, color: '#F97316' },
    { name: 'D', value: gradeDistribution.D, color: '#DC2626' }
  ];

  // 주의 KR (C, D 등급)
  const warningKRs = allKRs.filter(kr => kr.grade === 'C' || kr.grade === 'D');

  // BII 통계 (AI 인사이트용 등으로 활용 가능)
  const biiStats = {
    Build: objectives.filter(o => o.biiType === 'Build').length,
    Innovate: objectives.filter(o => o.biiType === 'Innovate').length,
    Improve: objectives.filter(o => o.biiType === 'Improve').length,
  };

  // [Mock Data] 조직별 진행률 (DB 구조상 복잡하여 일단 하드코딩 유지, 추후 교체)
  const orgProgressMock = [
    { name: '마케팅', S: 0, A: 1, B: 3, C: 2, D: 0, total: 72 },
    { name: '영업', S: 1, A: 2, B: 2, C: 0, D: 0, total: 85 },
    { name: '생산', S: 0, A: 1, B: 3, C: 1, D: 0, total: 68 },
    { name: 'R&D', S: 1, A: 3, B: 1, C: 0, D: 0, total: 88 },
    { name: '지원', S: 0, A: 2, B: 2, C: 1, D: 0, total: 75 }
  ];

  // [Mock Data] 체크인율 (추후 checkins 테이블 연동 필요)
  const checkinRate = 85;

  // [Mock Data] 활동 피드 (CFR 연동 전까지 임시 데이터 사용)
  const activityFeedMock = [
    { id: 1, user: '김철수', message: '영업이익 목표 달성률 105% 기록', timestamp: '10분 전' },
    { id: 2, user: '이영희', message: '신규 KR "고객 만족도" 등록', timestamp: '1시간 전' },
    { id: 3, user: '박민수', message: '마케팅 캠페인 결과 리포트 업로드', timestamp: '2시간 전' },
  ];
  // 실제 CFR 데이터가 있다면 그것을 우선 사용
  // const feed = useStore(state => state.cfrThreads) || activityFeedMock; 
  const feed = activityFeedMock; 

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      
      {/* 헤더 영역 (조직 선택 포함) */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
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
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <button className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            2025년 1분기
          </button>
        </div>
      </div>

      {/* 1. 상단 핵심 지표 카드 (KPI Cards) */}
      <div className="grid grid-cols-4 gap-6">
        
        {/* 전체 진행률 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">전체 진행률</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-slate-900">{totalProgress}%</span>
            {/* 증감률은 히스토리 데이터가 필요하므로 임시값 */}
            <span className="text-sm text-green-600 font-medium mb-1 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> 4%p
            </span>
          </div>
          <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${totalProgress >= 80 ? 'bg-green-600' : 'bg-blue-600'}`}
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>

        {/* OKR 현황 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">OKR 현황</span>
            <Target className="w-5 h-5 text-violet-600" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-slate-900">
              목표 {activeObjectives.length}개 <span className="text-base font-normal text-slate-500">/ KR {allKRs.length}개</span>
            </div>
            <div className="flex gap-2 flex-wrap mt-2">
              <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs rounded-full font-medium">
                Build {biiStats.Build}
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                Innovate {biiStats.Innovate}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                Improve {biiStats.Improve}
              </span>
            </div>
          </div>
        </div>

        {/* 체크인 현황 (Mock) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">체크인 현황</span>
            <CheckSquare className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-slate-900">이번 달 {checkinRate}%</div>
            <div className="h-12 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'M', rate: 90 }, { name: 'S', rate: 85 }, 
                  { name: 'P', rate: 80 }, { name: 'R', rate: 88 }, { name: 'Sup', rate: 82 }
                ]}>
                  <Bar dataKey="rate" fill="#10B981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 주의 KR */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">주의 KR</span>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-red-600">{warningKRs.length}개 <span className="text-sm text-slate-500 font-normal">위험</span></div>
            <div className="space-y-1 mt-2">
              {warningKRs.length > 0 ? warningKRs.slice(0, 2).map(kr => (
                <div key={kr.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                  <span className="text-xs text-slate-700 truncate">{kr.name}</span>
                </div>
              )) : (
                <div className="text-xs text-slate-400">모든 KR이 순항 중입니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 중간 차트 섹션 */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* 조직별 진행률 (Bar Chart) */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">조직별 진행률 (예시)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={orgProgressMock} layout="vertical" margin={{ left: 40, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              {/* 스택형 바 차트 */}
              <Bar dataKey="S" stackId="a" fill="#2563EB" name="S등급" />
              <Bar dataKey="A" stackId="a" fill="#059669" name="A등급" />
              <Bar dataKey="B" stackId="a" fill="#65A30D" name="B등급" />
              <Bar dataKey="C" stackId="a" fill="#F97316" name="C등급" />
              <Bar dataKey="D" stackId="a" fill="#DC2626" name="D등급" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 등급 분포 (Pie Chart) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900">등급 분포</h2>
            <MoreHorizontal className="w-5 h-5 text-slate-400 cursor-pointer" />
          </div>
          
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={gradeChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {gradeChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 space-y-2">
            {gradeChartData.map(item => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600">{item.name}등급</span>
                </div>
                <span className="font-medium text-slate-900">{item.value}개</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. 하단 피드 및 AI 인사이트 */}
      <div className="grid grid-cols-3 gap-6">
        
        {/* 최근 활동 피드 */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-slate-900">최근 활동 피드</h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">더보기 →</button>
          </div>
          
          <div className="space-y-4">
            {feed.length > 0 ? (
              feed.slice(0, 5).map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 text-slate-600 font-medium text-xs">
                    {activity.user[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{activity.user}</span>
                      <span className="mx-1">·</span>
                      {activity.message}
                    </p>
                    <span className="text-xs text-slate-400 mt-0.5 block">{activity.timestamp}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 py-4">최근 활동이 없습니다.</div>
            )}
          </div>
        </div>

        {/* AI 인사이트 */}
        <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">AI 인사이트</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-blue-100 shadow-sm">
              <p className="text-sm text-slate-700 leading-relaxed">
                📢 <span className="font-semibold text-blue-700">영업이익률</span>이 목표 대비 8%p 하회하고 있습니다. 원가 구조 점검을 권장합니다.
              </p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-blue-100 shadow-sm">
              <p className="text-sm text-slate-700 leading-relaxed">
                ⚠️ <span className="font-semibold text-orange-600">교육이수율</span>이 4개 팀에서 지연되고 있습니다. 집중 관리가 필요합니다.
              </p>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-blue-100 shadow-sm">
              <p className="text-sm text-slate-700 leading-relaxed">
                🎉 <span className="font-semibold text-green-600">마케팅본부</span>의 매출채권회전일이 목표를 조기 달성했습니다! 
              </p>
            </div>
          </div>
          <button className="w-full mt-4 py-2 bg-white border border-blue-200 text-blue-600 text-sm font-medium rounded-lg hover:bg-blue-50 transition-colors shadow-sm">
            AI 리포트 전체보기
          </button>
        </div>
      </div>
    </div>
  );
}