// src/components/CEONudgePanel.tsx
// 대표가 하위 조직장들에게 원클릭으로 목표수립 독촉하는 패널
// Dashboard에 임베드하거나 standalone으로 사용 가능
import { useState, useEffect } from 'react';
import {
  Megaphone, Send, Clock, Check, AlertTriangle, ChevronDown, ChevronUp,
  RefreshCw, Users, Target, Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';

interface OrgStatus {
  id: string;
  name: string;
  level: string;
  headName: string | null;
  headId: string | null;
  okrStatus: 'not_started' | 'draft' | 'submitted' | 'approved' | 'finalized';
  lastNudgedAt: string | null;
  selected: boolean;
}

export default function CEONudgePanel() {
  const { user } = useAuth();
  const { organizations, company } = useStore();
  const currentPeriod = useStore(state => state.currentPeriod);

  const [orgStatuses, setOrgStatuses] = useState<OrgStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [showCustomMessage, setShowCustomMessage] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  // 하위 조직 상태 조회
  const fetchOrgStatuses = async () => {
    setLoading(true);
    try {
      // 하위 조직 (전사 제외)
      const subOrgs = organizations.filter(o => o.level !== '전사');

      const statuses: OrgStatus[] = [];

      for (const org of subOrgs) {
        // OKR Set 상태 확인
        const { data: okrSet } = await supabase
          .from('okr_sets')
          .select('status')
          .eq('org_id', org.id)
          .eq('period', currentPeriod)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();

        // 조직장 조회 (user_roles + roles)
        const { data: headData } = await supabase
          .from('user_roles')
          .select('user_id, profiles!inner(full_name), roles!inner(name)')
          .eq('org_id', org.id)
          .in('roles.name', ['org_head', 'company_admin'])
          .limit(1)
          .maybeSingle();

        // 마지막 독촉 시간 확인
        const { data: lastNudge } = await supabase
          .from('notifications')
          .select('created_at')
          .eq('type', 'okr_draft_reminder')
          .eq('org_id', org.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let status: OrgStatus['okrStatus'] = 'not_started';
        if (okrSet?.status === 'finalized') status = 'finalized';
        else if (okrSet?.status === 'approved') status = 'approved';
        else if (okrSet?.status === 'submitted' || okrSet?.status === 'under_review') status = 'submitted';
        else if (okrSet?.status === 'draft' || okrSet?.status === 'revision_requested') status = 'draft';

        statuses.push({
          id: org.id,
          name: org.name,
          level: org.level,
          headName: (headData as any)?.profiles?.full_name || null,
          headId: (headData as any)?.user_id || null,
          okrStatus: status,
          lastNudgedAt: lastNudge?.created_at || null,
          selected: status === 'not_started' || status === 'draft', // 미완료 조직 자동 선택
        });
      }

      setOrgStatuses(statuses);
    } catch (err) {
      console.warn('조직 상태 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrgStatuses(); }, [organizations, currentPeriod]);

  // 선택 토글
  const toggleSelect = (orgId: string) => {
    setOrgStatuses(prev => prev.map(o => o.id === orgId ? { ...o, selected: !o.selected } : o));
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    const nudgeable = orgStatuses.filter(o => o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved');
    const allSelected = nudgeable.every(o => o.selected);
    setOrgStatuses(prev => prev.map(o =>
      o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved'
        ? { ...o, selected: !allSelected }
        : o
    ));
  };

  // 미완료만 선택
  const selectIncomplete = () => {
    setOrgStatuses(prev => prev.map(o => ({
      ...o,
      selected: o.headId !== null && (o.okrStatus === 'not_started' || o.okrStatus === 'draft'),
    })));
  };

  // 일괄 독촉 발송
  const handleBulkNudge = async () => {
    const targets = orgStatuses.filter(o => o.selected && o.headId);
    if (targets.length === 0) {
      alert('독촉할 조직을 선택해주세요.');
      return;
    }

    if (!confirm(`${targets.length}개 조직에 목표수립 독촉 알림을 보내시겠습니까?`)) return;

    setSending(true);
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      const defaultMsg = `${currentPeriod} OKR 수립 기한이 임박했습니다. 빠른 시일 내에 목표를 수립하고 제출해 주세요.`;
      const msg = nudgeMessage.trim() || defaultMsg;

      for (const org of targets) {
        await supabase.from('notifications').insert({
          recipient_id: org.headId,
          type: 'okr_draft_reminder',
          title: `📢 ${currentPeriod} OKR 수립 요청`,
          message: `${myProfile?.full_name || 'CEO'}님의 메시지: ${msg}`,
          priority: 'high',
          action_url: `/wizard/${org.id}`,
          sender_id: user?.id,
          sender_name: myProfile?.full_name || 'CEO',
          org_id: org.id,
        });
      }

      setLastSentAt(new Date().toISOString());
      setNudgeMessage('');
      setShowCustomMessage(false);
      fetchOrgStatuses(); // 갱신
      alert(`✅ ${targets.length}개 조직에 독촉 알림을 발송했습니다.`);
    } catch (err: any) {
      alert(`발송 실패: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // 통계
  const stats = {
    total: orgStatuses.length,
    notStarted: orgStatuses.filter(o => o.okrStatus === 'not_started').length,
    draft: orgStatuses.filter(o => o.okrStatus === 'draft').length,
    submitted: orgStatuses.filter(o => o.okrStatus === 'submitted').length,
    approved: orgStatuses.filter(o => o.okrStatus === 'approved').length,
    finalized: orgStatuses.filter(o => o.okrStatus === 'finalized').length,
  };
  const completionRate = stats.total > 0 ? Math.round(((stats.approved + stats.finalized) / stats.total) * 100) : 0;
  const selectedCount = orgStatuses.filter(o => o.selected).length;

  const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    not_started: { label: '미착수', className: 'bg-slate-100 text-slate-600' },
    draft: { label: '작성중', className: 'bg-amber-100 text-amber-700' },
    submitted: { label: '제출됨', className: 'bg-blue-100 text-blue-700' },
    approved: { label: '승인', className: 'bg-green-100 text-green-700' },
    finalized: { label: '확정', className: 'bg-emerald-100 text-emerald-800' },
  };

  const timeAgo = (d: string | null) => {
    if (!d) return null;
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">OKR 수립 현황</h3>
            <p className="text-xs text-slate-500">{currentPeriod} · 완료율 {completionRate}%</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stats.notStarted + stats.draft > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {stats.notStarted + stats.draft}개 미완료
            </span>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100">
          {/* 진행 바 */}
          <div className="px-6 py-3">
            <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-100">
              {stats.finalized > 0 && <div className="bg-emerald-500" style={{ width: `${(stats.finalized / stats.total) * 100}%` }} />}
              {stats.approved > 0 && <div className="bg-green-500" style={{ width: `${(stats.approved / stats.total) * 100}%` }} />}
              {stats.submitted > 0 && <div className="bg-blue-500" style={{ width: `${(stats.submitted / stats.total) * 100}%` }} />}
              {stats.draft > 0 && <div className="bg-amber-400" style={{ width: `${(stats.draft / stats.total) * 100}%` }} />}
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />확정 {stats.finalized}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />승인 {stats.approved}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />제출 {stats.submitted}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />작성중 {stats.draft}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" />미착수 {stats.notStarted}</span>
            </div>
          </div>

          {/* 조직 목록 */}
          <div className="px-6 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-2">
                <button onClick={toggleSelectAll} className="text-[10px] text-blue-600 hover:text-blue-700 font-medium">
                  전체 선택/해제
                </button>
                <button onClick={selectIncomplete} className="text-[10px] text-amber-600 hover:text-amber-700 font-medium">
                  미완료만 선택
                </button>
              </div>
              <button onClick={fetchOrgStatuses} className="p-1 text-slate-400 hover:text-slate-600">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading ? (
              <div className="py-4 text-center text-sm text-slate-400">불러오는 중...</div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {orgStatuses.map(org => {
                  const badge = STATUS_BADGE[org.okrStatus];
                  const canNudge = org.headId && org.okrStatus !== 'finalized' && org.okrStatus !== 'approved';
                  const nudgeAge = timeAgo(org.lastNudgedAt);

                  return (
                    <div
                      key={org.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        org.selected ? 'bg-orange-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={org.selected}
                        onChange={() => toggleSelect(org.id)}
                        disabled={!canNudge}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-orange-600 disabled:opacity-30"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800 truncate">{org.name}</span>
                          <span className="text-[10px] text-slate-400">{org.level}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {org.headName ? (
                            <span className="text-[10px] text-slate-400">{org.headName}</span>
                          ) : (
                            <span className="text-[10px] text-red-400">조직장 미지정</span>
                          )}
                          {nudgeAge && (
                            <span className="text-[10px] text-orange-400">독촉 {nudgeAge}</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 커스텀 메시지 */}
          {showCustomMessage && (
            <div className="px-6 pb-3">
              <textarea
                value={nudgeMessage}
                onChange={(e) => setNudgeMessage(e.target.value)}
                placeholder="독촉 메시지를 입력해주세요 (선택사항)..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-500 outline-none"
                rows={2}
              />
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <button
              onClick={handleBulkNudge}
              disabled={selectedCount === 0 || sending}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg py-2.5 font-medium hover:from-orange-600 hover:to-red-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {sending ? (
                <>전송 중...</>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  {selectedCount}개 조직에 독촉 알림 발송
                </>
              )}
            </button>
            <button
              onClick={() => setShowCustomMessage(!showCustomMessage)}
              className="px-3 py-2.5 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
              title="메시지 커스텀"
            >
              ✏️
            </button>
          </div>

          {lastSentAt && (
            <div className="px-6 py-2 text-[10px] text-slate-400 text-center">
              마지막 발송: {new Date(lastSentAt).toLocaleString('ko-KR')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}