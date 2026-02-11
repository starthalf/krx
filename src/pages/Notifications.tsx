// src/pages/Notifications.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Check, CheckCheck, Clock, Send, GitBranch, AlertTriangle,
  FileCheck, MessageSquare, Users, X, Filter, Search, Trash2, Archive
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  okr_draft_reminder:    { icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'OKR 작성 리마인더' },
  okr_deadline_reminder: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50', label: '마감 임박' },
  okr_submitted:         { icon: Send, color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'OKR 제출됨' },
  okr_approved:          { icon: FileCheck, color: 'text-green-600', bgColor: 'bg-green-50', label: '승인됨' },
  okr_rejected:          { icon: X, color: 'text-red-600', bgColor: 'bg-red-50', label: '반려됨' },
  okr_revision_requested:{ icon: MessageSquare, color: 'text-amber-600', bgColor: 'bg-amber-50', label: '수정 요청' },
  okr_finalized:         { icon: CheckCheck, color: 'text-green-600', bgColor: 'bg-green-50', label: '최종 확정' },
  cascade_available:     { icon: GitBranch, color: 'text-indigo-600', bgColor: 'bg-indigo-50', label: 'Cascading 가능' },
  cascade_updated:       { icon: GitBranch, color: 'text-indigo-600', bgColor: 'bg-indigo-50', label: 'Cascading 업데이트' },
  review_request:        { icon: Users, color: 'text-violet-600', bgColor: 'bg-violet-50', label: '검토 요청' },
  collaboration_request: { icon: Users, color: 'text-violet-600', bgColor: 'bg-violet-50', label: '협조 요청' },
  feedback_received:     { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-50', label: '피드백' },
  checkin_reminder:      { icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', label: '체크인 리마인더' },
  checkin_overdue:       { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50', label: '체크인 미달' },
  ceo_review_needed:     { icon: FileCheck, color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'CEO 검토 필요' },
  ceo_approved:          { icon: CheckCheck, color: 'text-green-600', bgColor: 'bg-green-50', label: 'CEO 승인' },
  ceo_rejected:          { icon: X, color: 'text-red-600', bgColor: 'bg-red-50', label: 'CEO 반려' },
  mention:               { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-50', label: '멘션' },
  system:                { icon: Bell, color: 'text-slate-600', bgColor: 'bg-slate-50', label: '시스템' },
};

const FILTER_GROUPS = [
  { key: 'all', label: '전체' },
  { key: 'approval', label: '승인', types: ['okr_submitted', 'okr_approved', 'okr_rejected', 'okr_revision_requested', 'ceo_review_needed', 'ceo_approved', 'ceo_rejected'] },
  { key: 'cascade', label: 'Cascading', types: ['cascade_available', 'cascade_updated'] },
  { key: 'review', label: '검토/협조', types: ['review_request', 'collaboration_request', 'feedback_received'] },
  { key: 'reminder', label: '리마인더', types: ['okr_draft_reminder', 'okr_deadline_reminder', 'checkin_reminder', 'checkin_overdue'] },
];

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  priority: string;
  action_url: string | null;
  created_at: string;
  sender_name: string | null;
  org_id: string | null;
}

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchAll = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (showUnreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.warn('알림 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [user?.id, showUnreadOnly]);

  // 필터링
  const filtered = notifications.filter(n => {
    const group = FILTER_GROUPS.find(g => g.key === activeFilter);
    if (group && group.types && !group.types.includes(n.type)) return false;
    if (searchQuery && !n.title.includes(searchQuery) && !n.message.includes(searchQuery)) return false;
    return true;
  });

  // 읽음 처리
  const markAsRead = async (ids: string[]) => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids);
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
    setSelectedIds(new Set());
  };

  // 삭제
  const deleteNotifications = async (ids: string[]) => {
    if (!confirm(`${ids.length}개 알림을 삭제하시겠습니까?`)) return;
    await supabase.from('notifications').delete().in('id', ids);
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    setSelectedIds(new Set());
  };

  // 전체 선택 토글
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(n => n.id)));
    }
  };

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

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">알림</h1>
          <p className="text-sm text-slate-500 mt-1">
            전체 {notifications.length}건 · 읽지 않음 {unreadCount}건
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAsRead(notifications.filter(n => !n.is_read).map(n => n.id))}
              className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              전체 읽음 처리
            </button>
          )}
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* 카테고리 필터 */}
          <div className="flex gap-1">
            {FILTER_GROUPS.map(g => (
              <button
                key={g.key}
                onClick={() => setActiveFilter(g.key)}
                className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                  activeFilter === g.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200" />

          {/* 검색 */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="알림 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* 읽지 않음만 */}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600"
            />
            읽지 않음만
          </label>
        </div>

        {/* 선택 액션 */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">{selectedIds.size}개 선택됨</span>
            <button
              onClick={() => markAsRead(Array.from(selectedIds))}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> 읽음 처리
            </button>
            <button
              onClick={() => deleteNotifications(Array.from(selectedIds))}
              className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> 삭제
            </button>
          </div>
        )}
      </div>

      {/* 알림 목록 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* 전체 선택 헤더 */}
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
          <input
            type="checkbox"
            checked={selectedIds.size === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-slate-300 text-blue-600"
          />
          <span className="text-xs text-slate-500">
            {filtered.length}건 표시 중
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">알림이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((notif) => {
              const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
              const IconComp = config.icon;
              const isSelected = selectedIds.has(notif.id);

              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${
                    !notif.is_read ? 'bg-blue-50/30' : ''
                  } ${isSelected ? 'bg-blue-50/60' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(notif.id)) next.delete(notif.id);
                        else next.add(notif.id);
                        return next;
                      });
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 mt-1 flex-shrink-0"
                  />

                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor}`}
                  >
                    <IconComp className={`w-4 h-4 ${config.color}`} />
                  </div>

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      if (!notif.is_read) markAsRead([notif.id]);
                      if (notif.action_url) navigate(notif.action_url);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      {!notif.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-slate-900">{notif.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                      {notif.priority === 'urgent' && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">긴급</span>
                      )}
                      {notif.priority === 'high' && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">중요</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{notif.message}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {notif.sender_name && (
                        <span className="text-[10px] text-slate-400">보낸 사람: {notif.sender_name}</span>
                      )}
                      <span className="text-[10px] text-slate-400">{timeAgo(notif.created_at)}</span>
                    </div>
                  </div>

                  {/* 개별 액션 */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead([notif.id])}
                        title="읽음 처리"
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotifications([notif.id])}
                      title="삭제"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}