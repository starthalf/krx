// src/pages/OKRSetupStatus.tsx
// OKR 수립 현황 관리 페이지 - CEO/본부장용
import { useState, useEffect, useMemo } from 'react';
import {
  Megaphone, Send, Clock, Check, AlertTriangle, RefreshCw,
  Zap, Search, ChevronRight, CheckCircle2, XCircle, FileEdit,
  BarChart3, Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { getMyRoleLevel } from '../lib/permissions';

interface OrgStatus {
  id: string;
  name: string;
  level: string;
  headName: string | null;
  headId: string | null;
  okrStatus: 'not_started' | 'draft' | 'submitted' | 'approved' | 'finalized';
  objectiveCount: number;
  krCount: number;
  lastNudgedAt: string | null;
  selected: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any; order: number }> = {
  not_started: { label: '미착수', cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: XCircle, order: 0 },
  draft:       { label: '작성중', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: FileEdit, order: 1 },
  submitted:   { label: '제출됨', cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: Send, order: 2 },
  approved:    { label: '승인',   cls: 'bg-green-50 text-green-700 border-green-200', icon: Check, order: 3 },
  finalized:   { label: '확정',   cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2, order: 4 },
};

export default function OKRSetupStatus() {
  const { user } = useAuth();
  const { organizations, company } = useStore();
  const currentPeriod = useStore(s => s.currentPeriod);
  const navigate = useNavigate();

  const [orgStatuses, setOrgStatuses] = useState<OrgStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [showMsgInput, setShowMsgInput] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleLevel, setRoleLevel] = useState(0);

  useEffect(() => { getMyRoleLevel().then(setRoleLevel); }, []);

  const fetchOrgStatuses = async () => {
    setLoading(true);
    try {
      const subOrgs = organizations.filter(o => o.level !== '전사');
      const statuses: OrgStatus[] = [];

      for (const org of subOrgs) {
        const { data: okrSet } = await supabase
          .from('okr_sets').select('status')
          .eq('org_id', org.id).eq('period', currentPeriod)
          .order('version', { ascending: false }).limit(1).maybeSingle();

        const { count: objCount } = await supabase
          .from('objectives').select('*', { count: 'exact', head: true }).eq('org_id', org.id);
        const { count: krCount } = await supabase
          .from('key_results').select('*', { count: 'exact', head: true }).eq('org_id', org.id);

        let headName: string | null = null;
        let headId: string | null = null;
        try {
          const { data: hr } = await supabase
            .from('user_roles').select('profile_id, role:roles!inner(name)')
            .eq('org_id', org.id).in('roles.name', ['org_head', 'company_admin'])
            .limit(1).maybeSingle();
          if (hr?.profile_id) {
            headId = hr.profile_id;
            const { data: p } = await supabase.from('profiles').select('full_name').eq('id', hr.profile_id).single();
            headName = p?.full_name || null;
          }
        } catch {}

        const { data: lastNudge } = await supabase
          .from('notifications').select('created_at')
          .eq('type', 'okr_draft_reminder').eq('org_id', org.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();

        let status: OrgStatus['okrStatus'] = 'not_started';
        if (okrSet?.status === 'finalized') status = 'finalized';
        else if (okrSet?.status === 'approved') status = 'approved';
        else if (okrSet?.status === 'submitted' || okrSet?.status === 'under_review') status = 'submitted';
        else if (okrSet?.status === 'draft' || okrSet?.status === 'revision_requested') status = 'draft';

        statuses.push({
          id: org.id, name: org.name, level: org.level,
          headName, headId, okrStatus: status,
          objectiveCount: objCount || 0, krCount: krCount || 0,
          lastNudgedAt: lastNudge?.created_at || null,
          selected: status === 'not_started' || status === 'draft',
        });
      }
      setOrgStatuses(statuses);
    } catch (err) { console.warn('조직 상태 조회 실패:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (organizations.length > 0) fetchOrgStatuses(); }, [organizations, currentPeriod]);

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
    const sb = orgStatuses.filter(o => o.okrStatus === 'submitted').length;
    const ap = orgStatuses.filter(o => o.okrStatus === 'approved').length;
    const fn = orgStatuses.filter(o => o.okrStatus === 'finalized').length;
    return { total: t, notStarted: ns, draft: dr, submitted: sb, approved: ap, finalized: fn,
      completionRate: t > 0 ? Math.round(((ap + fn) / t) * 100) : 0 };
  }, [orgStatuses]);

  const selectedCount = orgStatuses.filter(o => o.selected).length;

  const toggleSelect = (id: string) => {
    setOrgStatuses(p => p.map(o => o.id === id ? { ...o, selected: !o.selected } : o));
  };

  const selectByStatus = (s: 'all' | 'incomplete' | 'none') => {
    setOrgStatuses(p => p.map(o => {
      const can = o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved';
      if (!can) return { ...o, selected: false };
      if (s === 'all') return { ...o, selected: true };
      if (s === 'none') return { ...o, selected: false };
      return { ...o, selected: o.okrStatus === 'not_started' || o.okrStatus === 'draft' };
    }));
  };

  const handleBulkNudge = async () => {
    const targets = orgStatuses.filter(o => o.selected && o.headId);
    if (!targets.length) return alert('독촉할 조직을 선택해주세요.');
    if (!confirm(`${targets.length}개 조직에 목표수립 독촉 알림을 보내시겠습니까?`)) return;
    setSending(true);
    try {
      const { data: me } = await supabase.from('profiles').select('full_name').eq('id', user?.id).single();
      const msg = nudgeMessage.trim() || `${currentPeriod} OKR 수립 기한이 임박했습니다. 빠른 시일 내에 목표를 수립하고 제출해 주세요.`;
      for (const org of targets) {
        await supabase.from('notifications').insert({
          recipient_id: org.headId, type: 'okr_draft_reminder',
          title: `📢 ${currentPeriod} OKR 수립 요청`,
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

  const timeAgo = (d: string | null) => {
    if (!d) return null;
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  if (roleLevel > 0 && roleLevel < 50) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-20">
        <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-700">접근 권한이 없습니다</h2>
        <p className="text-sm text-slate-500 mt-1">이 페이지는 팀장 이상만 조회할 수 있습니다.</p>
      </div>
    );
  }

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
            <p className="text-sm text-slate-500">{currentPeriod} · {company?.name || ''}</p>
          </div>
        </div>
        <button onClick={fetchOrgStatuses} disabled={loading}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </div>

      {/* 요약 카드 5개 */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">전체 완료율</span>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.completionRate}%</div>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${stats.completionRate >= 80 ? 'bg-green-500' : stats.completionRate >= 50 ? 'bg-blue-500' : 'bg-orange-500'}`}
              style={{ width: `${stats.completionRate}%` }} />
          </div>
        </div>
        {(['not_started', 'draft', 'submitted', 'approved'] as const).map(key => {
          const cfg = STATUS_CONFIG[key];
          const Icon = cfg.icon;
          const count = key === 'approved' ? stats.approved + stats.finalized
            : key === 'not_started' ? stats.notStarted
            : key === 'draft' ? stats.draft : stats.submitted;
          const desc = key === 'not_started' ? '아직 시작하지 않은 조직'
            : key === 'draft' ? '초안 작성 진행중'
            : key === 'submitted' ? '검토 대기중' : '수립 완료';
          const active = statusFilter === key;
          return (
            <button key={key} onClick={() => setStatusFilter(active ? 'all' : key)}
              className={`bg-white rounded-xl border p-5 shadow-sm text-left transition-all hover:shadow-md ${active ? 'ring-1 ring-slate-400 border-slate-400' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500">{key === 'approved' ? '승인/확정' : cfg.label}</span>
                <Icon className="w-4 h-4 text-slate-400" />
              </div>
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
            {statusFilter !== 'all' && (
              <button onClick={() => setStatusFilter('all')} className="text-xs text-blue-600 hover:underline">필터 초기화</button>
            )}
          </div>
          <div className="flex gap-0.5 h-4 rounded-full overflow-hidden bg-slate-100">
            {stats.finalized > 0 && <div className="bg-emerald-500" style={{ width: `${(stats.finalized / stats.total) * 100}%` }} />}
            {stats.approved > 0 && <div className="bg-green-500" style={{ width: `${(stats.approved / stats.total) * 100}%` }} />}
            {stats.submitted > 0 && <div className="bg-blue-500" style={{ width: `${(stats.submitted / stats.total) * 100}%` }} />}
            {stats.draft > 0 && <div className="bg-amber-400" style={{ width: `${(stats.draft / stats.total) * 100}%` }} />}
            {stats.notStarted > 0 && <div className="bg-slate-300" style={{ width: `${(stats.notStarted / stats.total) * 100}%` }} />}
          </div>
          <div className="flex gap-5 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />확정 {stats.finalized}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />승인 {stats.approved}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" />제출 {stats.submitted}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" />작성중 {stats.draft}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" />미착수 {stats.notStarted}</span>
          </div>
        </div>
      )}

      {/* 테이블 영역 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* 툴바 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="조직명 또는 조직장 검색..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => selectByStatus('incomplete')} className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">미완료만</button>
              <button onClick={() => selectByStatus('all')} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">전체</button>
              <button onClick={() => selectByStatus('none')} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">해제</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMsgInput(!showMsgInput)}
              className="px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">✏️ 메시지</button>
            <button onClick={handleBulkNudge} disabled={selectedCount === 0 || sending}
              className="px-5 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 disabled:opacity-50 flex items-center gap-2 text-sm">
              {sending ? <><RefreshCw className="w-4 h-4 animate-spin" /> 전송 중...</> : <><Zap className="w-4 h-4" /> {selectedCount}개 독촉 발송</>}
            </button>
          </div>
        </div>

        {showMsgInput && (
          <div className="px-6 py-3 border-b border-slate-100 bg-orange-50/50">
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">독촉 메시지 (선택)</label>
            <textarea value={nudgeMessage} onChange={e => setNudgeMessage(e.target.value)}
              placeholder="기본: OKR 수립 기한이 임박했습니다. 빠른 시일 내에 목표를 수립하고 제출해 주세요."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-500 outline-none bg-white" rows={2} />
          </div>
        )}

        {/* 테이블 */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">불러오는 중...</p>
            </div>
          ) : filteredOrgs.length === 0 ? (
            <div className="py-16 text-center">
              <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">{searchQuery || statusFilter !== 'all' ? '검색 결과가 없습니다.' : '하위 조직이 없습니다.'}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pl-6 pr-2 py-3 w-10">
                    <input type="checkbox"
                      checked={filteredOrgs.filter(o => o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved').length > 0 &&
                        filteredOrgs.filter(o => o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved').every(o => o.selected)}
                      onChange={() => {
                        const nudgeable = filteredOrgs.filter(o => o.headId && o.okrStatus !== 'finalized' && o.okrStatus !== 'approved');
                        selectByStatus(nudgeable.every(o => o.selected) ? 'none' : 'all');
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-orange-600" />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">조직</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">조직장</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">상태</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">OKR</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">마지막 독촉</th>
                  <th className="pr-6 pl-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredOrgs.map(org => {
                  const c = STATUS_CONFIG[org.okrStatus];
                  const Icon = c.icon;
                  const canNudge = org.headId && org.okrStatus !== 'finalized' && org.okrStatus !== 'approved';
                  return (
                    <tr key={org.id} className={org.selected ? 'bg-orange-50/50' : 'hover:bg-slate-50/50'}>
                      <td className="pl-6 pr-2 py-3">
                        <input type="checkbox" checked={org.selected} onChange={() => toggleSelect(org.id)}
                          disabled={!canNudge} className="w-4 h-4 rounded border-slate-300 text-orange-600 disabled:opacity-30" />
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-semibold text-slate-800">{org.name}</span>
                        <span className="ml-2 text-xs text-slate-400">{org.level}</span>
                      </td>
                      <td className="px-3 py-3">
                        {org.headName
                          ? <span className="text-sm text-slate-600">{org.headName}</span>
                          : <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />미지정</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}>
                          <Icon className="w-3 h-3" />{c.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-slate-600">
                        {org.objectiveCount > 0
                          ? <>{org.objectiveCount} <span className="text-slate-400">O</span> / {org.krCount} <span className="text-slate-400">KR</span></>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {timeAgo(org.lastNudgedAt)
                          ? <span className="text-xs text-orange-500 flex items-center justify-center gap-1"><Clock className="w-3 h-3" />{timeAgo(org.lastNudgedAt)}</span>
                          : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="pr-6 pl-3 py-3 text-center">
                        <button onClick={() => navigate(`/wizard/${org.id}`)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-0.5">
                          보기 <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {lastSentAt && (
          <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-green-500" />
            마지막 발송: {new Date(lastSentAt).toLocaleString('ko-KR')}
          </div>
        )}
      </div>
    </div>
  );
}