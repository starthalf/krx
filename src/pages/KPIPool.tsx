import { useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function KPIPool() {
  const poolKPIs = useStore(state => state.poolKPIs);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFunction, setSelectedFunction] = useState<string>('');

  const filteredKPIs = poolKPIs.filter(kpi => {
    const matchesSearch = kpi.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kpi.definition.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFunction = !selectedFunction || kpi.functionTags.includes(selectedFunction);
    return matchesSearch && matchesFunction;
  });

  const functionTags = ['구매', '생산', '품질', '영업', '마케팅', 'R&D', '인사', '재경', 'IT', '기획'];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">KPI Pool</h1>
        <p className="text-slate-600">전사 공통 KPI 라이브러리</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="지표명, 키워드 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedFunction('')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedFunction === ''
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            전체
          </button>
          {functionTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedFunction(tag)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                selectedFunction === tag
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                지표명
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                직능
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                정의
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                관점
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                유형
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                사용횟수
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">

              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredKPIs.map((kpi) => (
              <tr key={kpi.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-900">{kpi.name}</div>
                  <div className="text-xs text-slate-500">{kpi.unit}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1 flex-wrap">
                    {kpi.functionTags.slice(0, 2).map(tag => (
                      <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-700 line-clamp-2">{kpi.definition}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{kpi.perspective}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{kpi.indicatorType}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-slate-900">{kpi.usageCount}</span>
                </td>
                <td className="px-6 py-4">
                  <button className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    📋 추가
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        <button className="px-3 py-1 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">
          이전
        </button>
        <span className="text-sm text-slate-600">1 / 3</span>
        <button className="px-3 py-1 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50">
          다음
        </button>
      </div>
    </div>
  );
}
