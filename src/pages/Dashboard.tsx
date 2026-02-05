import { TrendingUp, Target, CheckSquare, AlertTriangle, Bot } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'; // Legend 제거 (미사용)
import { useStore } from '../store/useStore';
import { calculateGrade } from '../utils/helpers';
// formatNumber, useNavigate 제거 (미사용)

export default function Dashboard() {
  // [수정] 데이터가 undefined일 경우를 대비해 기본값 [] 처리
  const krs = useStore(state => state.krs) || [];
  const objectives = useStore(state => state.objectives) || [];
  const activityFeed = useStore(state => state.activityFeed) || [];

  const allKRs = krs.filter(kr => kr.status === 'active');
  const totalProgress = allKRs.length > 0
    ? Math.round(allKRs.reduce((sum, kr) => sum + kr.progressPct, 0) / allKRs.length)
    : 0;

  const activeObjectives = objectives.filter(obj => obj.status === 'active' || obj.status === 'agreed');

  const gradeDistribution = allKRs.reduce((acc, kr) => {
    const grade = calculateGrade(kr);
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const warningKRs = allKRs.filter(kr => {
    const grade = calculateGrade(kr);
    return grade === 'C' || grade === 'D';
  });

  // [참고] 이 데이터는 나중에 Phase 7에서 실시간 집계로 교체될 예정 (현재는 하드코딩 유지)
  const orgProgress = [
    { name: '마케팅본부', S: 0, A: 1, B: 3, C: 2, D: 0, total: 72 },
    { name: '영업본부', S: 1, A: 2, B: 2, C: 0, D: 0, total: 85 },
    { name: '생산본부', S: 0, A: 1, B: 3, C: 1, D: 0, total: 68 },
    { name: 'R&D본부', S: 1, A: 3, B: 1, C: 0, D: 0, total: 88 },
    { name: '경영지원실', S: 0, A: 2, B: 2, C: 1, D: 0, total: 75 }
  ];

  const gradeChartData = [
    { name: 'S', value: gradeDistribution['S'] || 0, color: '#2563EB' },
    { name: 'A', value: gradeDistribution['A'] || 0, color: '#059669' },
    { name: 'B', value: gradeDistribution['B'] || 0, color: '#65A30D' },
    { name: 'C', value: gradeDistribution['C'] || 0, color: '#F97316' },
    { name: 'D', value: gradeDistribution['D'] || 0, color: '#DC2626' }
  ];

  const checkinRate = 85;

  return (
    <div className="p-6 space-y-6">
      {/* 상단 카드 4개 */}
      <div className="grid grid-cols-4 gap-6">
        {/* 전체 진행률 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">전체 진행률</span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold text-slate-900">{totalProgress}%</span>
            <span className="text-sm text-green-600 font-medium mb-1">+4%p</span>
          </div>
          <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
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
              목표 {activeObjectives.length}개 / KR {allKRs.length}개
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                확정 {objectives.filter(o => o.status === 'agreed').length}
              </span>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                진행중 {objectives.filter(o => o.status === 'active').length}
              </span>
            </div>
          </div>
        </div>

        {/* 체크인 현황 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-slate-600">체크인 현황</span>
            <CheckSquare className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-slate-900">이번 달 {checkinRate}%</div>
            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: '마케팅', rate: 90 },
                  { name: '영업', rate: 85 },
                  { name: '생산', rate: 80 },
                  { name: 'R&D', rate: 88 },
                  { name: '지원', rate: 82 }
                ]}>
                  <Bar dataKey="rate" fill="#10B981" radius={[4, 4, 0, 0]} />
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
            <div className="text-2xl font-bold text-red-600">{warningKRs.length}개 KR</div>
            <div className="text-xs text-slate-500">C등급 이하</div>
            <div className="space-y-1 mt-2">
              {warningKRs.slice(0, 2).map(kr => (
                <div key={kr.id} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                  <span className="text-xs text-slate-700 truncate">{kr.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 중간 차트 섹션 */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">조직별 진행률</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={orgProgress} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="name" width={80} />
              <Tooltip />
              <Bar dataKey="S" stackId="a" fill="#2563EB" />
              <Bar dataKey="A" stackId="a" fill="#059669" />
              <Bar dataKey="B" stackId="a" fill="#65A30D" />
              <Bar dataKey="C" stackId="a" fill="#F97316" />
              <Bar dataKey="D" stackId="a" fill="#DC2626" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">등급 분포</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={gradeChartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
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

      {/* 하단 피드 및 AI 인사이트 */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">최근 활동 피드</h2>
          <div className="space-y-3">
            {/* [수정] activityFeed가 있는지 확인 후 slice 호출 */}
            {activityFeed && activityFeed.length > 0 ? (
              activityFeed.slice(0, 10).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-medium">{activity.user[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">{activity.user}</span>이 {activity.message}
                    </p>
                    <span className="text-xs text-slate-500">{activity.timestamp}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">최근 활동이 없습니다.</div>
            )}
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              더보기 →
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">AI 인사이트</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-white/80 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                영업이익률이 목표 대비 8%p 하회하고 있습니다. 원가 구조 점검을 권장합니다.
              </p>
            </div>
            <div className="bg-white/80 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                교육이수율이 4개 팀에서 지연되고 있습니다. 잔여 기간 동안 집중 관리가 필요합니다.
              </p>
            </div>
            <div className="bg-white/80 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                마케팅본부의 매출채권회전일이 목표를 달성했습니다. 우수 사례로 전파를 권장합니다.
              </p>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              자세히 보기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 