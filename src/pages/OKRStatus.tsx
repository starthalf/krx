// src/pages/OKRStatus.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import KRCard from '../components/KRCard';
import { Loader2 } from 'lucide-react';

export default function OKRStatus() {
  const { orgId } = useParams<{ orgId?: string }>();
  const { 
    organizations, 
    objectives, 
    krs,
    fetchObjectives,
    fetchKRs,
    loading 
  } = useStore();

  // 기본 조직 ID (마케팅본부)
  const defaultOrgId = '20000000-0000-0000-0000-000000000001';
  const currentOrgId = orgId || defaultOrgId;

  // 데이터 로딩
  useEffect(() => {
    console.log('🔄 OKRStatus: 데이터 로딩 시작', currentOrgId);
    fetchObjectives(currentOrgId);
    fetchKRs(currentOrgId);
  }, [currentOrgId, fetchObjectives, fetchKRs]);

  const org = organizations.find(o => o.id === currentOrgId);
  const orgObjectives = objectives.filter(o => o.orgId === currentOrgId);

  // 로딩 중
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-slate-600">OKR 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  // 조직을 찾을 수 없음
  if (!org) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800 mb-2">해당 조직을 찾을 수 없습니다</p>
          <p className="text-sm text-yellow-600">조직 ID: {currentOrgId}</p>
        </div>
      </div>
    );
  }

  // 목표가 없음
  if (orgObjectives.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div>
          <div className="text-sm text-slate-500 mb-1">OKR 현황</div>
          <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <p className="text-blue-800 mb-2">아직 설정된 목표가 없습니다</p>
          <p className="text-sm text-blue-600 mb-4">
            목표 수립 페이지에서 OKR을 설정해주세요
          </p>
          <a 
            href={`/wizard/${currentOrgId}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            목표 수립하기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500 mb-1">OKR 현황</div>
          <h1 className="text-2xl font-bold text-slate-900">{org.name}</h1>
          <p className="text-sm text-slate-600 mt-1">{org.mission}</p>
        </div>
        <select className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
          <option value="2025-H1">2025년 상반기</option>
          <option value="2025-H2">2025년 하반기</option>
        </select>
      </div>

      {/* 목표 목록 */}
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

          // 가중치 합계
          const totalWeight = objectiveKRs.reduce((sum, kr) => sum + kr.weight, 0);

          return (
            <div key={objective.id} className="bg-white rounded-xl border border-slate-200 p-6">
              {/* 목표 헤더 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getBIIColor(objective.biiType)}`}>
                      {objective.biiType}
                    </span>
                    <span className="text-sm text-slate-500">
                      KR {objectiveKRs.length}개 • 가중치 {totalWeight}%
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{objective.name}</h2>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-slate-900">{totalProgress}%</div>
                  <div className="text-sm text-slate-500">전체 진행률</div>
                </div>
              </div>

              {/* 진행률 바 */}
              <div className="mb-6">
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      totalProgress >= 100 ? 'bg-green-500' :
                      totalProgress >= 70 ? 'bg-blue-500' :
                      totalProgress >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(totalProgress, 100)}%` }}
                  />
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
    </div>
  );
}