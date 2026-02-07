// src/pages/OnboardingWizard.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Layers, Target, Building2 } from 'lucide-react';

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
    description: '복잡한 계층 구조를 가진 대규모 조직',
    levels: [
      { level_order: 1, level_name: '전사', level_code: 'COMPANY', is_required: true },
      { level_order: 2, level_name: '사업부', level_code: 'BU', is_required: false },
      { level_order: 3, level_name: '본부', level_code: 'DIVISION', is_required: true },
      { level_order: 4, level_name: '실', level_code: 'DEPT', is_required: false },
      { level_order: 5, level_name: '팀', level_code: 'TEAM', is_required: true },
      { level_order: 6, level_name: '파트', level_code: 'PART', is_required: false },
      { level_order: 7, level_name: '개인', level_code: 'INDIVIDUAL', is_required: true },
    ]
  }
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      // 프로필에서 company_id 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) {
        alert('회사 정보를 찾을 수 없습니다.');
        navigate('/login');
        return;
      }

      // 회사 정보 조회
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      setCompany(companyData);
    } catch (error) {
      console.error('Failed to load company:', error);
      alert('회사 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (selectedTemplate === null || !company) {
      alert('조직 구조를 선택해주세요');
      return;
    }

    try {
      setSaving(true);
      const { supabase } = await import('../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const preset = PRESETS[selectedTemplate];

      // 1. 조직 템플릿 저장
      const templates = preset.levels.map(level => ({
        company_id: company.id,
        ...level
      }));

      const { error: templateError } = await supabase
        .from('org_level_templates')
        .insert(templates);

      if (templateError) throw templateError;

      // 2. 전사 조직 생성 (최상위 조직)
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({
          company_id: company.id,
          name: company.name, // 회사명 사용
          level: '전사',
          level_code: 'COMPANY',
          parent_org_id: null,
          org_type: 'Front',
          mission: `${company.name}의 비전과 미션을 달성합니다`
        });

      if (orgError) throw orgError;

      // 3. 온보딩 완료 플래그 설정
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 4. 완료 → 대시보드로
      alert('조직 구조 설정이 완료되었습니다!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      alert('설정 저장에 실패했습니다: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 max-w-md text-center">
          <p className="text-red-600">회사 정보를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <Target className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {company.name} 초기 설정
          </h1>
          <p className="text-slate-600">
            조직 구조를 선택하여 OKR 관리를 시작하세요
          </p>
        </div>

        {/* 회사 정보 카드 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">회사 정보</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-600">회사명:</span>
              <span className="ml-2 font-medium text-slate-900">{company.name}</span>
            </div>
            {company.industry && (
              <div>
                <span className="text-slate-600">산업:</span>
                <span className="ml-2 font-medium text-slate-900">{company.industry}</span>
              </div>
            )}
            {company.size && (
              <div>
                <span className="text-slate-600">직원 수:</span>
                <span className="ml-2 font-medium text-slate-900">{company.size}명</span>
              </div>
            )}
          </div>
        </div>

        {/* 조직 구조 선택 */}
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Layers className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-slate-900">조직 구조 선택</h2>
              <p className="text-sm text-slate-600 mt-1">회사 규모에 맞는 조직 계층을 선택하세요</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PRESETS.map((preset, index) => (
              <div
                key={preset.id}
                onClick={() => setSelectedTemplate(index)}
                className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all ${
                  selectedTemplate === index
                    ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                    : 'border-slate-200 hover:border-blue-300 hover:shadow-md bg-white'
                }`}
              >
                {/* 선택 체크 */}
                {selectedTemplate === index && (
                  <div className="absolute top-4 right-4 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}

                {/* 타이틀 */}
                <h3 className="text-lg font-bold text-slate-900 mb-2 pr-10">
                  {preset.name}
                </h3>
                <p className="text-sm text-slate-600 mb-6">{preset.description}</p>

                {/* 계층 구조 시각화 */}
                <div className="space-y-3">
                  {preset.levels.map((level, idx) => (
                    <div key={level.level_code} className="flex items-center gap-3">
                      {/* 인덴트 */}
                      <div className="flex items-center" style={{ paddingLeft: `${idx * 12}px` }}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          selectedTemplate === index 
                            ? 'bg-blue-100 text-blue-600' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          <span className="text-xs font-bold">{level.level_code.substring(0, 2)}</span>
                        </div>
                      </div>

                      {/* 레벨 정보 */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            selectedTemplate === index ? 'text-blue-900' : 'text-slate-900'
                          }`}>
                            {level.level_name}
                          </span>
                          {!level.is_required && (
                            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                              선택
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 선택 안내 */}
                {selectedTemplate === index && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <p className="text-xs text-blue-700 font-medium">✓ 이 구조로 설정됩니다</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 완료 버튼 */}
        <div className="flex justify-center mt-8">
          <button
            onClick={handleComplete}
            disabled={selectedTemplate === null || saving}
            className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                저장 중...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                설정 완료하고 시작하기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}