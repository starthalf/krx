// src/pages/Checkin.tsx — 조직장 중심 체크인 재설계
import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getBIIColor, calculateGrade, getGradeColor, formatNumber } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getMyRoleLevel, checkCanManageOrg, ROLE_LEVELS } from '../lib/permissions';
import type { DynamicKR } from '../types';
import {
  Loader2, Calendar, TrendingUp, CheckCircle2, AlertCircle, Clock,
  ChevronDown, ChevronUp, MessageSquare, History, Save, X, User,
  BarChart3, Target, Send, UserCheck
} from 'lucide-react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 타입
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface CheckinLog {
  id: string;
  kr_id: string;
  quarter: string;
  previous_value: number;
  new_value: number;
  progress_pct: number;
  grade: string;
  comment: string;
  checked_by_name: string;
  is_delegated: boolean;
  created_at: string;
}

interface CheckinSummary {
  totalKRs: number;
  checkedIn: number;
  notCheckedIn: number;
  rate: number;
}

// 현재 분기 계산
function getCurrentQuarter(): string {
  const month = new Date().getMonth() + 1;
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function Checkin() {
  const { user } = useAuth();
  const {
    organizations, objectives, krs,
    fetchObjectives, fetchKRs, fetchCFRs,
    updateKR, loading
  } = useStore();

  // 상태
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [roleLevel, setRoleLevel] = useState(0);
  const [canManageOrg, setCanManageOrg] = useState(false);
  const [permLoading, setPermLoading] = useState(true);
  const [managableOrgs, setManagableOrgs] = useState<string[]>([]);

  // 체크인 모달
  const [checkinModal, setCheckinModal] = useState<{ kr: DynamicKR; open: boolean } | null>(null);
  const [checkinValue, setCheckinValue] = useState('');
  const [checkinComment, setCheckinComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // 이력 모달
  const [historyModal, setHistoryModal] = useState<{ krId: string; krName: string; open: boolean } | null>(null);
  const [historyLogs, setHistoryLogs] = useState<CheckinLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 펼침 상태
  const [expandedObjs, setExpandedObjs] = useState<Set<string>>(new Set());

  // ── 1. 권한 체크 ──
  useEffect(() => {
    const check = async () => {
      setPermLoading(true);
      try {
        const level = await getMyRoleLevel();
        setRoleLevel(level);

        const managable: string[] = [];
        for (const org of organizations) {
          const can = await checkCanManageOrg(org.id);
          if (can) managable.push(org.id);
        }
        setManagableOrgs(managable);
      } catch (e) {
        console.error('Permission check failed:', e);
      } finally {
        setPermLoading(false);
      }
    };
    if (organizations.length > 0) check();
    else setPermLoading(false);
  }, [organizations.map(o => o.id).join(',')]);

  // ── 2. 초기 조직 선택 ──
  useEffect(() => {
    if (permLoading || organizations.length === 0 || selectedOrgId) return;
    // 관리 가능한 첫 번째 조직, 없으면 첫 조직
    const firstManagable = organizations.find(o => managableOrgs.includes(o.id));
    const fallback = organizations.find(o => o.level === '팀') || organizations[0];
    setSelectedOrgId(firstManagable?.id || fallback?.id || '');
  }, [permLoading, managableOrgs.join(',')]);

  // ── 3. 선택 조직 변경 시 권한 + 데이터 로딩 ──
  useEffect(() => {
    if (!selectedOrgId) return;
    fetchObjectives(selectedOrgId);
    fetchKRs(selectedOrgId);
    checkCanManageOrg(selectedOrgId).then(setCanManageOrg);
  }, [selectedOrgId]);

  // ── 4. KR 로드 후 CFR 로딩 ──
  useEffect(() => {
    if (selectedOrgId && krs.length > 0) {
      krs.filter(k => k.orgId === selectedOrgId).forEach(kr => fetchCFRs(kr.id));
    }
  }, [selectedOrgId, krs.length]);

  // ── 데이터 계산 ──
  const orgObjectives = objectives.filter(o => o.orgId === selectedOrgId);
  const orgKRs = krs.filter(k => k.orgId === selectedOrgId);

  const summary: CheckinSummary = {
    totalKRs: orgKRs.length,
    checkedIn: orgKRs.filter(kr => {
      const actual = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals];
      return actual !== null && actual !== undefined;
    }).length,
    notCheckedIn: 0,
    rate: 0,
  };
  summary.notCheckedIn = summary.totalKRs - summary.checkedIn;
  summary.rate = summary.totalKRs > 0 ? Math.round((summary.checkedIn / summary.totalKRs) * 100) : 0;

  // 체크인 가능 여부 판단
  const canCheckinKR = useCallback((kr: DynamicKR): boolean => {
    if (roleLevel >= ROLE_LEVELS.ORG_LEADER && canManageOrg) return true;
    // 위임받은 경우 (checkin_assignee_id는 아직 store에 없으므로 일단 true 허용)
    // TODO: kr.checkinAssigneeId === user?.id
    if (roleLevel >= ROLE_LEVELS.MEMBER && canManageOrg) return true;
    return false;
  }, [roleLevel, canManageOrg, user]);

  // ── 체크인 실적 입력 ──
  const openCheckinModal = (kr: DynamicKR) => {
    const currentActual = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals];
    setCheckinValue(currentActual?.toString() || '');
    setCheckinComment('');
    setCheckinModal({ kr, open: true });
  };

  const handleSubmitCheckin = async () => {
    if (!checkinModal?.kr || !user) return;
    const kr = checkinModal.kr;
    const newValue = parseFloat(checkinValue);
    if (isNaN(newValue)) return;

    setIsSaving(true);
    try {
      const previousActual = kr.quarterlyActuals?.[selectedQuarter as keyof typeof kr.quarterlyActuals] || 0;

      // 1. quarterly_actuals 갱신
      const newActuals = { ...kr.quarterlyActuals, [selectedQuarter]: newValue };

      // 2. 누적 current_value 계산
      const cumulative = (['Q1', 'Q2', 'Q3', 'Q4'] as const)
        .map(q => newActuals[q])
        .filter((v): v is number => v !== null && v !== undefined)
        .reduce((sum, v) => sum + v, 0);

      // 3. progress_pct 계산
      const newProgress = kr.targetValue > 0 ? Math.round((cumulative / kr.targetValue) * 100) : 0;

      // 4. grade 계산
      const tempKR = { ...kr, currentValue: cumulative };
      const newGrade = calculateGrade(tempKR);

      // 5. Supabase 업데이트 — key_results
      const { error: krError } = await supabase
        .from('key_results')
        .update({
          quarterly_actuals: newActuals,
          current_value: cumulative,
          progress_pct: newProgress,
          last_checkin_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', kr.id);

      if (krError) throw krError;

      // 6. checkin_logs INSERT
      const { error: logError } = await supabase
        .from('checkin_logs')
        .insert({
          kr_id: kr.id,
          org_id: kr.orgId,
          checkin_period: `2025-${selectedQuarter}`,
          quarter: selectedQuarter,
          previous_value: previousActual || 0,
          new_value: newValue,
          target_value: kr.quarterlyTargets?.[selectedQuarter as keyof typeof kr.quarterlyTargets] || kr.targetValue,
          progress_pct: newProgress,
          grade: newGrade,
          comment: checkinComment || null,
          checked_by: user.id,
          checked_by_name: (user as any).user_metadata?.full_name || user.email || '사용자',
          is_delegated: roleLevel < ROLE_LEVELS.ORG_LEADER,
        });

      // checkin_logs 테이블이 아직 없어도 KR 업데이트는 성공한 상태
      if (logError) console.warn('checkin_logs insert failed (table may not exist yet):', logError.message);

      // 7. Store 업데이트
      updateKR(kr.id, {
        quarterlyActuals: newActuals,
        currentValue: cumulative,
        progressPct: newProgress,
      });

      setCheckinModal(null);
    } catch (err: any) {
      console.error('Checkin failed:', err);
      alert(`저장 실패: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── 이력 조회 ──
  const openHistory = async (krId: string, krName: string) => {
    setHistoryModal({ krId, krName, open: true });
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('checkin_logs')
        .select('*')
        .eq('kr_id', krId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistoryLogs(data || []);
    } catch {
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 목표 펼침/접기 토글
  const toggleObj = (objId: string) => {
    setExpandedObjs(prev => {
      const next = new Set(prev);
      next.has(objId) ? next.delete(objId) : next.add(objId);
      return next;
    });
  };

  // 전체 펼치기 (초기)
  useEffect(() => {
    if (orgObjectives.length > 0) {
      setExpandedObjs(new Set(orgObjectives.map(o => o.id)));
    }
  }, [orgObjectives.map(o => o.id).join(',')]);

  // 선택 가능 조직
  const selectableOrgs = roleLevel >= ROLE_LEVELS.COMPANY_ADMIN
    ? organizations
    : organizations.filter(o => managableOrgs.includes(o.id) || managableOrgs.length === 0);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 렌더링
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-slate-500">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">체크인 (Check-in)</h1>
          <p className="text-slate-500 mt-1">조직 KR의 실적을 점검하고 관리합니다.</p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedOrgId}
            onChange={e => setSelectedOrgId(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {selectableOrgs.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>

          <select
            value={selectedQuarter}
            onChange={e => setSelectedQuarter(e.target.value)}
            className="border border-slate-300 rounded-lg px-4 py-2 bg-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="Q1">Q1 (1~3월)</option>
            <option value="Q2">Q2 (4~6월)</option>
            <option value="Q3">Q3 (7~9월)</option>
            <option value="Q4">Q4 (10~12월)</option>
          </select>
        </div>
      </div>

      {/* ── 체크인 요약 카드 ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{summary.totalKRs}</div>
              <div className="text-xs text-slate-500">전체 KR</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">{summary.checkedIn}</div>
              <div className="text-xs text-slate-500">입력 완료</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-700">{summary.notCheckedIn}</div>
              <div className="text-xs text-slate-500">미입력</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-700">{summary.rate}%</div>
              <div className="text-xs text-slate-500">체크인율</div>
            </div>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5">
            <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${summary.rate}%` }} />
          </div>
        </div>
      </div>

      {/* ── 로딩 ── */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* ── 목표 없음 ── */}
      {!loading && orgObjectives.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-slate-200">
          <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">이 조직에 등록된 목표가 없습니다.</p>
        </div>
      )}

      {/* ── Objective → KR 리스트 ── */}
      {!loading && orgObjectives.length > 0 && (
        <div className="space-y-4">
          {orgObjectives.map(obj => {
            const bii = getBIIColor(obj.biiType);
            const objKRs = krs.filter(k => k.objectiveId === obj.id);
            const isExpanded = expandedObjs.has(obj.id);
            const objProgress = objKRs.length > 0
              ? Math.round(objKRs.reduce((s, k) => s + k.progressPct, 0) / objKRs.length)
              : 0;

            return (
              <div key={obj.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* 목표 헤더 (클릭으로 펼침/접기) */}
                <button
                  onClick={() => toggleObj(obj.id)}
                  className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold ${bii.bg} ${bii.text}`}>
                      {obj.biiType}
                    </span>
                    <h2 className="text-base font-bold text-slate-900">{obj.name}</h2>
                    <span className="text-xs text-slate-400">KR {objKRs.length}개</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-bold text-slate-700">{objProgress}%</span>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </button>

                {/* KR 리스트 */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {objKRs.map(kr => (
                      <KRCheckinRow
                        key={kr.id}
                        kr={kr}
                        quarter={selectedQuarter}
                        canCheckin={canCheckinKR(kr)}
                        onCheckin={() => openCheckinModal(kr)}
                        onHistory={() => openHistory(kr.id, kr.name)}
                      />
                    ))}
                    {objKRs.length === 0 && (
                      <div className="p-6 text-center text-slate-400 text-sm">연결된 KR이 없습니다</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 실적 입력 모달 ── */}
      {checkinModal?.open && (
        <CheckinModal
          kr={checkinModal.kr}
          quarter={selectedQuarter}
          value={checkinValue}
          comment={checkinComment}
          isSaving={isSaving}
          onValueChange={setCheckinValue}
          onCommentChange={setCheckinComment}
          onSubmit={handleSubmitCheckin}
          onClose={() => setCheckinModal(null)}
        />
      )}

      {/* ── 이력 모달 ── */}
      {historyModal?.open && (
        <HistoryModal
          krName={historyModal.krName}
          logs={historyLogs}
          loading={historyLoading}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KR 체크인 행 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function KRCheckinRow({ kr, quarter, canCheckin, onCheckin, onHistory }: {
  kr: DynamicKR;
  quarter: string;
  canCheckin: boolean;
  onCheckin: () => void;
  onHistory: () => void;
}) {
  const grade = calculateGrade(kr);
  const gradeColor = getGradeColor(grade);
  const bii = getBIIColor(kr.biiType);

  const quarterTarget = kr.quarterlyTargets?.[quarter as keyof typeof kr.quarterlyTargets] || 0;
  const quarterActual = kr.quarterlyActuals?.[quarter as keyof typeof kr.quarterlyActuals];
  const isCheckedIn = quarterActual !== null && quarterActual !== undefined;

  const cfrCount = useStore(state => state.getCFRsByKRId(kr.id).length);

  return (
    <div className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        {/* 왼쪽: KR 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${bii.bg} ${bii.text}`}>{kr.biiType}</span>
            <span className="text-xs text-slate-400 font-medium">가중치 {kr.weight}%</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeColor}`}>{grade}</span>
            {isCheckedIn && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">✓ 입력완료</span>}
            {!isCheckedIn && <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-medium">미입력</span>}
          </div>
          <h3 className="text-sm font-semibold text-slate-900 mb-1">{kr.name}</h3>

          {/* 분기별 실적 미니 테이블 */}
          <div className="flex gap-3 mt-2">
            {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
              const target = kr.quarterlyTargets?.[q] || 0;
              const actual = kr.quarterlyActuals?.[q];
              const isCurrent = q === quarter;
              const filled = actual !== null && actual !== undefined;

              return (
                <div
                  key={q}
                  className={`text-center px-2 py-1 rounded text-xs ${
                    isCurrent
                      ? 'bg-blue-50 border border-blue-200 font-semibold'
                      : filled ? 'bg-slate-50 border border-slate-100' : 'bg-slate-50/50 text-slate-300'
                  }`}
                >
                  <div className={`font-medium ${isCurrent ? 'text-blue-700' : 'text-slate-500'}`}>{q}</div>
                  <div className={`${filled ? 'text-slate-900' : 'text-slate-300'}`}>
                    {filled ? formatNumber(actual as number) : '—'}
                  </div>
                  <div className="text-slate-400 text-[10px]">/{formatNumber(target)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 오른쪽: 현재값/목표 + 버튼 */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <div className="text-xs text-slate-400 mb-0.5">누적 달성</div>
            <div className="text-lg font-bold text-slate-900">
              {formatNumber(kr.currentValue)} <span className="text-sm font-normal text-slate-400">/ {formatNumber(kr.targetValue)} {kr.unit}</span>
            </div>
            <div className="text-sm font-semibold text-slate-600">{kr.progressPct}%</div>
          </div>

          <div className="flex gap-2">
            {canCheckin && (
              <button
                onClick={onCheckin}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isCheckedIn
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {isCheckedIn ? '수정' : '실적 입력'}
              </button>
            )}
            <button
              onClick={onHistory}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" />
              이력
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 체크인 실적 입력 모달
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function CheckinModal({ kr, quarter, value, comment, isSaving, onValueChange, onCommentChange, onSubmit, onClose }: {
  kr: DynamicKR;
  quarter: string;
  value: string;
  comment: string;
  isSaving: boolean;
  onValueChange: (v: string) => void;
  onCommentChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const quarterTarget = kr.quarterlyTargets?.[quarter as keyof typeof kr.quarterlyTargets] || 0;
  const currentActual = kr.quarterlyActuals?.[quarter as keyof typeof kr.quarterlyActuals];

  // 입력값 기반 미리보기 계산
  const previewValue = parseFloat(value) || 0;
  const newActuals = { ...kr.quarterlyActuals, [quarter]: previewValue };
  const previewCumulative = (['Q1', 'Q2', 'Q3', 'Q4'] as const)
    .map(q => newActuals[q])
    .filter((v): v is number => v !== null && v !== undefined)
    .reduce((sum, v) => sum + v, 0);
  const previewProgress = kr.targetValue > 0 ? Math.round((previewCumulative / kr.targetValue) * 100) : 0;
  const tempKR = { ...kr, currentValue: previewCumulative };
  const previewGrade = calculateGrade(tempKR);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">실적 입력</h3>
            <p className="text-sm text-slate-500 mt-0.5">{kr.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* 분기별 현황 */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">분기별 실적</div>
            <div className="grid grid-cols-4 gap-2">
              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(q => {
                const target = kr.quarterlyTargets?.[q] || 0;
                const actual = q === quarter ? previewValue : kr.quarterlyActuals?.[q];
                const isCurrent = q === quarter;

                return (
                  <div key={q} className={`rounded-lg p-3 text-center ${isCurrent ? 'bg-blue-50 border-2 border-blue-300' : 'bg-slate-50 border border-slate-100'}`}>
                    <div className={`text-xs font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-500'}`}>{q}</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      {actual !== null && actual !== undefined ? formatNumber(actual as number) : '—'}
                    </div>
                    <div className="text-[10px] text-slate-400">목표 {formatNumber(target)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 입력 필드 */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">
              {quarter} 실적값 ({kr.unit})
            </label>
            <input
              type="number"
              value={value}
              onChange={e => onValueChange(e.target.value)}
              placeholder={`${quarter} 목표: ${formatNumber(quarterTarget)}`}
              className="w-full border border-slate-300 rounded-lg px-4 py-3 text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              autoFocus
            />
            {currentActual !== null && currentActual !== undefined && (
              <p className="text-xs text-slate-400 mt-1">이전 입력값: {formatNumber(currentActual as number)} {kr.unit}</p>
            )}
          </div>

          {/* 미리보기 */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-500 mb-2">변경 미리보기</div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-slate-400">누적 실적</div>
                <div className="text-lg font-bold text-slate-900">{formatNumber(previewCumulative)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">달성률</div>
                <div className="text-lg font-bold text-slate-900">{previewProgress}%</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">등급</div>
                <div className={`inline-block px-3 py-1 rounded text-sm font-bold ${getGradeColor(previewGrade)}`}>
                  {previewGrade}
                </div>
              </div>
            </div>
          </div>

          {/* 코멘트 */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">코멘트 (선택)</label>
            <textarea
              value={comment}
              onChange={e => onCommentChange(e.target.value)}
              placeholder="실적에 대한 메모나 특이사항을 기록하세요"
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={isSaving || !value}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 이력 모달
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function HistoryModal({ krName, logs, loading, onClose }: {
  krName: string;
  logs: CheckinLog[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">체크인 이력</h3>
            <p className="text-sm text-slate-500">{krName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <History className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p>아직 체크인 이력이 없습니다.</p>
            </div>
          )}

          {!loading && logs.length > 0 && (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="border border-slate-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900">{log.checked_by_name}</span>
                      {log.is_delegated && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">위임</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(log.created_at).toLocaleDateString('ko-KR')} {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-500">{log.quarter}</span>
                    <span className="text-slate-400">{formatNumber(log.previous_value)}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-bold text-slate-900">{formatNumber(log.new_value)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${getGradeColor(log.grade as any)}`}>{log.grade}</span>
                  </div>
                  {log.comment && (
                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded p-2">{log.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}