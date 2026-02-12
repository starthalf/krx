// src/pages/Dashboard.tsx
// 수정: CEONudgePanel 완전 제거 - 대시보드는 성과 조회 전용

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { getMyRoleLevel } from '../lib/permissions';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, TrendingDown, Target, CheckCircle2, 
  AlertCircle, Clock, Award, Bot 
} from 'lucide-react';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function Dashboard() {
  const { user } = useAuth();
  const { company, organizations } = useStore();
  const [roleLevel, setRoleLevel] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      if (!user) return;
      const level = await getMyRoleLevel();
      setRoleLevel(level);
      await loadDashboardStats();
    }
    init();
  }, [user]);

  // 대시보드 통계 로드
  const loadDashboardStats = async () => {
    setLoading(true);
    try {
      // PostgreSQL 함수 호출로 실시간 통계 가져오기
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      
      if (error) throw error;
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load dashboard stats:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 로딩 상태
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // 통계 데이터가 없을 때
  if (!stats) {
    return (
      <div className="p-8">
        <div className="text-center py-20">
          <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">대시보드 데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  // 임시 피드 데이터 (나중에 실제 데이터로 교체)
  const feed = [
    { user: '김철수', message: 'Q1 영업목표를 달성했습니다 🎉', timestamp: '2시간 전' },
    { user: '박영희', message: '신제품 개발 마일스톤을 완료했습니다', timestamp: '5시간 전' },
    { user: '이민준', message: '고객만족도 KR이 95%에 도달했습니다', timestamp: '1일 전' },
  ];

  return (
    <div className="p-8 space-y-6 bg-slate-50 min-h-screen">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">대시보드</h1>
        <p className="text-slate-600 mt-1">
          {company?.name || '우리 회사'}의 실시간 성과 현황
        </p>
      </div>

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          title="전체 OKR"
          value={stats.totalOkrs || 0}
          change="+12%"
          trend="up"
          icon={Target}
          color="blue"
        />
        <StatCard
          title="평균 달성률"
          value={`${stats.avgProgress || 0}%`}
          change="+5%"
          trend="up"
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="완료된 KR"
          value={stats.completedKrs || 0}
          change="-3%"
          trend="down"
          icon={CheckCircle2}
          color="purple"
        />
        <StatCard
          title="주의 필요"
          value={stats.atRiskKrs || 0}
          change="+2"
          trend="up"
          icon={AlertCircle}
          color="red"
        />
      </div>

      {/* OKR 현황 및 등급 분포 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 조직별 진행률 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">조직별 평균 진행률</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.orgProgress || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="progress" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 등급 분포 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">KR 등급 분포</h2>
          <div className="space-y-3">
            {(stats.gradeDistribution || []).map((item: any) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 font-medium">{item.name}등급</span>
                </div>
                <span className="font-bold text-slate-900">{item.value}개</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
                  <Clock className="w-4 h-4 text-amber-500 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    <span className="font-bold">개발팀</span>이 3주째 체크인을 하지 않았습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-6 h-6 text-slate-400" />
              <h2 className="text-lg font-bold text-slate-700">개인 성과</h2>
            </div>
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">나의 OKR 달성률</p>
                <p className="text-2xl font-bold text-slate-900">78%</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600 mb-1">이번 주 체크인</p>
                <p className="text-2xl font-bold text-green-600">완료</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 통계 카드 컴포넌트
interface StatCardProps {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down';
  icon: any;
  color: 'blue' | 'green' | 'purple' | 'red';
}

function StatCard({ title, value, change, trend, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
          {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {change}
        </div>
      </div>
      <h3 className="text-sm font-medium text-slate-600 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}