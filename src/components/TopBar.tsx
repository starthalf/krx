import { Bell, User } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function TopBar() {
  const company = useStore(state => state.company);
  const currentPeriod = useStore(state => state.currentPeriod);
  const setCurrentPeriod = useStore(state => state.setCurrentPeriod);

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-900">{company.name}</h1>
        <div className="h-4 w-px bg-slate-300" />
        <select
          value={currentPeriod}
          onChange={(e) => setCurrentPeriod(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="2025-H1">2025년 상반기</option>
          <option value="2025-H2">2025년 하반기</option>
          <option value="2024-H2">2024년 하반기</option>
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        <div className="h-8 w-px bg-slate-300" />
        <button className="flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium">관리자</span>
        </button>
      </div>
    </div>
  );
}
