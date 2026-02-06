// src/components/admin/OrgStructureSettings.tsx
import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { 
  getOrgLevelTemplate, 
  saveOrgLevelTemplate,
  OrgLevelTemplate 
} from '../../lib/permissions';
import { Layers, Plus, Trash2, Save, AlertCircle, Check } from 'lucide-react';

interface LevelInput {
  level_order: number;
  level_name: string;
  level_code: string;
  is_required: boolean;
}

export default function OrgStructureSettings() {
  const { organizations } = useStore();
  const [companyId, setCompanyId] = useState<string>('');
  const [template, setTemplate] = useState<OrgLevelTemplate[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editedLevels, setEditedLevels] = useState<LevelInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (organizations.length > 0) {
      const firstOrg = organizations[0];
      setCompanyId(firstOrg.companyId || '');
    }
  }, [organizations]);

  useEffect(() => {
    const loadTemplate = async () => {
      if (!companyId) return;
      try {
        setLoading(true);
        const data = await getOrgLevelTemplate(companyId);
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
  }, [companyId]);

  const handleAddLevel = () => {
    const newOrder = editedLevels.length > 0 
      ? Math.max(...editedLevels.map(l => l.level_order)) + 1 
      : 1;
    setEditedLevels([...editedLevels, {
      level_order: newOrder, level_name: '', level_code: '', is_required: true
    }]);
  };

  const handleRemoveLevel = (index: number) => {
    setEditedLevels(editedLevels.filter((_, i) => i !== index));
  };

  const handleUpdateLevel = (index: number, field: keyof LevelInput, value: any) => {
    const updated = [...editedLevels];
    updated[index] = { ...updated[index], [field]: value };
    setEditedLevels(updated);
  };

  const handleSave = async () => {
    const hasEmpty = editedLevels.some(l => !l.level_name.trim() || !l.level_code.trim());
    if (hasEmpty) {
      alert('모든 레벨의 이름과 코드를 입력해주세요');
      return;
    }
    try {
      setLoading(true);
      await saveOrgLevelTemplate(companyId, editedLevels);
      const updated = await getOrgLevelTemplate(companyId);
      setTemplate(updated);
      setEditMode(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('저장에 실패했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedLevels(template.map(t => ({
      level_order: t.level_order, level_name: t.level_name,
      level_code: t.level_code, is_required: t.is_required
    })));
    setEditMode(false);
  };

  if (loading && template.length === 0) {
    return <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">조직 계층 구조 설정</h2>
          <p className="text-sm text-slate-600">회사의 조직 계층을 정의합니다</p>
        </div>
        {!editMode ? (
          <button onClick={() => setEditMode(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            수정하기
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleCancel} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium">취소</button>
            <button onClick={handleSave} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2">
              <Save className="w-4 h-4" />저장
            </button>
          </div>
        )}
      </div>

      {saveSuccess && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
          <Check className="w-5 h-5" /><span className="text-sm font-medium">성공적으로 저장되었습니다!</span>
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 조직 계층 구조</p>
            <ul className="space-y-1 text-xs">
              <li>• 2~7단계 자유롭게 설정 가능</li>
              <li>• 예: 전사 → 본부 → 팀 → 개인 (4단계)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {(editMode ? editedLevels : template).map((level, index) => (
          <div key={index} className="flex items-center gap-4 p-4 bg-white rounded-lg border-2 border-slate-200">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-blue-600">{level.level_order}</span>
            </div>
            {editMode ? (
              <>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">레벨 이름 *</label>
                    <input type="text" value={level.level_name}
                      onChange={(e) => handleUpdateLevel(index, 'level_name', e.target.value)}
                      placeholder="예: 본부, 팀" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">레벨 코드 *</label>
                    <input type="text" value={level.level_code}
                      onChange={(e) => handleUpdateLevel(index, 'level_code', e.target.value.toUpperCase())}
                      placeholder="예: DIVISION" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={level.is_required}
                    onChange={(e) => handleUpdateLevel(index, 'is_required', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm text-slate-700">필수</span>
                </label>
                <button onClick={() => handleRemoveLevel(index)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="삭제">
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
        ))}
        {editMode && (
          <button onClick={handleAddLevel} className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:text-blue-600">
            <Plus className="w-5 h-5" /><span className="font-medium">레벨 추가</span>
          </button>
        )}
      </div>
    </div>
  );
}