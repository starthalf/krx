import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom'; // URL 감지를 위해 추가
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import KRCard from '../components/KRCard';

export default function OKRStatus() {
  const location = useLocation(); // 현재 주소 가져오기
  const selectedOrgId = useStore(state => state.selectedOrgId);
  const getOrgById = useStore(state => state.getOrgById);
  const getObjectivesByOrgId = useStore(state => state.getObjectivesByOrgId);
  const getKRsByObjectiveId = useStore(state => state.getKRsByObjectiveId);

  // URL에 따라 보여줄 조직 ID 결정
  const [currentOrgId, setCurrentOrgId] = useState('org-marketing');

  useEffect(() => {
    // 메뉴 클릭에 따라 보여줄 조직을 매핑합니다.
    // 실제 앱에서는 클릭한 조직의 ID를 넘겨받겠지만, 데모에서는 대표 조직을 보여줍니다.
    if (location.pathname.includes('/okr/company')) {
      setCurrentOrgId('org-ceo'); // 전사 -> CEO 조직 (데이터 필요)
    } else if (location.pathname.includes('/okr/division')) {
      setCurrentOrgId('org-marketing'); // 본부 -> 마케팅본부
    } else if (location.pathname.includes('/okr/team')) {
      setCurrentOrgId('org-marketing-planning'); // 팀 -> 마케팅기획팀 (데이터 필요)
    } else {
      // 그 외의 경우(조직도에서 선택해서 들어온 경우 등) 선택된 ID 사용
      setCurrentOrgId(selectedOrgId || 'org-marketing');
    }
  }, [location.pathname, selectedOrgId]);

  const org = getOrgById(currentOrgId);
  const objectives = getObjectivesByOrgId(currentOrgId);

  // 데이터가 없을 경우에 대한 방어 로직
  if (!org) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p className="mb-2">해당 조직({currentOrgId})의 데이터를 찾을 수 없습니다.</p>
        <p className="text-sm">mockData.ts에 해당 조직과 OKR 데이터가 있는지 확인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500 mb-1">
            {/* 상위 조직 경로를 동적으로 보여주면 더 좋습니다 */}
            OKR 현황 &gt; {org.level}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{org.name} OKR</h1>
        </div>
        <select className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
          <option value="2025-H1">2025년 상반기</option>
          <option value="2025-H2">2025년 하반기</option>
        </select>
      </div>

      {objectives.length === 0 ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-10 text-center text-slate-500">
          등록된 목표가 없습니다.
        </div>
      ) : (
        <div className="space-y-6">
          {objectives.map((objective) => {
            const krs = getKRsByObjectiveId(objective.id);
            const totalProgress = krs.length > 0
              ? Math.round(krs.reduce((sum, kr) => sum + kr.progressPct, 0) / krs.length)
              : 0;
            const biiColor = getBIIColor(objective.biiType);

            return (
              <div key={objective.id} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-lg">📌</span>
                    <h2 className="text-lg font-semibold text-slate-900">
                      목표 {objective.order}: {objective.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                      {objective.biiType}
                    </span>
                    <span className="text-sm text-slate-600">재무 관점</span>
                    <span className="text-sm text-slate-600">진행률 {totalProgress}%</span>
                  </div>
                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${totalProgress}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {krs.map((kr) => (
                    <KRCard key={kr.id} kr={kr} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}