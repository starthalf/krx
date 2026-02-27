// src/components/TopBar.tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, User, ChevronDown, Settings, LogOut, Shield, Inbox,
  Check, CheckCheck, Clock, Send, GitBranch, AlertTriangle,
  FileCheck, MessageSquare, Users, X
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { getMyRoleLevel } from '../lib/permissions';
import { supabase } from '../lib/supabase';

// 알림 타입별 아이콘/색상
const NOTIF_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  okr_draft_reminder:    { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  okr_deadline_reminder: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  okr_submitted:         { icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
  okr_approved:          { icon: FileCheck, color: 'text-green-600', bg: 'bg-green-50' },
  okr_rejected:          { icon: X, color: 'text-red-600', bg: 'bg-red-50' },
  okr_revision_requested:{ icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50' },
  okr_finalized:         { icon: CheckCheck, color: 'text-green-600', bg: 'bg-green-50' },
  cascade_available:     { icon: GitBranch, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  cascade_updated:       { icon: GitBranch, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  review_request:        { icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
  collaboration_request: { icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
  feedback_received:     { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
  checkin_reminder:      { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  checkin_overdue:       { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  ceo_review_needed:     { icon: FileCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
  ceo_approved:          { icon: CheckCheck, color: 'text-green-600', bg: 'bg-green-50' },
  ceo_rejected:          { icon: X, color: 'text-red-600', bg: 'bg-red-50' },
  mention:               { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
  system:                { icon: Bell, color: 'text-slate-600', bg: 'bg-slate-50' },
};

interface NotifItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  priority: string;
  action_url: string | null;
  created_at: string;
  sender_name: string | null;
}

export default function TopBar() {
  const navigate = useNavigate();
const { profile, user, signOut } = useAuth();
  const company = useStore(state => state.company);
  const currentPeriod = useStore(state => state.currentPeriod);
  const setCurrentPeriod = useStore(state => state.setCurrentPeriod);

  // 기존 상태
  const [showDropdown, setShowDropdown] = useState(false);
  const [roleLevel, setRoleLevel] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 알림 상태 (NEW)
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // 권한 체크 (기존)
  useEffect(() => {
    const checkRole = async () => {
      const level = await getMyRoleLevel();
      setRoleLevel(level);
    };
    checkRole();
  }, []);

  // 외부 클릭 감지
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ==================== 알림 로직 (NEW) ====================

  const fetchNotifs = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifs(data || []);
      setUnreadCount((data || []).filter((n: any) => !n.is_read).length);
    } catch (err) {
      console.warn('알림 조회 실패:', err);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchNotifs();

    const channel = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          setNotifs(prev => [payload.new as NotifItem, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('recipient_id', user.id).eq('is_read', false);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const onNotifClick = (n: NotifItem) => {
    if (!n.is_read) markRead(n.id);
    if (n.action_url) { navigate(n.action_url); setShowNotif(false); }
  };

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const days = Math.floor(h / 24);
    return days < 7 ? `${days}일 전` : new Date(d).toLocaleDateString('ko-KR');
  };

  // ==================== 기존 핸들러 ====================

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleMySettings = () => { setShowDropdown(false); navigate('/my-settings'); };
  const handleAdminSettings = () => { navigate('/admin'); };

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
<h1 className="text-lg font-semibold text-slate-900">{company?.name || 'OKR Drive'}</h1>
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
        {/* [NEW] 승인 대기함 바로가기 */}
        <button
          onClick={() => navigate('/approval-inbox')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="승인 대기함"
        >
          <Inbox className="w-4 h-4" />
          <span className="hidden lg:inline">승인함</span>
        </button>

        {/* [NEW] 알림 벨 + 드롭다운 */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotif(!showNotif); if (!showNotif) fetchNotifs(); }}
            className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">알림</h3>
                  {unreadCount > 0 && <span className="bg-red-100 text-red-700 text-xs font-medium px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">모두 읽음</button>}
                  <button onClick={() => { navigate('/notifications'); setShowNotif(false); }} className="text-xs text-slate-500 hover:text-slate-700">전체 보기</button>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">새로운 알림이 없습니다</p>
                  </div>
                ) : notifs.slice(0, 10).map(n => {
                  const cfg = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.system;
                  const Icon = cfg.icon;
                  return (
                    <div key={n.id} onClick={() => onNotifClick(n)} className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${!n.is_read ? 'bg-blue-50/40' : ''}`}>
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900 truncate">{n.title}</span>
                            {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                            {n.priority === 'urgent' && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded font-medium">긴급</span>}
                            {n.priority === 'high' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded font-medium">중요</span>}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {n.sender_name && <span className="text-[10px] text-slate-400">{n.sender_name}</span>}
                            <span className="text-[10px] text-slate-400">{timeAgo(n.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {notifs.length > 10 && (
                <div className="px-4 py-2 border-t border-slate-100 text-center">
                  <button onClick={() => { navigate('/notifications'); setShowNotif(false); }} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+{notifs.length - 10}개 더 보기</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 관리자 설정 (레벨 90 이상) - 기존 */}
        {roleLevel >= 80 && (
          <>
            <div className="h-8 w-px bg-slate-300" />
            <button onClick={handleAdminSettings} className="px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2" title="관리자 설정">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium hidden lg:inline">관리자 설정</span>
            </button>
          </>
        )}

        <div className="h-8 w-px bg-slate-300" />

        {/* 사용자 메뉴 - 기존 */}
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium hidden lg:inline">{profile?.full_name || '사용자'}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-2 z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-semibold text-slate-900">{profile?.full_name || '사용자'}</div>
                <div className="text-xs text-slate-500 truncate">{(profile as any)?.email || ''}</div>
              </div>
              <button onClick={handleMySettings} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                <Settings className="w-4 h-4 text-slate-500" />
                <span>내 설정</span>
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
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