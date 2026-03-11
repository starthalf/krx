// src/components/OKRExportModal.tsx
// OKR Excel 다운로드 모달 — 조직 선택 + 기간 선택 + 다운로드
// 사용법: <OKRExportModal isOpen={open} onClose={() => setOpen(false)} />

import { useEffect, useState, useMemo } from 'react';
import {
  X, Download, Building2, ChevronDown, ChevronRight,
  CheckSquare, Square, FileSpreadsheet, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { useOKRExport } from '../hooks/useOKRExport';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultPeriodCode?: string;  // 현재 선택된 기간을 외부에서 주입 가능
}

interface OrgItem {
  id: string;
  name: string;
  level: string;
  parentOrgId: string | null;
}

interface FiscalPeriod {
  id: string;
  code: string;
  name: string;
  status: string;
}

// 계층 레벨 정렬 가중치
const LEVEL_ORDER: Record<string, number> = {
  전사: 0, 부문: 1, 본부: 2, 국: 3, 부: 4, 실: 5, 팀: 6, 센터: 7,
};

export default function OKRExportModal({ isOpen, onClose, defaultPeriodCode }: Props) {
  const { user } = useAuth();
  const { company, organizations } = useStore();
  const { exportOKR, loading: exporting } = useOKRExport();

  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(defaultPeriodCode ?? '');
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set(['전사', '본부', '부문']));
  const [includeKRDetail, setIncludeKRDetail] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  // ── 기간 목록 로드 ─────────────────────────────────
  useEffect(() => {
    if (!isOpen || !company?.id) return;

    const load = async () => {
      setLoadingPeriods(true);
      try {
        const { data } = await supabase
          .from('fiscal_periods')
          .select('id, code, name, status')
          .eq('company_id', company.id)
          .order('start_date', { ascending: false });

        const list = (data ?? []) as FiscalPeriod[];
        setPeriods(list);

        // 기본 선택: props > active > planning > 첫 번째
        if (!selectedPeriod || !list.find(p => p.code === selectedPeriod)) {
          const active = list.find(p => p.status === 'active');
          const planning = list.find(p => p.status === 'planning');
          setSelectedPeriod(
            defaultPeriodCode ?? active?.code ?? planning?.code ?? list[0]?.code ?? '',
          );
        }
      } finally {
        setLoadingPeriods(false);
      }
    };

    load();
  }, [isOpen, company?.id]);

  // ── 조직 목록 (계층 정렬) ──────────────────────────
  const sortedOrgs = useMemo<OrgItem[]>(() => {
    return [...organizations]
      .map(o => ({
        id: o.id,
        name: o.name,
        level: o.level,
        parentOrgId: o.parentOrgId ?? null,
      }))
      .sort((a, b) => (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99));
  }, [organizations]);

  // 레벨별 그룹화
  const orgsByLevel = useMemo(() => {
    const map = new Map<string, OrgItem[]>();
    for (const org of sortedOrgs) {
      const list = map.get(org.level) ?? [];
      list.push(org);
      map.set(org.level, list);
    }
    return map;
  }, [sortedOrgs]);

  const levels = useMemo(
    () => [...orgsByLevel.keys()].sort((a, b) => (LEVEL_ORDER[a] ?? 99) - (LEVEL_ORDER[b] ?? 99)),
    [orgsByLevel],
  );

  // ── 선택 로직 ─────────────────────────────────────
  const toggleOrg = (id: string) => {
    setSelectedOrgIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleLevel = (level: string) => {
    const orgs = orgsByLevel.get(level) ?? [];
    const allSelected = orgs.every(o => selectedOrgIds.has(o.id));
    setSelectedOrgIds(prev => {
      const next = new Set(prev);
      if (allSelected) orgs.forEach(o => next.delete(o.id));
      else orgs.forEach(o => next.add(o.id));
      return next;
    });
  };

  const selectAll = () => setSelectedOrgIds(new Set(sortedOrgs.map(o => o.id)));
  const clearAll = () => setSelectedOrgIds(new Set());

  const toggleExpand = (level: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  // ── 다운로드 ──────────────────────────────────────
  const handleExport = async () => {
    if (!selectedPeriod) return;
    await exportOKR({
      orgIds: selectedOrgIds.size > 0 ? [...selectedOrgIds] : [],
      periodCode: selectedPeriod,
      companyName: company?.name ?? '',
      includeKRDetail,
    });
  };

  if (!isOpen) return null;

  const selectedCount = selectedOrgIds.size;
  const totalCount = sortedOrgs.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">OKR Excel 다운로드</h2>
              <p className="text-xs text-slate-500 mt-0.5">조직과 기간을 선택하여 내보내세요</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 기간 선택 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">기간 선택</label>
            {loadingPeriods ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>기간 불러오는 중...</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {periods.map(p => (
                  <button
                    key={p.code}
                    onClick={() => setSelectedPeriod(p.code)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      selectedPeriod === p.code
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {p.name || p.code}
                    {p.status === 'active' && (
                      <span className="ml-1.5 text-xs opacity-75">(진행중)</span>
                    )}
                  </button>
                ))}
                {periods.length === 0 && (
                  <p className="text-sm text-slate-400">등록된 기간이 없습니다.</p>
                )}
              </div>
            )}
          </div>

          {/* 조직 선택 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">
                조직 선택
                <span className="ml-2 text-xs text-slate-400 font-normal">
                  {selectedCount === 0 ? '전체 포함' : `${selectedCount}/${totalCount}개 선택`}
                </span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:underline"
                >
                  전체 선택
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={clearAll}
                  className="text-xs text-slate-500 hover:underline"
                >
                  전체 해제
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {levels.map(level => {
                const orgs = orgsByLevel.get(level) ?? [];
                const expanded = expandedLevels.has(level);
                const allSelected = orgs.every(o => selectedOrgIds.has(o.id));
                const someSelected = orgs.some(o => selectedOrgIds.has(o.id));

                return (
                  <div key={level}>
                    {/* 레벨 헤더 */}
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <button
                        onClick={() => toggleExpand(level)}
                        className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1 text-left"
                      >
                        {expanded
                          ? <ChevronDown className="w-3.5 h-3.5" />
                          : <ChevronRight className="w-3.5 h-3.5" />}
                        {level} ({orgs.length})
                      </button>
                      <button
                        onClick={() => toggleLevel(level)}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        {allSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : someSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                        레벨 전체
                      </button>
                    </div>

                    {/* 조직 목록 */}
                    {expanded && (
                      <div className="divide-y divide-slate-50">
                        {orgs.map(org => (
                          <label
                            key={org.id}
                            className="flex items-center gap-3 px-5 py-2 hover:bg-blue-50/50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedOrgIds.has(org.id)}
                              onChange={() => toggleOrg(org.id)}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                            />
                            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-sm text-slate-700">{org.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedCount === 0 && (
              <p className="mt-2 text-xs text-slate-400">
                ※ 조직을 선택하지 않으면 전체 조직이 포함됩니다.
              </p>
            )}
          </div>

          {/* 옵션 */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">내보내기 옵션</label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeKRDetail}
                onChange={e => setIncludeKRDetail(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-600">
                KR 상세 포함 <span className="text-slate-400">(정의·산식·관점·측정주기)</span>
              </span>
            </label>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl">
          <div className="text-xs text-slate-400">
            {selectedPeriod ? (
              <>
                <span className="font-medium text-slate-600">{selectedPeriod}</span> ·{' '}
                {selectedCount === 0 ? '전체 조직' : `${selectedCount}개 조직`} ·{' '}
                {includeKRDetail ? 'KR 상세 포함' : 'KR 기본만'}
              </>
            ) : (
              '기간을 선택해주세요'
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleExport}
              disabled={!selectedPeriod || exporting}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? '생성 중...' : 'Excel 다운로드'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}