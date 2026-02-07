import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, ChevronDown, Settings, LogOut } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';

export default function TopBar() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const company = useStore(state => state.company);
  const currentPeriod = useStore(state => state.currentPeriod);
  const setCurrentPeriod = useStore(state => state.setCurrentPeriod);
  
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      const { supabase } = await import('../lib/supabase');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleMySettings = () => {
    setShowDropdown(false);
    navigate('/my-settings');
  };

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* 회사명 */}
        <h1 className="text-lg font-semibold text-slate-900">
          {company?.name || 'Loading...'}
        </h1>
        <div className="h-4 w-px bg-slate-300" />
        
        {/* 기간 선택 */}
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
        {/* 알림 */}
        <button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
        
        <div className="h-8 w-px bg-slate-300" />
        
        {/* 내 설정 드롭다운 */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium">{profile?.full_name || '사용자'}</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${
                showDropdown ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* 드롭다운 메뉴 */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-2 z-50">
              {/* 사용자 정보 */}
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-semibold text-slate-900">
                  {profile?.full_name || '사용자'}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {profile?.email || ''}
                </div>
              </div>

              {/* 메뉴 아이템 */}
              <button
                onClick={handleMySettings}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-500" />
                <span>내 설정</span>
              </button>

              <div className="border-t border-slate-100 my-1"></div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>로그아웃</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}