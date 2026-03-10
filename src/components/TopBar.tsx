// src/components/TopBar.tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, User, ChevronDown, Settings, LogOut, Shield, Inbox,
  Check, CheckCheck, Clock, Send, GitBranch, AlertTriangle,
  FileCheck, MessageSquare, Users, X, Calendar
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { getMyRoleLevel } from '../lib/permissions';
import { supabase } from '../lib/supabase';

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

interface PeriodOption {
  id: string;
  period_code: string;
  period_name: string;
  period_type: string;
  status: string;
  starts_at: string;
  ends_at: string;
}

function periodStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    upcoming: { label: '예정', cls: 'bg-slate-100 text-slate-500' },
    planning: { label: '수립중', cls: 'bg-blue-100 text-blue-700' },
    active:   { label: '실행중', cls: 'bg-green-100 text-green-700' },
    closing:  { label: '마감중', cls: 'bg-orange-100 text-orange-700' },
    closed:   { label: '마감', cls: 'bg-slate-200 text-slate-600' },
  };
  return map[status] || { label: status, cls: 'bg-slate-100 text-slate-500' };
}

export default function TopBar() {
  const navigate = useNavigate();
  const { profile, user, signOut } = useAuth();
  const company = useStore(state => state.company);

  // ★ 모든 useState를 먼저 선언
  const [showDropdown, setShowDropdown] = useState(false);
  const [roleLevel, setRoleLevel] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [periods, setPeriods] = useState<PeriodOption[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [localPeriod, setLocalPeriod] = useState<string>(''); // ★ 반드시 여기서 선언

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // ★ store의 currentPeriod 안전 접근 (없을 수 있음)
  const storeCurrentPeriod = useStore(state => (state as any).currentPeriod) as string | undefined;
  const storeSetCurrentPeriod = useStore(state => (state as any).setCurrentPeriod) as ((v: string) => void) | undefined;

  // ★ 현재 기간값 (store 우선, 없으면 로컬)
  const currentPeriod = storeCurrentPeriod || localPeriod;
  const setCurrentPeriod = (code: string) => {
    setLocalPeriod(code);
    if (storeSetCurrentPeriod) {
      try { storeSetCurrentPeriod(code); } catch {}
    }
  };

  // 권한 체크
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

  // ★ fiscal_periods에서 기간 목록 로딩
  useEffect(() => {
    const loadPeriods = async () => {
      const companyId = company?.id || profile?.company_id;
      if (!companyId) return;

      setPeriodsLoading(true);
      try {
        const { data: companyData } = await supabase
          .from('companies')
          .select('okr_cycle_unit')
          .eq('id', companyId)
          .single();

        const cycleUnit = companyData?.okr_cycle_unit || 'half';

        let { data, error } = await supabase
          .from('fiscal_periods')
          .select('id, period_code, period_name, period_type, status, starts_at, ends_at')
          .eq('company_id', companyId)
          .eq('period_type', cycleUnit)
          .order('period_code', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
          const { data: allPeriods } = await supabase
            .from('fiscal_periods')
            .select('id, period_code, period_name, period_type, status, starts_at, ends_at')
            .eq('company_id', companyId)
            .in('period_type', ['half', 'quarter', 'year'])
            .order('period_code', { ascending: false });
          data = allPeriods || [];
        }

        setPeriods(data || []);

        if (data && data.length > 0) {
          const now = new Date();
          const active = data.find(p => p.status === 'active');
          const planning = data.find(p => p.status === 'planning');
          const current = data.find(p => new Date(p.starts_at) <= now && now <= new Date(p.ends_at));
          const best = active || planning || current || data[0];

          const existsInList = data.some(p => p.period_code === currentPeriod);
          if (!currentPeriod || !existsInList) {
            setCurrentPeriod(best.period_code);
          }
        }
      } catch (err) {
        console.warn('기간 목록 로드 실패:', err);
      } finally {
        setPeriodsLoading(false);
      }
    };

    loadPeriods();
  }, [company?.id, profile?.company_id]);

  // ==================== 알림 ====================

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

  const handleLogout = async () => {
    try { await signOut(); navigate('/login'); } catch (error) { console.error('Logout failed:', error); }
  };
  const handleMySettings = () => { setShowDropdown(false); navigate('/my-settings'); };
  const handleAdminSettings = () => { navigate('/admin'); };

  return (
    <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-slate-900">{company?.name || 'OKR-Driven'}</h1>
        <div className="h-4 w-px bg-slate-300" />

        {periods.length > 0 ? (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={currentPeriod}
              onChange={(e) => setCurrentPeriod(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {periods.map(p => {
                const badge = periodStatusBadge(p.status);
                return (
                  <option key={p.id} value={p.period_code}>
                    {p.period_name || p.period_code} ({badge.label})
                  </option>
                );
              })}
            </select>
          </div>
        ) : periodsLoading ? (
          <span className="text-xs text-slate-400">기간 로딩...</span>
        ) : (
          <span className="text-xs text-slate-400">설정된 기간이 없습니다</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/approval-inbox')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="승인 대기함">
          <Inbox className="w-4 h-4" /><span className="hidden lg:inline">승인함</span>
        </button>

        <div className="relative" ref={notifRef}>
          <button onClick={() => { setShowNotif(!showNotif); if (!showNotif) fetchNotifs(); }} className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
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
                  <div className="p-8 text-center"><Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">새로운 알림이 없습니다</p></div>
                ) : notifs.slice(0, 10).map(n => {
                  const cfg = NOTIF_CONFIG[n.type] || NOTIF_CONFIG.system;
                  const Icon = cfg.icon;
                  return (
                    <div key={n.id} onClick={() => onNotifClick(n)} className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${!n.is_read ? 'bg-blue-50/40' : ''}`}>
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}><Icon className={`w-4 h-4 ${cfg.color}`} /></div>
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

        {roleLevel >= 80 && (
          <>
            <div className="h-8 w-px bg-slate-300" />
            <button onClick={handleAdminSettings} className="px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2" title="관리자 설정">
              <Shield className="w-4 h-4" /><span className="text-sm font-medium hidden lg:inline">관리자 설정</span>
            </button>
          </>
        )}

        <div className="h-8 w-px bg-slate-300" />

        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 px-3 py-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center"><User className="w-4 h-4 text-white" /></div>
            <span className="text-sm font-medium hidden lg:inline">{profile?.full_name || '사용자'}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg py-2 z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="text-sm font-semibold text-slate-900">{profile?.full_name || '사용자'}</div>
                <div className="text-xs text-slate-500 truncate">{(profile as any)?.email || ''}</div>
              </div>
              <button onClick={handleMySettings} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"><Settings className="w-4 h-4 text-slate-500" /><span>내 설정</span></button>
              <div className="border-t border-slate-100 my-1" />
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"><LogOut className="w-4 h-4" /><span>로그아웃</span></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}