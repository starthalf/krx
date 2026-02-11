// src/components/OKRCommentPanel.tsx
// OKR 코멘트/토론 패널 - 스레드형 댓글, @멘션, 유형별 분류
import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, AtSign, Reply, Check, MoreHorizontal,
  ChevronDown, ChevronUp, Lightbulb, FileCheck, X as XIcon, Edit3, Trash2, CheckCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Comment {
  id: string;
  content: string;
  comment_type: string;
  author_id: string;
  author_name: string;
  parent_comment_id: string | null;
  mentioned_user_ids: string[] | null;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  replies?: Comment[];
}

interface MentionUser {
  id: string;
  full_name: string;
}

interface OKRCommentPanelProps {
  // 대상 (하나만 전달)
  okrSetId?: string;
  objectiveId?: string;
  krId?: string;
  // 표시 제어
  compact?: boolean; // true면 축소 모드
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  comment: { icon: MessageSquare, label: '댓글', color: 'text-slate-600' },
  suggestion: { icon: Lightbulb, label: '제안', color: 'text-amber-600' },
  approval_note: { icon: FileCheck, label: '승인 메모', color: 'text-green-600' },
  rejection_reason: { icon: XIcon, label: '반려 사유', color: 'text-red-600' },
  revision_note: { icon: Edit3, label: '수정 요청', color: 'text-indigo-600' },
};

export default function OKRCommentPanel({ okrSetId, objectiveId, krId, compact = false }: OKRCommentPanelProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('comment');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [sending, setSending] = useState(false);

  // 멘션
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<MentionUser[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 코멘트 로딩
  const fetchComments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('okr_comments')
        .select('*')
        .is('parent_comment_id', null) // 최상위만
        .order('created_at', { ascending: true });

      if (okrSetId) query = query.eq('okr_set_id', okrSetId);
      else if (objectiveId) query = query.eq('objective_id', objectiveId);
      else if (krId) query = query.eq('kr_id', krId);

      const { data: topLevel, error } = await query;
      if (error) throw error;

      // 답글 로딩
      const enriched: Comment[] = [];
      for (const c of (topLevel || [])) {
        const { data: replies } = await supabase
          .from('okr_comments')
          .select('*')
          .eq('parent_comment_id', c.id)
          .order('created_at', { ascending: true });
        enriched.push({ ...c, replies: replies || [] });
      }

      setComments(enriched);
    } catch (err) {
      console.warn('코멘트 로딩 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComments(); }, [okrSetId, objectiveId, krId]);

  // 멘션 사용자 검색
  const searchMentionUsers = async (q: string) => {
    if (!q) { setMentionUsers([]); return; }
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', `%${q}%`)
        .limit(5);
      setMentionUsers(data || []);
    } catch { setMentionUsers([]); }
  };

  useEffect(() => {
    if (!showMention) return;
    const timer = setTimeout(() => searchMentionUsers(mentionQuery), 200);
    return () => clearTimeout(timer);
  }, [mentionQuery, showMention]);

  // @ 입력 감지
  const handleContentChange = (val: string) => {
    setNewContent(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0) {
      const afterAt = val.substring(lastAt + 1);
      if (!afterAt.includes(' ') && afterAt.length > 0 && afterAt.length < 20) {
        setShowMention(true);
        setMentionQuery(afterAt);
        return;
      }
    }
    setShowMention(false);
  };

  // 멘션 사용자 선택
  const insertMention = (u: MentionUser) => {
    const lastAt = newContent.lastIndexOf('@');
    const before = newContent.substring(0, lastAt);
    setNewContent(`${before}@${u.full_name} `);
    setSelectedMentions(prev => [...prev.filter(m => m.id !== u.id), u]);
    setShowMention(false);
    inputRef.current?.focus();
  };

  // 코멘트 등록
  const handleSubmit = async () => {
    if (!newContent.trim() || !user?.id) return;
    setSending(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const insertData: any = {
        content: newContent.trim(),
        comment_type: newType,
        author_id: user.id,
        author_name: profile?.full_name || '사용자',
        mentioned_user_ids: selectedMentions.length > 0 ? selectedMentions.map(m => m.id) : null,
      };

      // 대상 설정
      if (okrSetId) insertData.okr_set_id = okrSetId;
      else if (objectiveId) insertData.objective_id = objectiveId;
      else if (krId) insertData.kr_id = krId;

      // 답글이면 parent 설정
      if (replyTo) insertData.parent_comment_id = replyTo;

      const { error } = await supabase.from('okr_comments').insert(insertData);
      if (error) throw error;

      // 멘션된 사용자에게 알림 발송
      for (const m of selectedMentions) {
        await supabase.from('notifications').insert({
          recipient_id: m.id,
          type: 'mention',
          title: `${profile?.full_name || '누군가'}님이 멘션했습니다`,
          message: newContent.trim().substring(0, 100),
          priority: 'normal',
          action_url: okrSetId ? `/approval-inbox` : objectiveId ? `/okr/team` : `/checkin`,
          sender_id: user.id,
          sender_name: profile?.full_name,
        });
      }

      setNewContent('');
      setNewType('comment');
      setReplyTo(null);
      setSelectedMentions([]);
      fetchComments();
    } catch (err: any) {
      alert(`등록 실패: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // 해결 토글
  const toggleResolve = async (commentId: string, current: boolean) => {
    await supabase.from('okr_comments').update({
      is_resolved: !current,
      resolved_by: !current ? user?.id : null,
      resolved_at: !current ? new Date().toISOString() : null,
    }).eq('id', commentId);
    fetchComments();
  };

  // 삭제
  const deleteComment = async (commentId: string) => {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return;
    await supabase.from('okr_comments').delete().eq('id', commentId);
    fetchComments();
  };

  const timeAgo = (d: string) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  const totalCount = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  // 코멘트 렌더
  const renderComment = (c: Comment, isReply = false) => {
    const cfg = TYPE_CONFIG[c.comment_type] || TYPE_CONFIG.comment;
    const Icon = cfg.icon;
    const isOwn = c.author_id === user?.id;

    return (
      <div key={c.id} className={`${isReply ? 'ml-8 border-l-2 border-slate-100 pl-4' : ''} ${c.is_resolved ? 'opacity-60' : ''}`}>
        <div className="flex gap-3 py-3">
          {/* 아바타 */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold">
            {c.author_name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 min-w-0">
            {/* 헤더 */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-slate-900">{c.author_name}</span>
              {c.comment_type !== 'comment' && (
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.color} bg-slate-50`}>
                  {cfg.label}
                </span>
              )}
              <span className="text-[10px] text-slate-400">{timeAgo(c.created_at)}</span>
              {c.is_resolved && (
                <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                  <CheckCircle className="w-3 h-3" /> 해결됨
                </span>
              )}
            </div>

            {/* 본문 - @멘션 하이라이트 */}
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {c.content.split(/(@\S+)/g).map((part, i) =>
                part.startsWith('@') ? (
                  <span key={i} className="text-blue-600 font-medium bg-blue-50 px-0.5 rounded">{part}</span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </p>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-3 mt-1.5">
              {!isReply && (
                <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="text-[11px] text-slate-400 hover:text-blue-600 flex items-center gap-1">
                  <Reply className="w-3 h-3" /> 답글
                </button>
              )}
              <button onClick={() => toggleResolve(c.id, c.is_resolved)} className="text-[11px] text-slate-400 hover:text-green-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> {c.is_resolved ? '미해결' : '해결'}
              </button>
              {isOwn && (
                <button onClick={() => deleteComment(c.id)} className="text-[11px] text-slate-400 hover:text-red-600 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> 삭제
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 답글 */}
        {c.replies && c.replies.length > 0 && (
          <div className="space-y-0">
            {c.replies.map(r => renderComment(r, true))}
          </div>
        )}

        {/* 답글 입력 (이 댓글에 답글 쓰기 모드) */}
        {replyTo === c.id && (
          <div className="ml-10 mb-3 flex gap-2">
            <textarea
              value={newContent}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={`${c.author_name}님에게 답글...`}
              ref={inputRef}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
              rows={2}
            />
            <button onClick={handleSubmit} disabled={!newContent.trim() || sending} className="px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 self-end">
              <Send className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">토론</span>
          {totalCount > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{totalCount}</span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100">
          {/* 코멘트 목록 */}
          <div className="px-4 max-h-80 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="py-6 text-center text-sm text-slate-400">불러오는 중...</div>
            ) : comments.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">아직 코멘트가 없습니다</div>
            ) : (
              comments.map(c => renderComment(c))
            )}
          </div>

          {/* 새 코멘트 입력 */}
          {!replyTo && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              {/* 유형 선택 */}
              <div className="flex gap-1 mb-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setNewType(key)}
                    className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                      newType === key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={newContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
                  placeholder="의견을 남겨주세요... (@로 멘션)"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!newContent.trim() || sending}
                  className="absolute right-2 bottom-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>

                {/* 멘션 드롭다운 */}
                {showMention && mentionUsers.length > 0 && (
                  <div className="absolute left-0 bottom-full mb-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10 overflow-hidden">
                    {mentionUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => insertMention(u)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2"
                      >
                        <AtSign className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-medium text-slate-700">{u.full_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 멘션된 사용자 태그 */}
              {selectedMentions.length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {selectedMentions.map(m => (
                    <span key={m.id} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                      @{m.full_name}
                      <button onClick={() => setSelectedMentions(prev => prev.filter(p => p.id !== m.id))}>
                        <XIcon className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-slate-400 mt-1">Ctrl+Enter로 전송 · @로 멘션</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}