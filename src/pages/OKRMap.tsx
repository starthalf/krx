// src/pages/OKRMap.tsx
// 전사 OKR Cascading Map - Top-Down 조직도 다이어그램
// SVG bezier 연결선 + 노드 카드 + 클릭 시 상세 팝업 + 줌/패닝
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  GitBranch, Target, Loader2, Maximize2, Minimize2,
  X, TrendingUp, Building2, Users, Briefcase, BarChart3,
  ZoomIn, ZoomOut, RotateCcw, AlertCircle
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { getBIIColor } from '../utils/helpers';

// ==================== Types ====================

interface TreeNode {
  id: string;
  name: string;
  level: string;
  orgType: string;
  parentOrgId: string | null;
  children: TreeNode[];
  objectives: ObjData[];
  stats: {
    objCount: number;
    krCount: number;
    avgProgress: number;
    topGrade: string;
    status: 'not_started' | 'in_progress' | 'on_track' | 'at_risk';
  };
}

interface ObjData {
  id: string;
  name: string;
  biiType: string;
  krs: KRData[];
}

interface KRData {
  id: string;
  name: string;
  biiType: string;
  weight: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  progressPct: number;
  grade: string;
}

interface NodeLayout {
  node: TreeNode;
  x: number;
  y: number;
  width: number;
  height: number;
  children: NodeLayout[];
}

// ==================== Constants ====================

const NODE_W = 220;
const NODE_H = 88;
const GAP_Y = 100;
const GAP_X = 28;

const LEVEL_STYLES: Record<string, {
  gradient: string; iconBg: string; icon: typeof Building2;
  ring: string;
}> = {
  '전사': { gradient: 'from-slate-800 to-slate-900', iconBg: 'bg-amber-500', icon: Building2, ring: 'ring-slate-400/30' },
  '본부': { gradient: 'from-blue-600 to-indigo-700', iconBg: 'bg-blue-400', icon: Briefcase, ring: 'ring-blue-300/30' },
  '팀':   { gradient: 'from-emerald-600 to-teal-700', iconBg: 'bg-emerald-400', icon: Users, ring: 'ring-emerald-300/30' },
};

const GRADE_STYLE: Record<string, { bg: string; text: string }> = {
  S: { bg: 'bg-violet-600', text: 'text-white' },
  A: { bg: 'bg-blue-600', text: 'text-white' },
  B: { bg: 'bg-green-600', text: 'text-white' },
  C: { bg: 'bg-amber-500', text: 'text-white' },
  D: { bg: 'bg-red-500', text: 'text-white' },
  '-': { bg: 'bg-slate-200', text: 'text-slate-500' },
};

const STATUS_CLR: Record<string, string> = {
  not_started: '#94a3b8', in_progress: '#3b82f6', on_track: '#22c55e', at_risk: '#f59e0b',
};

// ==================== Layout Engine ====================

function subtreeW(node: TreeNode): number {
  if (node.children.length === 0) return NODE_W;
  return Math.max(NODE_W,
    node.children.reduce((s, c) => s + subtreeW(c), 0) + GAP_X * (node.children.length - 1)
  );
}

function doLayout(node: TreeNode, x: number, y: number): NodeLayout {
  const sw = subtreeW(node);
  const nx = x + (sw - NODE_W) / 2;
  const kids: NodeLayout[] = [];
  if (node.children.length > 0) {
    let cx = x;
    const cy = y + NODE_H + GAP_Y;
    for (const c of node.children) {
      const cw = subtreeW(c);
      kids.push(doLayout(c, cx, cy));
      cx += cw + GAP_X;
    }
  }
  return { node, x: nx, y, width: NODE_W, height: NODE_H, children: kids };
}

// ==================== SVG Lines ====================

function drawConnectors(lay: NodeLayout): JSX.Element[] {
  const out: JSX.Element[] = [];
  const px = lay.x + lay.width / 2;
  const py = lay.y + lay.height;

  for (const kid of lay.children) {
    const cx = kid.x + kid.width / 2;
    const cy = kid.y;
    const my = py + (cy - py) / 2;
    const d = `M ${px} ${py} C ${px} ${my}, ${cx} ${my}, ${cx} ${cy}`;
    const clr = STATUS_CLR[kid.node.stats.status] || '#cbd5e1';

    out.push(
      <path key={`e-${lay.node.id}-${kid.node.id}`} d={d}
        stroke={clr} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.55} />,
      <circle key={`d-${kid.node.id}`} cx={cx} cy={cy - 1} r={3} fill={clr} opacity={0.7} />
    );
    out.push(...drawConnectors(kid));
  }
  return out;
}

// ==================== Grade Calc ====================

function calcGrade(pct: number, crit: any): string {
  const S = crit?.S ?? 120, A = crit?.A ?? 110, B = crit?.B ?? 100, C = crit?.C ?? 90;
  if (pct >= S) return 'S'; if (pct >= A) return 'A';
  if (pct >= B) return 'B'; if (pct >= C) return 'C'; return 'D';
}

// ==================== Component ====================

export default function OKRMap() {
  const { profile } = useAuth();
  const { organizations, objectives, krs, fetchObjectives, fetchKRs } = useStore();

  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [collapsedOrgs, setCollapsedOrgs] = useState<Set<string>>(new Set());

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Data fetch ──
  useEffect(() => {
    if (organizations.length === 0) { setLoading(false); return; }
    for (const org of organizations) { fetchObjectives(org.id); fetchKRs(org.id); }
  }, [organizations.length]);

  // ── Build tree whenever store data changes ──
  useEffect(() => {
    if (organizations.length === 0) return;

    const orgMap = new Map<string, TreeNode>();

    for (const org of organizations) {
      const orgObjs = objectives.filter(o => o.orgId === org.id);
      const orgKRs = krs.filter(k => k.orgId === org.id);

      const objNodes: ObjData[] = orgObjs.map(obj => {
        const oKRs = orgKRs.filter(k => k.objectiveId === obj.id);
        return {
          id: obj.id, name: obj.name, biiType: obj.biiType || 'Improve',
          krs: oKRs.map(kr => {
            const p = kr.targetValue ? Math.round((kr.currentValue / kr.targetValue) * 100) : 0;
            return {
              id: kr.id, name: kr.name, biiType: kr.biiType || 'Improve',
              weight: kr.weight || 0, targetValue: kr.targetValue || 0,
              currentValue: kr.currentValue || 0, unit: kr.unit || '',
              progressPct: p, grade: calcGrade(p, kr.gradeCriteria),
            };
          }),
        };
      });

      const allKR = objNodes.flatMap(o => o.krs);
      const avg = allKR.length > 0
        ? Math.round(allKR.reduce((s, k) => s + k.progressPct, 0) / allKR.length) : 0;
      const gs = allKR.map(k => k.grade).filter(g => g !== '-');
      const tg = gs.length > 0 ? (['S','A','B','C','D'].find(g => gs.includes(g)) || '-') : '-';
      let st: TreeNode['stats']['status'] = 'not_started';
      if (objNodes.length > 0) {
        st = avg >= 80 ? 'on_track' : avg >= 40 ? 'in_progress' : 'at_risk';
      }

      orgMap.set(org.id, {
        id: org.id, name: org.name, level: org.level,
        orgType: org.orgType || '', parentOrgId: org.parentOrgId || null,
        children: [], objectives: objNodes,
        stats: { objCount: objNodes.length, krCount: allKR.length, avgProgress: avg, topGrade: tg, status: st },
      });
    }

    for (const nd of orgMap.values()) {
      if (nd.parentOrgId && orgMap.has(nd.parentOrgId) && !collapsedOrgs.has(nd.parentOrgId)) {
        orgMap.get(nd.parentOrgId)!.children.push(nd);
      }
    }

    const roots = Array.from(orgMap.values()).filter(n => !n.parentOrgId || !orgMap.has(n.parentOrgId));
    setTree(roots);
    setLoading(false);
  }, [organizations, objectives, krs, collapsedOrgs]);

  // ── Layouts ──
  const layouts = useMemo(() => {
    if (tree.length === 0) return [];
    const out: NodeLayout[] = [];
    let sx = 60;
    for (const r of tree) {
      const w = subtreeW(r);
      out.push(doLayout(r, sx, 50));
      sx += w + GAP_X * 3;
    }
    return out;
  }, [tree]);

  const bounds = useMemo(() => {
    let mx = 900, my = 500;
    const walk = (ls: NodeLayout[]) => {
      for (const l of ls) {
        mx = Math.max(mx, l.x + l.width + 60);
        my = Math.max(my, l.y + l.height + 60);
        walk(l.children);
      }
    };
    walk(layouts);
    return { w: mx, h: my };
  }, [layouts]);

  // ── Pan & Zoom ──
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2.5, Math.max(0.25, z + (e.deltaY > 0 ? -0.08 : 0.08))));
  };
  const onMD = (e: React.MouseEvent) => {
    if (e.button === 0 && ((e.target as HTMLElement).closest('svg') === e.currentTarget.querySelector('svg') || (e.target as HTMLElement).tagName === 'DIV')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  const onMM = (e: React.MouseEvent) => { if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); };
  const onMU = () => setIsPanning(false);
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // ── Node click ──
  const onNodeClick = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedNode?.id === node.id) { setSelectedNode(null); setPopupPos(null); return; }
    setSelectedNode(node);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top + 16;
      setPopupPos({
        x: Math.max(8, Math.min(rawX, rect.width - 420)),
        y: Math.max(8, Math.min(rawY, rect.height - 350)),
      });
    }
  };

  const toggleCollapse = (orgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedOrgs(prev => {
      const n = new Set(prev);
      n.has(orgId) ? n.delete(orgId) : n.add(orgId);
      return n;
    });
  };

  // ── Render node cards as foreignObjects ──
  const renderCards = (lay: NodeLayout): JSX.Element[] => {
    const { node, x, y, width, height } = lay;
    const ls = LEVEL_STYLES[node.level] || LEVEL_STYLES['팀'];
    const gs = GRADE_STYLE[node.stats.topGrade] || GRADE_STYLE['-'];
    const isSel = selectedNode?.id === node.id;
    const isCol = collapsedOrgs.has(node.id);
    const hasKids = organizations.some(o => o.parentOrgId === node.id);

    const els: JSX.Element[] = [];
    els.push(
      <foreignObject key={node.id} x={x} y={y} width={width} height={height}
        style={{ overflow: 'visible' }}>
        <div
          className={`h-full rounded-xl border-2 cursor-pointer transition-all duration-200
            hover:shadow-xl hover:-translate-y-0.5
            ${isSel ? `border-white/80 shadow-2xl ring-4 ${ls.ring} scale-[1.04]` : 'border-white/20 shadow-lg'}`}
          style={{ background: 'white' }}
          onClick={(e) => onNodeClick(node, e)}
        >
          {/* Color strip */}
          <div className={`h-1.5 rounded-t-[10px] bg-gradient-to-r ${ls.gradient}`} />

          <div className="px-3 py-2">
            {/* Name row */}
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center ${ls.iconBg} flex-shrink-0`}>
                <ls.icon className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-slate-900 truncate leading-tight">{node.name}</div>
                <div className="text-[10px] text-slate-400 leading-tight">{node.level}</div>
              </div>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black ${gs.bg} ${gs.text} flex-shrink-0`}>
                {node.stats.topGrade}
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  node.stats.avgProgress >= 80 ? 'bg-green-500' :
                  node.stats.avgProgress >= 50 ? 'bg-blue-500' :
                  node.stats.avgProgress >= 20 ? 'bg-amber-400' : 'bg-slate-300'
                }`} style={{ width: `${Math.min(100, node.stats.avgProgress)}%` }} />
              </div>
              <span className={`text-[11px] font-bold tabular-nums w-8 text-right ${
                node.stats.avgProgress >= 80 ? 'text-green-600' :
                node.stats.avgProgress >= 50 ? 'text-blue-600' : 'text-slate-400'
              }`}>{node.stats.avgProgress}%</span>
            </div>

            {/* Meta row */}
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span>O:{node.stats.objCount}</span>
                <span>KR:{node.stats.krCount}</span>
              </div>
              {hasKids && (
                <button onClick={(e) => toggleCollapse(node.id, e)}
                  className={`text-[9px] px-1.5 py-0.5 rounded-md transition-colors ${
                    isCol ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                         : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  {isCol ? `+${organizations.filter(o => o.parentOrgId === node.id).length} 하위` : '접기'}
                </button>
              )}
            </div>
          </div>
        </div>
      </foreignObject>
    );

    for (const kid of lay.children) els.push(...renderCards(kid));
    return els;
  };

  // ── Detail Popup ──
  const popup = () => {
    if (!selectedNode || !popupPos) return null;
    const nd = selectedNode;
    const ls = LEVEL_STYLES[nd.level] || LEVEL_STYLES['팀'];

    return (
      <div className="absolute z-50 w-[400px] max-h-[480px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200"
        style={{ left: popupPos.x, top: popupPos.y }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`bg-gradient-to-r ${ls.gradient} px-5 py-4 text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ls.icon className="w-5 h-5 opacity-80" />
              <div>
                <h3 className="font-bold text-base">{nd.name}</h3>
                <p className="text-xs opacity-70">{nd.level} · {nd.orgType}</p>
              </div>
            </div>
            <button onClick={() => { setSelectedNode(null); setPopupPos(null); }}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="text-center"><div className="text-lg font-black">{nd.stats.objCount}</div><div className="text-[10px] opacity-60">목표</div></div>
            <div className="text-center"><div className="text-lg font-black">{nd.stats.krCount}</div><div className="text-[10px] opacity-60">KR</div></div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] opacity-60">진행률</span>
                <span className="text-sm font-black">{nd.stats.avgProgress}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, nd.stats.avgProgress)}%` }} />
              </div>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black ${GRADE_STYLE[nd.stats.topGrade]?.bg} ${GRADE_STYLE[nd.stats.topGrade]?.text}`}>
              {nd.stats.topGrade}
            </div>
          </div>
        </div>

        {/* Objectives list */}
        <div className="max-h-[300px] overflow-y-auto">
          {nd.objectives.length === 0 ? (
            <div className="py-8 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">아직 수립된 목표가 없습니다</p>
              <p className="text-xs text-slate-400 mt-1">목표 수립 위저드에서 OKR을 생성해주세요</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {nd.objectives.map((obj, oi) => {
                const bc = getBIIColor(obj.biiType);
                const oa = obj.krs.length > 0
                  ? Math.round(obj.krs.reduce((s, k) => s + k.progressPct, 0) / obj.krs.length) : 0;

                return (
                  <div key={obj.id} className="border border-slate-100 rounded-xl p-3 hover:border-slate-200 transition-colors">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-[11px] font-black text-slate-400 mt-0.5">O{oi + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${bc?.bg || 'bg-slate-100'} ${bc?.text || 'text-slate-600'}`}>
                            {obj.biiType}
                          </span>
                          <span className="text-[10px] text-slate-400">{oa}%</span>
                        </div>
                        <p className="text-[13px] text-slate-800 font-medium leading-snug">{obj.name}</p>
                      </div>
                    </div>
                    {obj.krs.length > 0 && (
                      <div className="ml-5 space-y-1.5">
                        {obj.krs.map((kr, ki) => (
                          <div key={kr.id} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 w-6 flex-shrink-0">KR{ki + 1}</span>
                            <p className="flex-1 text-[11px] text-slate-700 truncate min-w-0">{kr.name}</p>
                            <span className="text-[10px] text-slate-400 flex-shrink-0">{kr.weight}%</span>
                            <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                              <div className={`h-full rounded-full ${
                                kr.progressPct >= 100 ? 'bg-green-500' : kr.progressPct >= 70 ? 'bg-blue-400' :
                                kr.progressPct >= 40 ? 'bg-amber-400' : 'bg-slate-300'
                              }`} style={{ width: `${Math.min(100, kr.progressPct)}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-500 w-7 text-right tabular-nums flex-shrink-0">{kr.progressPct}%</span>
                            <span className={`w-[18px] h-[18px] rounded text-[8px] font-black flex items-center justify-center flex-shrink-0 ${GRADE_STYLE[kr.grade]?.bg} ${GRADE_STYLE[kr.grade]?.text}`}>
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
    );
  };

  // ── Summary stats ──
  const allNodes = useMemo(() => {
    const ns: TreeNode[] = [];
    const w = (ls: TreeNode[]) => { for (const n of ls) { ns.push(n); w(n.children); } };
    w(tree); return ns;
  }, [tree]);

  const tO = allNodes.reduce((s, n) => s + n.stats.objCount, 0);
  const tK = allNodes.reduce((s, n) => s + n.stats.krCount, 0);
  const wO = allNodes.filter(n => n.stats.objCount > 0).length;
  const aP = (() => {
    const withKR = allNodes.filter(n => n.stats.krCount > 0);
    return withKR.length > 0 ? Math.round(withKR.reduce((s, n) => s + n.stats.avgProgress, 0) / withKR.length) : 0;
  })();

  // ==================== Render ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">OKR 구조를 분석하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-slate-50' : ''} flex flex-col h-full`}>
      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">OKR Cascading Map</h1>
              <p className="text-[11px] text-slate-500">전사 목표 정렬 현황 · 노드를 클릭하면 상세를 볼 수 있습니다</p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-6 mr-4">
            <div className="text-center">
              <div className="text-lg font-black text-slate-900">{wO}<span className="text-xs text-slate-400 font-normal">/{organizations.length}</span></div>
              <div className="text-[10px] text-slate-400">참여 조직</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-blue-600">{tO}</div>
              <div className="text-[10px] text-slate-400">Objectives</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-emerald-600">{tK}</div>
              <div className="text-[10px] text-slate-400">Key Results</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-black ${aP >= 70 ? 'text-green-600' : aP >= 40 ? 'text-amber-600' : 'text-slate-400'}`}>{aP}%</div>
              <div className="text-[10px] text-slate-400">평균 진행률</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" title="확대">
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.15))} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" title="축소">
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={resetView} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" title="리셋">
              <RotateCcw className="w-4 h-4 text-slate-600" />
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-slate-600" /> : <Maximize2 className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-5 mt-3 text-[10px] text-slate-400">
          <span className="font-semibold text-slate-500">레벨:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-gradient-to-r from-slate-800 to-slate-900" /> 전사</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700" /> 본부</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700" /> 팀</span>
          <span className="text-slate-300 mx-1">|</span>
          <span className="font-semibold text-slate-500">연결선:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded-full" style={{ background: STATUS_CLR.on_track }} /> 정상</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded-full" style={{ background: STATUS_CLR.in_progress }} /> 진행중</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded-full" style={{ background: STATUS_CLR.at_risk }} /> 주의</span>
          <span className="flex items-center gap-1"><span className="w-3 h-1 rounded-full" style={{ background: STATUS_CLR.not_started }} /> 미시작</span>
          <span className="text-slate-300 mx-1">|</span>
          <span className="font-semibold text-slate-500">등급:</span>
          {['S','A','B','C','D'].map(g => (
            <span key={g} className={`w-4 h-4 rounded text-[8px] font-black flex items-center justify-center ${GRADE_STYLE[g].bg} ${GRADE_STYLE[g].text}`}>{g}</span>
          ))}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div ref={canvasRef}
        className="flex-1 overflow-hidden relative"
        style={{
          background: 'radial-gradient(circle at 1px 1px, #e2e8f0 1px, transparent 0)',
          backgroundSize: '24px 24px',
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
        onWheel={onWheel} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
        onClick={() => { setSelectedNode(null); setPopupPos(null); }}
      >
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <GitBranch className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-500 text-sm mb-1">조직 데이터가 없습니다</p>
            <p className="text-slate-400 text-xs">조직 관리에서 조직을 먼저 등록해주세요</p>
          </div>
        ) : (
          <svg
            width={bounds.w * zoom}
            height={bounds.h * zoom}
            viewBox={`0 0 ${bounds.w} ${bounds.h}`}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, transformOrigin: '0 0' }}
          >
            {/* Connectors first (behind nodes) */}
            <g>{layouts.flatMap(l => drawConnectors(l))}</g>
            {/* Node cards */}
            {layouts.flatMap(l => renderCards(l))}
          </svg>
        )}

        {/* Detail popup */}
        {popup()}

        {/* Zoom indicator */}
        <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] text-slate-500 font-medium shadow-sm">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
}