// src/pages/Organization.tsx
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Download, Upload, Bot, Loader2, Save } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getOrgTypeColor } from '../utils/helpers';
import type { Organization } from '../types';

export default function OrganizationPage() {
  const { organizations, updateOrganization, loading } = useStore();
  
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // 첫 번째 조직 자동 선택
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      const rootOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
      setSelectedOrgId(rootOrg.id);
      setExpandedOrgs(new Set([rootOrg.id]));
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);

  const toggleExpand = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  const getChildOrgs = (parentId: string | null) => {
    return organizations.filter(org => org.parentOrgId === parentId);
  };

  const renderOrgTree = (org: Organization, level: number = 0) => {
    const children = getChildOrgs(org.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedOrgs.has(org.id);
    const isSelected = selectedOrgId === org.id;

    return (
      <div key={org.id}>
        <div
          onClick={() => setSelectedOrgId(org.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50'
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
        >
          {hasChildren ? (
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                toggleExpand(org.id); 
              }} 
              className="p-0.5"
            >
              {isExpanded ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
            </button>
          ) : (
            <div className="w-5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{org.name}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`px-1.5 py-0.5 text-xs rounded border ${getOrgTypeColor(org.orgType)}`}>
                {org.orgType}
              </span>
              <span className="text-xs text-slate-500">{org.headcount}명</span>
            </div>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {children.map(child => renderOrgTree(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootOrgs = organizations.filter(org => org.parentOrgId === null);

  const handleSave = async () => {
    if (!selectedOrg) return;
    
    await updateOrganization(selectedOrg.id, {
      name: selectedOrg.name,
      mission: selectedOrg.mission,
      level: selectedOrg.level,
      orgType: selectedOrg.orgType,
      functionTags: selectedOrg.functionTags,
      headcount: selectedOrg.headcount
    });
    
    alert('✅ 조직 정보가 저장되었습니다');
  };

  // 로딩 화면
  if (loading && organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-slate-600">조직 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  // 데이터 없음
  if (!loading && organizations.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800 mb-2">조직 데이터가 없습니다</p>
          <p className="text-sm text-yellow-600">
            Supabase에서 시드 데이터를 삽입해주세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">조직 관리</h1>
          <p className="text-slate-600 mt-1">
            조직도 편집 및 관리 ({organizations.length}개 조직)
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
            <Download className="w-4 h-4" />
            엑셀 템플릿
          </button>
          <button className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2">
            <Upload className="w-4 h-4" />
            일괄 업로드
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2">
            <Bot className="w-4 h-4" />
            AI 자동생성
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6 h-[calc(100vh-180px)]">
        {/* 왼쪽: 조직 트리 */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-4 overflow-y-auto">
          <h2 className="font-semibold text-slate-900 mb-4">조직 트리</h2>
          {rootOrgs.length > 0 ? (
            rootOrgs.map(rootOrg => renderOrgTree(rootOrg))
          ) : (
            <div className="text-center text-slate-500 py-10">
              루트 조직이 없습니다
            </div>
          )}
        </div>

        {/* 오른쪽: 상세 정보 */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-6 overflow-y-auto">
          {selectedOrg ? (
            <div className="space-y-6">
              {/* 조직명 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  조직명
                </label>
                <input
                  type="text"
                  value={selectedOrg.name}
                  onChange={(e) => updateOrganization(selectedOrg.id, { name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* 조직 레벨 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  조직 레벨
                </label>
                <select
                  value={selectedOrg.level}
                  onChange={(e) => updateOrganization(selectedOrg.id, { 
                    level: e.target.value as any 
                  })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="전사">전사</option>
                  <option value="부문">부문</option>
                  <option value="본부">본부</option>
                  <option value="실">실</option>
                  <option value="팀">팀</option>
                </select>
              </div>

              {/* 조직 유형 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  조직 유형
                </label>
                <div className="flex gap-3">
                  {(['Front', 'Middle', 'Back'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => updateOrganization(selectedOrg.id, { orgType: type })}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
                        selectedOrg.orgType === type
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* 미션 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  미션
                </label>
                <textarea
                  value={selectedOrg.mission}
                  onChange={(e) => updateOrganization(selectedOrg.id, { mission: e.target.value })}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="이 조직의 미션을 입력하세요"
                />
              </div>

              {/* 핵심 기능 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  핵심 기능 태그
                </label>
                <input
                  type="text"
                  value={selectedOrg.functionTags.join(', ')}
                  onChange={(e) => updateOrganization(selectedOrg.id, { 
                    functionTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="예: 마케팅전략, 캠페인기획, 시장조사"
                />
                <p className="text-xs text-slate-500 mt-1">
                  쉼표(,)로 구분해서 입력하세요
                </p>
              </div>

              {/* 인원수 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  인원수
                </label>
                <input
                  type="number"
                  value={selectedOrg.headcount}
                  onChange={(e) => updateOrganization(selectedOrg.id, { 
                    headcount: parseInt(e.target.value) || 0 
                  })}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* 저장 버튼 */}
              <div className="pt-4 border-t">
                <button
                  onClick={handleSave}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  변경사항 저장
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              왼쪽에서 조직을 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}