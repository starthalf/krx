// src/components/admin/OrgStructureManager.tsx
// 조직 구조 편집 기능 (AdminSettings에서 사용)
import { useState, useEffect, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Download, Upload, Bot, Loader2, Save,
  AlertCircle, Plus, Trash2, X, Building2, FolderPlus, Sparkles, Edit3, Users
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getOrgTypeColor } from '../../utils/helpers';
import { exportToExcel, readExcel } from '../../utils/excel';
import { supabase } from '../../lib/supabase';
import type { Organization } from '../../types';

const DEFAULT_LEVELS = ['전사', '본부', '팀'] as const;

function getChildLevel(parentLevel: string, levels: string[]): string {
  const idx = levels.indexOf(parentLevel);
  if (idx < 0 || idx >= levels.length - 1) return levels[levels.length - 1] || '팀';
  return levels[idx + 1];
}

export default function OrgStructureManager() {
  const {
    organizations, fetchOrganizations, addOrganization, updateOrganization,
    deleteOrganization, loading, company
  } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // ★ 실제 배정 인원수 (user_roles 기반)
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());

  // 동적 레벨 목록
  const [orgLevels, setOrgLevels] = useState<string[]>([...DEFAULT_LEVELS]);
  const [levelPriority, setLevelPriority] = useState<Record<string, number>>({});

  // 하위 조직 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [addParentOrg, setAddParentOrg] = useState<Organization | null>(null);
  const [newOrg, setNewOrg] = useState({ name: '', level: '팀', orgType: 'Middle' as string, mission: '' });
  const [addLoading, setAddLoading] = useState(false);

  // AI 자동생성 모달
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any[] | null>(null);
  const [aiApplying, setAiApplying] = useState(false);

  // 조직 계층 템플릿 로드
  useEffect(() => {
    loadOrgLevelTemplate();
  }, [company?.id]);

  const loadOrgLevelTemplate = async () => {
    const companyId = company?.id || organizations[0]?.companyId;
    if (!companyId) return;

    try {
      const { data, error } = await supabase
        .from('org_level_templates')
        .select('level_name, level_order, level_code')
        .eq('company_id', companyId)
        .order('level_order');

      if (error) throw error;
      if (data && data.length > 0) {
        const levels = data
          .filter(l => l.level_code !== 'INDIVIDUAL')
          .map(l => l.level_name);
        const priority: Record<string, number> = {};
        data.forEach(l => { priority[l.level_name] = l.level_order; });

        setOrgLevels(levels.length > 0 ? levels : [...DEFAULT_LEVELS]);
        setLevelPriority(priority);
      }
    } catch (err) {
      console.warn('조직 계층 템플릿 로드 실패:', err);
    }
  };

  // ★ 실제 배정 인원수 조회 (user_roles 기반)
  useEffect(() => {
    const fetchMemberCounts = async () => {
      if (organizations.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('org_id')
          .not('org_id', 'is', null);

        if (error) throw error;

        // org_id별로 카운트
        const counts = new Map<string, number>();
        (data || []).forEach((row: any) => {
          const orgId = row.org_id;
          if (orgId) {
            counts.set(orgId, (counts.get(orgId) || 0) + 1);
          }
        });

        setMemberCounts(counts);
      } catch (err) {
        console.error('Failed to fetch member counts:', err);
      }
    };

    fetchMemberCounts();
  }, [organizations]);

  // 초기 선택
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

  // 트리
  const toggleExpand = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) newExpanded.delete(orgId);
    else newExpanded.add(orgId);
    setExpandedOrgs(newExpanded);
  };

  const getChildOrgs = (parentId: string | null) =>
    organizations.filter(org => org.parentOrgId === parentId);

  const renderOrgTree = (org: Organization, level: number = 0) => {
    const children = getChildOrgs(org.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedOrgs.has(org.id);
    const isSelected = selectedOrgId === org.id;
    const actualMemberCount = memberCounts.get(org.id) || 0; // ★ 실제 인원수

    return (
      <div key={org.id}>
        <div
          onClick={() => setSelectedOrgId(org.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
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
              {/* ★ 수정: headcount 대신 실제 배정 인원수 */}
              <span className="text-xs text-slate-500">{actualMemberCount}명</span>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); openAddModal(org); }}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
            title="하위 조직 추가"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div>{children.map(child => renderOrgTree(child, level + 1))}</div>
        )}
      </div>
    );
  };

  const rootOrgs = organizations.filter(org => org.parentOrgId === null);

  // 저장
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
    setEditMode(false);
    alert('✅ 조직 정보가 저장되었습니다');
  };

  // 조직 삭제
  const handleDelete = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (!org) return;

    const children = getChildOrgs(orgId);
    if (children.length > 0) {
      alert('❌ 하위 조직이 있는 조직은 삭제할 수 없습니다.\n하위 조직을 먼저 삭제해주세요.');
      return;
    }

    if (!confirm(`"${org.name}" 조직을 삭제하시겠습니까?\n\n삭제하면 복구할 수 없습니다.`)) return;

    await deleteOrganization(orgId);
    if (selectedOrgId === orgId) {
      const root = organizations.find(o => !o.parentOrgId && o.id !== orgId);
      setSelectedOrgId(root?.id || null);
    }
    alert('✅ 조직이 삭제되었습니다');
  };

  // 하위 조직 추가
  const openAddModal = (parentOrg: Organization) => {
    setAddParentOrg(parentOrg);
    const childLevel = getChildLevel(parentOrg.level, orgLevels);
    setNewOrg({ name: '', level: childLevel, orgType: parentOrg.orgType || 'Middle', mission: '' });
    setShowAddModal(true);
  };

  const handleAddOrg = async () => {
    if (!addParentOrg || !newOrg.name.trim()) return;
    setAddLoading(true);
    try {
      const companyId = addParentOrg.companyId || company?.id;
      if (!companyId) throw new Error('회사 정보를 찾을 수 없습니다');

      await addOrganization({
        companyId,
        name: newOrg.name.trim(),
        level: newOrg.level,
        parentOrgId: addParentOrg.id,
        orgType: newOrg.orgType as any,
        mission: newOrg.mission,
        functionTags: [],
        headcount: 0,
      });

      setExpandedOrgs(prev => new Set([...prev, addParentOrg.id]));
      setShowAddModal(false);
      alert('✅ 하위 조직이 추가되었습니다');
    } catch (err: any) {
      alert(`추가 실패: ${err.message}`);
    } finally {
      setAddLoading(false);
    }
  };

  // AI 자동생성
  const handleAIGenerate = () => {
    setAiPrompt('');
    setAiResult(null);
    setShowAIModal(true);
  };

  const handleAIRequest = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const rootOrg = organizations.find(o => !o.parentOrgId);
      const companyName = rootOrg?.name || company?.name || '회사';
      const industry = company?.industry || '';
      const existingOrgs = organizations.map(o =>
        `- ${o.name} (${o.level}, ${o.orgType}${o.parentOrgId ? ', 상위: ' + organizations.find(p => p.id === o.parentOrgId)?.name : ''})`
      ).join('\n');

      const prompt = `당신은 한국 기업의 조직 구조 전문가입니다.

회사명: ${companyName}
업종: ${industry || '미지정'}
사용자 요청: ${aiPrompt || '일반적인 조직 구조를 추천해주세요'}

현재 조직:
${existingOrgs || '(없음 - 전사 조직만 있음)'}

위 정보를 바탕으로 추가할 하위 조직 구조를 JSON 배열로 제안하세요.
각 조직은 다음 형식입니다:
[
  { "name": "조직명", "level": "본부|실|팀", "orgType": "Front|Middle|Back", "parentName": "상위조직명", "mission": "미션" }
]

규칙:
- 전사 하위에 본부/부문을 먼저 배치
- 본부 하위에 팀을 배치
- orgType은 Front(영업/마케팅 등 매출 직접 기여), Middle(기획/개발/생산 등 가치 창출), Back(인사/재무/총무 등 지원)
- 업종에 맞는 현실적인 조직명 사용
- 이미 존재하는 조직은 중복 생성하지 않음
- JSON 배열만 출력, 다른 텍스트 없이`;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { prompt, max_tokens: 2000 }
      });

      if (error) throw error;

      const responseText = data?.response || data?.content || '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('유효한 조직 데이터가 없습니다');

      setAiResult(parsed);
    } catch (err: any) {
      console.error('AI 생성 실패:', err);
      alert(`AI 생성 실패: ${err.message}\n\n수동으로 조직을 추가해주세요.`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIApply = async () => {
    if (!aiResult || aiResult.length === 0) return;
    setAiApplying(true);

    try {
      const companyId = organizations[0]?.companyId || company?.id;
      if (!companyId) throw new Error('회사 정보를 찾을 수 없습니다');

      const nameToId = new Map<string, string>();
      organizations.forEach(o => nameToId.set(o.name, o.id));

      const sorted = [...aiResult].sort((a, b) =>
        (levelPriority[a.level] ?? 99) - (levelPriority[b.level] ?? 99)
      );

      let successCount = 0;
      for (const item of sorted) {
        if (nameToId.has(item.name)) continue;

        const parentId = nameToId.get(item.parentName) || null;
        if (!parentId && item.parentName) {
          console.warn(`상위 조직 '${item.parentName}'을 찾을 수 없어 건너뜁니다: ${item.name}`);
          continue;
        }

        const { data, error } = await supabase
          .from('organizations')
          .insert({
            company_id: companyId,
            name: item.name,
            level: item.level || '팀',
            parent_org_id: parentId,
            org_type: item.orgType || 'Middle',
            mission: item.mission || '',
            function_tags: [],
            headcount: 0,
            sort_order: 99,
          })
          .select()
          .single();

        if (!error && data) {
          nameToId.set(data.name, data.id);
          successCount++;
        } else {
          console.warn(`조직 생성 실패 (${item.name}):`, error);
        }
      }

      await fetchOrganizations(companyId);
      setExpandedOrgs(new Set(organizations.map(o => o.id)));
      setShowAIModal(false);
      alert(`✅ ${successCount}개 조직이 생성되었습니다!`);
    } catch (err: any) {
      alert(`적용 실패: ${err.message}`);
    } finally {
      setAiApplying(false);
    }
  };

  // 엑셀
  const handleDownloadTemplate = () => {
    const inputSheet = [
      { 조직명: '제품개발본부', 상위조직명: '', 레벨: '본부', 유형: 'Middle', 미션: '최고의 제품 개발', 기능태그: '기획, 개발, 디자인', 인원수: 50 },
      { 조직명: '모바일개발팀', 상위조직명: '제품개발본부', 레벨: '팀', 유형: 'Middle', 미션: '모바일 앱 고도화', 기능태그: 'iOS, Android', 인원수: 10 },
    ];
    const guideSheet = [
      { 항목: '조직명', 설명: '조직의 이름을 입력합니다. (중복 불가)' },
      { 항목: '상위조직명', 설명: '바로 위 상위 조직의 이름을 정확히 입력하세요. (루트 조직인 경우 비워둠)' },
      { 항목: '레벨', 설명: '전사 > 부문 > 본부 > 실 > 팀' },
      { 항목: '유형', 설명: 'Front(영업/마케팅), Middle(기획/개발), Back(인사/재무)' },
      { 항목: '기능태그', 설명: '쉼표(,)로 구분하여 핵심 기능을 입력' },
    ];
    exportToExcel({ '조직데이터(입력용)': inputSheet, '작성가이드(참고용)': guideSheet }, '조직일괄등록_템플릿');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('기존 조직 데이터에 추가됩니다. 진행하시겠습니까?')) { e.target.value = ''; return; }

    setIsUploading(true);
    try {
      const jsonData = await readExcel(file);
      const companyId = organizations[0]?.companyId;
      if (!companyId) throw new Error('기준 회사 정보를 찾을 수 없습니다.');

      const allowedTypes = ['Front', 'Middle', 'Back'];
      const errors: string[] = [];
      jsonData.forEach((row: any, index: number) => {
        if (row['유형'] && !allowedTypes.includes(row['유형'])) {
          errors.push(`${index + 2}행: 유형 '${row['유형']}'은(는) 유효하지 않습니다.`);
        }
        if (!row['조직명']) errors.push(`${index + 2}행: 조직명이 비어있습니다.`);
      });
      if (errors.length > 0) {
        alert(`❌ 오류:\n\n${errors.slice(0, 5).join('\n')}`);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const sortedRows = jsonData.sort((a: any, b: any) =>
        (levelPriority[a['레벨']] ?? 99) - (levelPriority[b['레벨']] ?? 99)
      );

      const orgNameMap = new Map<string, string>();
      organizations.forEach(org => orgNameMap.set(org.name, org.id));
      let successCount = 0;

      for (const row of sortedRows) {
        const orgName = row['조직명']?.trim();
        if (!orgName || orgNameMap.has(orgName)) continue;

        let parentId: string | null = null;
        const parentName = row['상위조직명']?.trim();
        if (parentName) {
          parentId = orgNameMap.get(parentName) || null;
        }

        const { data, error } = await supabase
          .from('organizations')
          .insert({
            company_id: companyId,
            name: orgName,
            level: row['레벨'] || '팀',
            parent_org_id: parentId,
            org_type: row['유형'] || 'Middle',
            mission: row['미션'] || '',
            function_tags: row['기능태그'] ? row['기능태그'].split(',').map((t: string) => t.trim()) : [],
            headcount: row['인원수'] || 0,
            sort_order: 99
          })
          .select()
          .single();

        if (!error && data) {
          orgNameMap.set(data.name, data.id);
          successCount++;
        }
      }

      alert(`✅ ${successCount}개 조직이 업로드되었습니다!`);
      await fetchOrganizations(companyId);
    } catch (error: any) {
      alert(`업로드 실패: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 로딩/빈 상태
  if (loading && organizations.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!loading && organizations.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-2">조직 구조 편집</h2>
          <p className="text-sm text-slate-600">조직을 추가하고 계층 구조를 설정합니다.</p>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <Building2 className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
          <p className="text-yellow-800 font-medium mb-2">조직 데이터가 없습니다</p>
          <p className="text-sm text-yellow-600 mb-4">AI로 자동 생성하거나 엑셀로 일괄 등록하세요</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleAIGenerate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
            >
              <Bot className="w-4 h-4" /> AI 자동생성
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> 엑셀 템플릿
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">조직 구조 편집</h2>
          <p className="text-sm text-slate-600">{organizations.length}개 조직</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" hidden />
          <button onClick={handleDownloadTemplate}
            className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> 템플릿
          </button>
          <button onClick={handleUploadClick} disabled={isUploading}
            className="px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm flex items-center gap-2 disabled:opacity-50">
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            업로드
          </button>
          <button onClick={handleAIGenerate}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2">
            <Bot className="w-4 h-4" /> AI 생성
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 왼쪽: 조직 트리 */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 max-h-[500px] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 text-sm">조직 트리</h3>
            {rootOrgs.length > 0 && (
              <button
                onClick={() => openAddModal(rootOrgs[0])}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 추가
              </button>
            )}
          </div>
          {rootOrgs.map(rootOrg => renderOrgTree(rootOrg))}
        </div>

        {/* 오른쪽: 상세 편집 */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 max-h-[500px] overflow-y-auto">
          {selectedOrg ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">조직 정보</h3>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`px-2 py-1 text-xs rounded ${editMode ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}
                >
                  <Edit3 className="w-3 h-3 inline mr-1" />
                  {editMode ? '편집 중' : '편집'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">조직명</label>
                <input type="text" value={selectedOrg.name}
                  onChange={(e) => editMode && updateOrganization(selectedOrg.id, { name: e.target.value })}
                  disabled={!editMode}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-white disabled:cursor-default"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">레벨</label>
                  <select value={selectedOrg.level}
                    onChange={(e) => editMode && updateOrganization(selectedOrg.id, { level: e.target.value as any })}
                    disabled={!editMode}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-white disabled:cursor-default">
                    {orgLevels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">유형</label>
                  <select value={selectedOrg.orgType}
                    onChange={(e) => editMode && updateOrganization(selectedOrg.id, { orgType: e.target.value as any })}
                    disabled={!editMode}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-white disabled:cursor-default">
                    <option value="Front">Front</option>
                    <option value="Middle">Middle</option>
                    <option value="Back">Back</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">미션</label>
                <textarea value={selectedOrg.mission || ''} rows={2}
                  onChange={(e) => editMode && updateOrganization(selectedOrg.id, { mission: e.target.value })}
                  disabled={!editMode}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none disabled:bg-white disabled:cursor-default"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">기능 태그</label>
                <input type="text" placeholder="쉼표로 구분"
                  value={(selectedOrg.functionTags || []).join(', ')}
                  onChange={(e) => editMode && updateOrganization(selectedOrg.id, {
                    functionTags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                  disabled={!editMode}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-white disabled:cursor-default"
                />
              </div>

              {/* ★ 수정: 인원수를 실제 배정 인원으로 표시 (읽기 전용) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">인원수</label>
                <div className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-900">{memberCounts.get(selectedOrg.id) || 0}명</span>
                  <span className="text-xs text-slate-400">(역할 배정 기준)</span>
                </div>
              </div>

              {editMode && (
                <div className="pt-3 border-t space-y-2">
                  <button onClick={handleSave}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> 저장
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => openAddModal(selectedOrg)}
                      className="flex-1 px-3 py-2 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 text-xs flex items-center justify-center gap-1">
                      <FolderPlus className="w-3.5 h-3.5" /> 하위 추가
                    </button>
                    {selectedOrg.parentOrgId && (
                      <button onClick={() => handleDelete(selectedOrg.id)}
                        className="px-3 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-xs flex items-center justify-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> 삭제
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
              왼쪽에서 조직을 선택하세요
            </div>
          )}
        </div>
      </div>

      {/* 도움말 */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
        <p className="text-xs text-blue-700">
          <span className="font-medium">💡 도움말</span>{' '}
          조직을 추가, 수정, 삭제하거나 AI로 자동 생성할 수 있습니다.
        </p>
      </div>

      {/* 하위 조직 추가 모달 */}
      {showAddModal && addParentOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">하위 조직 추가</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm">
              <span className="text-slate-500">상위 조직:</span>{' '}
              <span className="font-medium text-slate-900">{addParentOrg.name}</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">조직명 *</label>
                <input type="text" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  placeholder="예: 마케팅팀"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">레벨</label>
                  <select value={newOrg.level} onChange={(e) => setNewOrg({ ...newOrg, level: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    {orgLevels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">유형</label>
                  <select value={newOrg.orgType} onChange={(e) => setNewOrg({ ...newOrg, orgType: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                    <option value="Front">Front</option>
                    <option value="Middle">Middle</option>
                    <option value="Back">Back</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">미션 (선택)</label>
                <input type="text" value={newOrg.mission} onChange={(e) => setNewOrg({ ...newOrg, mission: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleAddOrg} disabled={addLoading || !newOrg.name.trim()}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                추가
              </button>
              <button onClick={() => setShowAddModal(false)}
                className="px-4 border border-slate-300 text-slate-600 rounded-lg py-2.5 hover:bg-slate-50">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 자동생성 모달 */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">AI 조직 구조 생성</h3>
              </div>
              <button onClick={() => setShowAIModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!aiResult ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    어떤 조직 구조가 필요한가요? (선택)
                  </label>
                  <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="예: IT 스타트업에 맞는 조직 구조를 만들어줘"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" rows={3} />
                </div>

                <button onClick={handleAIRequest} disabled={aiLoading}
                  className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> 생성 중...</> : <><Sparkles className="w-4 h-4" /> 생성</>}
                </button>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">AI 제안 ({aiResult.length}개)</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {aiResult.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 text-sm">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{item.name}</div>
                          <div className="text-xs text-slate-500">{item.level} · {item.orgType}</div>
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded border ${getOrgTypeColor(item.orgType)}`}>
                          {item.orgType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleAIApply} disabled={aiApplying}
                    className="flex-1 bg-green-600 text-white rounded-lg py-2.5 font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {aiApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    적용
                  </button>
                  <button onClick={() => setAiResult(null)} className="px-4 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50">
                    다시
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}