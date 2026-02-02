import { useStore } from '../store/useStore';
import { getBIIColor, formatNumber } from '../utils/helpers';
import KRCard from '../components/KRCard';

export default function OKRStatus() {
  const selectedOrgId = useStore(state => state.selectedOrgId);
  const getOrgById = useStore(state => state.getOrgById);
  const getObjectivesByOrgId = useStore(state => state.getObjectivesByOrgId);
  const getKRsByObjectiveId = useStore(state => state.getKRsByObjectiveId);

  const org = getOrgById(selectedOrgId || 'org-marketing');
  const objectives = getObjectivesByOrgId(selectedOrgId || 'org-marketing');

  if (!org) return <div className="p-6">조직을 찾을 수 없습니다</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500 mb-1">
            전사 &gt; {org.name}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{org.name} OKR</h1>
        </div>
        <select className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none">
          <option value="2025-H1">2025년 상반기</option>
          <option value="2025-H2">2025년 하반기</option>
        </select>
      </div>

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
    </div>
  );
}
