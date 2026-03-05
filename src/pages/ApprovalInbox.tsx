// src/pages/ApprovalInbox.tsx
// 승인 대기함 — 유관부서 검토요청을 검토대기 탭에 통합 + 완료건은 처리완료 탭으로
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox, Check, X, MessageSquare, Clock, FileCheck, ChevronDown, ChevronRight,
  Send, GitBranch, Eye, ArrowLeft, AlertTriangle, CheckCheck, RefreshCw, User, Filter,
  CalendarClock, Timer, Users, Target, ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import type { BIIType } from '../types';
import OKRCommentPanel from '../components/OKRCommentPanel';

type TabType = 'pending' | 'completed' | 'my_submissions';

interface OKRSet {
  id: string;
  org_id: string;
  period: string;
  status: string;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  ceo_approval: string;
  version: number;
  org_name?: string;
  org_level?: string;
  submitter_name?: string;
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

interface ReviewRequest {
  id: string;
  requester_id: string;
  requester_org_id: string;
  reviewer_id: string;
  reviewer_org_id: string;
  request_type: string;
  title: string;
  message: string;
  status: string;
  period: string;
  response: string | null;
  responded_at: string | null;
  created_at: string;
  requester_org_name?: string;
  requester_org_level?: string;
  requester_name?: string;
  requester_org_role?: string;
}

interface ActiveCycle {
  title: string;
  status: string;
  deadlineAt: string;
  daysRemaining: number;
  isOverdue: boolean;
}

// 통합 리스트 아이템 타입
type ListItemType = 'okr_set' | 'review_request';
interface ListItem {
  type: ListItemType;
  id: string;
  sortDate: string; // 정렬용 날짜
  okrSet?: OKRSet;
  reviewRequest?: ReviewRequest;
}

export default function ApprovalInbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizations, company } = useStore();

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [okrSets, setOkrSets] = useState<OKRSet[]>([]);
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSet, setSelectedSet] = useState<OKRSet | null>(null);
  const [okrDetail, setOkrDetail] = useState<OKRDetail | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);

  // 유관부서 검토 상세
  const [selectedReviewReq, setSelectedReviewReq] = useState<ReviewRequest | null>(null);
  const [reviewReqOKRDetail, setReviewReqOKRDetail] = useState<OKRDetail | null>(null);
  const [reviewReqDetailLoading, setReviewReqDetailLoading] = useState(false);
  const [reviewResponseText, setReviewResponseText] = useState('');
  const [reviewResponseLoading, setReviewResponseLoading] = useState(false);

  // 모달
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'revision_request'>('approve');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // ── 활성 사이클 조회 ──
  const fetchActiveCycle = async () => {
    if (!company?.id) return;
    try {
      const { data, error } = await supabase.rpc('get_active_planning_cycle', { p_company_id: company.id });
      if (error) throw error;
      if (data && data.length > 0) {
        const row = data[0];
        setActiveCycle({ title: row.title, status: row.status, deadlineAt: row.deadline_at, daysRemaining: row.days_remaining, isOverdue: row.is_overdue });
      }
    } catch (err) { console.warn('사이클 조회 실패:', err); }
  };

  // ── OKR Sets 조회 ──
  const fetchOKRSets = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase.from('okr_sets').select('*').order('submitted_at', { ascending: false });
      if (activeTab === 'pending') {
        // 내가 제출한 건은 내 승인대기함에 보이지 않게
        query = query.in('status', ['submitted', 'under_review']).neq('submitted_by', user.id);
      }
      else if (activeTab === 'completed') {
        // 내가 제출한 건은 처리완료에서 제외 (내 제출 현황에서만 표시)
        query = query.in('status', ['approved', 'rejected', 'revision_requested', 'finalized']).neq('submitted_by', user.id);
      }
      else if (activeTab === 'my_submissions') {
        query = query.eq('submitted_by', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      // pending/completed 탭: 내가 관리하는 직속 하위 조직의 건만 표시
      if (activeTab === 'pending' || activeTab === 'completed') {
        // 내가 조직장인 조직 목록
        const { data: myRoles } = await supabase
          .from('user_roles')
          .select('org_id, roles!inner(level)')
          .eq('profile_id', user.id);
        
        const myLeaderOrgIds = (myRoles || [])
          .filter((r: any) => r.roles?.level >= 70)
          .map((r: any) => r.org_id);

        if (myLeaderOrgIds.length > 0) {
          // 내가 조직장인 조직의 직속 하위 조직만 필터
          const childOrgIds = organizations
            .filter(o => myLeaderOrgIds.includes(o.parentOrgId || ''))
            .map(o => o.id);
          
          // 내가 조직장인 조직 자체 + 직속 하위 조직의 제출건만 표시
          const visibleOrgIds = [...myLeaderOrgIds, ...childOrgIds];
          filtered = filtered.filter(set => visibleOrgIds.includes(set.org_id));
        }
      }

      setOkrSets(filtered.map(set => {
        const org = organizations.find(o => o.id === set.org_id);
        return { ...set, org_name: org?.name || '알 수 없는 조직', org_level: org?.level || '' };
      }));
    } catch (err) { console.warn('OKR Set 조회 실패:', err); }
    finally { setLoading(false); }
  };

  // ── 유관부서 검토 요청 조회 ──
  const fetchReviewRequests = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('review_requests').select('*').eq('reviewer_id', user.id).order('created_at', { ascending: false });
      if (data && data.length > 0) {
        // 요청자 프로필 일괄 조회 (이름)
        const requesterIds = [...new Set(data.map((r: any) => r.requester_id).filter(Boolean))];
        let nameMap: Record<string, string> = {};
        if (requesterIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', requesterIds);
          if (profiles) {
            nameMap = Object.fromEntries(
              profiles.map((p: any) => [p.id, p.full_name || ''])
            );
          }
        }

        // 요청자의 실제 조직 내 역할 조회 (user_roles → roles.level 기반)
        // requester_id + requester_org_id 조합으로 조회
        const roleQueries = data.map((r: any) => ({ profileId: r.requester_id, orgId: r.requester_org_id }));
        const uniquePairs = roleQueries.filter((v: any, i: number, a: any[]) =>
          a.findIndex(t => t.profileId === v.profileId && t.orgId === v.orgId) === i
        );
        let roleMap: Record<string, number> = {}; // key: "profileId__orgId" → role level
        if (uniquePairs.length > 0) {
          for (const pair of uniquePairs) {
            if (!pair.profileId || !pair.orgId) continue;
            const { data: ur } = await supabase
              .from('user_roles')
              .select('roles!inner(level)')
              .eq('profile_id', pair.profileId)
              .eq('org_id', pair.orgId)
              .limit(1)
              .maybeSingle();
            if (ur) {
              roleMap[`${pair.profileId}__${pair.orgId}`] = (ur as any).roles?.level || 0;
            }
          }
        }

        const getRoleLabelByLevel = (level: number, orgLevel?: string): string => {
          if (level >= 90) return 'CEO';
          if (level >= 80) return '임원';
          if (level >= 70) {
            // 조직 레벨에 따라 본부장/팀장 구분
            if (orgLevel === '본부' || orgLevel === '부문') return '본부장';
            if (orgLevel === '팀' || orgLevel === '센터') return '팀장';
            return '조직장';
          }
          if (level >= 30) return '팀원';
          return '뷰어';
        };

        setReviewRequests(data.map((req: any) => {
          const reqOrg = organizations.find(o => o.id === req.requester_org_id);
          const roleLevel = roleMap[`${req.requester_id}__${req.requester_org_id}`] || 0;
          const roleLabel = getRoleLabelByLevel(roleLevel, reqOrg?.level);
          return {
            ...req,
            requester_org_name: reqOrg?.name || '알 수 없는 조직',
            requester_org_level: reqOrg?.level || '',
            requester_name: nameMap[req.requester_id] || '',
            requester_org_role: roleLabel,
          };
        }));
      } else {
        setReviewRequests([]);
      }
    } catch (err) { console.warn('검토 요청 조회 실패:', err); }
  };

  useEffect(() => { if (company?.id) fetchActiveCycle(); }, [company?.id]);
  useEffect(() => { fetchOKRSets(); fetchReviewRequests(); }, [user?.id, activeTab, organizations]);

  // ── OKR 상세 로딩 (okr_sets) ──
  const loadOKRDetail = async (orgId: string, period?: string): Promise<OKRDetail> => {
    let query = supabase.from('objectives').select('id, name, bii_type, perspective, sort_order').eq('org_id', orgId).eq('is_latest', true).order('sort_order');
    if (period) query = query.eq('period', period);
    const { data: objs } = await query;
    const objectives = [];
    for (const obj of (objs || [])) {
      const { data: krs } = await supabase.from('key_results').select('id, name, definition, weight, target_value, unit, bii_type, kpi_category, perspective, grade_criteria').eq('objective_id', obj.id).eq('is_latest', true).order('weight', { ascending: false });
      objectives.push({ ...obj, key_results: krs || [] });
    }
    return { objectives };
  };

  const loadDetail = async (set: OKRSet) => {
    setSelectedSet(set); setSelectedReviewReq(null); setDetailLoading(true);
    try {
      setOkrDetail(await loadOKRDetail(set.org_id));
      const { data: history } = await supabase.from('approval_history').select('id, action, actor_name, comment, created_at').eq('okr_set_id', set.id).order('created_at', { ascending: false });
      setApprovalHistory(history || []);
    } catch (err) { console.warn('상세 조회 실패:', err); }
    finally { setDetailLoading(false); }
  };

  // ── 유관부서 검토 요청 OKR 상세 ──
  const loadReviewReqDetail = async (req: ReviewRequest) => {
    setSelectedReviewReq(req); setSelectedSet(null); setReviewReqDetailLoading(true); setReviewResponseText('');
    try {
      setReviewReqOKRDetail(await loadOKRDetail(req.requester_org_id, req.period));
      if (req.requester_id) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', req.requester_id).maybeSingle();
        if (profile) setSelectedReviewReq(prev => prev ? { ...prev, requester_name: profile.full_name } : null);
      }
    } catch (err) { console.warn('검토 요청 OKR 조회 실패:', err); }
    finally { setReviewReqDetailLoading(false); }
  };

  // ── 승인/반려/수정요청 ──
  const handleAction = async () => {
    if (!selectedSet || !user?.id) return;
    setActionLoading(true);
    try {
      const newStatus = actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'revision_requested';
      const { error } = await supabase.from('okr_sets').update({ status: newStatus, reviewer_id: user.id, reviewed_at: new Date().toISOString(), review_comment: actionComment || null }).eq('id', selectedSet.id);
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      await supabase.from('approval_history').insert({ okr_set_id: selectedSet.id, action: newStatus, actor_id: user.id, actor_name: profile?.full_name || '관리자', comment: actionComment || null });
      setShowActionModal(false); setActionComment(''); setSelectedSet(null); setOkrDetail(null); fetchOKRSets();
    } catch (err: any) { alert(`처리 실패: ${err.message}`); }
    finally { setActionLoading(false); }
  };

  // ── 유관부서 검토 응답 ──
  const handleReviewResponse = async () => {
    if (!selectedReviewReq || !reviewResponseText.trim()) return;
    setReviewResponseLoading(true);
    try {
      const { error } = await supabase.from('review_requests').update({ status: 'completed', response: reviewResponseText, responded_at: new Date().toISOString() }).eq('id', selectedReviewReq.id);
      if (error) throw error;
      try {
        const { data: myProfile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();
        const myOrg = organizations.find(o => o.id === selectedReviewReq.reviewer_org_id);
        await supabase.from('notifications').insert({ recipient_id: selectedReviewReq.requester_id, sender_id: user!.id, sender_name: myProfile?.full_name || '검토자', type: 'review_completed', title: `📝 ${myOrg?.name || '유관부서'} 검토 의견 도착`, message: reviewResponseText.length > 80 ? reviewResponseText.substring(0, 80) + '...' : reviewResponseText, priority: 'normal', action_url: `/wizard/${selectedReviewReq.requester_org_id}`, org_id: selectedReviewReq.requester_org_id });
      } catch (_) { /* 알림 실패 무시 */ }
      setSelectedReviewReq(null); setReviewReqOKRDetail(null); setReviewResponseText(''); fetchReviewRequests();
    } catch (err: any) { alert(`실패: ${err.message}`); }
    finally { setReviewResponseLoading(false); }
  };

  const handleQuickResponse = async (reqId: string) => {
    try {
      await supabase.from('review_requests').update({ status: 'completed', response: '확인했습니다.', responded_at: new Date().toISOString() }).eq('id', reqId);
      setSelectedReviewReq(null); setReviewReqOKRDetail(null);
      fetchReviewRequests();
    } catch (err: any) { alert(`실패: ${err.message}`); }
  };

  // ── Helpers ──
  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      draft: { label: '초안', className: 'bg-slate-100 text-slate-600' },
      submitted: { label: '검토 대기', className: 'bg-blue-100 text-blue-700' },
      under_review: { label: '검토 중', className: 'bg-indigo-100 text-indigo-700' },
      approved: { label: '승인', className: 'bg-green-100 text-green-700' },
      rejected: { label: '반려', className: 'bg-red-100 text-red-700' },
      revision_requested: { label: '수정 요청', className: 'bg-amber-100 text-amber-700' },
      finalized: { label: '최종 확정', className: 'bg-emerald-100 text-emerald-800' },
    };
    const info = map[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${info.className}`}>{info.label}</span>;
  };

  const timeFormat = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  };

  // ── 통합 리스트 생성 ──
  const pendingReviewRequests = reviewRequests.filter(r => r.status === 'pending');
  const completedReviewRequests = reviewRequests.filter(r => r.status === 'completed');

  const pendingOKRCount = okrSets.filter(s => ['submitted', 'under_review'].includes(s.status)).length;
  const totalPendingCount = (activeTab === 'pending' ? pendingOKRCount : 0) + pendingReviewRequests.length;

  // 검토대기 탭: OKR 제출건 + 유관부서 검토요청(pending) 통합
  const pendingListItems: ListItem[] = [
    ...okrSets.filter(s => ['submitted', 'under_review'].includes(s.status)).map(set => ({
      type: 'okr_set' as ListItemType,
      id: set.id,
      sortDate: set.submitted_at || set.id,
      okrSet: set,
    })),
    ...pendingReviewRequests.map(req => ({
      type: 'review_request' as ListItemType,
      id: req.id,
      sortDate: req.created_at,
      reviewRequest: req,
    })),
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

  // 처리완료 탭: 완료된 OKR + 완료된 유관부서 검토
  const completedListItems: ListItem[] = [
    ...okrSets.filter(s => ['approved', 'rejected', 'revision_requested', 'finalized'].includes(s.status)).map(set => ({
      type: 'okr_set' as ListItemType,
      id: set.id,
      sortDate: set.reviewed_at || set.submitted_at || set.id,
      okrSet: set,
    })),
    ...completedReviewRequests.map(req => ({
      type: 'review_request' as ListItemType,
      id: req.id,
      sortDate: req.responded_at || req.created_at,
      reviewRequest: req,
    })),
  ].sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime());

  const completedCount = completedListItems.length;

  const dDayColor = !activeCycle ? '' : activeCycle.isOverdue ? 'text-red-600' : activeCycle.daysRemaining <= 3 ? 'text-amber-600' : 'text-blue-600';
  const dDayText = !activeCycle ? '' : activeCycle.isOverdue ? `마감 ${Math.abs(activeCycle.daysRemaining)}일 초과` : activeCycle.daysRemaining === 0 ? '오늘 마감' : `D-${activeCycle.daysRemaining}`;

  // 현재 어떤 것이 선택되어 있는지
  const hasSelection = selectedSet || selectedReviewReq;

  // ── OKR 상세 렌더 (공용) ──
  const renderOKRDetail = (detail: OKRDetail | null, isLoading: boolean) => {
    if (isLoading) return <div className="p-8 text-center text-sm text-slate-500">OKR 불러오는 중...</div>;
    if (!detail || detail.objectives.length === 0) return <div className="p-8 text-center"><Target className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-500">등록된 OKR이 없습니다</p></div>;
    return (
      <div className="space-y-5">
        {detail.objectives.map((obj, objIdx) => {
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

  // ── 리스트 아이템 렌더링 ──
  const renderListItem = (item: ListItem) => {
    if (item.type === 'okr_set' && item.okrSet) {
      const set = item.okrSet;
      return (
        <div key={set.id} onClick={() => loadDetail(set)}
          className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${selectedSet?.id === set.id ? 'border-blue-500 shadow-md' : 'border-slate-200'}`}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileCheck className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{set.org_name}</span>
                  <span className="text-xs text-slate-400">{set.org_level}</span>
                </div>
                <span className="text-xs text-slate-500">{set.period}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(set.status)}
              {set.version > 1 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">v{set.version}</span>}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            {set.submitted_at && <span className="flex items-center gap-1"><Send className="w-3 h-3" />제출: {timeFormat(set.submitted_at)}</span>}
            {set.reviewed_at && <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" />검토: {timeFormat(set.reviewed_at)}</span>}
          </div>
        </div>
      );
    }

    if (item.type === 'review_request' && item.reviewRequest) {
      const req = item.reviewRequest;
      const isPending = req.status === 'pending';
      return (
        <div key={req.id} onClick={() => loadReviewReqDetail(req)}
          className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
            selectedReviewReq?.id === req.id 
              ? 'border-violet-500 shadow-md' 
              : isPending ? 'border-slate-200' : 'border-slate-200 opacity-70'
          }`}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{req.requester_org_name}</span>
                  <span className="text-xs text-slate-400">{req.requester_org_level}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-violet-600 font-medium">유관부서 검토</span>
                  {req.requester_name && (
                    <>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="text-xs text-slate-500">
                        {req.requester_name}{req.requester_org_role ? ` ${req.requester_org_role}` : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {isPending
              ? <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-medium">검토 대기</span>
              : <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">✅ 완료</span>
            }
          </div>
          <p className="text-sm text-slate-600 mb-1.5 line-clamp-1">{isPending ? req.message : req.response}</p>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>{req.period}</span>
            <span>{relativeTime(isPending ? req.created_at : (req.responded_at || req.created_at))}</span>
          </div>
        </div>
      );
    }

    return null;
  };

  // ═══════════════════════════ RENDER ═══════════════════════════
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <button onClick={() => navigate('/okr-setup')} className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> 수립 현황으로
      </button>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Inbox className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">승인 대기함</h1>
            <p className="text-sm text-slate-500 mt-0.5">OKR 검토 및 승인/반려/수정 요청을 관리합니다</p>
          </div>
        </div>
        <button onClick={() => { fetchOKRSets(); fetchReviewRequests(); fetchActiveCycle(); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><RefreshCw className="w-5 h-5" /></button>
      </div>

      {/* 사이클 배너 */}
      {activeCycle && activeCycle.status === 'in_progress' && (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border mb-5 ${activeCycle.isOverdue ? 'bg-red-50 border-red-200' : activeCycle.daysRemaining <= 3 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
          <CalendarClock className={`w-4 h-4 ${dDayColor} shrink-0`} />
          <span className="text-sm text-slate-700">{activeCycle.title}</span>
          <span className={`text-sm font-bold ${dDayColor}`}>{dDayText}</span>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500 flex items-center gap-1"><Timer className="w-3 h-3" />마감: {new Date(activeCycle.deadlineAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
        </div>
      )}

      {/* 탭 — peer_review 탭 제거 */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { key: 'pending' as TabType, label: '검토 대기', count: pendingListItems.length, icon: FileCheck },
          { key: 'completed' as TabType, label: '처리 완료', count: completedCount > 0 ? completedCount : undefined, icon: CheckCheck },
          { key: 'my_submissions' as TabType, label: '내 제출 현황', icon: Send },
        ]).map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedSet(null); setSelectedReviewReq(null); }}
            className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${activeTab === tab.key ? 'bg-white text-slate-900 font-medium shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center bg-red-500 text-white">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════ 검토 대기 탭 (OKR 제출 + 유관부서 검토 통합) ═══════ */}
      {activeTab === 'pending' && (
        <div className="grid grid-cols-12 gap-6">
          {/* 왼쪽: 통합 리스트 */}
          <div className={hasSelection ? 'col-span-5' : 'col-span-12'}>
            {loading ? (
              <div className="text-center py-12 text-slate-500 text-sm">불러오는 중...</div>
            ) : pendingListItems.length === 0 ? (
              <div className="text-center py-16">
                <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">검토 대기 중인 항목이 없습니다</p>
                <p className="text-xs text-slate-400 mt-2">조직들이 OKR을 제출하거나 유관부서 검토를 요청하면 여기에 표시됩니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingListItems.map(item => renderListItem(item))}
              </div>
            )}
          </div>

          {/* 오른쪽: OKR Set 상세 */}
          {selectedSet && (
            <div className="col-span-7">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3"><h3 className="text-lg font-bold text-slate-900">{selectedSet.org_name}</h3>{getStatusBadge(selectedSet.status)}</div>
                    <button onClick={() => { setSelectedSet(null); setOkrDetail(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-500">{selectedSet.period} · v{selectedSet.version}</p>
                  </div>
                </div>

                <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                  <div className="p-6 space-y-6">
                    {renderOKRDetail(okrDetail, detailLoading)}

                    {approvalHistory.length > 0 && (
                      <div className="border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" />승인 이력</h4>
                        <div className="space-y-3">
                          {approvalHistory.map((h) => {
                            const actionMap: Record<string, { icon: any; color: string; label: string }> = {
                              created: { icon: FileCheck, color: 'text-slate-400', label: '생성' }, submitted: { icon: Send, color: 'text-blue-500', label: '제출' },
                              approved: { icon: Check, color: 'text-green-500', label: '승인' }, rejected: { icon: X, color: 'text-red-500', label: '반려' },
                              revision_requested: { icon: MessageSquare, color: 'text-amber-500', label: '수정요청' }, revised: { icon: RefreshCw, color: 'text-indigo-500', label: '수정 완료' },
                              finalized: { icon: CheckCheck, color: 'text-green-600', label: '최종확정' },
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

                    {selectedSet.review_comment && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-4 h-4 text-amber-600" /><span className="text-sm font-medium text-amber-800">검토 의견</span></div>
                        <p className="text-sm text-amber-700">{selectedSet.review_comment}</p>
                      </div>
                    )}

                    <OKRCommentPanel okrSetId={selectedSet.id} />
                  </div>
                </div>

                {['submitted', 'under_review'].includes(selectedSet.status) && (
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                    <button onClick={() => { setActionType('approve'); setShowActionModal(true); setActionComment(''); }} className="flex-1 bg-green-600 text-white rounded-lg py-2.5 font-medium hover:bg-green-700 flex items-center justify-center gap-2"><Check className="w-4 h-4" /> 승인</button>
                    <button onClick={() => { setActionType('revision_request'); setShowActionModal(true); setActionComment(''); }} className="flex-1 bg-amber-500 text-white rounded-lg py-2.5 font-medium hover:bg-amber-600 flex items-center justify-center gap-2"><MessageSquare className="w-4 h-4" /> 수정 요청</button>
                    <button onClick={() => { setActionType('reject'); setShowActionModal(true); setActionComment(''); }} className="px-4 bg-red-600 text-white rounded-lg py-2.5 font-medium hover:bg-red-700 flex items-center justify-center gap-2"><X className="w-4 h-4" /> 반려</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 오른쪽: 유관부서 검토 요청 상세 */}
          {selectedReviewReq && (
            <div className="col-span-7">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
                {/* 헤더 */}
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-violet-600" /></div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{selectedReviewReq.requester_org_name}</h3>
                        <p className="text-xs text-slate-500">
                          {selectedReviewReq.period}
                          {selectedReviewReq.requester_name && ` · 요청자: ${selectedReviewReq.requester_name}`}
                          {' · '}{relativeTime(selectedReviewReq.created_at)}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedReviewReq(null); setReviewReqOKRDetail(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="bg-white/70 border border-violet-200 rounded-lg p-3 mt-2">
                    <div className="flex items-center gap-1.5 mb-1"><MessageSquare className="w-3.5 h-3.5 text-violet-500" /><span className="text-xs font-medium text-violet-700">검토 요청 메시지</span></div>
                    <p className="text-sm text-slate-700">{selectedReviewReq.message}</p>
                  </div>
                </div>

                {/* OKR 내용 */}
                <div className="max-h-[calc(100vh-420px)] overflow-y-auto px-6 py-5">
                  <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-slate-400" />{selectedReviewReq.requester_org_name}의 OKR
                  </h4>
                  {renderOKRDetail(reviewReqOKRDetail, reviewReqDetailLoading)}

                  {/* 이전 응답 (완료 상태) */}
                  {selectedReviewReq.status === 'completed' && selectedReviewReq.response && (
                    <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2"><Check className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-800">내 검토 의견</span><span className="text-xs text-green-600">{timeFormat(selectedReviewReq.responded_at)}</span></div>
                      <p className="text-sm text-green-700">{selectedReviewReq.response}</p>
                    </div>
                  )}
                </div>

                {/* 의견 작성 (pending만) */}
                {selectedReviewReq.status === 'pending' && (
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <label className="block text-sm font-medium text-slate-700 mb-2">검토 의견 작성</label>
                    <textarea value={reviewResponseText} onChange={(e) => setReviewResponseText(e.target.value)}
                      placeholder="OKR에 대한 피드백, 연관성 검토 의견, 조정 제안 등을 작성해주세요..."
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-violet-500 outline-none" rows={3} />
                    <div className="flex gap-2 mt-3">
                      <button onClick={handleReviewResponse} disabled={reviewResponseLoading || !reviewResponseText.trim()}
                        className="flex-1 bg-violet-600 text-white rounded-lg py-2.5 font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                        {reviewResponseLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> 전송 중...</> : <><Send className="w-4 h-4" /> 의견 전송</>}
                      </button>
                      <button onClick={() => handleQuickResponse(selectedReviewReq.id)}
                        className="px-4 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-100 text-sm font-medium transition-colors">확인 완료</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ 처리 완료 탭 (OKR 완료 + 유관부서 검토 완료 통합) ═══════ */}
      {activeTab === 'completed' && (
        <div className="grid grid-cols-12 gap-6">
          <div className={hasSelection ? 'col-span-5' : 'col-span-12'}>
            {loading ? (
              <div className="text-center py-12 text-slate-500 text-sm">불러오는 중...</div>
            ) : completedListItems.length === 0 ? (
              <div className="text-center py-16">
                <CheckCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">처리 완료된 건이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {completedListItems.map(item => renderListItem(item))}
              </div>
            )}
          </div>

          {/* 상세 패널 — OKR Set */}
          {selectedSet && (
            <div className="col-span-7">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3"><h3 className="text-lg font-bold text-slate-900">{selectedSet.org_name}</h3>{getStatusBadge(selectedSet.status)}</div>
                    <button onClick={() => { setSelectedSet(null); setOkrDetail(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-500">{selectedSet.period} · v{selectedSet.version}</p>
                  </div>
                </div>
                <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                  <div className="p-6 space-y-6">
                    {renderOKRDetail(okrDetail, detailLoading)}
                    {selectedSet.review_comment && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-4 h-4 text-amber-600" /><span className="text-sm font-medium text-amber-800">검토 의견</span></div>
                        <p className="text-sm text-amber-700">{selectedSet.review_comment}</p>
                      </div>
                    )}
                    <OKRCommentPanel okrSetId={selectedSet.id} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 상세 패널 — 유관부서 검토 완료건 */}
          {selectedReviewReq && (
            <div className="col-span-7">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-indigo-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-violet-600" /></div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{selectedReviewReq.requester_org_name}</h3>
                        <p className="text-xs text-slate-500">
                          {selectedReviewReq.period}
                          {selectedReviewReq.requester_name && ` · 요청자: ${selectedReviewReq.requester_name}`}
                          {' · '}{relativeTime(selectedReviewReq.created_at)}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedReviewReq(null); setReviewReqOKRDetail(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="bg-white/70 border border-violet-200 rounded-lg p-3 mt-2">
                    <div className="flex items-center gap-1.5 mb-1"><MessageSquare className="w-3.5 h-3.5 text-violet-500" /><span className="text-xs font-medium text-violet-700">검토 요청 메시지</span></div>
                    <p className="text-sm text-slate-700">{selectedReviewReq.message}</p>
                  </div>
                </div>
                <div className="max-h-[calc(100vh-420px)] overflow-y-auto px-6 py-5">
                  <h4 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-slate-400" />{selectedReviewReq.requester_org_name}의 OKR
                  </h4>
                  {renderOKRDetail(reviewReqOKRDetail, reviewReqDetailLoading)}
                  {selectedReviewReq.response && (
                    <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2"><Check className="w-4 h-4 text-green-600" /><span className="text-sm font-medium text-green-800">내 검토 의견</span><span className="text-xs text-green-600">{timeFormat(selectedReviewReq.responded_at)}</span></div>
                      <p className="text-sm text-green-700">{selectedReviewReq.response}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ 내 제출 현황 탭 ═══════ */}
      {activeTab === 'my_submissions' && (
        <div className="grid grid-cols-12 gap-6">
          <div className={selectedSet ? 'col-span-5' : 'col-span-12'}>
            {loading ? (
              <div className="text-center py-12 text-slate-500 text-sm">불러오는 중...</div>
            ) : okrSets.length === 0 ? (
              <div className="text-center py-16">
                <Send className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">제출한 OKR이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {okrSets.map(set => (
                  <div key={set.id} onClick={() => loadDetail(set)}
                    className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${selectedSet?.id === set.id ? 'border-blue-500 shadow-md' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{set.org_name}</span><span className="text-xs text-slate-400">{set.org_level}</span></div>
                        <span className="text-xs text-slate-500">{set.period}</span>
                      </div>
                      <div className="flex items-center gap-2">{getStatusBadge(set.status)}{set.version > 1 && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">v{set.version}</span>}</div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      {set.submitted_at && <span className="flex items-center gap-1"><Send className="w-3 h-3" />제출: {timeFormat(set.submitted_at)}</span>}
                      {set.reviewed_at && <span className="flex items-center gap-1"><FileCheck className="w-3 h-3" />검토: {timeFormat(set.reviewed_at)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedSet && (
            <div className="col-span-7">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3"><h3 className="text-lg font-bold text-slate-900">{selectedSet.org_name}</h3>{getStatusBadge(selectedSet.status)}</div>
                    <button onClick={() => { setSelectedSet(null); setOkrDetail(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-500">{selectedSet.period} · v{selectedSet.version}</p>
                  </div>
                </div>
                <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                  <div className="p-6 space-y-6">
                    {renderOKRDetail(okrDetail, detailLoading)}
                    {selectedSet.review_comment && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-4 h-4 text-amber-600" /><span className="text-sm font-medium text-amber-800">검토 의견</span></div>
                        <p className="text-sm text-amber-700">{selectedSet.review_comment}</p>
                      </div>
                    )}
                    <OKRCommentPanel okrSetId={selectedSet.id} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 승인/반려/수정요청 모달 */}
      {showActionModal && selectedSet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className={`text-lg font-bold mb-4 ${actionType === 'approve' ? 'text-green-800' : actionType === 'reject' ? 'text-red-800' : 'text-amber-800'}`}>
              {actionType === 'approve' ? '✅ OKR 승인' : actionType === 'reject' ? '❌ OKR 반려' : '⚠️ 수정 요청'}
            </h3>
            <div className="bg-slate-50 rounded-lg p-3 mb-4"><p className="text-sm font-medium text-slate-700">{selectedSet.org_name}</p><p className="text-xs text-slate-500">{selectedSet.period} · v{selectedSet.version}</p></div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">{actionType === 'approve' ? '승인 코멘트 (선택)' : actionType === 'reject' ? '반려 사유 (필수)' : '수정 요청 내용 (필수)'}</label>
              <textarea value={actionComment} onChange={(e) => setActionComment(e.target.value)}
                placeholder={actionType === 'approve' ? '잘 수립했습니다. 승인합니다.' : actionType === 'reject' ? '반려 사유를 입력해주세요...' : '수정이 필요한 부분을 구체적으로 작성해주세요...'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" rows={4} />
            </div>
            <div className="flex gap-3">
              <button onClick={handleAction} disabled={actionLoading || ((actionType !== 'approve') && !actionComment.trim())}
                className={`flex-1 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                {actionLoading ? '처리 중...' : actionType === 'approve' ? '승인 확인' : actionType === 'reject' ? '반려 확인' : '수정 요청 전송'}
              </button>
              <button onClick={() => setShowActionModal(false)} className="px-4 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}