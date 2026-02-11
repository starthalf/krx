// src/components/Sidebar.tsx
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Target, 
  TrendingUp, 
  CheckSquare, 
  Building2, 
  BookOpen
} from 'lucide-react';

const navigation = [
  { name: '대시보드', href: '/', icon: Home },
  { name: '목표 수립', href: '/wizard', icon: Target },
  {
    name: 'OKR 현황',
    icon: TrendingUp,
    children: [
      { name: '전사 OKR', href: '/okr/company' },
      { name: '본부별 OKR', href: '/okr/division' },
      { name: '팀별 OKR', href: '/okr/team' }
    ]
  },
  { name: '체크인', href: '/checkin', icon: CheckSquare },
  { name: '조직 관리', href: '/organization', icon: Building2 },
  { name: 'KR지표 DB', href: '/kpi-pool', icon: BookOpen }
];

export default function Sidebar() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="w-60 bg-white border-r border-slate-200 h-screen flex flex-col">
      {/* 로고 */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">OKRio</span>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          if (item.children) {
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700">
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
                <div className="ml-6 space-y-1">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      to={child.href}
                      className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive(child.href)
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {child.name}
                    </Link>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              to={item.href!}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                isActive(item.href!)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* 하단 정보 */}
      <div className="p-4 border-t border-slate-200">
        {/* 버전 정보 */}
        <div className="text-xs text-slate-400 text-center">
          OKRio v1.0.0
        </div>
      </div>
    </div>
  );
}