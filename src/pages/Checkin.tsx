// src/pages/CheckIn.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import KRCard from '../components/KRCard';
import OKRCommentPanel from '../components/OKRCommentPanel';
import { Loader2, Calendar } from 'lucide-react';

export default function Checkin() {
  const { 
    organizations, 
    objectives, 
    krs,
    fetchObjectives,
    fetchKRs,
    fetchCFRs, // [New] CFR 데이터 불러오기 함수 추가
    loading 
  } = useStore();

  // 선택된 조직 (드롭다운)
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  
  // 선택된 기간
  const [selectedPeriod, setSelectedPeriod] = useState('2025-03');

  // 초기 로딩: 첫 번째 조직 자동 선택
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      // 팀 레벨 조직 우선, 없으면 본부, 없으면 첫 번째 조직
      const teamOrg = organizations.find(o => o.level === '팀');
      const deptOrg = organizations.find(o => o.level === '본부');
      const firstOrg = teamOrg || deptOrg || organizations[0];
      
      setSelectedOrgId(firstOrg.id);
    }
  }, [organizations, selectedOrgId]);

  // 1. 조직이 선택되면 해당 조직의 목표와 KR 로딩
  useEffect(() => {
    if (selectedOrgId) {
      fetchObjectives(selectedOrgId);
      fetchKRs(selectedOrgId);
    }
  }, [selectedOrgId, fetchObjectives, fetchKRs]);

  // 2. [New] KRs가 로드되면 각 KR의 CFR(대화/피드백) 데이터 로딩
  useEffect(() => {
    if (selectedOrgId && krs.length > 0) {
      // 현재 선택된 조직의 KR만 필터링 (Store에 이미 필터링되어 있지만 안전장치)
      const orgKRs = krs.filter(k => k.orgId === selectedOrgId);
      
      orgKRs.forEach(kr => {
        fetchCFRs(kr.id);
      });
    }
  }, [selectedOrgId, krs, fetchCFRs]);

  // 현재 조직의 목표 필터링 (화면 표시용)
  const orgObjectives = objectives.filter(o => o.orgId === selectedOrgId);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 영역 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">체크인 (Check-in)</h1>
          <p className="text-slate-600 mt-1">목표 달성 현황을 점검하고 피드백을 나눕니다.</p>
        </div>
        
        <div className="flex gap-3">
          {/* 조직 선택 */}
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>

          {/* 기간 선택 */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            >
              <option value="2025-01">2025년 1월</option>
              <option value="2025-02">2025년 2월</option>
              <option value="2025-03">2025년 3월</option>
            </select>
          </div>
        </div>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* 목표 & KR 리스트 */}
      {!loading && orgObjectives.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-slate-500">등록된 목표가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {orgObjectives.map(objective => {
            const bii = getBIIColor(objective.biiType);
            const objectiveKRs = krs.filter(k => k.objectiveId === objective.id);
            
            // 목표 진행률 계산 (KR들의 평균)
            const totalProgress = objectiveKRs.length > 0
              ? Math.round(objectiveKRs.reduce((acc, kr) => acc + kr.progressPct, 0) / objectiveKRs.length)
              : 0;

            return (
              <div key={objective.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                {/* 목표 헤더 */}
                <div className="flex items-start justify-between mb-6 pb-6 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${bii.bg} ${bii.text}`}>
                        {objective.biiType}
                      </span>
                      <span className="text-xs text-slate-500">{objective.period}</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{objective.name}</h2>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-slate-900">{totalProgress}%</div>
                    <div className="text-sm text-slate-500">진행률</div>
                  </div>
                </div>

                {/* KR 카드들 */}
                {objectiveKRs.length > 0 ? (
                  <div className="space-y-4">
                    {objectiveKRs.map((kr) => (
                      <div key={kr.id}>
                        <KRCard kr={kr} />
                        {/* KR별 토론 (compact 모드) */}
                        <div className="mt-2 ml-4">
                          <OKRCommentPanel krId={kr.id} compact={true} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center text-slate-500">
                    이 목표에 연결된 KR이 없습니다
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 하단 액션 버튼 */}
      {orgObjectives.length > 0 && (
        <div className="flex justify-end gap-3 pt-4">
          <button className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
            임시 저장
          </button>
          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            체크인 완료
          </button>
        </div>
      )}
    </div>
  );
}