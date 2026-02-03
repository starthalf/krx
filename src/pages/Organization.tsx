// src/pages/Organization.tsx
import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Download, Upload, Bot, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getOrgTypeColor } from '../utils/helpers';
import type { Organization } from '../types';

export default function OrganizationPage() {
  // Store에서 상태와 액션 가져오기
  const { organizations, updateOrganization, loading } = useStore();
  
  // 선택된 조직 ID (초기값은 null로 설정 후 useEffect에서 첫 번째 조직 선택)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // 데이터 로딩 완료 시 첫 번째 조직 자동 선택
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      const rootOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
      setSelectedOrgId(rootOrg.id);
      setExpandedOrgs(new Set([rootOrg.id])); // 루트 조직 펼치기
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);

  // 트리 구조 토글
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

  // 재귀적 트리 렌더링
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
            <button onClick={(e) => { e.stopPropagation(); toggleExpand(org.id); }} className="p-0.5">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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

  const rootOrg = organizations.find(org => org.parentOrgId === null) || organizations[0];

  // 저장 핸들러 (실제 동작)
  const handleSave = async () => {
    if (!selectedOrg) return;
    // updateOrganization은 내부적으로 Supabase 호출 및 State 업데이트 수행
    await updateOrganization(selectedOrg.id, {
        name: selectedOrg.name,
        // 필요한 다른 필드들이 이미 store에 변경되어 있다면 여기서 호출만 해도 됨
        // 하지만 input onChange에서 즉시 store를 업데이트하고 있으므로,
        // 사실 별도의 "저장" 버튼 없이도 업데이트는 되지만, UX상 확인을 위해 남겨둠
    });
    alert('조직 정보가 저장되었습니다');
  };

  // 로딩 화면 처리
  if (loading && organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">조직 관리</h1>
          <p className="text-slate-600 mt-1">조직도 편집 및 관리</p>
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
          {organizations.length > 0 ? (
             rootOrg ? renderOrgTree(rootOrg) : <div>데이터 구조 오류</div>
          ) : (
             <div className="text-center text-slate-500 py-10">등록된 조직이 없습니다.</div>
          )}
        </div>

        {/* 오른쪽: 상세 정보 수정 */}
        <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-6 overflow-y-auto">
          {selectedOrg ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <input
                  type="text"
                  value={selectedOrg.name}
                  // onChange에서는 로컬 UI 반응성을 위해 store 업데이트
                  onChange={(e) => updateOrganization(selectedOrg.id, { name: e.target.value })}
                  className="text-2xl font-bold text-slate-900 border-b-2 border-transparent hover:border-slate-300 focus:border-blue-600 outline-none px-2 -mx-2"
                />
              </div>

              <div className="space-y-6">
                {/* 조직 레벨 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    조직 레벨
                  </label>
                  <select
                    value={selectedOrg.level}
                    onChange={(e) => updateOrganization(selectedOrg.id, { level: e.target.value as any })}
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
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-medium text-sm">{type} Office</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {type === 'Front' && '고객 대면'}
                          {type === 'Middle' && '핵심 업무'}
                          {type === 'Back' && '지원 업무'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 고유 미션 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    고유 미션
                  </label>
                  <textarea
                    value={selectedOrg.mission}
                    onChange={(e) => updateOrganization(selectedOrg.id, { mission: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    rows={3}
                  />
                </div>

                {/* 핵심 기능 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    핵심 기능
                  </label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {selectedOrg.functionTags.map((tag, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="쉼표로 구분하여 입력 후 엔터"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.currentTarget;
                        const newTags = input.value.split(',').map(t => t.trim()).filter(t => t);
                        if (newTags.length > 0) {
                          updateOrganization(selectedOrg.id, {
                            functionTags: [...selectedOrg.functionTags, ...newTags]
                          });
                          input.value = '';
                        }
                      }
                    }}
                  />
                </div>

                {/* 인원 규모 */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    인원 규모
                  </label>
                  <input
                    type="number"
                    value={selectedOrg.headcount}
                    onChange={(e) => updateOrganization(selectedOrg.id, { headcount: parseInt(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    💾 저장 완료
                  </button>
                  <button className="px-6 bg-red-50 text-red-600 rounded-lg py-3 font-medium hover:bg-red-100 transition-colors">
                    🗑️ 삭제
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              조직을 선택해주세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}