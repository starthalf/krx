// src/pages/OnboardingWizard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Building2, Layers } from 'lucide-react';

interface LevelPreset {
  id: string;
  name: string;
  description: string;
  levels: Array<{
    level_order: number;
    level_name: string;
    level_code: string;
    is_required: boolean;
  }>;
}

const PRESETS: LevelPreset[] = [
  {
    id: '3-level',
    name: '3단계 (스타트업)',
    description: '소규모 조직에 적합한 단순한 구조',
    levels: [
      { level_order: 1, level_name: '전사', level_code: 'COMPANY', is_required: true },
      { level_order: 2, level_name: '팀', level_code: 'TEAM', is_required: true },
      { level_order: 3, level_name: '개인', level_code: 'INDIVIDUAL', is_required: true },
    ]
  },
  {
    id: '4-level',
    name: '4단계 (일반 기업)',
    description: '중소기업에 가장 많이 사용되는 표준 구조',
    levels: [
      { level_order: 1, level_name: '전사', level_code: 'COMPANY', is_required: true },
      { level_order: 2, level_name: '본부', level_code: 'DIVISION', is_required: true },
      { level_order: 3, level_name: '팀', level_code: 'TEAM', is_required: true },
      { level_order: 4, level_name: '개인', level_code: 'INDIVIDUAL', is_required: true },
    ]
  },
  {
    id: '5-level',
    name: '5단계 (중견기업)',
    description: '중간 계층이 있는 구조',
    levels: [
      { level_order: 1, level_name: '전사', level_code: 'COMPANY', is_required: true },
      { level_order: 2, level_name: '본부', level_code: 'DIVISION', is_required: true },
      { level_order: 3, level_name: '실', level_code: 'DEPT', is_required: false },
      { level_order: 4, level_name: '팀', level_code: 'TEAM', is_required: true },
      { level_order: 5, level_name: '개인', level_code: 'INDIVIDUAL', is_required: true },
    ]
  },
  {
    id: '7-level',
    name: '7단계 (대기업)',
    description: '복잡한 대규모 조직 구조',
    levels: [
      { level_order: 1, level_name: '전사', level_code: 'COMPANY', is_required: true },
      { level_order: 2, level_name: '총괄본부', level_code: 'GROUP', is_required: true },
      { level_order: 3, level_name: '본부', level_code: 'DIVISION', is_required: true },
      { level_order: 4, level_name: '부문', level_code: 'DEPT', is_required: false },
      { level_order: 5, level_name: '실', level_code: 'OFFICE', is_required: false },
      { level_order: 6, level_name: '팀', level_code: 'TEAM', is_required: true },
      { level_order: 7, level_name: '개인', level_code: 'INDIVIDUAL', is_required: true },
    ]
  }
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState<LevelPreset | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectPreset = (preset: LevelPreset) => {
    setSelectedPreset(preset);
  };

  const handleComplete = async () => {
    if (!selectedPreset || !companyName.trim()) {
      alert('모든 정보를 입력해주세요');
      return;
    }

    try {
      setLoading(true);
      const { supabase } = await import('../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('User not found');

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('Company not found');

      const companyId = profile.company_id;

      const { saveOrgLevelTemplate } = await import('../lib/permissions');
      await saveOrgLevelTemplate(companyId, selectedPreset.levels);

      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('company_id', companyId)
        .eq('level', '전사')
        .single();

      if (!existingOrg) {
        await supabase
          .from('organizations')
          .insert({
            company_id: companyId,
            name: companyName,
            level: '전사',
            level_code: 'COMPANY',
            parent_org_id: null,
            org_type: 'Front',
            mission: `${companyName}의 비전과 미션을 달성합니다`
          });
      }

      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      navigate('/dashboard');
    } catch (error) {
      console.error('Onboarding failed:', error);
      alert('설정 중 오류가 발생했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">OKRio 초기 설정</h1>
          <p className="text-slate-600">
            {step === 1 && '조직 구조를 선택하여 시작하세요'}
            {step === 2 && '회사 정보를 입력하세요'}
          </p>
        </div>

        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {step > 1 ? <Check className="w-5 h-5" /> : '1'}
            </div>
            <div className={`w-24 h-1 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              2
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">조직 구조 선택</h2>
              <p className="text-slate-600 mb-6">회사에 가장 적합한 조직 계층 구조를 선택하세요</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-left p-6 rounded-xl border-2 transition-all ${
                      selectedPreset?.id === preset.id
                        ? 'border-blue-600 bg-blue-50 shadow-lg'
                        : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          selectedPreset?.id === preset.id ? 'bg-blue-100' : 'bg-slate-100'
                        }`}>
                          <Layers className={`w-5 h-5 ${
                            selectedPreset?.id === preset.id ? 'text-blue-600' : 'text-slate-600'
                          }`} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">{preset.name}</h3>
                      </div>
                      {selectedPreset?.id === preset.id && <Check className="w-6 h-6 text-blue-600" />}
                    </div>
                    <p className="text-sm text-slate-600 mb-4">{preset.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {preset.levels.map((level, idx) => (
                        <span key={idx} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded font-medium">
                          {level.level_name}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedPreset}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium flex items-center gap-2"
                >
                  다음 단계 <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">회사 정보 입력</h2>
              <p className="text-slate-600 mb-6">최상위 조직의 이름을 입력하세요</p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  회사명 (전사 조직 이름)
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: 데콘스타트업 주식회사"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg"
                />
              </div>

              {selectedPreset && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">
                    선택된 조직 구조: {selectedPreset.name}
                  </h4>
                  <div className="space-y-2">
                    {selectedPreset.levels.map((level, idx) => (
                      <div key={idx} className="flex items-center gap-3" style={{ marginLeft: `${idx * 20}px` }}>
                        <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-xs font-bold text-blue-600">
                          {level.level_order}
                        </div>
                        <span className="text-sm font-medium text-slate-700">{level.level_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                  이전
                </button>
                <button
                  onClick={handleComplete}
                  disabled={loading || !companyName.trim()}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {loading ? '설정 중...' : '완료'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 