// src/pages/ApprovalInbox.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox, Check, X, MessageSquare, Clock, FileCheck, ChevronDown, ChevronRight,
  Send, GitBranch, Eye, ArrowLeft, AlertTriangle, CheckCheck, RefreshCw, User, Filter
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { getBIIColor } from '../utils/helpers';
import type { BIIType } from '../types';

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
  requester_org_id: string;
  request_type: string;
  title: string;
  message: string;
  status: string;
  created_at: string;
  requester_name?: string;
  requester_org_name?: string;
}

export default function ApprovalInbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organizations } = useStore();

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [okrSets, setOkrSets] = useState<OKRSet[]>([]);
  const [reviewRequests, setReviewRequests] = useState<ReviewRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSet, setSelectedSet] = useState<OKRSet | null>(null);
  const [okrDetail, setOkrDetail] = useState<OKRDetail | null>(null);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistoryItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // 모달
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'revision_request'>('approve');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // 승인 대기 OKR 조회
  const fetchOKRSets = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('okr_sets')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (activeTab === 'pending') {
        query = query.in('status', ['submitted', 'under_review']);
      } else if (activeTab === 'completed') {
        query = query.in('status', ['approved', 'rejected', 'revision_requested', 'finalized']);
      } else {
        // my_submissions
        query = query.eq('submitted_by', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      // 조직명 매핑
      const enriched = (data || []).map(set => {
        const org = organizations.find(o => o.id === set.org_id);
        return {
          ...set,
          org_name: org?.name || '알 수 없는 조직',
          org_level: org?.level || '',
        };
      });

      setOkrSets(enriched);
    } catch (err) {
      console.warn('OKR Set 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  // 유관부서 검토 요청 조회
  const fetchReviewRequests = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('review_requests')
        .select('*')
        .eq('reviewer_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setReviewRequests(data || []);
    } catch (err) {
      console.warn('검토 요청 조회 실패:', err);
    }
  };

  useEffect(() => {
    fetchOKRSets();
    fetchReviewRequests();
  }, [user?.id, activeTab, organizations]);

  // OKR 상세 로딩
  const loadDetail = async (set: OKRSet) => {
    setSelectedSet(set);
    setDetailLoading(true);
    try {
      // Objectives + KRs
      const { data: objs } = await supabase
        .from('objectives')
        .select('id, name, bii_type, sort_order')
        .eq('org_id', set.org_id)
        .in('status', ['draft', 'active', 'agreed', 'review'])
        .order('sort_order');

      const objectives = [];
      for (const obj of (objs || [])) {
        const { data: krs } = await supabase
          .from('key_results')
          .select('id, name, weight, target_value, unit, bii_type, kpi_category, perspective, grade_criteria')
          .eq('objective_id', obj.id)
          .order('weight', { ascending: false });

        objectives.push({ ...obj, key_results: krs || [] });
      }
      setOkrDetail({ objectives });

      // 승인 이력
      const { data: history } = await supabase
        .from('approval_history')
        .select('id, action, actor_name, comment, created_at')
        .eq('okr_set_id', set.id)
        .order('created_at', { ascending: false });
      setApprovalHistory(history || []);

    } catch (err) {
      console.warn('상세 조회 실패:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // 승인/반려/수정요청 처리
  const handleAction = async () => {
    if (!selectedSet || !user?.id) return;
    setActionLoading(true);
    try {
      const newStatus = actionType === 'approve' ? 'approved'
        : actionType === 'reject' ? 'rejected'
        : 'revision_requested';

      // OKR Set 상태 업데이트
      const { error } = await supabase
        .from('okr_sets')
        .update({
          status: newStatus,
          reviewer_id: user.id,
          reviewed_at: new Date().toISOString(),
          review_comment: actionComment || null,
        })
        .eq('id', selectedSet.id);

      if (error) throw error;

      // 승인 이력 기록
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      await supabase.from('approval_history').insert({
        okr_set_id: selectedSet.id,
        action: newStatus,
        actor_id: user.id,
        actor_name: profile?.full_name || '관리자',
        comment: actionComment || null,
      });

      setShowActionModal(false);
      setActionComment('');
      setSelectedSet(null);
      fetchOKRSets();
      alert(
        actionType === 'approve' ? '✅ OKR이 승인되었습니다.'
        : actionType === 'reject' ? '❌ OKR이 반려되었습니다.'
        : '⚠️ 수정 요청이 전달되었습니다.'
      );
    } catch (err: any) {
      alert(`처리 실패: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 검토 요청 응답
  const handleReviewResponse = async (reqId: string, response: string) => {
    try {
      await supabase
        .from('review_requests')
        .update({
          status: 'completed',
          response,
          responded_at: new Date().toISOString(),
        })
        .eq('id', reqId);
      fetchReviewRequests();
      alert('✅ 검토 의견이 전달되었습니다.');
    } catch (err: any) {
      alert(`실패: ${err.message}`);
    }
  };

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

  const pendingCount = okrSets.filter(s => ['submitted', 'under_review'].includes(s.status)).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Inbox className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">승인 대기함</h1>
            <p className="text-sm text-slate-500 mt-0.5">OKR 검토 및 승인/반려/수정 요청을 관리합니다</p>
          </div>
        </div>
        <button onClick={() => { fetchOKRSets(); fetchReviewRequests(); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        {[
          { key: 'pending' as TabType, label: '검토 대기', count: pendingCount },
          { key: 'completed' as TabType, label: '처리 완료' },
          { key: 'my_submissions' as TabType, label: '내 제출 현황' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedSet(null); }}
            className={`px-4 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
              activeTab === tab.key
                ? 'bg-white text-slate-900 font-medium shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 왼쪽: OKR Set 목록 */}
        <div className={`${selectedSet ? 'col-span-5' : 'col-span-12'}`}>
          {/* 유관부서 검토 요청 (pending 탭에만) */}
          {activeTab === 'pending' && reviewRequests.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-medium text-violet-800">유관부서 검토 요청 ({reviewRequests.length})</span>
              </div>
              <div className="space-y-2">
                {reviewRequests.slice(0, 3).map(req => (
                  <div key={req.id} className="bg-white rounded-lg p-3 border border-violet-100">
                    <p className="text-sm font-medium text-slate-900 mb-1">{req.title || '검토 요청'}</p>
                    <p className="text-xs text-slate-500 mb-2 line-clamp-1">{req.message}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const comment = prompt('검토 의견을 입력해주세요:');
                          if (comment) handleReviewResponse(req.id, comment);
                        }}
                        className="text-xs bg-violet-600 text-white px-3 py-1 rounded-md hover:bg-violet-700"
                      >
                        의견 작성
                      </button>
                      <button
                        onClick={() => handleReviewResponse(req.id, '확인했습니다.')}
                        className="text-xs border border-violet-300 text-violet-700 px-3 py-1 rounded-md hover:bg-violet-50"
                      >
                        확인 완료
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* OKR Set 카드 목록 */}
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">불러오는 중...</div>
          ) : okrSets.length === 0 ? (
            <div className="text-center py-16">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">
                {activeTab === 'pending' ? '검토 대기 중인 OKR이 없습니다' :
                 activeTab === 'completed' ? '처리 완료된 건이 없습니다' :
                 '제출한 OKR이 없습니다'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {okrSets.map(set => (
                <div
                  key={set.id}
                  onClick={() => loadDetail(set)}
                  className={`bg-white border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedSet?.id === set.id ? 'border-blue-500 shadow-md' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{set.org_name}</span>
                        <span className="text-xs text-slate-400">{set.org_level}</span>
                      </div>
                      <span className="text-xs text-slate-500">{set.period}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(set.status)}
                      {set.version > 1 && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">v{set.version}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    {set.submitted_at && (
                      <span className="flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        제출: {timeFormat(set.submitted_at)}
                      </span>
                    )}
                    {set.reviewed_at && (
                      <span className="flex items-center gap-1">
                        <FileCheck className="w-3 h-3" />
                        검토: {timeFormat(set.reviewed_at)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오른쪽: 상세 패널 */}
        {selectedSet && (
          <div className="col-span-7">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden sticky top-6">
              {/* 상세 헤더 */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-900">{selectedSet.org_name}</h3>
                    {getStatusBadge(selectedSet.status)}
                  </div>
                  <button onClick={() => setSelectedSet(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-500">{selectedSet.period} · v{selectedSet.version}</p>
              </div>

              {/* 상세 내용 */}
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {detailLoading ? (
                  <div className="p-8 text-center text-sm text-slate-500">불러오는 중...</div>
                ) : (
                  <div className="p-6 space-y-6">
                    {/* OKR 내용 */}
                    {okrDetail?.objectives.map((obj, objIdx) => {
                      const biiColor = getBIIColor(obj.bii_type as BIIType);
                      return (
                        <div key={obj.id}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">O{objIdx + 1}</span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                              {obj.bii_type}
                            </span>
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
                                  <div className="flex gap-3 text-xs text-slate-500">
                                    <span>목표: {kr.target_value}{kr.unit}</span>
                                    <span>가중치: {kr.weight}%</span>
                                    <span className={`px-1 rounded ${krBii.bg} ${krBii.text}`}>{kr.bii_type}</span>
                                    <span>{kr.perspective}</span>
                                    <span>{kr.kpi_category}</span>
                                  </div>
                                  {kr.grade_criteria && (
                                    <div className="flex gap-2 mt-1 text-[10px] text-slate-400">
                                      {['S', 'A', 'B', 'C', 'D'].map(g => (
                                        <span key={g}>{g}:{(kr.grade_criteria as any)[g]}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* 승인 이력 타임라인 */}
                    {approvalHistory.length > 0 && (
                      <div className="border-t border-slate-100 pt-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          승인 이력
                        </h4>
                        <div className="space-y-3">
                          {approvalHistory.map((h) => {
                            const actionMap: Record<string, { icon: any; color: string; label: string }> = {
                              created: { icon: FileCheck, color: 'text-slate-400', label: '생성' },
                              submitted: { icon: Send, color: 'text-blue-500', label: '제출' },
                              approved: { icon: Check, color: 'text-green-500', label: '승인' },
                              rejected: { icon: X, color: 'text-red-500', label: '반려' },
                              revision_requested: { icon: MessageSquare, color: 'text-amber-500', label: '수정요청' },
                              revised: { icon: RefreshCw, color: 'text-indigo-500', label: '수정 완료' },
                              finalized: { icon: CheckCheck, color: 'text-green-600', label: '최종확정' },
                              ceo_approved: { icon: CheckCheck, color: 'text-green-600', label: 'CEO 승인' },
                              ceo_rejected: { icon: X, color: 'text-red-600', label: 'CEO 반려' },
                            };
                            const info = actionMap[h.action] || { icon: Clock, color: 'text-slate-400', label: h.action };
                            const IconComp = info.icon;
                            return (
                              <div key={h.id} className="flex gap-3">
                                <div className={`w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0`}>
                                  <IconComp className={`w-3.5 h-3.5 ${info.color}`} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-700">{info.label}</span>
                                    <span className="text-xs text-slate-400">by {h.actor_name}</span>
                                    <span className="text-xs text-slate-400">{timeFormat(h.created_at)}</span>
                                  </div>
                                  {h.comment && (
                                    <p className="text-xs text-slate-500 mt-1 bg-slate-50 rounded p-2">{h.comment}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 검토 코멘트 (있을 경우) */}
                    {selectedSet.review_comment && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-4 h-4 text-amber-600" />
                          <span className="text-sm font-medium text-amber-800">검토 의견</span>
                        </div>
                        <p className="text-sm text-amber-700">{selectedSet.review_comment}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 액션 버튼 (pending 탭) */}
              {activeTab === 'pending' && ['submitted', 'under_review'].includes(selectedSet.status) && (
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <button
                    onClick={() => { setActionType('approve'); setShowActionModal(true); setActionComment(''); }}
                    className="flex-1 bg-green-600 text-white rounded-lg py-2.5 font-medium hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> 승인
                  </button>
                  <button
                    onClick={() => { setActionType('revision_request'); setShowActionModal(true); setActionComment(''); }}
                    className="flex-1 bg-amber-500 text-white rounded-lg py-2.5 font-medium hover:bg-amber-600 flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" /> 수정 요청
                  </button>
                  <button
                    onClick={() => { setActionType('reject'); setShowActionModal(true); setActionComment(''); }}
                    className="px-4 bg-red-600 text-white rounded-lg py-2.5 font-medium hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> 반려
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 승인/반려/수정요청 모달 */}
      {showActionModal && selectedSet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className={`text-lg font-bold mb-4 ${
              actionType === 'approve' ? 'text-green-800' :
              actionType === 'reject' ? 'text-red-800' : 'text-amber-800'
            }`}>
              {actionType === 'approve' ? '✅ OKR 승인' :
               actionType === 'reject' ? '❌ OKR 반려' : '⚠️ 수정 요청'}
            </h3>

            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-slate-700">{selectedSet.org_name}</p>
              <p className="text-xs text-slate-500">{selectedSet.period} · v{selectedSet.version}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {actionType === 'approve' ? '승인 코멘트 (선택)' :
                 actionType === 'reject' ? '반려 사유 (필수)' : '수정 요청 내용 (필수)'}
              </label>
              <textarea
                value={actionComment}
                onChange={(e) => setActionComment(e.target.value)}
                placeholder={
                  actionType === 'approve' ? '잘 수립했습니다. 승인합니다.' :
                  actionType === 'reject' ? '반려 사유를 입력해주세요...' :
                  '수정이 필요한 부분을 구체적으로 작성해주세요...'
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAction}
                disabled={actionLoading || ((actionType !== 'approve') && !actionComment.trim())}
                className={`flex-1 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
                  actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-amber-500 hover:bg-amber-600'
                }`}
              >
                {actionLoading ? '처리 중...' :
                 actionType === 'approve' ? '승인 확인' :
                 actionType === 'reject' ? '반려 확인' : '수정 요청 전송'}
              </button>
              <button
                onClick={() => setShowActionModal(false)}
                className="px-4 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}