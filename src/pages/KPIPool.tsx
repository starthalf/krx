// src/pages/KPIPool.tsx
import { useState, useEffect, useCallback } from 'react';
import { 
  Search, Filter, ChevronDown, ChevronLeft, ChevronRight, 
  X, Database, TrendingUp, BarChart3, Target, Users,
  BookOpen, ArrowUpDown, Star, Copy, Check, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getBIIColor } from '../utils/helpers';

// ==================== Types ====================

interface PoolKPI {
  id: string;
  name: string;
  name_en: string | null;
  definition: string;
  formula: string;
  unit: string;
  perspective: string;
  indicator_type: string;
  function_tags: string[];
  industry_tags: string[];
  org_level_tags: string[];
  org_type: string;
  bii_type: string[];
  direction: string;
  weight_range: { min: number; typical: number; max: number } | null;
  typical_target: { min: number; median: number; stretch: number } | null;
  grade_template: { S: number; A: number; B: number; C: number; D: number } | null;
  measurement_cycle: string;
  keywords: string[];
  source: string;
  is_mandatory: boolean;
  relevance_score: number;
  usage_count: number;
}

interface FilterState {
  search: string;
  industry: string;
  function: string;
  perspective: string;
  biiType: string;
  orgLevel: string;
  direction: string;
  isMandatory: string; // 'all' | 'true' | 'false'
}

// ==================== Constants ====================

const INDUSTRIES = [
  'SaaS/클라우드', '자동차부품', 'IDM(종합반도체)', '파운드리/팹리스',
  '전자부품/반도체장비', '이커머스/D2C', '전문의약품', '바이오시밀러/CDMO',
  '의료기기', '핀테크/페이', '핀테크/금융IT', '배터리/ESS',
  '게임', 'AI/데이터', '모바일앱/플랫폼', '물류/풀필먼트',
  'F&B/외식', '철강/금속', '화학/소재', '디지털헬스/헬스텍', '반도체장비/소재'
];

const FUNCTIONS = [
  '영업', '마케팅', '고객서비스/CS', '사업개발',
  '생산/제조', '품질', 'R&D/연구개발', '구매/조달',
  'SCM/물류', '설비/시설', 'HR/인사', '재무/회계',
  '경영기획', 'IT/정보시스템', '법무/컴플라이언스'
];

const PERSPECTIVES = ['재무', '고객', '프로세스', '학습성장'];
const BII_TYPES = ['Build', 'Innovate', 'Improve'];
const ORG_LEVELS = ['전사', '본부', '팀'];
const PAGE_SIZE = 20;

const perspectiveIcons: Record<string, string> = {
  '재무': '💰', '고객': '👥', '프로세스': '⚙️', '학습성장': '📚'
};

const perspectiveColors: Record<string, string> = {
  '재무': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '고객': 'bg-sky-100 text-sky-700 border-sky-200',
  '프로세스': 'bg-amber-100 text-amber-700 border-amber-200',
  '학습성장': 'bg-violet-100 text-violet-700 border-violet-200',
};

// ==================== Component ====================

export default function KPIPool() {
  // State
  const [kpis, setKpis] = useState<PoolKPI[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedKPI, setSelectedKPI] = useState<PoolKPI | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<string>('relevance_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    industry: '',
    function: '',
    perspective: '',
    biiType: '',
    orgLevel: '',
    direction: '',
    isMandatory: 'all',
  });

  // Stats
  const [stats, setStats] = useState({ total: 0, industries: 0, functions: 0, mandatory: 0 });

  // ==================== Data Fetching ====================

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('kpi_pool')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,definition.ilike.%${filters.search}%,name_en.ilike.%${filters.search}%`);
      }
      if (filters.industry) {
        query = query.contains('industry_tags', [filters.industry]);
      }
      if (filters.function) {
        query = query.contains('function_tags', [filters.function]);
      }
      if (filters.perspective) {
        query = query.eq('perspective', filters.perspective);
      }
      if (filters.biiType) {
        query = query.contains('bii_type', [filters.biiType]);
      }
      if (filters.orgLevel) {
        query = query.contains('org_level_tags', [filters.orgLevel]);
      }
      if (filters.direction) {
        query = query.eq('direction', filters.direction);
      }
      if (filters.isMandatory === 'true') {
        query = query.eq('is_mandatory', true);
      } else if (filters.isMandatory === 'false') {
        query = query.eq('is_mandatory', false);
      }

      // Sort
      query = query.order(sortField, { ascending: sortDir === 'asc' });
      
      // Pagination
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;
      
      if (error) throw error;
      setKpis(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('KR 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, page, sortField, sortDir]);

  const fetchStats = useCallback(async () => {
    try {
      const { count } = await supabase
        .from('kpi_pool')
        .select('*', { count: 'exact', head: true });
      
      const { data: mandatoryData } = await supabase
        .from('kpi_pool')
        .select('id', { count: 'exact', head: true })
        .eq('is_mandatory', true);

      setStats({
        total: count || 0,
        industries: INDUSTRIES.length,
        functions: FUNCTIONS.length,
        mandatory: mandatoryData ? 0 : 0, // simplified
      });
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, []);

  useEffect(() => { fetchKPIs(); }, [fetchKPIs]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filters]);

  // ==================== Handlers ====================

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '', industry: '', function: '', perspective: '',
      biiType: '', orgLevel: '', direction: '', isMandatory: 'all'
    });
  };

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'search') return false;
    if (k === 'isMandatory') return v !== 'all';
    return v !== '';
  }).length;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleCopyKPI = (kpi: PoolKPI) => {
    const text = `${kpi.name}\n정의: ${kpi.definition}\n산식: ${kpi.formula}\n단위: ${kpi.unit}\n관점: ${kpi.perspective}\n측정주기: ${kpi.measurement_cycle}`;
    navigator.clipboard.writeText(text);
    setCopiedId(kpi.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ==================== Render ====================

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Database className="w-7 h-7 text-blue-600" />
              KR 레퍼런스
            </h1>
            <p className="text-slate-600 mt-1">
              {totalCount > 0 ? `${totalCount.toLocaleString()}개` : '...'} KR • {INDUSTRIES.length}개 산업 • {FUNCTIONS.length}개 기능
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{totalCount.toLocaleString()}</div>
                <div className="text-xs text-slate-500">전체 KR</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{INDUSTRIES.length}</div>
                <div className="text-xs text-slate-500">산업분류</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{FUNCTIONS.length}</div>
                <div className="text-xs text-slate-500">조직기능</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">4</div>
                <div className="text-xs text-slate-500">BSC 관점</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
        <div className="flex gap-3 mb-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="KR명, 정의, 영문명으로 검색..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
            {filters.search && (
              <button 
                onClick={() => updateFilter('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Industry Quick Select */}
          <select
            value={filters.industry}
            onChange={(e) => updateFilter('industry', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[180px]"
          >
            <option value="">🏭 전체 산업</option>
            {INDUSTRIES.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>

          {/* Function Quick Select */}
          <select
            value={filters.function}
            onChange={(e) => updateFilter('function', e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[160px]"
          >
            <option value="">👥 전체 기능</option>
            {FUNCTIONS.map(fn => (
              <option key={fn} value={fn}>{fn}</option>
            ))}
          </select>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2.5 border rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            상세필터
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="border-t border-slate-200 pt-4 mt-2">
            <div className="grid grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">BSC 관점</label>
                <select 
                  value={filters.perspective}
                  onChange={(e) => updateFilter('perspective', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">전체</option>
                  {PERSPECTIVES.map(p => <option key={p} value={p}>{perspectiveIcons[p]} {p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">BII 유형</label>
                <select 
                  value={filters.biiType}
                  onChange={(e) => updateFilter('biiType', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">전체</option>
                  {BII_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">조직레벨</label>
                <select 
                  value={filters.orgLevel}
                  onChange={(e) => updateFilter('orgLevel', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">전체</option>
                  {ORG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">방향</label>
                <select 
                  value={filters.direction}
                  onChange={(e) => updateFilter('direction', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">전체</option>
                  <option value="증가형">📈 증가형</option>
                  <option value="감소형">📉 감소형</option>
                  <option value="목표달성형">🎯 목표달성형</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">필수여부</label>
                <select 
                  value={filters.isMandatory}
                  onChange={(e) => updateFilter('isMandatory', e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">전체</option>
                  <option value="true">⭐ 필수 KR</option>
                  <option value="false">일반 KR</option>
                </select>
              </div>
            </div>
            
            {activeFilterCount > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {filters.perspective && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1">
                      관점: {filters.perspective}
                      <button onClick={() => updateFilter('perspective', '')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {filters.biiType && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1">
                      BII: {filters.biiType}
                      <button onClick={() => updateFilter('biiType', '')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {filters.orgLevel && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1">
                      레벨: {filters.orgLevel}
                      <button onClick={() => updateFilter('orgLevel', '')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {filters.direction && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1">
                      방향: {filters.direction}
                      <button onClick={() => updateFilter('direction', '')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {filters.isMandatory !== 'all' && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center gap-1">
                      {filters.isMandatory === 'true' ? '필수 KR' : '일반 KR'}
                      <button onClick={() => updateFilter('isMandatory', 'all')}><X className="w-3 h-3" /></button>
                    </span>
                  )}
                </div>
                <button 
                  onClick={clearFilters}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  필터 초기화
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result Count & Sort */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-sm text-slate-600">
          {loading ? '검색 중...' : `${totalCount.toLocaleString()}개 결과`}
          {(filters.industry || filters.function) && (
            <span className="ml-2 text-blue-600 font-medium">
              {filters.industry && `${filters.industry}`}
              {filters.industry && filters.function && ' × '}
              {filters.function && `${filters.function}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">정렬:</span>
          <button 
            onClick={() => handleSort('relevance_score')}
            className={`px-2 py-1 rounded text-xs font-medium ${sortField === 'relevance_score' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            관련도
          </button>
          <button 
            onClick={() => handleSort('name')}
            className={`px-2 py-1 rounded text-xs font-medium ${sortField === 'name' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            이름순
          </button>
          <button 
            onClick={() => handleSort('usage_count')}
            className={`px-2 py-1 rounded text-xs font-medium ${sortField === 'usage_count' ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            사용빈도
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 text-sm">KR 데이터를 불러오는 중...</p>
            </div>
          </div>
        ) : kpis.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">검색 결과가 없습니다</p>
              <button onClick={clearFilters} className="mt-2 text-blue-600 text-sm hover:underline">
                필터 초기화
              </button>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-8">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-700">
                    KR명 <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-24">
                  관점
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-20">
                  BII
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-28">
                  기능
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-16">
                  단위
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-16">
                  방향
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase w-14">
                  필수
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase w-20">
                  
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kpis.map((kpi, idx) => {
                const biiColors = (kpi.bii_type || []).map(b => getBIIColor(b as any));
                const perspColor = perspectiveColors[kpi.perspective] || 'bg-slate-100 text-slate-600';
                
                return (
                  <tr 
                    key={kpi.id} 
                    className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedKPI(kpi)}
                  >
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {page * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-slate-900 text-sm">{kpi.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {kpi.name_en && <span className="mr-2">{kpi.name_en}</span>}
                            {kpi.definition.length > 50 
                              ? kpi.definition.substring(0, 50) + '...' 
                              : kpi.definition}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${perspColor}`}>
                        {perspectiveIcons[kpi.perspective]} {kpi.perspective}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {(kpi.bii_type || []).map((b, i) => {
                          const c = getBIIColor(b as any);
                          return (
                            <span key={i} className={`px-1.5 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
                              {b.charAt(0)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(kpi.function_tags || []).slice(0, 1).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {kpi.unit}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {kpi.direction === '증가형' ? '📈' : kpi.direction === '감소형' ? '📉' : '🎯'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {kpi.is_mandatory && (
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => handleCopyKPI(kpi)}
                        className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                        title="KR 정보 복사"
                      >
                        {copiedId === kpi.id 
                          ? <Check className="w-4 h-4 text-green-600" />
                          : <Copy className="w-4 h-4 text-slate-400" />
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {page * PAGE_SIZE + 1}~{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> 이전
            </button>
            
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 5 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium ${
                    page === pageNum 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            
            <button 
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              다음 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer (Slide-over) */}
      {selectedKPI && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedKPI(null)}>
          <div className="fixed inset-0 bg-black/30" />
          <div 
            className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedKPI.is_mandatory && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500" /> 필수
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${perspectiveColors[selectedKPI.perspective]}`}>
                      {perspectiveIcons[selectedKPI.perspective]} {selectedKPI.perspective}
                    </span>
                    {(selectedKPI.bii_type || []).map((b, i) => {
                      const c = getBIIColor(b as any);
                      return (
                        <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{b}</span>
                      );
                    })}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedKPI.name}</h2>
                  {selectedKPI.name_en && (
                    <p className="text-sm text-slate-400 mt-0.5">{selectedKPI.name_en}</p>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedKPI(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Definition */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> 정의
                </h3>
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{selectedKPI.definition}</p>
              </div>

              {/* Formula */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" /> 산식
                </h3>
                <div className="text-sm text-slate-800 bg-blue-50 border border-blue-100 rounded-lg p-3 font-mono">
                  {selectedKPI.formula}
                </div>
              </div>

              {/* Key Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">단위</div>
                  <div className="text-sm font-medium text-slate-900">{selectedKPI.unit}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">측정주기</div>
                  <div className="text-sm font-medium text-slate-900">{selectedKPI.measurement_cycle}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">지표유형</div>
                  <div className="text-sm font-medium text-slate-900">{selectedKPI.indicator_type}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500 mb-1">방향</div>
                  <div className="text-sm font-medium text-slate-900">
                    {selectedKPI.direction === '증가형' ? '📈' : selectedKPI.direction === '감소형' ? '📉' : '🎯'} {selectedKPI.direction}
                  </div>
                </div>
              </div>

              {/* Grade Template */}
              {selectedKPI.grade_template && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">등급 기준 (기본 템플릿)</h3>
                  <div className="flex gap-2">
                    {Object.entries(selectedKPI.grade_template).map(([grade, value]) => (
                      <div key={grade} className={`flex-1 text-center rounded-lg p-2 ${
                        grade === 'S' ? 'bg-blue-50 border border-blue-200' :
                        grade === 'A' ? 'bg-green-50 border border-green-200' :
                        grade === 'B' ? 'bg-lime-50 border border-lime-200' :
                        grade === 'C' ? 'bg-amber-50 border border-amber-200' :
                        'bg-red-50 border border-red-200'
                      }`}>
                        <div className="text-xs font-bold">{grade}</div>
                        <div className="text-sm font-medium">{value}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weight Range */}
              {selectedKPI.weight_range && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">권장 가중치</h3>
                  <div className="flex items-center gap-4 bg-slate-50 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-xs text-slate-500">최소</div>
                      <div className="text-sm font-medium">{selectedKPI.weight_range.min}%</div>
                    </div>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full relative">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ 
                          width: `${((selectedKPI.weight_range.typical - selectedKPI.weight_range.min) / (selectedKPI.weight_range.max - selectedKPI.weight_range.min)) * 100}%`,
                          marginLeft: `${((selectedKPI.weight_range.min) / selectedKPI.weight_range.max) * 100}%`
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-slate-500">최대</div>
                      <div className="text-sm font-medium">{selectedKPI.weight_range.max}%</div>
                    </div>
                  </div>
                  <div className="text-center text-xs text-blue-600 mt-1">
                    권장: {selectedKPI.weight_range.typical}%
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">태그</h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-slate-500 mr-2">산업:</span>
                    <div className="inline-flex gap-1 flex-wrap">
                      {(selectedKPI.industry_tags || []).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 mr-2">기능:</span>
                    <div className="inline-flex gap-1 flex-wrap">
                      {(selectedKPI.function_tags || []).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 mr-2">레벨:</span>
                    <div className="inline-flex gap-1 flex-wrap">
                      {(selectedKPI.org_level_tags || []).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                  {(selectedKPI.keywords || []).length > 0 && (
                    <div>
                      <span className="text-xs text-slate-500 mr-2">키워드:</span>
                      <div className="inline-flex gap-1 flex-wrap">
                        {selectedKPI.keywords.map(kw => (
                          <span key={kw} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">#{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="border-t border-slate-200 pt-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xs text-slate-500">관련도</div>
                    <div className="text-sm font-medium text-slate-900">{selectedKPI.relevance_score}점</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">사용횟수</div>
                    <div className="text-sm font-medium text-slate-900">{selectedKPI.usage_count}회</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">출처</div>
                    <div className="text-xs font-medium text-slate-900 truncate">{selectedKPI.source || '-'}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Action */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4">
              <button 
                onClick={() => handleCopyKPI(selectedKPI)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                {copiedId === selectedKPI.id ? (
                  <><Check className="w-4 h-4" /> 복사됨!</>
                ) : (
                  <><Copy className="w-4 h-4" /> KR 정보 복사</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}