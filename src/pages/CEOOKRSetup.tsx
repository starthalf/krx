// src/pages/OKRSetupStatus.tsx
// OKR 수립 현황 — CEO/본부장용
// [1] 사이클 셀렉터 항상 표시
// [2] 테이블 우측 액션 버튼 (OKR 확인 / 승인 / 수정요청 / 검토의견)
// [3] OKR 상세는 모달
// [4] okr_sets / approval_history 연동
import { useState, useEffect, useMemo } from 'react';
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

/* ─── Types ─────────────────────────────────────────── */
interface OrgStatus {
  id: string; name: string; level: string; parentOrgId: string | null;
  headName: string | null; headId: string | null;
  okrStatus: 'not_started'|'draft'|'revision_requested'|'submitted'|'approved'|'finalized';
  objectiveCount: number; krCount: number;
  submittedAt: string | null; approvedAt: string | null;
  lastNudgedAt: string | null; selected: boolean; okrSetId: string | null;
}
interface Cycle {
  id: string; period: string; title: string;
  status: 'planning'|'in_progress'|'closed'|'finalized';
  startsAt: string; deadlineAt: string; gracePeriodAt: string | null;
  companyOkrFinalized: boolean; message: string | null;
  daysRemaining: number; isOverdue: boolean;
}
interface OKRDetail {
  objectives: Array<{
    id: string; name: string; bii_type: string; perspective?: string;
    key_results: Array<{
      id: string; name: string; weight: number; target_value: number;
      unit: string; bii_type: string; kpi_category: string;
      perspective: string; grade_criteria: any; definition?: string;
    }>;
  }>;
}
interface HistoryItem { id: string; action: string; actor_name: string; comment: string|null; created_at: string; }

const STATUS_CFG: Record<string,{label:string;cls:string;icon:any;order:number}> = {
  not_started:        { label:'미착수',   cls:'bg-slate-100 text-slate-600 border-slate-200',    icon:XCircle,      order:0 },
  draft:              { label:'작성중',   cls:'bg-amber-50 text-amber-700 border-amber-200',     icon:FileEdit,     order:1 },
  revision_requested: { label:'수정요청', cls:'bg-orange-50 text-orange-700 border-orange-200',  icon:AlertTriangle, order:1.5 },
  submitted:          { label:'제출됨',   cls:'bg-blue-50 text-blue-700 border-blue-200',        icon:Send,         order:2 },
  approved:           { label:'승인',     cls:'bg-green-50 text-green-700 border-green-200',     icon:Check,        order:3 },
  finalized:          { label:'확정',     cls:'bg-emerald-50 text-emerald-800 border-emerald-200', icon:CheckCircle2, order:4 },
};

function fmtDate(d:string){ return new Date(d).toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'short'}); }
function fmtTime(d:string|null){ if(!d) return '-'; return new Date(d).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}); }
function ago(d:string|null){ if(!d)return null; const m=Math.floor((Date.now()-new Date(d).getTime())/60000); if(m<60)return`${m}분 전`; const h=Math.floor(m/60); if(h<24)return`${h}시간 전`; return`${Math.floor(h/24)}일 전`; }

/* ─── Component ─────────────────────────────────────── */
export default function OKRSetupStatus() {
  const { user } = useAuth();
  const { organizations, company } = useStore();
  const currentPeriod = useStore(s => s.currentPeriod);
  const navigate = useNavigate();

  // ── company가 없으면 직접 로드 (CEOOKRSetup과 동일 패턴) ──
  const [companyReady, setCompanyReady] = useState(!!company?.id);

  useEffect(()=>{
    if(!user?.id) return;
    if(company?.id) { setCompanyReady(true); return; }

    (async()=>{
      try {
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
        if(!profile?.company_id) return;
        const { data: companyData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single();
        if(companyData){
          useStore.getState().setCompany({
            id: companyData.id, name: companyData.name,
            industry: companyData.industry, size: companyData.size,
            vision: companyData.vision || '',
          } as any);
          if(organizations.length === 0){
            await useStore.getState().fetchOrganizations(companyData.id);
          }
          setCompanyReady(true);
        }
      } catch(e){ console.warn('company 로드 실패:', e); }
    })();
  },[user?.id, company?.id]);

  const [orgStatuses, setOrgStatuses] = useState<OrgStatus[]>([]);
  const [allCycles, setAllCycles] = useState<Cycle[]>([]);
  const [cycle, setCycle] = useState<Cycle|null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [nudgeMsg, setNudgeMsg] = useState('');
  const [showMsgInput, setShowMsgInput] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string|null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleLevel, setRoleLevel] = useState(0);

  // 상세 모달
  const [modalOrg, setModalOrg] = useState<OrgStatus|null>(null);
  const [okrDetail, setOkrDetail] = useState<OKRDetail|null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [reviewText, setReviewText] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // 승인/수정요청 모달
  const [actionOrg, setActionOrg] = useState<OrgStatus|null>(null);
  const [actionType, setActionType] = useState<'approve'|'revision_request'>('approve');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // 내 조직장 역할
  const [myLeaderOrgIds, setMyLeaderOrgIds] = useState<string[]>([]);

  useEffect(()=>{ getMyRoleLevel().then(setRoleLevel); },[]);

  useEffect(()=>{
    if(!user?.id) return;
    (async()=>{
      const { data } = await supabase.from('user_roles').select('org_id, roles!inner(level)').eq('profile_id', user.id);
      if(data) setMyLeaderOrgIds(data.filter((r:any)=>r.roles?.level>=70).map((r:any)=>r.org_id));
    })();
  },[user?.id]);

  const directChildIds = useMemo(()=>
    organizations.filter(o=>myLeaderOrgIds.includes(o.parentOrgId||'')).map(o=>o.id),
  [myLeaderOrgIds, organizations]);

  const isDirect = (id:string) => directChildIds.includes(id);
  // CEO(level 90+)는 모든 조직에 승인 권한
  const canApprove = (id:string) => roleLevel >= 90 || isDirect(id);

  /* ─── 사이클 목록 조회 ─────────────────────────────── */
  const fetchCycles = async(companyId?: string)=>{
    const cid = companyId || company?.id;
    if(!cid) return;
    try {
      const { data, error } = await supabase.from('okr_planning_cycles').select('*')
        .eq('company_id', cid)
        .in('status',['planning','in_progress','closed','finalized'])
        .order('deadline_at',{ascending:false});
      if(error) { console.warn('사이클 조회 에러:', error); return; }
      if(data && data.length>0){
        const list: Cycle[] = data.map((r:any)=>{
          const dr = Math.max(0, Math.floor((new Date(r.deadline_at).getTime()-Date.now())/86400000));
          return { id:r.id, period:r.period, title:r.title, status:r.status,
            startsAt:r.starts_at, deadlineAt:r.deadline_at, gracePeriodAt:r.grace_period_at,
            companyOkrFinalized:r.company_okr_finalized, message:r.message,
            daysRemaining:dr, isOverdue: Date.now()>new Date(r.deadline_at).getTime() };
        });
        setAllCycles(list);
        if(!cycle){
          const matched = list.find(c=>c.period===currentPeriod);
          const active = list.find(c=>c.status==='in_progress');
          setCycle(matched||active||list[0]);
        }
      } else { setAllCycles([]); setCycle(null); }
    } catch(e){ console.warn('사이클 조회 실패:',e); }
  };

  /* ─── 조직 상태 조회 ───────────────────────────────── */
  const fetchStatuses = async()=>{
    setLoading(true);
    const period = cycle?.period || currentPeriod;
    try {
      let usedRPC = false;
      if(cycle?.id){
        try {
          const { data, error } = await supabase.rpc('get_cycle_setup_stats',{ p_cycle_id: cycle.id });
          if(!error && data && data.length>0){
            usedRPC = true;
            const list: OrgStatus[] = data.map((r:any)=>{
              let st: OrgStatus['okrStatus'] = 'not_started';
              const s=r.okr_set_status;
              if(s==='finalized') st='finalized'; else if(s==='approved') st='approved';
              else if(s==='submitted'||s==='under_review') st='submitted';
              else if(s==='revision_requested') st='revision_requested'; else if(s==='draft') st='draft';
              const org = organizations.find(o=>o.id===r.org_id);
              return { id:r.org_id, name:r.org_name, level:r.org_level,
                parentOrgId: org?.parentOrgId||null,
                headName:r.head_name, headId:r.head_profile_id, okrStatus:st,
                objectiveCount:r.objective_count||0, krCount:r.kr_count||0,
                submittedAt:r.submitted_at, approvedAt:r.approved_at,
                lastNudgedAt:null, selected: st==='not_started'||st==='draft'||st==='revision_requested',
                okrSetId: r.okr_set_id||null };
            });
            for(const os of list.filter(s=>!s.okrSetId && s.okrStatus!=='not_started')){
              const { data:sd } = await supabase.from('okr_sets').select('id')
                .eq('org_id',os.id).eq('period',period).order('version',{ascending:false}).limit(1).maybeSingle();
              if(sd) os.okrSetId = sd.id;
            }
            const ids = list.map(s=>s.id);
            if(ids.length>0){
              const { data:nudges } = await supabase.from('notifications').select('org_id,created_at')
                .eq('type','okr_draft_reminder').in('org_id',ids).order('created_at',{ascending:false});
              if(nudges){ const m=new Map<string,string>(); for(const n of nudges){ if(n.org_id&&!m.has(n.org_id)) m.set(n.org_id,n.created_at); } for(const s of list) s.lastNudgedAt=m.get(s.id)||null; }
            }
            setOrgStatuses(list);
          }
        } catch(e){ console.warn('RPC 실패, fallback:',e); }
      }
      if(!usedRPC){
        const subs = organizations.filter(o=>o.level!=='전사');
        const list: OrgStatus[] = [];
        for(const org of subs){
          const { data:okrSet } = await supabase.from('okr_sets').select('id,status,submitted_at,reviewed_at')
            .eq('org_id',org.id).eq('period',period).order('version',{ascending:false}).limit(1).maybeSingle();
          const { count:oc } = await supabase.from('objectives').select('*',{count:'exact',head:true})
            .eq('org_id',org.id).eq('is_latest',true).eq('period',period);
          const { count:kc } = await supabase.from('key_results').select('*',{count:'exact',head:true})
            .eq('org_id',org.id).eq('is_latest',true);
          let headName:string|null=null, headId:string|null=null;
          try {
            const { data:leaders } = await supabase.from('user_roles').select('profile_id, roles!inner(level)').eq('org_id',org.id);
            const ld = (leaders||[]).find((r:any)=>r.roles?.level>=70);
            if(ld?.profile_id){ headId=ld.profile_id; const { data:p }=await supabase.from('profiles').select('full_name').eq('id',ld.profile_id).single(); headName=p?.full_name||null; }
          } catch{}
          const { data:ln } = await supabase.from('notifications').select('created_at')
            .eq('type','okr_draft_reminder').eq('org_id',org.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
          let st: OrgStatus['okrStatus'] = 'not_started';
          if(okrSet){ if(okrSet.status==='finalized') st='finalized'; else if(okrSet.status==='approved') st='approved'; else if(okrSet.status==='submitted'||okrSet.status==='under_review') st='submitted'; else if(okrSet.status==='revision_requested') st='revision_requested'; else if(okrSet.status==='draft') st='draft'; }
          else if((oc||0)>0) st='draft';
          list.push({ id:org.id, name:org.name, level:org.level, parentOrgId:org.parentOrgId||null,
            headName, headId, okrStatus:st, objectiveCount:oc||0, krCount:kc||0,
            submittedAt:okrSet?.submitted_at||null, approvedAt:okrSet?.reviewed_at||null,
            lastNudgedAt:ln?.created_at||null, selected: st==='not_started'||st==='draft'||st==='revision_requested',
            okrSetId:okrSet?.id||null });
        }
        setOrgStatuses(list);
      }
    } catch(e){ console.warn('조직 상태 조회 실패:',e); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{
    if(!companyReady || !company?.id) return;
    fetchCycles(company.id);
  }, [companyReady, company?.id]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ if(organizations.length>0 && cycle?.id) fetchStatuses(); }, [cycle?.id, organizations.length]);

  /* ─── OKR 상세 로드 ─────────────────────────────────── */
  const openDetail = async(org: OrgStatus)=>{
    setModalOrg(org); setDetailLoading(true); setOkrDetail(null); setHistory([]); setReviewText('');
    try {
      const period = cycle?.period||currentPeriod;
      const { data:objs } = await supabase.from('objectives').select('id,name,bii_type,perspective,sort_order')
        .eq('org_id',org.id).eq('is_latest',true).eq('period',period).order('sort_order');
      const objectives = [];
      for(const obj of (objs||[])){
        const { data:krs } = await supabase.from('key_results')
          .select('id,name,definition,weight,target_value,unit,bii_type,kpi_category,perspective,grade_criteria')
          .eq('objective_id',obj.id).eq('is_latest',true).order('weight',{ascending:false});
        objectives.push({...obj, key_results:krs||[]});
      }
      setOkrDetail({objectives});
      if(org.okrSetId){
        const { data:h } = await supabase.from('approval_history').select('id,action,actor_name,comment,created_at')
          .eq('okr_set_id',org.okrSetId).order('created_at',{ascending:false});
        setHistory(h||[]);
      }
    } catch(e){ console.warn('상세 조회 실패:',e); }
    finally { setDetailLoading(false); }
  };

  /* ─── 승인/수정요청 ────────────────────────────────── */
  const handleAction = async()=>{
    if(!actionOrg?.okrSetId||!user?.id) return;
    setActionLoading(true);
    try {
      const newSt = actionType==='approve'?'approved':'revision_requested';
      await supabase.from('okr_sets').update({ status:newSt, reviewer_id:user.id, reviewed_at:new Date().toISOString(), review_comment:actionComment||null }).eq('id',actionOrg.okrSetId);
      const { data:p } = await supabase.from('profiles').select('full_name').eq('id',user.id).single();
      await supabase.from('approval_history').insert({ okr_set_id:actionOrg.okrSetId, action:newSt, actor_id:user.id, actor_name:p?.full_name||'관리자', comment:actionComment||null });
      if(actionOrg.headId) await supabase.from('notifications').insert({
        recipient_id:actionOrg.headId, sender_id:user.id, sender_name:p?.full_name||'관리자',
        type: newSt==='approved'?'okr_approved':'okr_revision_requested',
        title: newSt==='approved'?`✅ ${actionOrg.name} OKR 승인됨`:`⚠️ ${actionOrg.name} OKR 수정 요청`,
        message: actionComment||(newSt==='approved'?'OKR이 승인되었습니다.':'OKR 수정이 필요합니다.'),
        priority:'high', action_url:`/wizard/${actionOrg.id}`, org_id:actionOrg.id });
      setActionOrg(null); setActionComment(''); setModalOrg(null); setOkrDetail(null); fetchStatuses();
    } catch(e:any){ alert(`처리 실패: ${e.message}`); }
    finally { setActionLoading(false); }
  };

  /* ─── 검토 의견 ─────────────────────────────────────── */
  const handleReview = async()=>{
    if(!modalOrg?.okrSetId||!user?.id||!reviewText.trim()) return;
    setReviewLoading(true);
    try {
      const { data:p } = await supabase.from('profiles').select('full_name').eq('id',user.id).single();
      await supabase.from('approval_history').insert({ okr_set_id:modalOrg.okrSetId, action:'comment', actor_id:user.id, actor_name:p?.full_name||'검토자', comment:reviewText });
      if(modalOrg.headId) await supabase.from('notifications').insert({
        recipient_id:modalOrg.headId, sender_id:user.id, sender_name:p?.full_name||'검토자',
        type:'okr_comment', title:`💬 ${modalOrg.name} OKR 검토 의견`,
        message: reviewText.length>80?reviewText.substring(0,80)+'...':reviewText,
        priority:'normal', action_url:`/wizard/${modalOrg.id}`, org_id:modalOrg.id });
      setReviewText('');
      const { data:h } = await supabase.from('approval_history').select('id,action,actor_name,comment,created_at')
        .eq('okr_set_id',modalOrg.okrSetId).order('created_at',{ascending:false});
      setHistory(h||[]);
    } catch(e:any){ alert(`실패: ${e.message}`); }
    finally { setReviewLoading(false); }
  };

  /* ─── 독촉 ─────────────────────────────────────────── */
  const handleNudge = async()=>{
    const targets = orgStatuses.filter(o=>o.selected&&o.headId);
    if(!targets.length) return alert('독촉할 조직을 선택해주세요.');
    if(!confirm(`${targets.length}개 조직에 독촉 알림을 보내시겠습니까?`)) return;
    setSending(true);
    try {
      const { data:me } = await supabase.from('profiles').select('full_name').eq('id',user?.id).single();
      const per = cycle?.period||currentPeriod;
      const msg = nudgeMsg.trim()||`${per} OKR 수립 기한이 임박했습니다. 빠른 시일 내에 목표를 수립하고 제출해 주세요.`;
      for(const org of targets){
        await supabase.from('notifications').insert({ recipient_id:org.headId, type:'okr_draft_reminder',
          title:`📢 ${per} OKR 수립 요청`, message:`${me?.full_name||'CEO'}님의 메시지: ${msg}`,
          priority:'high', action_url:`/wizard/${org.id}`, sender_id:user?.id, sender_name:me?.full_name||'CEO', org_id:org.id });
      }
      setLastSentAt(new Date().toISOString()); setNudgeMsg(''); setShowMsgInput(false);
      fetchStatuses(); alert(`✅ ${targets.length}개 조직에 독촉 알림을 발송했습니다.`);
    } catch(e:any){ alert(`발송 실패: ${e.message}`); }
    finally { setSending(false); }
  };

  /* ─── 필터/통계 ─────────────────────────────────────── */
  const filtered = useMemo(()=>{
    let l=[...orgStatuses];
    if(searchQ){ const q=searchQ.toLowerCase(); l=l.filter(o=>o.name.toLowerCase().includes(q)||o.headName?.toLowerCase().includes(q)); }
    if(statusFilter!=='all') l=l.filter(o=>o.okrStatus===statusFilter);
    return l.sort((a,b)=>STATUS_CFG[a.okrStatus].order-STATUS_CFG[b.okrStatus].order);
  },[orgStatuses, searchQ, statusFilter]);

  const stats = useMemo(()=>{
    const t=orgStatuses.length, ns=orgStatuses.filter(o=>o.okrStatus==='not_started').length,
      dr=orgStatuses.filter(o=>o.okrStatus==='draft').length, rv=orgStatuses.filter(o=>o.okrStatus==='revision_requested').length,
      sb=orgStatuses.filter(o=>o.okrStatus==='submitted').length, ap=orgStatuses.filter(o=>o.okrStatus==='approved').length,
      fn=orgStatuses.filter(o=>o.okrStatus==='finalized').length;
    return { total:t, notStarted:ns, draft:dr, revisionRequested:rv, submitted:sb, approved:ap, finalized:fn,
      completionRate: t>0?Math.round(((ap+fn)/t)*100):0 };
  },[orgStatuses]);

  const selCount = orgStatuses.filter(o=>o.selected).length;
  const toggle = (id:string)=>setOrgStatuses(p=>p.map(o=>o.id===id?{...o,selected:!o.selected}:o));
  const selectBy = (s:'all'|'incomplete'|'none')=>{
    setOrgStatuses(p=>p.map(o=>{
      const can=o.headId&&o.okrStatus!=='finalized'&&o.okrStatus!=='approved';
      if(!can) return {...o,selected:false};
      if(s==='all') return {...o,selected:true}; if(s==='none') return {...o,selected:false};
      return {...o,selected:o.okrStatus==='not_started'||o.okrStatus==='draft'||o.okrStatus==='revision_requested'};
    }));
  };

  /* ─── 권한 체크 ─────────────────────────────────────── */
  if(roleLevel>0&&roleLevel<50) return (
    <div className="p-6 max-w-7xl mx-auto text-center py-20">
      <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-3"/>
      <h2 className="text-lg font-semibold text-slate-700">접근 권한이 없습니다</h2>
    </div>
  );

  const ddColor = !cycle?'text-slate-500':cycle.isOverdue?'text-red-600':cycle.daysRemaining<=3?'text-amber-600':cycle.daysRemaining<=7?'text-blue-600':'text-slate-700';
  const ddText = !cycle?'':cycle.isOverdue?`마감 ${Math.abs(cycle.daysRemaining)}일 초과`:cycle.daysRemaining===0?'오늘 마감':`D-${cycle.daysRemaining}`;

  /* ─── OKR 렌더 ──────────────────────────────────────── */
  const renderOKR = ()=>{
    if(detailLoading) return <div className="p-8 text-center text-sm text-slate-500">OKR 불러오는 중...</div>;
    if(!okrDetail||okrDetail.objectives.length===0) return <div className="p-8 text-center"><Target className="w-10 h-10 text-slate-300 mx-auto mb-2"/><p className="text-sm text-slate-500">등록된 OKR이 없습니다</p></div>;
    return (
      <div className="space-y-5">
        {okrDetail.objectives.map((obj,i)=>{
          const bc=getBIIColor(obj.bii_type as BIIType);
          return (
            <div key={obj.id}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">O{i+1}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${bc.bg} ${bc.text}`}>{obj.bii_type}</span>
                {obj.perspective&&<span className="text-xs text-slate-400">{obj.perspective}</span>}
                <span className="font-medium text-slate-900 text-sm">{obj.name}</span>
              </div>
              <div className="ml-6 border-l-2 border-slate-100 pl-4 space-y-2">
                {obj.key_results.map((kr,ki)=>{
                  const kc=getBIIColor(kr.bii_type as BIIType);
                  return (
                    <div key={kr.id} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-blue-500 bg-blue-50 px-1 rounded">KR{ki+1}</span>
                        <span className="text-sm text-slate-800">{kr.name}</span>
                      </div>
                      {kr.definition&&<p className="text-xs text-slate-400 mb-1.5 ml-7">{kr.definition}</p>}
                      <div className="flex gap-3 text-xs text-slate-500 ml-7 flex-wrap">
                        <span className="font-medium">목표: {kr.target_value?.toLocaleString()}{kr.unit}</span>
                        <span>가중치: {kr.weight}%</span>
                        <span className={`px-1 rounded ${kc.bg} ${kc.text}`}>{kr.bii_type}</span>
                        <span>{kr.perspective}</span>
                      </div>
                      {kr.grade_criteria&&(
                        <div className="flex gap-2 mt-1.5 ml-7 text-[10px]">
                          {(['S','A','B','C','D'] as const).map(g=>{
                            const clr:Record<string,string>={S:'text-blue-600',A:'text-green-600',B:'text-slate-600',C:'text-amber-600',D:'text-red-500'};
                            return <span key={g} className={clr[g]}>{g}:{(kr.grade_criteria as any)?.[g]??'-'}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {obj.key_results.length===0&&<p className="text-xs text-slate-400 py-2">KR이 아직 없습니다</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── 헤더 + 사이클 셀렉터 ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-white"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">OKR 수립 현황</h1>
            <p className="text-sm text-slate-500">{cycle?cycle.title:`${currentPeriod} · ${company?.name||''}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {allCycles.length>0&&(
            <select value={cycle?.id||''} onChange={e=>{const c=allCycles.find(x=>x.id===e.target.value); if(c) setCycle(c);}}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none min-w-[200px]">
              {allCycles.map(c=><option key={c.id} value={c.id}>{c.title||c.period} {c.status==='in_progress'?'(진행중)':c.status==='planning'?'(계획)':c.status==='closed'?'(마감)':'(확정)'}</option>)}
            </select>
          )}
          <button onClick={()=>{fetchCycles(company?.id||undefined);fetchStatuses();}} disabled={loading}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
            <RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`}/> 새로고침
          </button>
        </div>
      </div>

      {/* ── 사이클 정보 카드 ── */}
      {cycle&&(
        <div className={`rounded-xl border p-5 ${cycle.isOverdue?'bg-red-50 border-red-200':cycle.daysRemaining<=3?'bg-amber-50 border-amber-200':'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`text-center px-4 py-2 rounded-lg ${cycle.isOverdue?'bg-red-100':cycle.daysRemaining<=3?'bg-amber-100':'bg-blue-100'}`}>
                <div className={`text-2xl font-black ${ddColor}`}>{ddText}</div>
                <div className="text-xs text-slate-500 mt-0.5">마감까지</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-slate-600"><CalendarClock className="w-4 h-4"/>시작: {fmtDate(cycle.startsAt)}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400"/>
                  <span className={`flex items-center gap-1.5 font-medium ${ddColor}`}><Timer className="w-4 h-4"/>마감: {fmtDate(cycle.deadlineAt)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${cycle.status==='in_progress'?'bg-blue-200 text-blue-800':'bg-slate-200 text-slate-700'}`}>
                    {cycle.status==='planning'?'전사 OKR 수립중':cycle.status==='in_progress'?'하위 조직 수립 진행중':cycle.status==='closed'?'마감':'확정'}
                  </span>
                  {cycle.companyOkrFinalized&&<span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/>전사 OKR 확정됨</span>}
                </div>
              </div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-black ${stats.completionRate>=80?'text-green-600':stats.completionRate>=50?'text-blue-600':ddColor}`}>{stats.completionRate}%</div>
              <div className="text-xs text-slate-500">승인 완료</div>
            </div>
          </div>
        </div>
      )}

      {!cycle&&!loading&&(
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3"><CalendarClock className="w-8 h-8 text-slate-300"/><div><p className="text-sm font-medium text-slate-700">활성 수립 사이클이 없습니다</p><p className="text-xs text-slate-400">관리자 설정에서 새 수립 사이클을 만들어주세요</p></div></div>
          {roleLevel>=90&&<button onClick={()=>navigate('/admin?tab=planning-cycles')} className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1">설정으로 이동<ChevronRight className="w-4 h-4"/></button>}
        </div>
      )}

      {/* ── 요약 카드 ── */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3"><span className="text-xs font-medium text-slate-500">전체 완료율</span><BarChart3 className="w-4 h-4 text-slate-400"/></div>
          <div className="text-3xl font-bold text-slate-900">{stats.completionRate}%</div>
          <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-700 ${stats.completionRate>=80?'bg-green-500':stats.completionRate>=50?'bg-blue-500':'bg-orange-500'}`} style={{width:`${stats.completionRate}%`}}/></div>
        </div>
        {(['not_started','draft','submitted','approved'] as const).map(k=>{
          const cfg=STATUS_CFG[k]; const Icon=cfg.icon;
          const cnt=k==='approved'?stats.approved+stats.finalized:k==='not_started'?stats.notStarted:k==='draft'?stats.draft+stats.revisionRequested:stats.submitted;
          const active=statusFilter===k;
          return (
            <button key={k} onClick={()=>setStatusFilter(active?'all':k)}
              className={`bg-white rounded-xl border p-5 shadow-sm text-left transition-all hover:shadow-md ${active?'ring-1 ring-slate-400 border-slate-400':'border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3"><span className="text-xs font-medium text-slate-500">{k==='approved'?'승인/확정':cfg.label}</span><Icon className="w-4 h-4 text-slate-400"/></div>
              <div className={`text-3xl font-bold ${k==='draft'?'text-amber-600':k==='submitted'?'text-blue-600':k==='approved'?'text-green-600':'text-slate-900'}`}>{cnt}</div>
            </button>
          );
        })}
      </div>

      {/* ── 진행 바 ── */}
      {stats.total>0&&(
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-700">수립 진행 현황</span>
            {statusFilter!=='all'&&<button onClick={()=>setStatusFilter('all')} className="text-xs text-blue-600 hover:underline">필터 초기화</button>}
          </div>
          <div className="flex gap-0.5 h-4 rounded-full overflow-hidden bg-slate-100">
            {stats.finalized>0&&<div className="bg-emerald-500" style={{width:`${(stats.finalized/stats.total)*100}%`}}/>}
            {stats.approved>0&&<div className="bg-green-500" style={{width:`${(stats.approved/stats.total)*100}%`}}/>}
            {stats.submitted>0&&<div className="bg-blue-500" style={{width:`${(stats.submitted/stats.total)*100}%`}}/>}
            {stats.revisionRequested>0&&<div className="bg-orange-400" style={{width:`${(stats.revisionRequested/stats.total)*100}%`}}/>}
            {stats.draft>0&&<div className="bg-amber-400" style={{width:`${(stats.draft/stats.total)*100}%`}}/>}
            {stats.notStarted>0&&<div className="bg-slate-300" style={{width:`${(stats.notStarted/stats.total)*100}%`}}/>}
          </div>
          <div className="flex gap-5 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/>확정 {stats.finalized}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"/>승인 {stats.approved}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"/>제출 {stats.submitted}</span>
            {stats.revisionRequested>0&&<span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400"/>수정요청 {stats.revisionRequested}</span>}
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"/>작성중 {stats.draft}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300"/>미착수 {stats.notStarted}</span>
          </div>
        </div>
      )}

      {/* ═══ 테이블 ═══ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"/>
              <input type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="조직명 또는 조직장 검색..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
            </div>
            <div className="flex gap-1.5">
              <button onClick={()=>selectBy('incomplete')} className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100">미완료만</button>
              <button onClick={()=>selectBy('all')} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">전체</button>
              <button onClick={()=>selectBy('none')} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100">해제</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowMsgInput(!showMsgInput)} className="px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm">✏️ 메시지</button>
            <button onClick={handleNudge} disabled={selCount===0||sending}
              className="px-5 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-600 disabled:opacity-50 flex items-center gap-2 text-sm">
              {sending?<><RefreshCw className="w-4 h-4 animate-spin"/> 전송 중...</>:<><Zap className="w-4 h-4"/> {selCount}개 독촉 발송</>}
            </button>
          </div>
        </div>

        {showMsgInput&&(
          <div className="px-6 py-3 border-b border-slate-100 bg-orange-50/50">
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">독촉 메시지 (선택)</label>
            <textarea value={nudgeMsg} onChange={e=>setNudgeMsg(e.target.value)} placeholder="기본: OKR 수립 기한이 임박했습니다..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-orange-500 outline-none bg-white" rows={2}/>
          </div>
        )}

        <div className="overflow-x-auto">
          {loading?(
            <div className="py-16 text-center"><RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3"/><p className="text-sm text-slate-400">불러오는 중...</p></div>
          ):filtered.length===0?(
            <div className="py-16 text-center"><Building2 className="w-8 h-8 text-slate-300 mx-auto mb-3"/><p className="text-sm text-slate-400">{searchQ||statusFilter!=='all'?'검색 결과가 없습니다.':'하위 조직이 없습니다.'}</p></div>
          ):(
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pl-6 pr-2 py-3 w-10">
                    <input type="checkbox"
                      checked={filtered.filter(o=>o.headId&&o.okrStatus!=='finalized'&&o.okrStatus!=='approved').length>0&&
                        filtered.filter(o=>o.headId&&o.okrStatus!=='finalized'&&o.okrStatus!=='approved').every(o=>o.selected)}
                      onChange={()=>{const n=filtered.filter(o=>o.headId&&o.okrStatus!=='finalized'&&o.okrStatus!=='approved'); selectBy(n.every(o=>o.selected)?'none':'all');}}
                      className="w-4 h-4 rounded border-slate-300 text-orange-600"/>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">조직</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">상태</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 uppercase">조직장</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">OKR</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">마지막 독촉</th>
                  <th className="pr-6 pl-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(org=>{
                  const c=STATUS_CFG[org.okrStatus]; const Icon=c.icon;
                  const canNudge=org.headId&&org.okrStatus!=='finalized'&&org.okrStatus!=='approved';
                  const direct=canApprove(org.id);
                  return (
                    <tr key={org.id} className={`transition-colors ${org.selected?'bg-orange-50/50':'hover:bg-slate-50/50'}`}>
                      <td className="pl-6 pr-2 py-3">
                        <input type="checkbox" checked={org.selected} onChange={()=>toggle(org.id)}
                          disabled={!canNudge} className="w-4 h-4 rounded border-slate-300 text-orange-600 disabled:opacity-30"/>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-semibold text-slate-800">{org.name}</span>
                        <span className="ml-2 text-xs text-slate-400">{org.level}</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}>
                          <Icon className="w-3 h-3"/>{c.label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {org.headName?<span className="text-sm text-slate-600">{org.headName}</span>
                          :<span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>미지정</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-slate-600">
                        {org.objectiveCount>0?<>{org.objectiveCount} <span className="text-slate-400">O</span> / {org.krCount} <span className="text-slate-400">KR</span></>:<span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {ago(org.lastNudgedAt)?<span className="text-xs text-orange-500 flex items-center justify-center gap-1"><Clock className="w-3 h-3"/>{ago(org.lastNudgedAt)}</span>:<span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="pr-6 pl-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {org.okrStatus!=='not_started'&&(
                            <button onClick={()=>openDetail(org)}
                              className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1">
                              <Eye className="w-3 h-3"/> OKR 확인
                            </button>
                          )}
                          {direct&&org.okrStatus==='submitted'&&(
                            <button onClick={()=>{setActionOrg(org);setActionType('approve');setActionComment('');}}
                              className="px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1">
                              <Check className="w-3 h-3"/> 승인
                            </button>
                          )}
                          {direct&&org.okrStatus==='submitted'&&(
                            <button onClick={()=>{setActionOrg(org);setActionType('revision_request');setActionComment('');}}
                              className="px-2.5 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1">
                              <MessageSquare className="w-3 h-3"/> 수정요청
                            </button>
                          )}
                          {!direct&&org.okrStatus!=='not_started'&&org.okrSetId&&(
                            <button onClick={()=>openDetail(org)}
                              className="px-2.5 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors flex items-center gap-1">
                              <MessageSquare className="w-3 h-3"/> 검토의견
                            </button>
                          )}
                          {org.okrStatus==='not_started'&&<span className="text-xs text-slate-300">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {lastSentAt&&(
          <div className="px-6 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-green-500"/>마지막 발송: {new Date(lastSentAt).toLocaleString('ko-KR')}
          </div>
        )}
      </div>

      {/* ═══ OKR 상세 모달 ═══ */}
      {modalOrg&&!actionOrg&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-900">{modalOrg.name}</h3>
                  {(()=>{const c=STATUS_CFG[modalOrg.okrStatus]; return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${c.cls}`}><c.icon className="w-3 h-3"/>{c.label}</span>;})()}
                </div>
                <button onClick={()=>{setModalOrg(null);setOkrDetail(null);setReviewText('');}} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{cycle?.period||currentPeriod}</span>
                {modalOrg.headName&&<span>조직장: {modalOrg.headName}</span>}
                {modalOrg.submittedAt&&<span>제출: {fmtTime(modalOrg.submittedAt)}</span>}
                {isDirect(modalOrg.id)?<span className="text-blue-600 font-medium">직속 하위</span>:<span className="text-slate-400">비직속 하위</span>}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {renderOKR()}
              {history.length>0&&(
                <div className="border-t border-slate-100 pt-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2"><Clock className="w-4 h-4"/>처리 이력</h4>
                  <div className="space-y-3">
                    {history.map(h=>{
                      const am:Record<string,{icon:any;color:string;label:string}>={
                        submitted:{icon:Send,color:'text-blue-500',label:'제출'},approved:{icon:Check,color:'text-green-500',label:'승인'},
                        rejected:{icon:X,color:'text-red-500',label:'반려'},revision_requested:{icon:MessageSquare,color:'text-amber-500',label:'수정요청'},
                        comment:{icon:MessageSquare,color:'text-violet-500',label:'검토 의견'},finalized:{icon:CheckCircle2,color:'text-green-600',label:'최종확정'}};
                      const inf=am[h.action]||{icon:Clock,color:'text-slate-400',label:h.action}; const IC=inf.icon;
                      return (
                        <div key={h.id} className="flex gap-3">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"><IC className={`w-3.5 h-3.5 ${inf.color}`}/></div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2"><span className="text-sm font-medium text-slate-700">{inf.label}</span><span className="text-xs text-slate-400">by {h.actor_name}</span><span className="text-xs text-slate-400">{fmtTime(h.created_at)}</span></div>
                            {h.comment&&<p className="text-xs text-slate-500 mt-1 bg-slate-50 rounded p-2">{h.comment}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {modalOrg.okrSetId&&<OKRCommentPanel okrSetId={modalOrg.okrSetId}/>}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
              {canApprove(modalOrg.id)&&modalOrg.okrStatus==='submitted'?(
                <div className="flex gap-3">
                  <button onClick={()=>{setActionOrg(modalOrg);setActionType('approve');setActionComment('');}}
                    className="flex-1 bg-green-600 text-white rounded-lg py-2.5 font-medium hover:bg-green-700 flex items-center justify-center gap-2"><Check className="w-4 h-4"/> 승인</button>
                  <button onClick={()=>{setActionOrg(modalOrg);setActionType('revision_request');setActionComment('');}}
                    className="flex-1 bg-amber-500 text-white rounded-lg py-2.5 font-medium hover:bg-amber-600 flex items-center justify-center gap-2"><MessageSquare className="w-4 h-4"/> 수정 요청</button>
                  <button onClick={()=>{setModalOrg(null);setOkrDetail(null);}} className="px-6 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-100">닫기</button>
                </div>
              ):!canApprove(modalOrg.id)&&modalOrg.okrStatus!=='not_started'&&modalOrg.okrSetId?(
                <div className="flex gap-2">
                  <textarea value={reviewText} onChange={e=>setReviewText(e.target.value)} placeholder="검토 의견을 작성하세요..."
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" rows={1}/>
                  <button onClick={handleReview} disabled={reviewLoading||!reviewText.trim()}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                    {reviewLoading?<RefreshCw className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>} 의견 전송
                  </button>
                  <button onClick={()=>{setModalOrg(null);setOkrDetail(null);}} className="px-4 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-100">닫기</button>
                </div>
              ):(
                <div className="flex justify-end">
                  <button onClick={()=>{setModalOrg(null);setOkrDetail(null);}} className="px-6 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-100">닫기</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 승인/수정요청 모달 ═══ */}
      {actionOrg&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className={`text-lg font-bold mb-4 ${actionType==='approve'?'text-green-800':'text-amber-800'}`}>
              {actionType==='approve'?'✅ OKR 승인':'⚠️ 수정 요청'}
            </h3>
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-slate-700">{actionOrg.name}</p>
              <p className="text-xs text-slate-500">{cycle?.period||currentPeriod} · {actionOrg.headName||'조직장 미지정'}</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {actionType==='approve'?'승인 코멘트 (선택)':'수정 요청 내용 (필수)'}
              </label>
              <textarea value={actionComment} onChange={e=>setActionComment(e.target.value)}
                placeholder={actionType==='approve'?'잘 수립했습니다. 승인합니다.':'수정이 필요한 부분을 구체적으로 작성해주세요...'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" rows={4}/>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAction} disabled={actionLoading||(actionType==='revision_request'&&!actionComment.trim())}
                className={`flex-1 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${actionType==='approve'?'bg-green-600 hover:bg-green-700':'bg-amber-500 hover:bg-amber-600'}`}>
                {actionLoading?'처리 중...':actionType==='approve'?'승인 확인':'수정 요청 전송'}
              </button>
              <button onClick={()=>setActionOrg(null)} className="px-4 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}