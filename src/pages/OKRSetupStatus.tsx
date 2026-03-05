// src/pages/OKRSetupStatus.tsx
// OKR 수립 현황 관리 페이지 - CEO/본부장용
// ─── 변경사항 ───
// [1] 행 클릭 → 오른쪽 OKR 상세 패널 (승인대기함과 동일 UX)
// [2] 직속 하위 조직: 승인/수정요청 액션
// [3] 비직속 하위 조직: 검토 조회 + 의견 작성만
// [4] okr_sets / approval_history 연동
// [5] OKRCommentPanel 연동
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Megaphone, Send, Clock, Check, AlertTriangle, RefreshCw,
  Zap, Search, ChevronRight, CheckCircle2, XCircle, FileEdit,
  BarChart3, Building2, CalendarClock, Timer, ArrowRight,
  X, MessageSquare, Target, Eye
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { getMyRoleLevel } from '../lib/permissions';
import { getBIIColor } from '../utils/helpers';
import type { BIIType } from '../types';
import OKRCommentPanel from '../components/OKRCommentPanel';

// ─── Types ───────────────────────────────────────────────
interface OrgStatus {
  id: string;
  name: string;
  level: string;
  parentOrgId: string | null;
  headName: string | null;
  headId: string | null;
  okrStatus: 'not_started' | 'draft' | 'revision_requested' | 'submitted' | 'approved' | 'finalized';
  objectiveCount: number;
  krCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  lastNudgedAt: string | null;
  selected: boolean;
  okrSetId: string | null;
}

interface ActiveCycle {
  id: string;
  period: string;
  title: string;
  status: 'planning' | 'in_progress' | 'closed' | 'finalized';
  startsAt: string;
  deadlineAt: string;
  gracePeriodAt: string | null;
  companyOkrFinalized: boolean;
  message: string | null;
  daysRemaining: number;
  isOverdue: boolean;
}

interface OKRDetail {
  objectives: Array<{
    id: string;
    name: string;
    bii_type: string;
    perspective?: string;
    key_results: Array<{
      id: string;
      name: string;
      weight: number;
      target_value: number;
      unit: string;
      bii_type: string;
      kpi_category: string;
      perspective: string;
      grade_criteria: any;
      definition?: string;
    }>;
  }>;
}

interface ApprovalHistoryItem {
  id: string;
  action: string;
  actor_name: string;
  comment: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any; order: number }> = {
  not_started:        { label: '미착수',   cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: XCircle, order: 0 },
  draft:              { label: '작성중',   cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: FileEdit, order: 1 },
  revision_requested: { label: '수정요청', cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertTriangle, order: 1.5 },
  submitted:          { label: '제출됨',   cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: Send, order: 2 },
  approved:           { label: '승인',     cls: 'bg-green-50 text-green-700 border-green-200', icon: Check, order: 3 },
  finalized:          { label: '확정',     cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2, order: 4 },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}
function timeAgo(d: string | null) {
  if (!d) return null;
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}
function timeFormat(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Component ───────────────────────────────────────────
export default function OKRSetupStatus() {
  const { user } = useAuth();
  const { organizations, company } = useStore();
  const currentPeriod = useStore(s => s.currentPeriod);
  const navigate = useNavigate();

  const [orgStatuses, setOrgStatuses] = useState<OrgStatus[]>([]);
  const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [showMsgInput, setShowMsgInput] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleLevel, setRoleLevel] = useState(0);

  // ── 상세 패널 ──
  const [selectedOrg, setSelectedOrg] = useState<OrgStatus | null>(null);
  const [okrDetail, setOkrDetail] = useState<OKRDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryItem[]>([]);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'revision_request'>('approve');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewCommentLoading, setReviewCommentLoading] = useState(false);

  // ── 내 직속 하위 조직 판별 ──
  const [myLeaderOrgIds, setMyLeaderOrgIds] = useState<string[]>([]);

  useEffect(() => { getMyRoleLevel().then(setRoleLevel); }, []);

  useEffect(() => {
    const loadMyOrgs = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('user_roles')
        .select('org_id, roles!inner(level)')
        .eq('profile_id', user.id);
      if (data) {
        setMyLeaderOrgIds(
          data.filter((r: any) => r.roles?.level >= 70).map((r: any) => r.org_id)
        );
      }
    };
    loadMyOrgs();
  }, [user?.id]);

  // 직속 하위 조직 ID 목록
  const myDirectChildOrgIds = useMemo(() => {
    return organizations
      .filter(o => myLeaderOrgIds.includes(o.parentOrgId || ''))
      .map(o => o.id);
  }, [myLeaderOrgIds, organizations]);

  // 선택한 조직이 직속 하위인지 판별
  const isDirectChild = (orgId: string) => myDirectChildOrgIds.includes(orgId);

  // ─── 활성 사이클 조회 ─────────────────────────────────
  const fetchActiveCycle = useCallback(async () => {
    if (!company?.id) return;
    try {
      const { data, error } = await supabase.rpc('get_active_planning_cycle', { p_company_id: company.id });
      if (error) throw error;
      if (data && data.length > 0) {
        const row = data[0];
        setActiveCycle({
          id: row.id, period: row.period, title: row.title, status: row.status,
          startsAt: row.starts_at, deadlineAt: row.deadline_at,
          gracePeriodAt: row.grace_period_at, companyOkrFinalized: row.company_okr_finalized,
          message: row.message, daysRemaining: row.days_remaining, isOverdue: row.is_overdue,
        });
      } else { setActiveCycle(null); }
    } catch (err) { console.warn('사이클 조회 실패:', err); setActiveCycle(null); }
  }, [company?.id]);

  // ─── 조직 상태 조회 ──────────────────────────────────
  const fetchOrgStatuses = useCallback(async () => {
    setLoading(true);
    try {
      if (activeCycle?.id) {
        const { data, error } = await supabase.rpc('get_cycle_setup_stats', { p_cycle_id: activeCycle.id });
        if (error) throw error;
        const statuses: OrgStatus[] = (data || []).map((row: any) => {
          let status: OrgStatus['okrStatus'] = 'not_started';
          const s = row.okr_set_status;
          if (s === 'finalized') status = 'finalized';
          else if (s === 'approved') status = 'approved';
          else if (s === 'submitted' || s === 'under_review') status = 'submitted';
          else if (s === 'revision_requested') status = 'revision_requested';
          else if (s === 'draft') status = 'draft';
          const org = organizations.find(o => o.id === row.org_id);
          return {
            id: row.org_id, name: row.org_name, level: row.org_level,
            parentOrgId: org?.parentOrgId || null,
            headName: row.head_name, headId: row.head_profile_id,
            okrStatus: status,
            objectiveCount: row.objective_count || 0, krCount: row.kr_count || 0,
            submittedAt: row.submitted_at, approvedAt: row.approved_at,
            lastNudgedAt: null, selected: status === 'not_started' || status === 'draft' || status === 'revision_requested',
            okrSetId: row.okr_set_id || null,
          };
        });
        const orgIds = statuses.map(s => s.id);
        if (orgIds.length > 0) {
          const { data: nudges } = await supabase
            .from('notifications').select('org_id, created_at')
            .eq('type', 'okr_draft_reminder').in('org_id', orgIds)
            .order('created_at', { ascending: false });
          if (nudges) {
            const nudgeMap = new Map<string, string>();
            for (const n of nudges) { if (n.org_id && !nudgeMap.has(n.org_id)) nudgeMap.set(n.org_id, n.created_at); }
            for (const s of statuses) s.lastNudgedAt = nudgeMap.get(s.id) || null;
          }
        }
        // okr_set_id가 RPC에 없을 수 있으므로 보조 조회
        const noSetOrgs = statuses.filter(s => !s.okrSetId && s.okrStatus !== 'not_started');
        if (noSetOrgs.length > 0) {
          for (const os of noSetOrgs) {
            const { data: setData } = await supabase
              .from('okr_sets').select('id')
              .eq('org_id', os.id).eq('period', activeCycle.period)
              .order('version', { ascending: false }).limit(1).maybeSingle();
            if (setData) os.okrSetId = setData.id;
          }
        }
        setOrgStatuses(statuses);
      } else {
        const subOrgs = organizations.filter(o => o.level !== '전사');
        const statuses: OrgStatus[] = [];
        for (const org of subOrgs) {
          const { data: okrSet } = await supabase
            .from('okr_sets').select('id, status, submitted_at, reviewed_at')
            .eq('org_id', org.id).eq('period', currentPeriod)
            .order('version', { ascending: false }).limit(1).maybeSingle();
          const { count: objCount } = await supabase.from('objectives').select('*', { count: 'exact', head: true }).eq('org_id', org.id);
          const { count: krCount } = await supabase.from('key_results').select('*', { count: 'exact', head: true }).eq('org_id', org.id);
          let headName: string | null = null, headId: string | null = null;
          try {
            const { data: hr } = await supabase.from('user_roles').select('profile_id, role:roles!inner(name)')
              .eq('org_id', org.id).in('roles.name', ['org_head', 'company_admin']).limit(1).maybeSingle();
            if (hr?.profile_id) { headId = hr.profile_id; const { data: p } = await supabase.from('profiles').select('full_name').eq('id', hr.profile_id).single(); headName = p?.full_name || null; }
          } catch {}
          const { data: lastNudge } = await supabase.from('notifications').select('created_at')
            .eq('type', 'okr_draft_reminder').eq('org_id', org.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
          let status: OrgStatus['okrStatus'] = 'not_started';
          if (okrSet?.status === 'finalized') status = 'finalized';
          else if (okrSet?.status === 'approved') status = 'approved';
          else if (okrSet?.status === 'submitted' || okrSet?.status === 'under_review') status = 'submitted';
          else if (okrSet?.status === 'revision_requested') status = 'revision_requested';
          else if (okrSet?.status === 'draft') status = 'draft';
          statuses.push({
            id: org.id, name: org.name, level: org.level, parentOrgId: org.parentOrgId || null,
            headName, headId, okrStatus: status,
            objectiveCount: objCount || 0, krCount: krCount || 0,
            submittedAt: okrSet?.submitted_at || null, approvedAt: okrSet?.reviewed_at || null,
            lastNudgedAt: lastNudge?.created_at || null,
            selected: status === 'not_started' || status === 'draft' || status === 'revision_requested',
            okrSetId: okrSet?.id || null,
          });
        }
        setOrgStatuses(statuses);
      }
    } catch (err) { console.warn('조직 상태 조회 실패:', err); }
    finally { setLoading(false); }
  }, [activeCycle, organizations, currentPeriod]);

  useEffect(() => { if (company?.id) fetchActiveCycle(); }, [company?.id, fetchActiveCycle]);
  useEffect(() => { if (organizations.length > 0) fetchOrgStatuses(); }, [organizations, activeCycle, fetchOrgStatuses]);

  // ─── OKR 상세 로드 ────────────────────────────────────
  const loadOrgDetail = async (org: OrgStatus) => {
    setSelectedOrg(org); setDetailLoading(true); setOkrDetail(null); setApprovalHistory([]);
    try {
      const period = activeCycle?.period || currentPeriod;
      let query = supabase.from('objectives').select('id, name, bii_type, perspective, sort_order')
        .eq('org_id', org.id).eq('is_latest', true).eq('period', period).order('sort_order');
      const { data: objs } = await query;
      const objectives = [];
      for (const obj of (objs || [])) {
        const { data: krs } = await supabase.from('key_results')
          .select('id, name, definition, weight, target_value, unit, bii_type, kpi_category, perspective, grade_criteria')
          .eq('objective_id', obj.id).eq('is_latest', true).order('weight', { ascending: false });
        objectives.push({ ...obj, key_results: krs || [] });
      }
      setOkrDetail({ objectives });

      if (org.okrSetId) {
        const { data: history } = await supabase.from('approval_history')
          .select('id, action, actor_name, comment, created_at')
          .eq('okr_set_id', org.okrSetId).order('created_at', { ascending: false });
        setApprovalHistory(history || []);
      }
    } catch (err) { console.warn('상세 조회 실패:', err); }
    finally { setDetailLoading(false); }
  };

  // ─── 승인/수정요청 액션 ───────────────────────────────
  const handleApprovalAction = async () => {
    if (!selectedOrg?.okrSetId || !user?.id) return;
    setActionLoading(true);
    try {
      const newStatus = actionType === 'approve' ? 'approved' : 'revision_requested';
      const { error } = await supabase.from('okr_sets').update({
        status: newStatus, reviewer_id: user.id,
        reviewed_at: new Date().toISOString(), review_comment: actionComment || null,
      }).eq('id', selectedOrg.okrSetId);
      if (error) throw error;

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      await supabase.from('approval_history').insert({
        okr_set_id: selectedOrg.okrSetId, action: newStatus,
        actor_id: user.id, actor_name: profile?.full_name || '관리자',
        comment: actionComment || null,
      });

      // 제출자에게 알림
      if (selectedOrg.headId) {
        await supabase.from('notifications').insert({
          recipient_id: selectedOrg.headId, sender_id: user.id,
          sender_name: profile?.full_name || '관리자',
          type: newStatus === 'approved' ? 'okr_approved' : 'okr_revision_requested',
          title: newStatus === 'approved'
            ? `✅ ${selectedOrg.name} OKR 승인됨`
            : `⚠️ ${selectedOrg.name} OKR 수정 요청`,
          message: actionComment || (newStatus === 'approved' ? 'OKR이 승인되었습니다.' : 'OKR 수정이 필요합니다.'),
          priority: 'high', action_url: `/wizard/${selectedOrg.id}`, org_id: selectedOrg.id,
        });
      }

      setShowActionModal(false); setActionComment('');
      setSelectedOrg(null); setOkrDetail(null);
      fetchOrgStatuses();
    } catch (err: any) { alert(`처리 실패: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  // ─── 검토 의견 작성 (비직속 하위) ─────────────────────
  const handleReviewComment = async () => {
    if (!selectedOrg?.okrSetId || !user?.id || !reviewComment.trim()) return;
    setReviewCommentLoading(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      // approval_history에 검토 의견으로 기록
      await supabase.from('approval_history').insert({
        okr_set_id: selectedOrg.okrSetId, action: 'comment',
        actor_id: user.id, actor_name: profile?.full_name || '검토자',
        comment: reviewComment,
      });

      // 조직장에게 알림
      if (selectedOrg.headId) {
        await supabase.from('notifications').insert({
          recipient_id: selectedOrg.headId, sender_id: user.id,
          sender_name: profile?.full_name || '검토자',
          type: 'okr_comment', title: `💬 ${selectedOrg.name} OKR 검토 의견`,
          message: reviewComment.length > 80 ? reviewComment.substring(0, 80) + '...' : reviewComment,
          priority: 'normal', action_url: `/wizard/${selectedOrg.id}`, org_id: selectedOrg.id,
        });
      }

      setReviewComment('');
      // 이력 새로고침
      if (selectedOrg.okrSetId) {
        const { data: history } = await supabase.from('approval_history')
          .select('id, action, actor_name, comment, created_at')
          .eq('okr_set_id', selectedOrg.okrSetId).order('created_at', { ascending: false });
        setApprovalHistory(history || []);
      }
    } catch (err: any) { alert(`실패: ${err.message}`); }
    finally { setReviewCommentLoading(false); }
  };

  // ─── 필터/통계 ────────────────────────────────────────
  const filteredOrgs = useMemo(() => {
    let list = [...orgStatuses];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o => o.name.toLowerCase().includes(q) || o.headName?.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') list = list.filter(o => o.okrStatus === statusFilter);
    return list.sort((a, b) => STATUS_CONFIG[a.okrStatus].order - STATUS_CONFIG[b.okrStatus].order);
  }, [orgStatuses, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const t = orgStatuses.length;
    const ns = orgStatuses.filter(o => o.okrStatus === 'not_started').length;
    const dr = orgStatuses.filter(o => o.okrStatus === 'draft').length;
    const rv = orgStatuses.filter(o => o.okrStatus === 'revision_requested').length;
    const sb = orgStatuses.filter(o => o.okrStatus === 'submitted').length;
    const ap = orgStatuses.filter(o => o.okrStatus === 'approved').length;
    const fn = orgStatuses.filter(o => o.okrStatus === 'finalized').length;
    return { total: t, notStarted: ns, draft: dr, revisionRequested: rv, submitted: sb, approved: ap, finalized: fn,
      completionRate: t > 0 ? Math.round(((ap + fn) / t) * 100) : 0 };
  }, [orgStatuses]);

  const selectedCount = orgStatuses.filter(o => o.selected).length;
  const toggleSelect = (id: string) => setOrgStatuses(p => p.map(o => o.id === id ? { ...o, selected: !o.selected } : o));
  const selectByStatus = (s: 'all' | 'incomplete' | 'none') => {
    setOrgStatuses(p => p.map(o => {
      const can = o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved';
      if (!can) return { ...o, selected: false };
      if (s === 'all') return { ...o, selected: true };
      if (s === 'none') return { ...o, selected: false };
      return { ...o, selected: o.okrStatus === 'not_started' || o.okrStatus === 'draft' || o.okrStatus === 'revision_requested' };
    }));
  };

  const handleBulkNudge = async () => {
    const targets = orgStatuses.filter(o => o.selected && o.headId);
    if (!targets.length) return alert('독촉할 조직을 선택해주세요.');
    if (!confirm(`${targets.length}개 조직에 목표수립 독촉 알림을 보내시겠습니까?`)) return;
    setSending(true);
    try {
      const { data: me } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();
      const period = activeCycle?.period || currentPeriod;
      const msg = nudgeMessage.trim() || `${period} OKR 수립 기한이 임박했습니다. 빠른 시일 내에 목표를 수립하고 제출해 주세요.`;
      for (const org of targets) {
        await supabase.from('notifications').insert({
          recipient_id: org.headId, type: 'okr_draft_reminder',
          title: `📢 ${period} OKR 수립 요청`,
          message: `${me?.full_name || 'CEO'}님의 메시지: ${msg}`,
          priority: 'high', action_url: `/wizard/${org.id}`,
          sender_id: user?.id, sender_name: me?.full_name || 'CEO', org_id: org.id,
        });
      }
      setLastSentAt(new Date().toISOString());
      setNudgeMessage(''); setShowMsgInput(false);
      fetchOrgStatuses();
      alert(`✅ ${targets.length}개 조직에 독촉 알림을 발송했습니다.`);
    } catch (err: any) { alert(`발송 실패: ${err.message}`); }
    finally { setSending(false); }
  };

  // ─── OKR 상세 렌더 ───────────────────────────────────
  const renderOKRDetail = () => {
    if (detailLoading) return <div className="p-8 text-center text-sm text-slate-500">OKR 불러오는 중...</div>;
    if (!okrDetail || okrDetail.objectives.length === 0) return <div className="p-8 text-center"><Target className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">등록된 OKR이 없습니다</p></div>;
    return (
      <div className="space-y-5">
        {okrDetail.objectives.map((obj, objIdx) => {
          const biiColor = getBIIColor(obj.bii_type as BIIType);
          return (
            <div key={obj.id}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">O{objIdx + 1}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>{obj.bii_type}</span>
                {obj.perspective && <span className="text-xs text-slate-400">{obj.perspective}</span>}
                <span className="font-medium text-slate-900 text-sm">{obj.name}</span>
              </div>
              <div className="ml-6 border-l-2 border-slate-100 pl-4 space-y-2">
                {obj.key_results.map((kr, krIdx) => {
                  const krBii = getBIIColor(kr.bii_type as BIIType);
                  return (
                    <div key={kr.id} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-blue-500 bg-blue-50 px-1 rounded">KR{krIdx + 1}</span>
                        <span className="text-sm text-slate-800">{kr.name}</span>
                      </div>
                      {kr.definition && <p className="text-xs text-slate-400 mb-1.5 ml-7">{kr.definition}</p>}
                      <div className="flex gap-3 text-xs text-slate-500 ml-7 flex-wrap">
                        <span className="font-medium">목표: {kr.target_value?.toLocaleString()}{kr.unit}</span>
                        <span>가중치: {kr.weight}%</span>
                        <span className={`px-1 rounded ${krBii.bg} ${krBii.text}`}>{kr.bii_type}</span>
                        <span>{kr.perspective}</span>
                        {kr.kpi_category && <span className="text-slate-400">{kr.kpi_category}</span>}
                      </div>
                      {kr.grade_criteria && (
                        <div className="flex gap-2 mt-1.5 ml-7 text-[10px]">
                          {(['S','A','B','C','D'] as const).map(g => {
                            const colors: Record<string, string> = { S: 'text-blue-600', A: 'text-green-600', B: 'text-slate-600', C: 'text-amber-600', D: 'text-red-500' };
                            return <span key={g} className={colors[g]}>{g}:{(kr.grade_criteria as any)?.[g] ?? '-'}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {obj.key_results.length === 0 && <p className="text-xs text-slate-400 py-2">KR이 아직 없습니다</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── 권한 체크 ────────────────────────────────────────
  if (roleLevel > 0 && roleLevel < 50) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-20">
        <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-700">접근 권한이 없습니다</h2>
        <p className="text-sm text-slate-500 mt-1">이 페이지는 팀장 이상만 조회할 수 있습니다.</p>
      </div>
    );
  }

  const dDayColor = !activeCycle ? 'text-slate-500' : activeCycle.isOverdue ? 'text-red-600' : activeCycle.daysRemaining <= 3 ? 'text-amber-600' : activeCycle.daysRemaining <= 7 ? 'text-blue-600' : 'text-slate-700';
  const dDayText = !activeCycle ? '' : activeCycle.isOverdue ? `마감 ${Math.abs(activeCycle.daysRemaining)}일 초과` : activeCycle.daysRemaining === 0 ? '오늘 마감' : `D-${activeCycle.daysRemaining}`;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">OKR 수립 현황</h1>
            <p className="text-sm text-slate-500">{activeCycle ? activeCycle.title : `${currentPeriod} · ${company?.name || ''}`}</p>
          </div>
        </div>
        <button onClick={() => { fetchActiveCycle(); fetchOrgStatuses(); }} disabled={loading}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </div>

      {/* 사이클 정보 카드 */}
      {activeCycle && (
        <div className={`rounded-xl border p-5 ${activeCycle.isOverdue ? 'bg-red-50 border-red-200' : activeCycle.daysRemaining <= 3 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-center px-4 py-2 rounded-lg ${activeCycle.isOverdue ? 'bg-red-100' : activeCycle.daysRemaining <= 3 ? 'bg-amber-100' : 'bg-blue-100'}`}>
                <div className={`text-2xl font-black ${dDayColor}`}>{dDayText}</div>
                <div className="text-xs text-slate-500 mt-0.5">마감까지</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-slate-600"><CalendarClock className="w-4 h-4" />시작: {formatDate(activeCycle.startsAt)}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className={`flex items-center gap-1.5 font-medium ${dDayColor}`}><Timer className="w-4 h-4" />마감: {formatDate(activeCycle.deadlineAt)}</span>
                  {activeCycle.gracePeriodAt && (<><span className="text-slate-300">|</span><span className="text-xs text-slate-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />유예: {formatDate(activeCycle.gracePeriodAt)}</span></>)}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${activeCycle.status === 'planning' ? 'bg-slate-200 text-slate-700' : activeCycle.status === 'in_progress' ? 'bg-blue-200 text-blue-800' : activeCycle.status === 'closed' ? 'bg-amber-200 text-amber-800' : 'bg-green-200 text-green-800'}`}>
                    {activeCycle.status === 'planning' ? '전사 OKR 수립중' : activeCycle.status === 'in_progress' ? '하위 조직 수립 진행중' : activeCycle.status === 'closed' ? '마감' : '확정'}
                  </span>
                  {activeCycle.companyOkrFinalized && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> 전사 OKR 확정됨</span>}
                </div>
                {activeCycle.message && <p className="text-xs text-slate-500 flex items-start gap-1 mt-1"><Megaphone className="w-3 h-3 mt-0.5 shrink-0" />{activeCycle.message}</p>}
              </div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-black ${stats.completionRate >= 80 ? 'text-green-600' : stats.completionRate >= 50 ? 'text-blue-600' : dDayColor}`}>{stats.completionRate}%</div>
              <div className="text-xs text-slate-500">승인 완료</div>
            </div>
          </div>
        </div>
      )}

      {!activeCycle && !loading && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3"><CalendarClock className="w-8 h-8 text-slate-300" /><div><p className="text-sm font-medium text-slate-700">활성 수립 사이클이 없습니다</p><p className="text-xs text-slate-400">관리자 설정에서 새 수립 사이클을 만들어주세요</p></div></div>
          {roleLevel >= 90 && <button onClick={() => navigate('/admin?tab=planning-cycles')} className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1">설정으로 이동 <ChevronRight className="w-4 h-4" /></button>}
        </div>
      )}

      {/* 요약 카드 5개 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3"><span className="text-xs font-medium text-slate-500">전체 완료율</span><BarChart3 className="w-4 h-4 text-slate-400" /></div>
          <div className="text-3xl font-bold text-slate-900">{stats.completionRate}%</div>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${stats.completionRate >= 80 ? 'bg-green-500' : stats.completionRate >= 50 ? 'bg-blue-500' : 'bg-orange-500'}`} style={{ width: `${stats.completionRate}%` }} /></div>
        </div>
        {(['not_started', 'draft', 'submitted', 'approved'] as const).map(key => {
          const cfg = STATUS_CONFIG[key]; const Icon = cfg.icon;
          const count = key === 'approved' ? stats.approved + stats.finalized : key === 'not_started' ? stats.notStarted : key === 'draft' ? stats.draft + stats.revisionRequested : stats.submitted;
          const desc = key === 'not_started' ? '아직 시작하지 않은 조직' : key === 'draft' ? `초안 작성 / 수정요청${stats.revisionRequested > 0 ? ` (수정 ${stats.revisionRequested})` : ''}` : key === 'submitted' ? '검토 대기중' : '수립 완료';
          const active = statusFilter === key;
          return (
            <button key={key} onClick={() => setStatusFilter(active ? 'all' : key)}
              className={`bg-white rounded-xl border p-5 shadow-sm text-left transition-all hover:shadow-md ${active ? 'ring-1 ring-slate-400 border-slate-400' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3"><span className="text-xs font-medium text-slate-500">{key === 'approved' ? '승인/확정' : cfg.label}</span><Icon className="w-4 h-4 text-slate-400" /></div>
              <div className={`text-3xl font-bold ${key === 'draft' ? 'text-amber-600' : key === 'submitted' ? 'text-blue-600' : key === 'approved' ? 'text-green-600' : 'text-slate-900'}`}>{count}</div>
              <p className="text-xs text-slate-400 mt-1">{desc}</p>
            </button>
          );
        })}
      </div>

      {/* 진행 바 */}
      {stats.total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700">수립 진행 현황</span>
            {statusFilter !== 'all' && <button onClick={() => setStatusFilter('all')} className="text-xs text-blue-600 hover:underline">필터 초기화</button>}
          </div>
          <div className="flex gap-0.5 h-4 rounded-full overflow-hidden bg-slate-100">
            {stats.finalized > 0 && <div className="bg-emerald-500" style={{ width: `${(stats.finalized / stats.total) * 100}%` }} />}
            {stats.approved > 0 && <div className="bg-green-500" style={{ width: `${(stats.approved / stats.total) * 100}%` }} />}
            {stats.submitted > 0 && <div className="bg-blue-500" style={{ width: `${(stats.submitted / stats.total) * 100}%` }} />}
            {stats.revisionRequested > 0 && <div className="bg-orange-400" style={{ width: `${(stats.revisionRequested / stats.total) * 100}%` }} />}
            {stats.draft > 0 && <div className="bg-amber-400" style={{ width: `${(stats.draft / stats.total) * 100}%` }} />}
            {stats.notStarted > 0 && <div className="bg-slate-300" style={{ width: `${(stats.notStarted / stats.total) * 100}%` }} />}
          </div>
          <div className="flex gap-5 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />확정 {stats.finalized}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />승인 {stats.approved}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />제출 {stats.submitted}</span>
            {stats.revisionRequested > 0 && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400" />수정요청 {stats.revisionRequested}</span>}
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />작성중 {stats.draft}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" />미착수 {stats.notStarted}</span>
          </div>
        </div>
      )}

      {/* ═══ 테이블 + 상세 패널 레이아웃 ═══ */}
      <div className={`grid gap-6 ${selectedOrg ? 'grid-cols-12' : ''}`}>
        {/* 테이블 */}
        <div className={selectedOrg ? 'col-span-5' : ''}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="조직명 또는 조직장 검색..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                {!selectedOrg && (
                  <div className="flex gap-1.5">
                    <button onClick={() => selectByStatus('incomplete')} className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">미완료만</button>
                    <button onClick={() => selectByStatus('all')} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">전체</button>
                    <button onClick={() => selectByStatus('none')} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">해제</button>
                  </div>
                )}
              </div>
              {!selectedOrg && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowMsgInput(!showMsgInput)} className="px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">✏️ 메시지</button>
                  <button onClick={handleBulkNudge} disabled={selectedCount === 0 || sending}
                    className="px-5 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 disabled:opacity-50 flex items-center gap-2 text-sm">
                    {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> 전송 중...</> : <><Zap className="w-4 h-4" /> {selectedCount}개 독촉 발송</>}
                  </button>
                </div>
              )}
            </div>

            {showMsgInput && !selectedOrg && (
              <div className="px-6 py-3 border-b border-slate-100 bg-orange-50/50">
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">독촉 메시지 (선택)</label>
                <textarea value={nudgeMessage} onChange={e => setNudgeMessage(e.target.value)} placeholder="기본: OKR 수립 기한이 임박했습니다..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-500 outline-none bg-white" rows={2} />
              </div>
            )}

            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-16 text-center"><RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" /><p className="text-sm text-slate-400">불러오는 중...</p></div>
              ) : filteredOrgs.length === 0 ? (
                <div className="py-16 text-center"><Building2 className="w-8 h-8 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-400">{searchQuery || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '하위 조직이 없습니다.'}</p></div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {!selectedOrg && (
                        <th className="pl-6 pr-2 py-3 w-10">
                          <input type="checkbox"
                            checked={filteredOrgs.filter(o => o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved').length > 0 &&
                              filteredOrgs.filter(o => o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved').every(o => o.selected)}
                            onChange={() => { const nudgeable = filteredOrgs.filter(o => o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved'); selectByStatus(nudgeable.every(o => o.selected) ? 'none' : 'all'); }}
                            className="w-4 h-4 rounded border-slate-300 text-orange-600" />
                        </th>
                      )}
                      <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">조직</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">상태</th>
                      {!selectedOrg && <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">조직장</th>}
                      {!selectedOrg && <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">OKR</th>}
                      {!selectedOrg && <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">마지막 독촉</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredOrgs.map(org => {
                      const c = STATUS_CONFIG[org.okrStatus]; const Icon = c.icon;
                      const canNudge = org.headId && org.okrStatus !== 'finalized' && org.okrStatus !== 'approved';
                      const isSelected = selectedOrg?.id === org.id;
                      return (
                        <tr key={org.id}
                          onClick={() => { if (org.okrStatus !== 'not_started') loadOrgDetail(org); }}
                          className={`transition-colors ${isSelected ? 'bg-blue-50' : org.selected && !selectedOrg ? 'bg-orange-50/50' : 'hover:bg-slate-50/50'} ${org.okrStatus !== 'not_started' ? 'cursor-pointer' : ''}`}>
                          {!selectedOrg && (
                            <td className="pl-6 pr-2 py-3" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={org.selected} onChange={() => toggleSelect(org.id)}
                                disabled={!canNudge} className="w-4 h-4 rounded border-slate-300 text-orange-600 disabled:opacity-30" />
                            </td>
                          )}
                          <td className="px-3 py-3">
                            <span className="text-sm font-semibold text-slate-800">{org.name}</span>
                            <span className="ml-2 text-xs text-slate-400">{org.level}</span>
                            {selectedOrg && org.headName && <div className="text-xs text-slate-400 mt-0.5">{org.headName}</div>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}>
                              <Icon className="w-3 h-3" />{c.label}
                            </span>
                          </td>
                          {!selectedOrg && (
                            <td className="px-3 py-3">
                              {org.headName ? <span className="text-sm text-slate-600">{org.headName}</span>
                                : <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />미지정</span>}
                            </td>
                          )}
                          {!selectedOrg && (
                            <td className="px-3 py-3 text-center text-sm text-slate-600">
                              {org.objectiveCount > 0 ? <>{org.objectiveCount} <span className="text-slate-400">O</span> / {org.krCount} <span className="text-slate-400">KR</span></> : <span className="text-slate-300">—</span>}
                            </td>
                          )}
                          {!selectedOrg && (
                            <td className="px-3 py-3 text-center">
                              {timeAgo(org.lastNudgedAt) ? <span className="text-xs text-orange-500 flex items-center justify-center gap-1"><Clock className="w-3 h-3" />{timeAgo(org.lastNudgedAt)}</span> : <span className="text-xs text-slate-300">—</span>}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {lastSentAt && !selectedOrg && (
              <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-green-500" />마지막 발송: {new Date(lastSentAt).toLocaleString('ko-KR')}
              </div>
            )}
          </div>
        </div>

        {/* ═══ 상세 패널 ═══ */}
        {selectedOrg && (
          <div className="col-span-7">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
              {/* 헤더 */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-900">{selectedOrg.name}</h3>
                    {(() => { const c = STATUS_CONFIG[selectedOrg.okrStatus]; return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}><c.icon className="w-3 h-3" />{c.label}</span>; })()}
                  </div>
                  <button onClick={() => { setSelectedOrg(null); setOkrDetail(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{activeCycle?.period || currentPeriod}</span>
                  {selectedOrg.headName && <span>조직장: {selectedOrg.headName}</span>}
                  {selectedOrg.submittedAt && <span>제출: {timeFormat(selectedOrg.submittedAt)}</span>}
                  {isDirectChild(selectedOrg.id)
                    ? <span className="text-blue-600 font-medium">직속 하위</span>
                    : <span className="text-slate-400">비직속 하위</span>
                  }
                </div>
              </div>

              {/* OKR 내용 */}
              <div className="max-h-[calc(100vh-380px)] overflow-y-auto">
                <div className="p-6 space-y-6">
                  {renderOKRDetail()}

                  {/* 승인 이력 */}
                  {approvalHistory.length > 0 && (
                    <div className="border-t border-slate-100 pt-4">
                      <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" />처리 이력</h4>
                      <div className="space-y-3">
                        {approvalHistory.map((h) => {
                          const actionMap: Record<string, { icon: any; color: string; label: string }> = {
                            created: { icon: FileEdit, color: 'text-slate-400', label: '생성' },
                            submitted: { icon: Send, color: 'text-blue-500', label: '제출' },
                            approved: { icon: Check, color: 'text-green-500', label: '승인' },
                            rejected: { icon: X, color: 'text-red-500', label: '반려' },
                            revision_requested: { icon: MessageSquare, color: 'text-amber-500', label: '수정요청' },
                            revised: { icon: RefreshCw, color: 'text-indigo-500', label: '수정 완료' },
                            finalized: { icon: CheckCircle2, color: 'text-green-600', label: '최종확정' },
                            comment: { icon: MessageSquare, color: 'text-violet-500', label: '검토 의견' },
                          };
                          const info = actionMap[h.action] || { icon: Clock, color: 'text-slate-400', label: h.action };
                          const IconComp = info.icon;
                          return (
                            <div key={h.id} className="flex gap-3">
                              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"><IconComp className={`w-3.5 h-3.5 ${info.color}`} /></div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2"><span className="text-sm font-medium text-slate-700">{info.label}</span><span className="text-xs text-slate-400">by {h.actor_name}</span><span className="text-xs text-slate-400">{timeFormat(h.created_at)}</span></div>
                                {h.comment && <p className="text-xs text-slate-500 mt-1 bg-slate-50 rounded p-2">{h.comment}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 코멘트 패널 */}
                  {selectedOrg.okrSetId && <OKRCommentPanel okrSetId={selectedOrg.okrSetId} />}
                </div>
              </div>

              {/* ═══ 액션 영역 ═══ */}
              {/* 직속 하위 + 제출됨 상태: 승인/수정요청 */}
              {isDirectChild(selectedOrg.id) && selectedOrg.okrStatus === 'submitted' && (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <button onClick={() => { setActionType('approve'); setShowActionModal(true); setActionComment(''); }}
                    className="flex-1 bg-green-600 text-white rounded-lg py-2.5 font-medium hover:bg-green-700 flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" /> 승인
                  </button>
                  <button onClick={() => { setActionType('revision_request'); setShowActionModal(true); setActionComment(''); }}
                    className="flex-1 bg-amber-500 text-white rounded-lg py-2.5 font-medium hover:bg-amber-600 flex items-center justify-center gap-2">
                    <MessageSquare className="w-4 h-4" /> 수정 요청
                  </button>
                </div>
              )}

              {/* 비직속 하위: 검토 의견 작성 */}
              {!isDirectChild(selectedOrg.id) && selectedOrg.okrStatus !== 'not_started' && selectedOrg.okrSetId && (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
                  <label className="block text-sm font-medium text-slate-700 mb-2">검토 의견</label>
                  <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                    placeholder="이 조직의 OKR에 대한 의견을 작성하세요..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" rows={2} />
                  <button onClick={handleReviewComment} disabled={reviewCommentLoading || !reviewComment.trim()}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                    {reviewCommentLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    의견 전송
                  </button>
                </div>
              )}

              {/* 직속 하위 + 이미 승인됨: 안내 */}
              {isDirectChild(selectedOrg.id) && (selectedOrg.okrStatus === 'approved' || selectedOrg.okrStatus === 'finalized') && (
                <div className="px-6 py-3 border-t border-slate-100 bg-green-50">
                  <p className="text-sm text-green-700 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> 이미 승인된 OKR입니다.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 승인/수정요청 모달 */}
      {showActionModal && selectedOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className={`text-lg font-bold mb-4 ${actionType === 'approve' ? 'text-green-800' : 'text-amber-800'}`}>
              {actionType === 'approve' ? '✅ OKR 승인' : '⚠️ 수정 요청'}
            </h3>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-slate-700">{selectedOrg.name}</p>
              <p className="text-xs text-slate-500">{activeCycle?.period || currentPeriod} · {selectedOrg.headName || '조직장 미지정'}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {actionType === 'approve' ? '승인 코멘트 (선택)' : '수정 요청 내용 (필수)'}
              </label>
              <textarea value={actionComment} onChange={e => setActionComment(e.target.value)}
                placeholder={actionType === 'approve' ? '잘 수립했습니다. 승인합니다.' : '수정이 필요한 부분을 구체적으로 작성해주세요...'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" rows={4} />
            </div>
            <div className="flex gap-3">
              <button onClick={handleApprovalAction} disabled={actionLoading || (actionType === 'revision_request' && !actionComment.trim())}
                className={`flex-1 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {actionLoading ? '처리 중...' : actionType === 'approve' ? '승인 확인' : '수정 요청 전송'}
              </button>
              <button onClick={() => setShowActionModal(false)} className="px-4 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}