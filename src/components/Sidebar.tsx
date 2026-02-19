// src/components/Sidebar.tsx
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Target, 
  TrendingUp, 
  CheckSquare, 
  Building2, 
  BookOpen,
  Inbox,
  Bell,
  GitBranch,
  Megaphone,
  ClipboardList
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface NavItem {
  name: string;
  href?: string;
  icon: any;
  requiredLevel?: number; // 이 레벨 이상만 표시
  children?: { name: string; href: string }[];
}

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [maxRoleLevel, setMaxRoleLevel] = useState<number>(0);

  // 사용자의 최고 역할 레벨 조회
  useEffect(() => {
    if (!user?.id) return;

    const loadRole = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('roles!inner(level)')
        .eq('profile_id', user.id);

      if (data && data.length > 0) {
        const max = Math.max(...data.map((r: any) => r.roles?.level || 0));
        setMaxRoleLevel(max);
      }
    };

    loadRole();
  }, [user?.id]);

  const navigation: NavItem[] = [
    { name: '대시보드', href: '/', icon: Home },
   // CEO/관리자 전용 (level >= 90)
    { name: '전사 OKR 수립', href: '/ceo-okr-setup', icon: ClipboardList, requiredLevel: 90 },
    { name: '조직 OKR 수립', href: '/wizard', icon: Target },
       { name: '수립 현황', href: '/okr-setup', icon: Megaphone, requiredLevel: 90 },
    { name: 'OKR Map', href: '/okr-map', icon: GitBranch },
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
    { name: '승인 대기함', href: '/approval-inbox', icon: Inbox },
    { name: '알림', href: '/notifications', icon: Bell },
    { name: '조직 관리', href: '/organization', icon: Building2 },
    { name: 'KR지표 DB', href: '/kpi-pool', icon: BookOpen }
  ];

  // 역할 레벨에 따른 메뉴 필터링
  const filteredNavigation = navigation.filter(item => {
    if (!item.requiredLevel) return true;
    return maxRoleLevel >= item.requiredLevel;
  });

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
        {filteredNavigation.map((item) => {
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
        <div className="text-xs text-slate-400 text-center">
          OKRio v1.1.0
        </div>
      </div>
    </div>
  );
}