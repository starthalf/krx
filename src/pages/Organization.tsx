import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Download, Upload, Bot, Loader2, Save } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getOrgTypeColor } from '../utils/helpers';
import { exportToExcel, readExcel } from '../utils/excel'; // [New] 엑셀 유틸
import { supabase } from '../lib/supabase';
import type { Organization } from '../types';

export default function OrganizationPage() {
  const { organizations, fetchOrganizations, updateOrganization, loading } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null); // [New] 파일 입력 참조
  
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  // [기존 코드 유지] 첫 번째 조직 자동 선택
  useEffect(() => {
    if (organizations.length > 0 && !selectedOrgId) {
      const rootOrg = organizations.find(o => !o.parentOrgId) || organizations[0];
      if (rootOrg) {
        setSelectedOrgId(rootOrg.id);
        setExpandedOrgs(new Set([rootOrg.id]));
      }
    }
  }, [organizations, selectedOrgId]);

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);

  // [기존 코드 유지] 트리 확장 토글
  const toggleExpand = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  // [기존 코드 유지] 자식 조직 찾기
  const getChildOrgs = (parentId: string | null) => {
    return organizations.filter(org => org.parentOrgId === parentId);
  };

  // [기존 코드 유지] 트리 렌더링
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

  // [기존 코드 유지] 저장 핸들러
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

  // ------------------------------------------------------------------
  // [New] 엑셀 기능 구현
  // ------------------------------------------------------------------

  // 1. 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const template = [
      {
        조직명: '신규팀',
        상위조직명: '제품개발본부', // 상위 조직 이름을 적으면 ID를 찾아 연결
        레벨: '팀', // 전사, 부문, 본부, 실, 팀
        유형: 'Middle', // Front, Middle, Back
        미션: '팀의 미션을 입력하세요',
        기능태그: '기획, 개발',
        인원수: 5
      },
      {
        조직명: '디자인실',
        상위조직명: '테크스타트업(전사)',
        레벨: '실',
        유형: 'Middle',
        미션: '사용자 경험 혁신',
        기능태그: 'UI, UX, BX',
        인원수: 10
      }
    ];
    exportToExcel(template, '조직일괄등록_템플릿');
  };

  // 2. 파일 선택 트리거
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 3. 파일 업로드 및 데이터 처리
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('기존 조직 데이터에 추가됩니다. 진행하시겠습니까?')) {
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const jsonData = await readExcel(file);
      console.log('Parsed Excel:', jsonData);

      // (1) 회사 ID 가져오기 (현재 조직들의 회사 ID 사용)
      const companyId = organizations[0]?.companyId;
      if (!companyId) throw new Error('기준 회사 정보를 찾을 수 없습니다.');

      // (2) 데이터 변환 및 부모 조직 연결
      // 주의: 부모 조직 ID를 찾기 위해 이름 매핑을 시도합니다.
      // 실제로는 더 복잡한 로직(부모가 엑셀 안에 있는 경우 등)이 필요하지만, 
      // 여기서는 "이미 존재하는 조직" 또는 "루트"만 처리합니다.
      
      const newOrgs = jsonData.map((row: any) => {
        // 상위 조직 찾기
        const parentName = row['상위조직명'];
        const parent = organizations.find(o => o.name === parentName);
        
        return {
          company_id: companyId,
          name: row['조직명'],
          level: row['레벨'] || '팀',
          parent_org_id: parent ? parent.id : null, // 부모 못 찾으면 루트가 됨 (주의)
          org_type: row['유형'] || 'Middle',
          mission: row['미션'] || '',
          function_tags: row['기능태그'] ? row['기능태그'].split(',').map((t:string) => t.trim()) : [],
          headcount: row['인원수'] || 0,
          sort_order: 99
        };
      });

      // (3) Supabase Insert
      const { error } = await supabase.from('organizations').insert(newOrgs);
      if (error) throw error;

      alert(`✅ ${newOrgs.length}개 조직이 성공적으로 업로드되었습니다!`);
      await fetchOrganizations(companyId); // 목록 새로고침

    } catch (error: any) {
      console.error('Upload Error:', error);
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ------------------------------------------------------------------

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
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800 mb-2">조직 데이터가 없습니다</p>
          <p className="text-sm text-yellow-600">Supabase에서 시드 데이터를 삽입해주세요</p>
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
          {/* [New] 숨겨진 파일 입력 */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".xlsx, .xls" 
            hidden 
          />

          <button 
            onClick={handleDownloadTemplate}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            엑셀 템플릿
          </button>
          <button 
            onClick={handleUploadClick}
            disabled={isUploading}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? '업로드 중...' : '일괄 업로드'}
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