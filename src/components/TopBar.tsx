// src/components/TopBar.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, User, Check, CheckCheck, Clock, Send, GitBranch, AlertTriangle, FileCheck, MessageSquare, Users, X, Inbox } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// 알림 타입 아이콘/색상 매핑
const NOTIFICATION_CONFIG: Record<string, { icon: any; color: string; bgColor: string }> = {
  okr_draft_reminder: { icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  okr_deadline_reminder: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' },
  okr_submitted: { icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  okr_approved: { icon: FileCheck, color: 'text-green-600', bgColor: 'bg-green-50' },
  okr_rejected: { icon: X, color: 'text-red-600', bgColor: 'bg-red-50' },
  okr_revision_requested: { icon: MessageSquare, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  okr_finalized: { icon: CheckCheck, color: 'text-green-600', bgColor: 'bg-green-50' },
  cascade_available: { icon: GitBranch, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  cascade_updated: { icon: GitBranch, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  review_request: { icon: Users, color: 'text-violet-600', bgColor: 'bg-violet-50' },
  collaboration_request: { icon: Users, color: 'text-violet-600', bgColor: 'bg-violet-50' },
  feedback_received: { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  checkin_reminder: { icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  checkin_overdue: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50' },
  ceo_review_needed: { icon: FileCheck, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  ceo_approved: { icon: CheckCheck, color: 'text-green-600', bgColor: 'bg-green-50' },
  ceo_rejected: { icon: X, color: 'text-red-600', bgColor: 'bg-red-50' },
  mention: { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  system: { icon: Bell, color: 'text-slate-600', bgColor: 'bg-slate-50' },
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  action_url: string | null;
  created_at: string;
  sender_name: string | null;
  org_id: string | null;
}

export default function TopBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const company = useStore(state => state.company);
  const currentPeriod = useStore(state => state.currentPeriod);
  const setCurrentPeriod = useStore(state => state.setCurrentPeriod);

  const [showDropdown, setShowDropdown] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 알림 조회
  const fetchNotifications = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (err) {
      console.warn('알림 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 초기 로딩 + 실시간 구독
  useEffect(() => {
    if (!user?.id) return;
    fetchNotifications();

    // Realtime 구독
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 읽음 처리
  const markAsRead = async (notifId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notifId);

      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('읽음 처리 실패:', err);
    }
  };

  // 전체 읽음
  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('전체 읽음 실패:', err);
    }
  };

  // 알림 클릭 → 읽음 + 네비게이션
  const handleNotificationClick = (notif: Notification) => {
    if (!notif.is_read) markAsRead(notif.id);
    if (notif.action_url) {
      navigate(notif.action_url);
      setShowDropdown(false);
    }
  };

  // 상대 시간 포맷
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-900">
          {company?.name || 'Loading...'}
        </h1>
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
        {/* 승인 대기함 바로가기 */}
        <button
          onClick={() => navigate('/approval-inbox')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Inbox className="w-4 h-4" />
          <span>승인함</span>
        </button>

        {/* 알림 벨 */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              if (!showDropdown) fetchNotifications();
            }}
            className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* 드롭다운 */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              {/* 헤더 */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">알림</h3>
                  {unreadCount > 0 && (
                    <span className="bg-red-100 text-red-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      모두 읽음
                    </button>
                  )}
                  <button
                    onClick={() => {
                      navigate('/notifications');
                      setShowDropdown(false);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    전체 보기
                  </button>
                </div>
              </div>

              {/* 알림 목록 */}
              <div className="max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-sm text-slate-500">불러오는 중...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">새로운 알림이 없습니다</p>
                  </div>
                ) : (
                  notifications.slice(0, 10).map((notif) => {
                    const config = NOTIFICATION_CONFIG[notif.type] || NOTIFICATION_CONFIG.system;
                    const IconComp = config.icon;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${
                          !notif.is_read ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor}`}>
                            <IconComp className={`w-4 h-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900 truncate">{notif.title}</span>
                              {!notif.is_read && (
                                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                              )}
                              {notif.priority === 'urgent' && (
                                <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded font-medium">긴급</span>
                              )}
                              {notif.priority === 'high' && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded font-medium">중요</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {notif.sender_name && (
                                <span className="text-[10px] text-slate-400">{notif.sender_name}</span>
                              )}
                              <span className="text-[10px] text-slate-400">{timeAgo(notif.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 푸터 */}
              {notifications.length > 10 && (
                <div className="px-4 py-2 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      navigate('/notifications');
                      setShowDropdown(false);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    +{notifications.length - 10}개 더 보기
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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