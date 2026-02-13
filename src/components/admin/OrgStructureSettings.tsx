// src/components/admin/OrgStructureSettings.tsx
import { useEffect, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { 
  getOrgLevelTemplate, 
  OrgLevelTemplate 
} from '../../lib/permissions';
import { getMyRoleLevel } from '../../lib/permissions';
import { supabase } from '../../lib/supabase';
import { 
  Layers, Plus, Trash2, Save, AlertCircle, Check, Building2, 
  GripVertical, AlertTriangle, Wand2
} from 'lucide-react';

interface LevelInput {
  level_order: number;
  level_name: string;
  level_code: string;
  is_required: boolean;
}

interface Company {
  id: string;
  name: string;
}

// ─── 레벨 이름 → 코드 기본 매핑 ───────────────────────
const DEFAULT_LEVEL_CODES: Record<string, string> = {
  // 한글
  '전사': 'COMPANY',
  '회사': 'COMPANY',
  '그룹': 'GROUP',
  '부문': 'SECTOR',
  '사업부': 'BUSINESS_UNIT',
  '사업부문': 'BUSINESS_UNIT',
  '본부': 'DIVISION',
  '센터': 'CENTER',
  '연구소': 'LAB',
  '실': 'DEPARTMENT',
  '부': 'DEPARTMENT',
  '팀': 'TEAM',
  '파트': 'PART',
  '셀': 'CELL',
  '유닛': 'UNIT',
  '개인': 'INDIVIDUAL',
  '담당': 'INDIVIDUAL',
};

// 자동 코드 추천 함수
function getAutoCode(levelName: string): string | null {
  const trimmed = levelName.trim();
  
  // 정확히 일치하는 경우
  if (DEFAULT_LEVEL_CODES[trimmed]) {
    return DEFAULT_LEVEL_CODES[trimmed];
  }
  
  // 부분 일치 (예: "마케팅본부" → "본부" 매칭)
  for (const [name, code] of Object.entries(DEFAULT_LEVEL_CODES)) {
    if (trimmed.endsWith(name) || trimmed.includes(name)) {
      return code;
    }
  }
  
  return null;
}

export default function OrgStructureSettings() {
  const { organizations } = useStore();
  const [roleLevel, setRoleLevel] = useState<number>(0);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [template, setTemplate] = useState<OrgLevelTemplate[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editedLevels, setEditedLevels] = useState<LevelInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 역할 레벨 확인
  useEffect(() => {
    const checkRole = async () => {
      const level = await getMyRoleLevel();
      setRoleLevel(level);
    };
    checkRole();
  }, []);

  // 회사 목록 로딩
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        if (roleLevel >= 100) {
          const { data, error } = await supabase
            .from('companies')
            .select('id, name')
            .order('name');
          
          if (error) throw error;
          setCompanies(data || []);
          
          if (data && data.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(data[0].id);
          }
        } else {
          if (organizations.length > 0) {
            const myCompanyId = organizations[0].companyId;
            
            const { data, error } = await supabase
              .from('companies')
              .select('id, name')
              .eq('id', myCompanyId)
              .single();
            
            if (error) throw error;
            if (data) {
              setCompanies([data]);
              setSelectedCompanyId(data.id);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load companies:', error);
      }
    };

    if (roleLevel > 0) {
      loadCompanies();
    }
  }, [roleLevel, organizations]);

  // 템플릿 로딩
  useEffect(() => {
    const loadTemplate = async () => {
      if (!selectedCompanyId) return;
      try {
        setLoading(true);
        const data = await getOrgLevelTemplate(selectedCompanyId);
        setTemplate(data);
        setEditedLevels(data.map(t => ({
          level_order: t.level_order,
          level_name: t.level_name,
          level_code: t.level_code,
          is_required: t.is_required
        })));
      } catch (error) {
        console.error('Failed to load template:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTemplate();
  }, [selectedCompanyId]);

  // 레벨 추가
  const handleAddLevel = () => {
    const newOrder = editedLevels.length + 1;
    setEditedLevels([...editedLevels, {
      level_order: newOrder, 
      level_name: '', 
      level_code: '', 
      is_required: true
    }]);
  };

  // 레벨 삭제
  const handleRemoveLevel = (index: number) => {
    const updated = editedLevels.filter((_, i) => i !== index);
    // 순서 재정렬
    setEditedLevels(updated.map((level, i) => ({
      ...level,
      level_order: i + 1
    })));
  };

  // 레벨 수정
  const handleUpdateLevel = (index: number, field: keyof LevelInput, value: any) => {
    const updated = [...editedLevels];
    updated[index] = { ...updated[index], [field]: value };
    
    // 레벨 이름 변경 시 코드가 비어있으면 자동 추천
    if (field === 'level_name') {
      const autoCode = getAutoCode(value);
      if (autoCode && !updated[index].level_code) {
        updated[index].level_code = autoCode;
      }
    }
    
    setEditedLevels(updated);
  };

  // 레벨 이름에서 코드 자동 추천 (버튼 클릭)
  const handleAutoFillCode = (index: number) => {
    const level = editedLevels[index];
    const autoCode = getAutoCode(level.level_name);
    if (autoCode) {
      handleUpdateLevel(index, 'level_code', autoCode);
    } else {
      alert('인식할 수 없는 레벨 이름입니다.\n직접 코드를 입력해주세요.');
    }
  };

  // ─── 드래그 앤 드롭 핸들러 ───────────────────────────
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', ''); // Firefox 호환
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...editedLevels];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(dropIndex, 0, draggedItem);

    // 순서 재정렬
    setEditedLevels(updated.map((level, i) => ({
      ...level,
      level_order: i + 1
    })));

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // ─── 중복 코드 검사 ─────────────────────────────────
  const getDuplicateCodes = useCallback(() => {
    const codes = editedLevels.map(l => l.level_code.toUpperCase().trim()).filter(Boolean);
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
    return [...new Set(duplicates)];
  }, [editedLevels]);

  // ─── 저장 (직접 구현) ──────────────────────────────
  const handleSave = async () => {
    // 빈 값 검사
    const hasEmpty = editedLevels.some(l => !l.level_name.trim() || !l.level_code.trim());
    if (hasEmpty) {
      alert('모든 레벨의 이름과 코드를 입력해주세요');
      return;
    }

    // 중복 코드 검사
    const duplicates = getDuplicateCodes();
    if (duplicates.length > 0) {
      alert(`중복된 레벨 코드가 있습니다: ${duplicates.join(', ')}\n각 레벨은 고유한 코드를 가져야 합니다.`);
      return;
    }

    try {
      setLoading(true);

      // 1. 기존 템플릿 전체 삭제
      const { error: deleteError } = await supabase
        .from('org_level_templates')
        .delete()
        .eq('company_id', selectedCompanyId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw new Error('기존 데이터 삭제 실패: ' + deleteError.message);
      }

      // 2. 새 템플릿 삽입 (순서대로)
      const insertData = editedLevels.map((l, index) => ({
        company_id: selectedCompanyId,
        level_order: index + 1,
        level_name: l.level_name.trim(),
        level_code: l.level_code.toUpperCase().trim(),
        is_required: l.is_required
      }));

      const { error: insertError } = await supabase
        .from('org_level_templates')
        .insert(insertData);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error('새 데이터 저장 실패: ' + insertError.message);
      }

      // 3. 새로 로드
      const updated = await getOrgLevelTemplate(selectedCompanyId);
      setTemplate(updated);
      setEditedLevels(updated.map(t => ({
        level_order: t.level_order,
        level_name: t.level_name,
        level_code: t.level_code,
        is_required: t.is_required
      })));
      
      setEditMode(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Failed to save template:', error);
      alert('저장에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedLevels(template.map(t => ({
      level_order: t.level_order, 
      level_name: t.level_name,
      level_code: t.level_code, 
      is_required: t.is_required
    })));
    setEditMode(false);
  };

  const duplicateCodes = getDuplicateCodes();

  return (
    <div>
      {/* 회사 선택 (Super Admin만) */}
      {roleLevel >= 100 && companies.length > 1 && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <label className="block text-sm font-medium text-purple-900 mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            회사 선택 (Super Admin)
          </label>
          <select
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              setEditMode(false);
            }}
            className="w-full px-4 py-2 border border-purple-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          >
            <option value="">-- 회사를 선택하세요 --</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 현재 회사 표시 (Company Admin) */}
      {roleLevel >= 90 && roleLevel < 100 && companies.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-900">
            <Building2 className="w-5 h-5" />
            <span className="font-semibold">현재 회사: {companies[0].name}</span>
          </div>
        </div>
      )}

      {!selectedCompanyId ? (
        <div className="text-center py-20 bg-slate-50 rounded-lg border border-slate-200">
          <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">회사를 선택해주세요</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">조직 계층 구조 설정</h2>
              <p className="text-sm text-slate-600">회사의 조직 계층을 정의합니다 (드래그로 순서 변경)</p>
            </div>
            {!editMode ? (
              <button 
                onClick={() => setEditMode(true)} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                수정하기
              </button>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={handleCancel} 
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
                >
                  취소
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={loading || duplicateCodes.length > 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {loading ? '저장 중...' : '저장'}
                </button>
              </div>
            )}
          </div>

          {saveSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
              <Check className="w-5 h-5" />
              <span className="text-sm font-medium">성공적으로 저장되었습니다!</span>
            </div>
          )}

          {/* 중복 경고 */}
          {editMode && duplicateCodes.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">
                중복된 레벨 코드: {duplicateCodes.join(', ')} - 저장하기 전에 수정해주세요
              </span>
            </div>
          )}

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">💡 조직 계층 구조</p>
                <ul className="space-y-1 text-xs">
                  <li>• 2~7단계 자유롭게 설정 가능</li>
                  <li>• <strong>드래그 앤 드롭</strong>으로 순서를 쉽게 변경할 수 있습니다</li>
                  <li>• 레벨 이름 입력 시 코드가 자동으로 추천됩니다 (직접 수정 가능)</li>
                </ul>
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <p className="font-medium mb-1">기본 코드 매핑:</p>
                  <p className="text-xs text-blue-700">
                    전사=COMPANY, 부문=SECTOR, 본부=DIVISION, 실/부=DEPARTMENT, 팀=TEAM, 파트=PART, 개인=INDIVIDUAL
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {(editMode ? editedLevels : template).map((level, index) => {
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index;
              const isCodeDuplicate = editMode && duplicateCodes.includes(level.level_code.toUpperCase().trim());
              
              return (
                <div
                  key={index}
                  draggable={editMode}
                  onDragStart={(e) => editMode && handleDragStart(e, index)}
                  onDragOver={(e) => editMode && handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => editMode && handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-4 p-4 bg-white rounded-lg border-2 transition-all ${
                    isDragging 
                      ? 'opacity-50 border-blue-400 bg-blue-50' 
                      : isDragOver 
                        ? 'border-blue-500 border-dashed bg-blue-50'
                        : isCodeDuplicate
                          ? 'border-red-300 bg-red-50'
                          : 'border-slate-200'
                  } ${editMode ? 'cursor-move' : ''}`}
                >
                  {/* 드래그 핸들 */}
                  {editMode && (
                    <div className="text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-5 h-5" />
                    </div>
                  )}
                  
                  {/* 순서 번호 */}
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-blue-600">{index + 1}</span>
                  </div>
                  
                  {editMode ? (
                    <>
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">레벨 이름 *</label>
                          <input 
                            type="text" 
                            value={level.level_name}
                            onChange={(e) => handleUpdateLevel(index, 'level_name', e.target.value)}
                            placeholder="예: 본부, 팀" 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            레벨 코드 * 
                            {isCodeDuplicate && <span className="text-red-500 ml-1">(중복!)</span>}
                          </label>
                          <div className="flex gap-1">
                            <input 
                              type="text" 
                              value={level.level_code}
                              onChange={(e) => handleUpdateLevel(index, 'level_code', e.target.value.toUpperCase())}
                              placeholder="예: DIVISION" 
                              className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none ${
                                isCodeDuplicate ? 'border-red-400 bg-red-50' : 'border-slate-300'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleAutoFillCode(index)}
                              className="px-2 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-colors"
                              title="레벨 이름으로 코드 자동 추천"
                            >
                              <Wand2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                        <input 
                          type="checkbox" 
                          checked={level.is_required}
                          onChange={(e) => handleUpdateLevel(index, 'is_required', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded" 
                        />
                        <span className="text-sm text-slate-700">필수</span>
                      </label>
                      <button 
                        onClick={() => handleRemoveLevel(index)} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0" 
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{level.level_name}</div>
                        <div className="text-sm text-slate-500 mt-1">
                          코드: {level.level_code} • {level.is_required ? '필수' : '선택'}
                        </div>
                      </div>
                      <Layers className="w-5 h-5 text-slate-400" />
                    </>
                  )}
                </div>
              );
            })}
            
            {editMode && (
              <button 
                onClick={handleAddLevel} 
                className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">레벨 추가</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}