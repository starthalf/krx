import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Download, Upload, Bot, Loader2, Save, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getOrgTypeColor } from '../utils/helpers';
import { exportToExcel, readExcel } from '../utils/excel';
import { supabase } from '../lib/supabase';
import type { Organization } from '../types';

export default function OrganizationPage() {
  const { organizations, fetchOrganizations, updateOrganization, loading } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);

  // [기존 코드 유지] 초기 선택 로직
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

  // [기존 코드 유지] 트리 토글
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
  // [개선된] 엑셀 기능 구현
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // [개선된] 엑셀 기능 구현
  // ------------------------------------------------------------------

  const handleDownloadTemplate = () => {
    // 1. 입력 시트 (사용자가 데이터를 넣을 곳)
    const inputSheet = [
      {
        조직명: '제품개발본부',
        상위조직명: '테크스타트업(전사)', 
        레벨: '본부',
        유형: 'Middle',
        미션: '최고의 제품 개발',
        기능태그: '기획, 개발, 디자인',
        인원수: 50
      },
      {
        조직명: '모바일개발팀',
        상위조직명: '제품개발본부',
        레벨: '팀',
        유형: 'Middle',
        미션: '모바일 앱 고도화',
        기능태그: 'iOS, Android',
        인원수: 10
      }
    ];

    // 2. 가이드 시트 (설명서)
    const guideSheet = [
      { 항목: '조직명', 설명: '조직의 이름을 입력합니다. (중복 불가)' },
      { 항목: '상위조직명', 설명: '바로 위 상위 조직의 이름을 정확히 입력하세요. (루트 조직인 경우 비워둠)' },
      { 항목: '레벨', 설명: '조직의 위계를 입력합니다. (전사 > 부문 > 본부 > 실 > 팀)' },
      { 항목: '유형 (중요!)', 설명: 'Front: 영업/마케팅 등 직접 매출 부서\nMiddle: 기획/개발/디자인 등 가치 창출 부서\nBack: 인사/총무/재무 등 지원 부서' },
      { 항목: '기능태그', 설명: '쉼표(,)로 구분하여 핵심 기능을 입력합니다. (예: 기획, 개발)' },
      { 항목: '주의사항', 설명: '입력 시트(첫 번째 시트)의 데이터만 업로드됩니다.' }
    ];

    // 두 시트를 묶어서 엑셀 생성
    exportToExcel(
      {
        '조직데이터(입력용)': inputSheet,
        '작성가이드(참고용)': guideSheet
      }, 
      '조직일괄등록_템플릿'
    );
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 레벨 정렬을 위한 우선순위 맵
  const levelPriority: Record<string, number> = {
    '전사': 0,
    '부문': 1,
    '본부': 2,
    '실': 3,
    '팀': 4
  };

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
      const companyId = organizations[0]?.companyId;
      if (!companyId) throw new Error('기준 회사 정보를 찾을 수 없습니다.');

      // 1. 유효성 검사 (Validation)
      const allowedTypes = ['Front', 'Middle', 'Back'];
      const errors: string[] = [];
      
      jsonData.forEach((row: any, index) => {
        if (row['유형'] && !allowedTypes.includes(row['유형'])) {
          errors.push(`${index + 2}행: 유형 '${row['유형']}'은(는) 유효하지 않습니다. (Front, Middle, Back 중 하나여야 함)`);
        }
        if (!row['조직명']) {
          errors.push(`${index + 2}행: 조직명이 비어있습니다.`);
        }
      });

      if (errors.length > 0) {
        alert(`❌ 다음 오류를 수정하고 다시 업로드해주세요:\n\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // 2. 레벨 순서대로 정렬 (상위 조직 먼저 생성하기 위해)
      const sortedRows = jsonData.sort((a: any, b: any) => {
        const priorityA = levelPriority[a['레벨']] ?? 99;
        const priorityB = levelPriority[b['레벨']] ?? 99;
        return priorityA - priorityB;
      });

      // 3. 순차적 처리 (부모 조직 ID 매핑을 위해)
      // 기존 조직 맵 생성 (이름 -> ID)
      const orgNameMap = new Map<string, string>();
      organizations.forEach(org => orgNameMap.set(org.name, org.id));

      let successCount = 0;

      for (const row of sortedRows) {
        const orgName = row['조직명'];
        
        // 이미 존재하면 ID만 맵에 업데이트하고 스킵 (중복 방지)
        if (orgNameMap.has(orgName)) {
          console.log(`Skip existing: ${orgName}`);
          continue;
        }

        // 부모 조직 ID 찾기 (기존 DB 또는 방금 맵에 추가된 조직에서 검색)
        const parentName = row['상위조직명'];
        let parentId = null;
        
        if (parentName) {
          parentId = orgNameMap.get(parentName) || null;
          if (!parentId) {
            console.warn(`Parent not found for ${orgName}: ${parentName}`);
            // 부모를 못 찾으면 루트로 둘지, 에러를 낼지 결정. 여기서는 루트로 둠.
          }
        }

        // DB Insert
        const { data, error } = await supabase
          .from('organizations')
          .insert({
            company_id: companyId,
            name: orgName,
            level: row['레벨'] || '팀',
            parent_org_id: parentId,
            org_type: row['유형'] || 'Middle',
            mission: row['미션'] || '',
            function_tags: row['기능태그'] ? row['기능태그'].split(',').map((t:string) => t.trim()) : [],
            headcount: row['인원수'] || 0,
            sort_order: 99
          })
          .select()
          .single();

        if (error) {
          console.error(`Failed to insert ${orgName}:`, error);
        } else if (data) {
          // 성공 시 맵에 추가 (다음 하위 조직이 이 ID를 참조할 수 있게 됨)
          orgNameMap.set(data.name, data.id);
          successCount++;
        }
      }

      alert(`✅ ${successCount}개 조직이 성공적으로 업로드되었습니다!`);
      await fetchOrganizations(companyId); // 목록 새로고침

    } catch (error: any) {
      console.error('Upload Error:', error);
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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