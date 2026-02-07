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
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Layers className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">조직 구조 선택</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRESETS.map((preset, index) => (
              <button
                key={preset.id}
                onClick={() => setSelectedTemplate(index)}
                className={`text-left p-6 rounded-xl border-2 transition-all ${
                  selectedTemplate === index
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">{preset.name}</h3>
                  {selectedTemplate === index && (
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-4">{preset.description}</p>
                <div className="space-y-1">
                  {preset.levels.map((level) => (
                    <div key={level.level_code} className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                      {level.level_name}
                      {!level.is_required && <span className="text-slate-400">(선택)</span>}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 완료 버튼 */}
        <div className="flex justify-center">
          <button
            onClick={handleComplete}
            disabled={selectedTemplate === null || saving}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? '저장 중...' : '설정 완료'}
            {!saving && <Check className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}