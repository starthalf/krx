// src/pages/Checkin.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import KRCard from '../components/KRCard';
import { Loader2, Calendar } from 'lucide-react';

export default function Checkin() {
  const { 
    organizations, 
    objectives, 
    krs,
    fetchObjectives,
    fetchKRs,
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

  // 조직이 선택되면 해당 조직의 목표와 KR 로딩
  useEffect(() => {
    if (selectedOrgId) {
      console.log('🔄 Checkin: 데이터 로딩', selectedOrgId);
      fetchObjectives(selectedOrgId);
      fetchKRs(selectedOrgId);
    }
  }, [selectedOrgId, fetchObjectives, fetchKRs]);

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);
  const orgObjectives = objectives.filter(o => o.orgId === selectedOrgId);

  // 로딩 중
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-slate-600">체크인 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500 mb-1">실적 입력 및 관리</div>
          <h1 className="text-2xl font-bold text-slate-900">체크인</h1>
        </div>
        
        <div className="flex gap-3">
          {/* 기간 선택 */}
          <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2 bg-white">
            <Calendar className="w-4 h-4 text-slate-500" />
            <select 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="text-sm outline-none bg-transparent"
            >
              <option value="2025-01">2025년 1월</option>
              <option value="2025-02">2025년 2월</option>
              <option value="2025-03">2025년 3월</option>
              <option value="2025-04">2025년 4월</option>
              <option value="2025-05">2025년 5월</option>
              <option value="2025-06">2025년 6월</option>
              <option value="2025-Q1">2025년 1분기</option>
              <option value="2025-Q2">2025년 2분기</option>
            </select>
          </div>

          {/* 조직 선택 */}
          <select 
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
          >
            <option value="">조직 선택</option>
            {organizations
              .filter(o => o.level !== '전사') // 전사는 제외
              .map(org => (
                <option key={org.id} value={org.id}>
                  [{org.level}] {org.name}
                </option>
              ))
            }
          </select>
        </div>
      </div>

      {/* 선택된 조직 정보 */}
      {selectedOrg && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-blue-600 font-medium">
                {selectedOrg.level} • {selectedOrg.orgType}
              </div>
              <div className="text-lg font-semibold text-blue-900 mt-1">
                {selectedOrg.name}
              </div>
              {selectedOrg.mission && (
                <div className="text-sm text-blue-700 mt-1">
                  {selectedOrg.mission}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">
                {krs.length}개
              </div>
              <div className="text-sm text-blue-600">핵심결과</div>
            </div>
          </div>
        </div>
      )}

      {/* 목표가 없는 경우 */}
      {!selectedOrgId ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-slate-600 mb-2">조직을 선택해주세요</p>
          <p className="text-sm text-slate-500">
            위의 드롭다운에서 체크인할 조직을 선택하세요
          </p>
        </div>
      ) : orgObjectives.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-10 text-center">
          <p className="text-yellow-800 mb-2">아직 설정된 목표가 없습니다</p>
          <p className="text-sm text-yellow-600 mb-4">
            목표 수립 페이지에서 OKR을 설정해주세요
          </p>
          <a 
            href={`/wizard/${selectedOrgId}`}
            className="inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            목표 수립하기
          </a>
        </div>
      ) : (
        /* 목표별 KR 카드 목록 */
        <div className="space-y-6">
          {orgObjectives.map((objective) => {
            // 이 목표의 KR들
            const objectiveKRs = krs.filter(k => k.objectiveId === objective.id);
            
            // 진행률 계산
            const totalProgress = objectiveKRs.length > 0
              ? Math.round(
                  objectiveKRs.reduce((sum, kr) => sum + (kr.progressPct || 0), 0) / 
                  objectiveKRs.length
                )
              : 0;

            return (
              <div key={objective.id} className="bg-white rounded-xl border border-slate-200 p-6">
                {/* 목표 헤더 */}
                <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-200">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getBIIColor(objective.biiType)}`}>
                        {objective.biiType}
                      </span>
                      <span className="text-sm text-slate-500">
                        Objective
                      </span>
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
                      <KRCard key={kr.id} kr={kr} />
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