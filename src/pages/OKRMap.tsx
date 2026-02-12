// src/pages/OKRMap.tsx
// 전사 OKR Cascading Map - 조직 구조별 목표 정렬 시각화
import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, ChevronDown, ChevronRight, Target, Loader2,
  Maximize2, Minimize2, Filter, Eye, EyeOff, ArrowLeft,
  TrendingUp, AlertCircle, CheckCircle2, Clock, Zap,
  Building2, Users, Briefcase, BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { getBIIColor } from '../utils/helpers';
import type { BIIType } from '../types';

// ==================== Types ====================

interface OrgNode {
  id: string;
  name: string;
  level: string;
  orgType: string;
  parentOrgId: string | null;
  objectives: ObjNode[];
  children: OrgNode[];
  expanded: boolean;
  stats: {
    objectiveCount: number;
    krCount: number;
    avgProgress: number;
    topGrade: string;
  };
}

interface ObjNode {
  id: string;
  name: string;
  biiType: BIIType;
  status: string;
  period: string;
  krs: KRNode[];
}

interface KRNode {
  id: string;
  name: string;
  biiType: BIIType;
  weight: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  progressPct: number;
  grade: string;
  perspective: string;
}

// ==================== Helpers ====================

function calcGrade(progressPct: number, criteria: any): string {
  if (!criteria) return '-';
  if (progressPct >= (criteria.S || 120)) return 'S';
  if (progressPct >= (criteria.A || 110)) return 'A';
  if (progressPct >= (criteria.B || 100)) return 'B';
  if (progressPct >= (criteria.C || 90)) return 'C';
  return 'D';
}

function calcProgress(current: number, target: number): number {
  if (!target || target === 0) return 0;
  return Math.round((current / target) * 100);
}

const gradeColor: Record<string, string> = {
  S: 'bg-violet-600 text-white',
  A: 'bg-blue-600 text-white',
  B: 'bg-green-600 text-white',
  C: 'bg-amber-500 text-white',
  D: 'bg-red-500 text-white',
  '-': 'bg-slate-200 text-slate-500',
};

const levelIcon: Record<string, typeof Building2> = {
  '전사': Building2,
  '본부': Briefcase,
  '팀': Users,
};

const levelColor: Record<string, { bg: string; border: string; accent: string }> = {
  '전사': { bg: 'bg-slate-900', border: 'border-slate-700', accent: 'text-white' },
  '본부': { bg: 'bg-blue-600', border: 'border-blue-400', accent: 'text-white' },
  '팀': { bg: 'bg-emerald-600', border: 'border-emerald-400', accent: 'text-white' },
};

// ==================== Component ====================

export default function OKRMap() {
  const { profile } = useAuth();
  const { organizations } = useStore();

  const [tree, setTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [showKRs, setShowKRs] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterBII, setFilterBII] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ==================== Data Fetch ====================

  const fetchOKRTree = useCallback(async () => {
    if (!profile?.company_id || organizations.length === 0) return;
    setLoading(true);

    try {
      // 1) 모든 Objectives
      const { data: allObjs, error: objErr } = await supabase
        .from('objectives')
        .select('*')
        .in('org_id', organizations.map(o => o.id))
        .order('sort_order');
      if (objErr) throw objErr;

      // 2) 모든 KRs
      const { data: allKRs, error: krErr } = await supabase
        .from('key_results')
        .select('*')
        .in('org_id', organizations.map(o => o.id));
      if (krErr) throw krErr;

      // 3) 트리 빌드
      const orgMap = new Map<string, OrgNode>();

      for (const org of organizations) {
        const orgObjs = (allObjs || []).filter(o => o.org_id === org.id);
        const orgKRs = (allKRs || []).filter(k => k.org_id === org.id);

        const objectiveNodes: ObjNode[] = orgObjs.map(obj => {
          const relatedKRs = orgKRs.filter(k => k.objective_id === obj.id);
          return {
            id: obj.id,
            name: obj.name,
            biiType: (obj.bii_type || 'Improve') as BIIType,
            status: obj.status || 'active',
            period: obj.period || '',
            krs: relatedKRs.map(kr => {
              const progress = calcProgress(kr.current_value || 0, kr.target_value || 0);
              return {
                id: kr.id,
                name: kr.name,
                biiType: (kr.bii_type || 'Improve') as BIIType,
                weight: kr.weight || 0,
                targetValue: kr.target_value || 0,
                currentValue: kr.current_value || 0,
                unit: kr.unit || '',
                progressPct: progress,
                grade: calcGrade(progress, kr.grade_criteria),
                perspective: kr.perspective || '',
              };
            }),
          };
        });

        // stats 계산
        const allOrgKRs = objectiveNodes.flatMap(o => o.krs);
        const avgProg = allOrgKRs.length > 0
          ? Math.round(allOrgKRs.reduce((s, k) => s + k.progressPct, 0) / allOrgKRs.length)
          : 0;
        const grades = allOrgKRs.map(k => k.grade).filter(g => g !== '-');
        const topGrade = grades.length > 0
          ? ['S', 'A', 'B', 'C', 'D'].find(g => grades.includes(g)) || '-'
          : '-';

        orgMap.set(org.id, {
          id: org.id,
          name: org.name,
          level: org.level,
          orgType: org.orgType || '',
          parentOrgId: org.parentOrgId || null,
          objectives: objectiveNodes,
          children: [],
          expanded: org.level === '전사',
          stats: {
            objectiveCount: objectiveNodes.length,
            krCount: allOrgKRs.length,
            avgProgress: avgProg,
            topGrade,
          },
        });
      }

      // 부모-자식 연결
      for (const node of orgMap.values()) {
        if (node.parentOrgId && orgMap.has(node.parentOrgId)) {
          orgMap.get(node.parentOrgId)!.children.push(node);
        }
      }

      // 루트 노드 (전사 또는 parentOrgId가 null)
      const roots = Array.from(orgMap.values()).filter(
        n => !n.parentOrgId || !orgMap.has(n.parentOrgId)
      );

      setTree(roots);

      // 기본 확장: 전사 + 본부
      const initialExpanded = new Set<string>();
      for (const node of orgMap.values()) {
        if (node.level === '전사' || node.level === '본부') {
          initialExpanded.add(node.id);
        }
      }
      setExpandedOrgs(initialExpanded);

    } catch (err) {
      console.error('OKR Map 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, organizations]);

  useEffect(() => {
    fetchOKRTree();
  }, [fetchOKRTree]);

  // ==================== Handlers ====================

  const toggleOrg = (orgId: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const collect = (nodes: OrgNode[]) => {
      for (const n of nodes) {
        all.add(n.id);
        collect(n.children);
      }
    };
    collect(tree);
    setExpandedOrgs(all);
  };

  const collapseAll = () => {
    // 전사만 유지
    const roots = new Set<string>();
    tree.forEach(t => roots.add(t.id));
    setExpandedOrgs(roots);
  };

  // ==================== Stats ====================

  const allNodes: OrgNode[] = [];
  const collectAll = (nodes: OrgNode[]) => {
    for (const n of nodes) {
      allNodes.push(n);
      collectAll(n.children);
    }
  };
  collectAll(tree);

  const totalObjectives = allNodes.reduce((s, n) => s + n.stats.objectiveCount, 0);
  const totalKRs = allNodes.reduce((s, n) => s + n.stats.krCount, 0);
  const avgProgress = allNodes.length > 0
    ? Math.round(allNodes.filter(n => n.stats.krCount > 0).reduce((s, n) => s + n.stats.avgProgress, 0) / Math.max(1, allNodes.filter(n => n.stats.krCount > 0).length))
    : 0;
  const orgsWithOKR = allNodes.filter(n => n.stats.objectiveCount > 0).length;

  // ==================== OrgNode Renderer ====================

  const renderOrgNode = (node: OrgNode, depth: number = 0) => {
    const isExpanded = expandedOrgs.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedOrg === node.id;
    const lColor = levelColor[node.level] || levelColor['팀'];
    const LevelIcon = levelIcon[node.level] || Users;

    // Level filter
    if (filterLevel !== 'all') {
      if (filterLevel === '전사' && node.level !== '전사') return null;
      if (filterLevel === '본부' && !['전사', '본부'].includes(node.level)) return null;
    }

    // BII filter on objectives
    const filteredObjs = filterBII === 'all'
      ? node.objectives
      : node.objectives.filter(o => o.biiType === filterBII);

    return (
      <div key={node.id} className="relative">
        {/* 연결선 */}
        {depth > 0 && (
          <div className="absolute left-0 top-0 bottom-0" style={{ width: `${depth * 48}px` }}>
            <div
              className="absolute border-l-2 border-b-2 border-slate-300 rounded-bl-xl"
              style={{
                left: `${(depth - 1) * 48 + 20}px`,
                top: 0,
                width: '28px',
                height: '28px',
              }}
            />
          </div>
        )}

        {/* 노드 카드 */}
        <div
          className="relative"
          style={{ marginLeft: `${depth * 48}px` }}
        >
          <div
            className={`border-2 rounded-xl mb-3 transition-all duration-200 hover:shadow-lg cursor-pointer ${
              isSelected
                ? `${lColor.border} shadow-lg ring-2 ring-offset-1 ring-blue-300`
                : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => setSelectedOrg(isSelected ? null : node.id)}
          >
            {/* 헤더 */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* 확장 버튼 */}
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleOrg(node.id); }}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-500" />
                    : <ChevronRight className="w-4 h-4 text-slate-500" />
                  }
                </button>
              ) : (
                <div className="w-6" />
              )}

              {/* 레벨 아이콘 */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${lColor.bg}`}>
                <LevelIcon className={`w-4 h-4 ${lColor.accent}`} />
              </div>

              {/* 조직 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm truncate">{node.name}</h3>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded flex-shrink-0">
                    {node.level}
                  </span>
                  {node.orgType && (
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{node.orgType}</span>
                  )}
                </div>
                {node.stats.objectiveCount > 0 && (
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-slate-500">
                      <Target className="w-3 h-3 inline mr-0.5" />
                      {node.stats.objectiveCount}개 목표
                    </span>
                    <span className="text-[11px] text-slate-500">
                      <BarChart3 className="w-3 h-3 inline mr-0.5" />
                      {node.stats.krCount}개 KR
                    </span>
                  </div>
                )}
              </div>

              {/* 통계 뱃지 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {node.stats.krCount > 0 ? (
                  <>
                    {/* 진행률 */}
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400">진행률</div>
                      <div className={`text-sm font-bold ${
                        node.stats.avgProgress >= 100 ? 'text-green-600' :
                        node.stats.avgProgress >= 70 ? 'text-blue-600' :
                        node.stats.avgProgress >= 40 ? 'text-amber-600' :
                        'text-slate-500'
                      }`}>
                        {node.stats.avgProgress}%
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          node.stats.avgProgress >= 100 ? 'bg-green-500' :
                          node.stats.avgProgress >= 70 ? 'bg-blue-500' :
                          node.stats.avgProgress >= 40 ? 'bg-amber-400' :
                          'bg-slate-300'
                        }`}
                        style={{ width: `${Math.min(100, node.stats.avgProgress)}%` }}
                      />
                    </div>
                    {/* 등급 */}
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${gradeColor[node.stats.topGrade]}`}>
                      {node.stats.topGrade}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                    미수립
                  </span>
                )}
              </div>
            </div>

            {/* 목표 목록 (선택 시) */}
            {isSelected && filteredObjs.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50 space-y-2">
                {filteredObjs.map((obj, objIdx) => {
                  const biiColor = getBIIColor(obj.biiType);
                  return (
                    <div key={obj.id}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-slate-400">O{objIdx + 1}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${biiColor.bg} ${biiColor.text}`}>
                          {obj.biiType}
                        </span>
                        <span className="text-sm text-slate-800 font-medium truncate">{obj.name}</span>
                      </div>

                      {/* KR 목록 */}
                      {showKRs && obj.krs.length > 0 && (
                        <div className="ml-8 space-y-1 mb-2">
                          {obj.krs.map((kr, krIdx) => (
                            <div key={kr.id} className="flex items-center gap-2 text-[11px]">
                              <span className="text-slate-400 w-8 flex-shrink-0">KR{krIdx + 1}</span>
                              <span className="text-slate-700 truncate flex-1">{kr.name}</span>
                              <span className="text-slate-400 flex-shrink-0">{kr.weight}%</span>
                              <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
                                <div
                                  className={`h-full rounded-full ${
                                    kr.progressPct >= 100 ? 'bg-green-500' :
                                    kr.progressPct >= 70 ? 'bg-blue-400' :
                                    kr.progressPct >= 40 ? 'bg-amber-400' :
                                    'bg-slate-300'
                                  }`}
                                  style={{ width: `${Math.min(100, kr.progressPct)}%` }}
                                />
                              </div>
                              <span className="text-slate-500 w-8 text-right flex-shrink-0">{kr.progressPct}%</span>
                              <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${gradeColor[kr.grade]} flex-shrink-0`}>
                                {kr.grade}
                              </span>
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
        </div>

        {/* 자식 노드 재귀 */}
        {isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderOrgNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">OKR 구조를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white overflow-auto' : ''} p-6 max-w-7xl mx-auto`}>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">OKR Cascading Map</h1>
            <p className="text-xs text-slate-500">전사 목표 정렬 현황을 한눈에 확인합니다</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* KR 표시 토글 */}
          <button
            onClick={() => setShowKRs(!showKRs)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
              showKRs
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {showKRs ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            KR 상세
          </button>

          {/* 펼침/접기 */}
          <button
            onClick={expandAll}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
          >
            전체 펼침
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
          >
            접기
          </button>

          {/* 필터 */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600"
          >
            <option value="all">전체 레벨</option>
            <option value="전사">전사만</option>
            <option value="본부">전사+본부</option>
          </select>

          <select
            value={filterBII}
            onChange={(e) => setFilterBII(e.target.value)}
            className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600"
          >
            <option value="all">전체 BII</option>
            <option value="Build">Build</option>
            <option value="Innovate">Innovate</option>
            <option value="Improve">Improve</option>
          </select>

          {/* 전체화면 */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500">참여 조직</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {orgsWithOKR}<span className="text-sm text-slate-400 font-normal">/{allNodes.length}</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500">전체 목표</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalObjectives}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-slate-500">전체 KR</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalKRs}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-violet-500" />
            <span className="text-xs text-slate-500">평균 진행률</span>
          </div>
          <div className={`text-2xl font-bold ${
            avgProgress >= 80 ? 'text-green-600' : avgProgress >= 50 ? 'text-blue-600' : 'text-slate-500'
          }`}>
            {avgProgress}%
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 mb-4 px-2">
        <span className="text-[11px] text-slate-400">레벨:</span>
        <span className="flex items-center gap-1 text-[11px]">
          <span className="w-3 h-3 rounded bg-slate-900" /> 전사
        </span>
        <span className="flex items-center gap-1 text-[11px]">
          <span className="w-3 h-3 rounded bg-blue-600" /> 본부
        </span>
        <span className="flex items-center gap-1 text-[11px]">
          <span className="w-3 h-3 rounded bg-emerald-600" /> 팀
        </span>
        <span className="text-slate-300 mx-2">|</span>
        <span className="text-[11px] text-slate-400">등급:</span>
        {['S', 'A', 'B', 'C', 'D'].map(g => (
          <span key={g} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${gradeColor[g]}`}>
            {g}
          </span>
        ))}
      </div>

      {/* 트리 맵 */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <GitBranch className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm mb-1">아직 등록된 OKR이 없습니다</p>
            <p className="text-slate-400 text-xs">목표 수립 위저드에서 OKR을 생성해주세요</p>
          </div>
        ) : (
          <div>
            {tree.map(rootNode => renderOrgNode(rootNode, 0))}
          </div>
        )}
      </div>

      {/* 안내 문구 */}
      <div className="mt-4 text-center">
        <p className="text-[11px] text-slate-400">
          카드를 클릭하면 해당 조직의 목표와 KR을 펼쳐볼 수 있습니다 · 화살표로 하위 조직을 열고 닫을 수 있습니다
        </p>
      </div>
    </div>
  );
}