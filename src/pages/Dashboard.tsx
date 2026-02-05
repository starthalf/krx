import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import { 
  Activity, Target, Users, TrendingUp, Calendar, 
  ChevronDown, ArrowUpRight, ArrowDownRight, MoreHorizontal 
} from 'lucide-react';

export default function Dashboard() {
  const { 
    organizations, 
    objectives, 
    krs, 
    fetchOrganizations, 
    fetchObjectives, 
    fetchKRs,
    loading 
  } = useStore();

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // 1. 초기 데이터 로딩 (전사 조직 찾기)
  useEffect(() => {
    const initData = async () => {
      // 회사 ID가 없으면 로직상 organizations가 비어있을 수 있음 (로그인 직후 등)
      // 실제 앱에서는 user profile에서 company_id를 가져와야 함.
      // 여기서는 store에 이미 로드된 organizations를 활용하거나, 없다면 fetch 시도
      if (organizations.length === 0) {
        // 임시: userStore에 있는 companyId나, 하드코딩된 ID 사용 필요
        // 실제 구현 시: await fetchOrganizations(user.company_id);
      }
    };
    initData();
  }, []);

  // 2. 조직 목록이 로드되면 기본값(최상위 조직) 선택
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      const rootOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
      if (rootOrg) {
        setSelectedOrgId(rootOrg.id);
      }
    }
  }, [organizations, selectedOrgId]);

  // 3. 조직 선택 시 해당 조직의 OKR 데이터 가져오기
  useEffect(() => {
    if (selectedOrgId) {
      fetchObjectives(selectedOrgId);
      fetchKRs(selectedOrgId);
    }
  }, [selectedOrgId, fetchObjectives, fetchKRs]);

  // ==================== 통계 계산 로직 ====================

  // (1) 전체 진척률 계산
  const totalProgress = krs.length > 0
    ? Math.round(krs.reduce((acc, kr) => acc + (kr.progressPct || 0), 0) / krs.length)
    : 0;

  // (2) 등급 분포 계산 (S/A/B/C/D)
  const gradeDistribution = {
    S: krs.filter(kr => (kr.grade || 'D') === 'S').length,
    A: krs.filter(kr => (kr.grade || 'D') === 'A').length,
    B: krs.filter(kr => (kr.grade || 'D') === 'B').length,
    C: krs.filter(kr => (kr.grade || 'D') === 'C').length,
    D: krs.filter(kr => (kr.grade || 'D') === 'D').length,
  };

  // (3) BII 비중 계산
  const biiStats = {
    Build: objectives.filter(o => o.biiType === 'Build').length,
    Innovate: objectives.filter(o => o.biiType === 'Innovate').length,
    Improve: objectives.filter(o => o.biiType === 'Improve').length,
  };

  const currentOrg = organizations.find(o => o.id === selectedOrgId);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
          <p className="text-slate-600 mt-1">
            {currentOrg ? `${currentOrg.name}의 성과 현황입니다.` : '조직 데이터를 불러오는 중...'}
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

      {/* 1. 핵심 지표 카드 */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <span className={`flex items-center text-sm font-medium ${totalProgress >= 80 ? 'text-green-600' : 'text-slate-600'}`}>
              {totalProgress >= 80 ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
              {totalProgress}%
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalProgress}%</div>
          <div className="text-sm text-slate-500 mt-1">평균 진척률</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-violet-50 rounded-lg">
              <Target className="w-6 h-6 text-violet-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">{objectives.length}건</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{objectives.length}</div>
          <div className="text-sm text-slate-500 mt-1">수립된 목표</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm font-medium text-green-600">{krs.length}건</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{krs.length}</div>
          <div className="text-sm text-slate-500 mt-1">관리 중인 KR</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">{currentOrg?.headcount || 0}명</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{currentOrg?.headcount || 0}</div>
          <div className="text-sm text-slate-500 mt-1">구성원</div>
        </div>
      </div>

      {/* 2. 상세 차트 영역 */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        
        {/* (1) 등급 분포 */}
        <div className="col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900">KR 등급 분포</h3>
            <button className="text-slate-400 hover:text-slate-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
          
          <div className="grid grid-cols-5 gap-4 items-end h-48">
            {Object.entries(gradeDistribution).map(([grade, count]) => {
              const height = krs.length > 0 ? (count / krs.length) * 100 : 0;
              let color = 'bg-slate-300';
              if (grade === 'S') color = 'bg-blue-500';
              if (grade === 'A') color = 'bg-green-500';
              if (grade === 'B') color = 'bg-lime-500';
              if (grade === 'C') color = 'bg-yellow-400';
              if (grade === 'D') color = 'bg-red-400';

              return (
                <div key={grade} className="flex flex-col items-center gap-2 h-full justify-end">
                  <div className="text-sm font-bold text-slate-700">{count}</div>
                  <div 
                    className={`w-full rounded-t-lg transition-all duration-500 ${color}`}
                    style={{ height: `${Math.max(height, 5)}%` }} // 최소 높이 5%
                  />
                  <div className="text-sm font-medium text-slate-600">{grade}등급</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* (2) BII Balance */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6">전략 유형 (BII)</h3>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Build (기반구축)</span>
                <span className="text-slate-500">{biiStats.Build}건</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-violet-500 rounded-full transition-all duration-500"
                  style={{ width: `${objectives.length > 0 ? (biiStats.Build / objectives.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Innovate (혁신)</span>
                <span className="text-slate-500">{biiStats.Innovate}건</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${objectives.length > 0 ? (biiStats.Innovate / objectives.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Improve (개선)</span>
                <span className="text-slate-500">{biiStats.Improve}건</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${objectives.length > 0 ? (biiStats.Improve / objectives.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <div className="text-xs text-slate-500 mb-1">총 목표 수</div>
            <div className="text-3xl font-bold text-slate-900">{objectives.length}</div>
          </div>
        </div>
      </div>

      {/* 3. 목표 목록 요약 (Recent Objectives) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">목표 달성 현황</h3>
          <button className="text-sm text-blue-600 font-medium hover:text-blue-700">전체보기</button>
        </div>
        <div className="divide-y divide-slate-100">
          {objectives.length === 0 ? (
            <div className="p-8 text-center text-slate-500">등록된 목표가 없습니다.</div>
          ) : (
            objectives.slice(0, 5).map(obj => {
              const bii = getBIIColor(obj.biiType);
              // 해당 목표의 KR 평균 진척률
              const myKRs = krs.filter(k => k.objectiveId === obj.id);
              const progress = myKRs.length > 0 
                ? Math.round(myKRs.reduce((sum, k) => sum + (k.progressPct || 0), 0) / myKRs.length)
                : 0;

              return (
                <div key={obj.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${bii.bg} ${bii.text} w-16 text-center`}>
                      {obj.biiType}
                    </span>
                    <div>
                      <div className="font-medium text-slate-900">{obj.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{myKRs.length} Key Results</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">진행률</span>
                        <span className="font-bold text-slate-900">{progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${progress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}