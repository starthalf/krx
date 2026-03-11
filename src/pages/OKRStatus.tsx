// src/pages/OKRStatus.tsx
// OKR 현황 — 단일 페이지, 드롭다운 조직 선택, 동적 조직 계층 반영
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getBIIColor, calculateGrade } from '../utils/helpers';
import {
  Target, TrendingUp, ChevronDown, ChevronRight, ChevronUp,
  Lock, Building2, Layers, BarChart3, AlertCircle, CheckCircle2,
  Download
} from 'lucide-react';
import { getMyRoleLevel, checkCanManageOrg, ROLE_LEVELS } from '../lib/permissions';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import OKRExportModal from '../components/OKRExportModal';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 타입
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface OrgNode {
  id: string;
  name: string;
  level: string;
  parentOrgId: string | null;
  orgType: string;
  children: OrgNode[];
  depth: number;
}

interface ObjWithKRs {
  id: string;
  name: string;
  biiType: string;
  status: string;
  approvalStatus: string;
  orgId: string;
  krs: KRItem[];
  progress: number;
}

interface KRItem {
  id: string;
  name: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  progressPct: number;
  grade: string;
  weight: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 등급 색상
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function gradeColor(grade: string) {
  const map: Record<string, string> = {
    S: 'text-blue-600 bg-blue-50',
    A: 'text-green-600 bg-green-50',
    B: 'text-lime-600 bg-lime-50',
    C: 'text-amber-600 bg-amber-50',
    D: 'text-red-600 bg-red-50',
  };
  return map[grade] || 'text-slate-500 bg-slate-50';
}

function progressColor(pct: number) {
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 70) return 'bg-blue-500';
  if (pct >= 40) return 'bg-amber-500';
  return 'bg-red-400';
}

function progressTextColor(pct: number) {
  if (pct >= 100) return 'text-green-600';
  if (pct >= 70) return 'text-blue-600';
  if (pct >= 40) return 'text-amber-600';
  return 'text-red-600';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 메인 컴포넌트
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function OKRStatus() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { organizations } = useStore();

  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [roleLevel, setRoleLevel] = useState(0);
  const [permissionsLoading, setPermissionsLoading] = useState(true);
  const [managableOrgs, setManagableOrgs] = useState<string[]>([]);

  // OKR 데이터 (DB 직접 조회)
  const [orgObjectives, setOrgObjectives] = useState<ObjWithKRs[]>([]);
  const [childOrgStats, setChildOrgStats] = useState<Map<string, { objCount: number; krCount: number; avgProgress: number }>>(new Map());
  const [dataLoading, setDataLoading] = useState(false);

  // UI 상태
  const [expandedObjs, setExpandedObjs] = useState<Set<string>>(new Set());
  const [showChildren, setShowChildren] = useState(true);

  // ★ 다운로드 모달
  const [exportOpen, setExportOpen] = useState(false);

  // ── 권한 체크 ──
  useEffect(() => {
    if (organizations.length === 0) { setPermissionsLoading(false); return; }
    const check = async () => {
      setPermissionsLoading(true);
      const level = await getMyRoleLevel();
      setRoleLevel(level);

      let managable: string[];
      if (level >= ROLE_LEVELS.COMPANY_ADMIN) {
        managable = organizations.map(o => o.id);
      } else {
        const results = await Promise.all(
          organizations.map(async (org) => ({ id: org.id, can: await checkCanManageOrg(org.id) }))
        );
        managable = results.filter(r => r.can).map(r => r.id);
      }
      setManagableOrgs(managable);
      setPermissionsLoading(false);
    };
    check();
  }, [organizations.length]);

  // ── 초기 조직 선택 ──
  useEffect(() => {
    if (organizations.length === 0 || permissionsLoading || roleLevel === 0) return;
    if (selectedOrgId) {
      const current = organizations.find(o => o.id === selectedOrgId);
      if (current && !(roleLevel < ROLE_LEVELS.COMPANY_ADMIN && current.level === '전사')) return;
    }

    let defaultOrg;
    if (roleLevel >= ROLE_LEVELS.COMPANY_ADMIN) {
      defaultOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
    } else if (managableOrgs.length > 0) {
      defaultOrg = organizations.find(o => managableOrgs.includes(o.id) && o.level !== '전사');
    }
    if (!defaultOrg) defaultOrg = organizations.find(o => o.level !== '전사') || organizations[0];
    if (defaultOrg) setSelectedOrgId(defaultOrg.id);
  }, [organizations.length, permissionsLoading, roleLevel, managableOrgs.join(',')]);

  // ── 조직 트리 구성 (parentOrgId 기반, 하드코딩 없음) ──
  const orgTree = useMemo(() => {
    if (organizations.length === 0) return [];

    const buildTree = (parentId: string | null, depth: number): OrgNode[] => {
      return organizations
        .filter(o => o.parentOrgId === parentId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map(o => ({
          id: o.id,
          name: o.name,
          level: o.level,
          parentOrgId: o.parentOrgId || null,
          orgType: o.orgType || '',
          depth,
          children: buildTree(o.id, depth + 1),
        }));
    };

    const roots = organizations.filter(o => !o.parentOrgId);
    if (roots.length === 0) return [];
    return buildTree(null, 0);
  }, [organizations]);

  // ── 선택된 조직의 하위 조직 목록 ──
  const childOrgs = useMemo(() => {
    return organizations
      .filter(o => o.parentOrgId === selectedOrgId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [organizations, selectedOrgId]);

  // ── 선택된 조직의 상위 경로 (빵 부스러기) ──
  const breadcrumb = useMemo(() => {
    const path: { id: string; name: string; level: string }[] = [];
    let current = organizations.find(o => o.id === selectedOrgId);
    while (current) {
      path.unshift({ id: current.id, name: current.name, level: current.level });
      current = current.parentOrgId ? organizations.find(o => o.id === current!.parentOrgId) : undefined;
    }
    return path;
  }, [organizations, selectedOrgId]);

  // ── 드롭다운용 조직 목록 (계층 들여쓰기) ──
  const flatOrgList = useMemo(() => {
    const result: { id: string; name: string; level: string; depth: number }[] = [];
    const flatten = (nodes: OrgNode[]) => {
      nodes.forEach(n => {
        result.push({ id: n.id, name: n.name, level: n.level, depth: n.depth });
        flatten(n.children);
      });
    };
    flatten(orgTree);

    // ★ OKR 현황은 조회 전용 → 모든 조직 볼 수 있음 (전사 포함)
    return result;
  }, [orgTree, roleLevel]);

  // ── OKR 데이터 로딩 (선택된 조직) ──
  const loadOrgOKR = useCallback(async (orgId: string) => {
    setDataLoading(true);
    try {
      // 1. 해당 조직의 objectives (is_latest=true)
      const { data: objs } = await supabase
        .from('objectives')
        .select('id, name, bii_type, status, approval_status, org_id')
        .eq('org_id', orgId)
        .eq('is_latest', true)
        .order('created_at');

      if (!objs || objs.length === 0) {
        setOrgObjectives([]);
        setDataLoading(false);
        // 하위 조직 통계는 별도 로드
        loadChildStats(orgId);
        return;
      }

      // 2. 해당 objectives의 KRs
      const objIds = objs.map(o => o.id);
      const { data: krsData, error: krErr } = await supabase
        .from('key_results')
        .select('id, name, unit, target_value, current_value, weight, objective_id, grade_criteria')
        .in('objective_id', objIds);


      // 3. 매핑
      const mapped: ObjWithKRs[] = objs.map(obj => {
        const objKRs = (krsData || [])
          .filter(kr => kr.objective_id === obj.id)
          .map(kr => {
            const pct = kr.target_value > 0
              ? Math.round((kr.current_value / kr.target_value) * 100)
              : 0;
            return {
              id: kr.id,
              name: kr.name,
              unit: kr.unit || '',
              targetValue: kr.target_value || 0,
              currentValue: kr.current_value || 0,
              progressPct: pct,
              grade: calculateGradeFromPct(pct, kr.grade_criteria),
              weight: kr.weight || 0,
            };
          });

        const progress = objKRs.length > 0
          ? Math.round(objKRs.reduce((s, k) => s + k.progressPct, 0) / objKRs.length)
          : 0;

        return {
          id: obj.id,
          name: obj.name,
          biiType: obj.bii_type,
          status: obj.status,
          approvalStatus: obj.approval_status || 'draft',
          orgId: obj.org_id,
          krs: objKRs,
          progress,
        };
      });

      setOrgObjectives(mapped);
      // ★ 기본: 모두 접힘
      setExpandedObjs(new Set());
    } catch (e) {
      console.error('OKR 데이터 로드 실패:', e);
      setOrgObjectives([]);
    } finally {
      setDataLoading(false);
    }

    // 하위 조직 통계 로드
    loadChildStats(orgId);
  }, []);

  const loadChildStats = async (parentOrgId: string) => {
    const children = organizations.filter(o => o.parentOrgId === parentOrgId);
    if (children.length === 0) { setChildOrgStats(new Map()); return; }

    const stats = new Map<string, { objCount: number; krCount: number; avgProgress: number }>();

    await Promise.all(children.map(async (child) => {
      const { count: objCount } = await supabase
        .from('objectives')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', child.id)
        .eq('is_latest', true);

      const { data: krsData } = await supabase
        .from('key_results')
        .select('current_value, target_value')
        .eq('org_id', child.id);

      const krCount = krsData?.length || 0;
      const avgProgress = krCount > 0
        ? Math.round(krsData!.reduce((s, kr) => {
            const pct = kr.target_value > 0 ? (kr.current_value / kr.target_value) * 100 : 0;
            return s + pct;
          }, 0) / krCount)
        : 0;

      stats.set(child.id, { objCount: objCount || 0, krCount, avgProgress });
    }));

    setChildOrgStats(stats);
  };

  useEffect(() => {
    if (selectedOrgId) loadOrgOKR(selectedOrgId);
  }, [selectedOrgId, loadOrgOKR]);

  // ── 등급 계산 ──
  function calculateGradeFromPct(pct: number, gradeCriteria?: any): string {
    if (gradeCriteria) {
      const gc = typeof gradeCriteria === 'string' ? JSON.parse(gradeCriteria) : gradeCriteria;
      if (pct >= (gc.S || 120)) return 'S';
      if (pct >= (gc.A || 100)) return 'A';
      if (pct >= (gc.B || 80)) return 'B';
      if (pct >= (gc.C || 60)) return 'C';
      return 'D';
    }
    if (pct >= 120) return 'S';
    if (pct >= 100) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 60) return 'C';
    return 'D';
  }

  // ── 승인 상태 배지 ──
  function approvalBadge(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
      draft: { label: '초안', cls: 'bg-slate-100 text-slate-500' },
      ai_draft: { label: 'AI 초안', cls: 'bg-violet-100 text-violet-600' },
      submitted: { label: '제출됨', cls: 'bg-blue-100 text-blue-600' },
      under_review: { label: '검토중', cls: 'bg-amber-100 text-amber-600' },
      approved: { label: '승인', cls: 'bg-green-100 text-green-600' },
      manager_approved: { label: '관리자 승인', cls: 'bg-green-100 text-green-600' },
      ceo_approved: { label: 'CEO 승인', cls: 'bg-green-100 text-green-700' },
      finalized: { label: '확정', cls: 'bg-emerald-100 text-emerald-700' },
      rejected: { label: '반려', cls: 'bg-red-100 text-red-600' },
      revision_requested: { label: '수정요청', cls: 'bg-orange-100 text-orange-600' },
    };
    return map[status] || { label: status, cls: 'bg-slate-100 text-slate-500' };
  }

  // ── 토글 ──
  const toggleObj = (id: string) => {
    setExpandedObjs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedObjs(new Set(orgObjectives.map(o => o.id)));
  const collapseAll = () => setExpandedObjs(new Set());

  // ── 통계 ──
  const selectedOrg = organizations.find(o => o.id === selectedOrgId);
  const totalKRs = orgObjectives.reduce((s, o) => s + o.krs.length, 0);
  const avgProgress = totalKRs > 0
    ? Math.round(orgObjectives.reduce((s, o) => s + o.krs.reduce((ss, k) => ss + k.progressPct, 0), 0) / totalKRs)
    : 0;
  const approvedCount = orgObjectives.filter(o =>
    ['finalized', 'approved', 'ceo_approved', 'manager_approved'].includes(o.approvalStatus)
  ).length;
  const draftCount = orgObjectives.filter(o =>
    ['draft', 'ai_draft', 'submitted', 'under_review', 'revision_requested'].includes(o.approvalStatus)
  ).length;

  // ── 로딩 ──
  if (permissionsLoading || roleLevel === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">OKR 현황</h1>
          {/* 빵 부스러기 */}
          {breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              {breadcrumb.map((b, i) => (
                <span key={b.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-slate-400" />}
                  <button
                    onClick={() => setSelectedOrgId(b.id)}
                    className={`text-sm ${b.id === selectedOrgId ? 'text-blue-600 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {b.name}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 우측: 다운로드 버튼 + 조직 드롭다운 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Excel 내보내기
          </button>

          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="bg-white border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium text-slate-700 shadow-sm min-w-[200px]"
          >
            {flatOrgList.map(o => (
              <option key={o.id} value={o.id}>
                {'　'.repeat(o.depth)}{o.name} ({o.level})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">선택 조직</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900">{selectedOrg?.name || '—'}</div>
          <span className="text-xs text-slate-400">{selectedOrg?.level}</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">목표</span>
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{approvedCount}</div>
          {draftCount > 0 && <span className="text-xs text-orange-500">+ 수립 중 {draftCount}개</span>}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">KR</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalKRs}개</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">평균 달성률</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-2xl font-bold ${totalKRs > 0 ? progressTextColor(avgProgress) : 'text-slate-400'}`}>
            {totalKRs > 0 ? `${avgProgress}%` : '—'}
          </div>
        </div>
      </div>

      {/* OKR 목록 */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            {selectedOrg?.name} 목표 및 KR
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50">모두 펼치기</button>
            <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-50">모두 접기</button>
          </div>
        </div>

        {dataLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">OKR 데이터 로딩 중...</p>
          </div>
        ) : orgObjectives.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 mb-1">설정된 목표가 없습니다</p>
            <p className="text-xs text-slate-400">OKR 수립 후 이곳에서 확인할 수 있습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orgObjectives.map(obj => {
              const isExpanded = expandedObjs.has(obj.id);
              const badge = approvalBadge(obj.approvalStatus);
              const biiColor = getBIIColor(obj.biiType as any);

              return (
                <div key={obj.id}>
                  {/* Objective 행 */}
                  <div
                    className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => toggleObj(obj.id)}
                  >
                    {/* 펼침/접힘 */}
                    <button className="text-slate-400">
                      {obj.krs.length > 0 ? (
                        isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                      ) : <div className="w-4 h-4" />}
                    </button>

                    {/* BII 배지 */}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${biiColor.bg} ${biiColor.text}`}>
                      {obj.biiType}
                    </span>

                    {/* 승인 상태 */}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>

                    {/* 목표명 */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-900">{obj.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{obj.krs.length} KRs</span>
                    </div>

                    {/* 진행률 */}
                    <div className="flex items-center gap-3 w-48">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${progressColor(obj.progress)}`} style={{ width: `${Math.min(100, obj.progress)}%` }} />
                      </div>
                      <span className={`text-sm font-bold w-12 text-right ${progressTextColor(obj.progress)}`}>
                        {obj.progress}%
                      </span>
                    </div>
                  </div>

                  {/* KR 목록 (펼침) */}
                  {isExpanded && obj.krs.length > 0 && (
                    <div className="bg-slate-50/50 border-t border-slate-100">
                      {obj.krs.map(kr => (
                        <div key={kr.id} className="px-6 py-3 flex items-center gap-4 ml-10 border-b border-slate-50 last:border-0">
                          {/* 등급 배지 */}
                          <span className={`px-2 py-0.5 rounded text-xs font-bold min-w-[28px] text-center ${gradeColor(kr.grade)}`}>
                            {kr.grade}
                          </span>

                          {/* KR명 */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-slate-700">{kr.name}</span>
                            <span className="text-xs text-slate-400 ml-2">
                              {kr.currentValue} / {kr.targetValue} {kr.unit}
                            </span>
                          </div>

                          {/* 가중치 */}
                          {kr.weight > 0 && (
                            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {kr.weight}%
                            </span>
                          )}

                          {/* 진행률 */}
                          <div className="flex items-center gap-2 w-36">
                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${progressColor(kr.progressPct)}`} style={{ width: `${Math.min(100, kr.progressPct)}%` }} />
                            </div>
                            <span className={`text-xs font-bold w-10 text-right ${progressTextColor(kr.progressPct)}`}>
                              {kr.progressPct}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 하위 조직 현황 */}
      {childOrgs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-500" />
              하위 조직 현황
            </h2>
            <span className="text-xs text-slate-400">{childOrgs.length}개 조직</span>
          </div>
          <div className="divide-y divide-slate-100">
            {childOrgs.map(child => {
              const stats = childOrgStats.get(child.id);
              return (
                <div
                  key={child.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedOrgId(child.id)}
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-sm font-semibold text-slate-900">{child.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{child.level}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-xs text-slate-400">목표</span>
                      <div className="text-sm font-bold text-slate-700">{stats?.objCount ?? '—'}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">KR</span>
                      <div className="text-sm font-bold text-slate-700">{stats?.krCount ?? '—'}</div>
                    </div>
                    <div className="text-right w-16">
                      <span className="text-xs text-slate-400">달성률</span>
                      <div className={`text-sm font-bold ${stats && stats.krCount > 0 ? progressTextColor(stats.avgProgress) : 'text-slate-400'}`}>
                        {stats && stats.krCount > 0 ? `${stats.avgProgress}%` : '—'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ★ Excel 다운로드 모달 */}
      <OKRExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}