// src/pages/Organization.tsx
// 조회 전용 - 편집은 관리자 설정에서 가능
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight, ChevronDown, Building2, Users, Target,
  Settings, Loader2, Search, Filter, LayoutGrid, List,
  Crown, User, Mail
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getOrgTypeColor } from '../utils/helpers';
import type { Organization } from '../types';

interface OrgMember {
  profileId: string;
  fullName: string;
  email: string;
  roleName: string;
  roleLevel: number;
}

export default function OrganizationPage() {
  const navigate = useNavigate();
  const { organizations, loading, company } = useStore();
  const { user } = useAuth();

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'Front' | 'Middle' | 'Back'>('all');
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 사용자 관리자 여부 확인
  useEffect(() => {
    if (!user?.id) return;
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('roles!inner(level)')
        .eq('profile_id', user.id);
      if (data) {
        const max = Math.max(...data.map((r: any) => r.roles?.level || 0));
        setIsAdmin(max >= 90);
      }
    };
    checkAdmin();
  }, [user?.id]);

  // 초기 선택 및 확장
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      const rootOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
      if (rootOrg) {
        setSelectedOrgId(rootOrg.id);
        const toExpand = new Set([rootOrg.id]);
        organizations.filter(o => o.parentOrgId === rootOrg.id).forEach(o => toExpand.add(o.id));
        setExpandedOrgs(toExpand);
      }
    }
  }, [organizations, selectedOrgId]);

  // 선택한 조직의 구성원 로딩
  useEffect(() => {
    if (!selectedOrgId) return;
    loadMembers(selectedOrgId);
  }, [selectedOrgId]);

  const loadMembers = async (orgId: string) => {
    setMembersLoading(true);
    try {
      const { data } = await supabase
        .from('user_roles')
        .select(`
          profile_id,
          profiles!inner(full_name, email),
          roles!inner(display_name, level)
        `)
        .eq('org_id', orgId)
        .order('granted_at');

      if (data) {
        const m: OrgMember[] = data.map((row: any) => ({
          profileId: row.profile_id,
          fullName: row.profiles?.full_name || '이름 없음',
          email: row.profiles?.email || '',
          roleName: row.roles?.display_name || '구성원',
          roleLevel: row.roles?.level || 0,
        }));
        // 역할 레벨 높은 순 정렬
        m.sort((a, b) => b.roleLevel - a.roleLevel);
        setMembers(m);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error('구성원 로딩 실패:', err);
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);

  const toggleExpand = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) newExpanded.delete(orgId);
    else newExpanded.add(orgId);
    setExpandedOrgs(newExpanded);
  };

  const getChildOrgs = (parentId: string | null) =>
    organizations.filter(org => org.parentOrgId === parentId);

  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = !searchQuery || 
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.mission?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || org.orgType === filterType;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: organizations.length,
    front: organizations.filter(o => o.orgType === 'Front').length,
    middle: organizations.filter(o => o.orgType === 'Middle').length,
    back: organizations.filter(o => o.orgType === 'Back').length,
    totalHeadcount: organizations.reduce((sum, o) => sum + (o.headcount || 0), 0),
  };

  // 역할에 따른 아이콘
  const getRoleIcon = (level: number) => {
    if (level >= 90) return <Crown className="w-4 h-4 text-amber-500" />;
    if (level >= 50) return <Crown className="w-4 h-4 text-blue-500" />;
    return <User className="w-4 h-4 text-slate-400" />;
  };

  // 트리 렌더링
  const renderOrgTree = (org: Organization, level: number = 0) => {
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
            </div>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div>{children.map(child => renderOrgTree(child, level + 1))}</div>
        )}
      </div>
    );
  };

  const rootOrgs = organizations.filter(org => org.parentOrgId === null);

  if (loading && organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!loading && organizations.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">조직이 없습니다</h3>
          <p className="text-slate-600 mb-6">관리자 설정에서 조직 구조를 먼저 등록해주세요.</p>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin?tab=structure')}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2"
            >
              <Settings className="w-4 h-4" /> 관리자 설정으로 이동
            </button>
          )}
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
        {isAdmin && (
          <button
            onClick={() => navigate('/admin?tab=structure')}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm font-medium"
          >
            <Settings className="w-4 h-4" /> 조직 편집
          </button>
        )}
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-slate-200 p-3">
          <div className="text-xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-xs text-slate-500">전체 조직</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-3">
          <div className="text-xl font-bold text-green-700">{stats.front}</div>
          <div className="text-xs text-green-600">Front</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-3">
          <div className="text-xl font-bold text-blue-700">{stats.middle}</div>
          <div className="text-xs text-blue-600">Middle</div>
        </div>
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-3">
          <div className="text-xl font-bold text-purple-700">{stats.back}</div>
          <div className="text-xs text-purple-600">Back</div>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
          <div className="text-xl font-bold text-amber-700">{stats.totalHeadcount}</div>
          <div className="text-xs text-amber-600">총 인원</div>
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
              {filteredOrganizations.map(org => (
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
                  <p className="text-xs text-slate-500">{org.level}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 오른쪽: 상세 정보 + 구성원 */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-6 overflow-y-auto">
          {selectedOrg ? (
            <div className="space-y-6">
              {/* 헤더 - 컴팩트 */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedOrg.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-sm rounded-lg border ${getOrgTypeColor(selectedOrg.orgType)}`}>
                      {selectedOrg.orgType}
                    </span>
                    <span className="text-sm text-slate-500">{selectedOrg.level}</span>
                    {selectedOrg.parentOrgId && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-sm text-slate-500">
                          상위: {organizations.find(o => o.id === selectedOrg.parentOrgId)?.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">{members.length}</div>
                  <div className="text-sm text-slate-500">인원</div>
                </div>
              </div>

              {/* 미션 */}
              {selectedOrg.mission && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-sm text-blue-800">{selectedOrg.mission}</p>
                </div>
              )}

              {/* 하위 조직 (있을 때만) */}
              {(() => {
                const children = getChildOrgs(selectedOrg.id);
                if (children.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">
                      하위 조직 ({children.length}개)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {children.map(child => (
                        <button
                          key={child.id}
                          onClick={() => {
                            setSelectedOrgId(child.id);
                            setExpandedOrgs(prev => new Set([...prev, selectedOrg.id]));
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors text-sm"
                        >
                          <span className="font-medium text-slate-900">{child.name}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded border ${getOrgTypeColor(child.orgType)}`}>
                            {child.orgType}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── 구성원 리스트 ── */}
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  구성원 ({members.length}명)
                </h4>

                {membersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 text-center">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">아직 구성원이 없습니다</p>
                    {isAdmin && (
                      <p className="text-xs text-slate-400 mt-1">관리자 설정에서 구성원을 초대할 수 있습니다</p>
                    )}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">이름</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">이메일</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500">역할</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m, idx) => (
                          <tr key={m.profileId} className={`border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {getRoleIcon(m.roleLevel)}
                                <span className="text-sm font-medium text-slate-900">{m.fullName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-slate-500">{m.email}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                m.roleLevel >= 90 ? 'bg-amber-100 text-amber-800' :
                                m.roleLevel >= 50 ? 'bg-blue-100 text-blue-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {m.roleName}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 관리자만 편집 안내 */}
              {isAdmin && (
                <div className="pt-4 border-t">
                  <button
                    onClick={() => navigate('/admin?tab=structure')}
                    className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"
                  >
                    <Settings className="w-3.5 h-3.5" /> 조직 구조 편집 →
                  </button>
                </div>
              )}
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