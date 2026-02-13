// src/pages/Organization.tsx
// 조회 전용 - 편집은 관리자 설정에서 가능
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, Building2, Users, Target,
  Settings, Loader2, Search, Filter, LayoutGrid, List
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { getOrgTypeColor } from '../utils/helpers';
import type { Organization } from '../types';

export default function OrganizationPage() {
  const navigate = useNavigate();
  const { organizations, loading, company } = useStore();

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Front' | 'Middle' | 'Back'>('all');
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');

  // 초기 선택 및 확장
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      const rootOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
      if (rootOrg) {
        setSelectedOrgId(rootOrg.id);
        // 루트와 1단계 하위까지 확장
        const toExpand = new Set([rootOrg.id]);
        organizations.filter(o => o.parentOrgId === rootOrg.id).forEach(o => toExpand.add(o.id));
        setExpandedOrgs(toExpand);
      }
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);

  // 트리 토글
  const toggleExpand = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) newExpanded.delete(orgId);
    else newExpanded.add(orgId);
    setExpandedOrgs(newExpanded);
  };

  const getChildOrgs = (parentId: string | null) =>
    organizations.filter(org => org.parentOrgId === parentId);

  // 검색 필터링
  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = !searchQuery || 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.mission?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || org.orgType === filterType;
    return matchesSearch && matchesType;
  });

  // 통계 계산
  const stats = {
    total: organizations.length,
    front: organizations.filter(o => o.orgType === 'Front').length,
    middle: organizations.filter(o => o.orgType === 'Middle').length,
    back: organizations.filter(o => o.orgType === 'Back').length,
    totalHeadcount: organizations.reduce((sum, o) => sum + (o.headcount || 0), 0),
  };

  // 트리 렌더링
  const renderOrgTree = (org: Organization, level: number = 0) => {
    // 검색 중이면 필터된 결과만 표시
    if (searchQuery && !filteredOrganizations.some(fo => fo.id === org.id)) {
      return null;
    }

    const children = getChildOrgs(org.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedOrgs.has(org.id);
    const isSelected = selectedOrgId === org.id;

    return (
      <div key={org.id}>
        <div
          onClick={() => setSelectedOrgId(org.id)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
            isSelected 
              ? 'bg-blue-50 text-blue-700 border border-blue-200' 
              : 'hover:bg-slate-50 border border-transparent'
          }`}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
          {hasChildren ? (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleExpand(org.id); }} 
              className="p-0.5 hover:bg-slate-200 rounded"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-5" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{org.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`px-1.5 py-0.5 text-xs rounded border ${getOrgTypeColor(org.orgType)}`}>
                {org.orgType}
              </span>
              <span className="text-xs text-slate-500">{org.level}</span>
              {org.headcount > 0 && (
                <span className="text-xs text-slate-400 flex items-center gap-0.5">
                  <Users className="w-3 h-3" /> {org.headcount}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>{children.map(child => renderOrgTree(child, level + 1))}</div>
        )}
      </div>
    );
  };

  // 그리드 카드 렌더링
  const renderOrgCard = (org: Organization) => (
    <div
      key={org.id}
      onClick={() => setSelectedOrgId(org.id)}
      className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
        selectedOrgId === org.id
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-slate-900 truncate">{org.name}</h3>
        <span className={`px-2 py-0.5 text-xs rounded-full border ${getOrgTypeColor(org.orgType)}`}>
          {org.orgType}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-2">{org.level}</p>
      {org.mission && (
        <p className="text-sm text-slate-600 line-clamp-2 mb-2">{org.mission}</p>
      )}
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {org.headcount || 0}명
        </span>
        <span className="flex items-center gap-1">
          <Target className="w-3.5 h-3.5" /> {getChildOrgs(org.id).length}개 하위
        </span>
      </div>
    </div>
  );

  const rootOrgs = organizations.filter(org => org.parentOrgId === null);

  // 로딩
  if (loading && organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // 빈 상태
  if (!loading && organizations.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">조직이 없습니다</h3>
          <p className="text-slate-600 mb-6">관리자 설정에서 조직 구조를 먼저 등록해주세요.</p>
          <button
            onClick={() => navigate('/admin?tab=structure')}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2"
          >
            <Settings className="w-4 h-4" /> 관리자 설정으로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">조직 관리</h1>
          <p className="text-slate-600 mt-1">조직도 조회 및 정보 확인</p>
        </div>
        <button
          onClick={() => navigate('/admin?tab=structure')}
          className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <Settings className="w-4 h-4" /> 조직 편집
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-sm text-slate-600">전체 조직</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-4">
          <div className="text-2xl font-bold text-green-700">{stats.front}</div>
          <div className="text-sm text-green-600">Front</div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
          <div className="text-2xl font-bold text-blue-700">{stats.middle}</div>
          <div className="text-sm text-blue-600">Middle</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-4">
          <div className="text-2xl font-bold text-purple-700">{stats.back}</div>
          <div className="text-sm text-purple-600">Back</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-4">
          <div className="text-2xl font-bold text-amber-700">{stats.totalHeadcount}</div>
          <div className="text-sm text-amber-600">총 인원</div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="조직명 또는 미션으로 검색..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">전체 유형</option>
            <option value="Front">Front</option>
            <option value="Middle">Middle</option>
            <option value="Back">Back</option>
          </select>
        </div>

        <div className="flex border border-slate-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-2 text-sm ${viewMode === 'tree' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 text-sm border-l ${viewMode === 'grid' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 grid grid-cols-5 gap-6 min-h-0">
        {/* 왼쪽: 조직 목록 */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-4 overflow-y-auto">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            조직 트리
            <span className="text-xs text-slate-500 font-normal ml-auto">
              {filteredOrganizations.length}개
            </span>
          </h2>
          
          {viewMode === 'tree' ? (
            rootOrgs.length > 0 ? (
              rootOrgs.map(rootOrg => renderOrgTree(rootOrg))
            ) : (
              <div className="text-center text-slate-500 py-10">조직이 없습니다</div>
            )
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredOrganizations.map(org => renderOrgCard(org))}
            </div>
          )}
        </div>

        {/* 오른쪽: 상세 정보 (조회 전용) */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-6 overflow-y-auto">
          {selectedOrg ? (
            <div className="space-y-6">
              {/* 헤더 */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedOrg.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-sm rounded-lg border ${getOrgTypeColor(selectedOrg.orgType)}`}>
                      {selectedOrg.orgType}
                    </span>
                    <span className="text-sm text-slate-500">{selectedOrg.level}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">{selectedOrg.headcount || 0}</div>
                  <div className="text-sm text-slate-500">인원</div>
                </div>
              </div>

              {/* 미션 */}
              {selectedOrg.mission && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-1">미션</h3>
                  <p className="text-blue-800">{selectedOrg.mission}</p>
                </div>
              )}

              {/* 정보 그리드 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">조직 유형</h4>
                  <p className="text-slate-900">
                    {selectedOrg.orgType === 'Front' && '🎯 Front - 매출 직접 기여 (영업/마케팅)'}
                    {selectedOrg.orgType === 'Middle' && '⚙️ Middle - 가치 창출 (기획/개발/생산)'}
                    {selectedOrg.orgType === 'Back' && '🛡️ Back - 지원 기능 (인사/재무/총무)'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">상위 조직</h4>
                  <p className="text-slate-900">
                    {selectedOrg.parentOrgId
                      ? organizations.find(o => o.id === selectedOrg.parentOrgId)?.name || '-'
                      : '(최상위 조직)'}
                  </p>
                </div>
              </div>

              {/* 기능 태그 */}
              {selectedOrg.functionTags && selectedOrg.functionTags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">핵심 기능</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrg.functionTags.map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 하위 조직 목록 */}
              {(() => {
                const children = getChildOrgs(selectedOrg.id);
                if (children.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-3">
                      하위 조직 ({children.length}개)
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {children.map(child => (
                        <button
                          key={child.id}
                          onClick={() => {
                            setSelectedOrgId(child.id);
                            setExpandedOrgs(prev => new Set([...prev, selectedOrg.id]));
                          }}
                          className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-slate-900 truncate">{child.name}</div>
                            <div className="text-xs text-slate-500">{child.level} · {child.headcount || 0}명</div>
                          </div>
                          <span className={`px-1.5 py-0.5 text-xs rounded border ${getOrgTypeColor(child.orgType)}`}>
                            {child.orgType}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* 편집 안내 */}
              <div className="pt-4 border-t">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <Settings className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">조직 정보를 수정하려면?</p>
                    <p className="text-sm text-amber-700 mt-1">
                      관리자 설정에서 조직 구조를 편집할 수 있습니다.
                    </p>
                    <button
                      onClick={() => navigate('/admin?tab=structure')}
                      className="mt-2 text-sm text-amber-800 font-medium hover:underline"
                    >
                      관리자 설정으로 이동 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Building2 className="w-12 h-12 text-slate-300 mb-3" />
              <p>왼쪽에서 조직을 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}