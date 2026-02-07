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
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">조직 구조 선택</h2>
          <p className="text-slate-600 mb-6">회사에 가장 적합한 조직 계층 구조를 선택하세요</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PRESETS.map((preset, index) => (
              <button
                key={preset.id}
                onClick={() => setSelectedTemplate(index)}
                className={`text-left p-6 rounded-xl border-2 transition-all ${
                  selectedTemplate === index
                    ? 'border-blue-600 bg-blue-50 shadow-lg'
                    : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      selectedTemplate === index ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                      <Layers className={`w-5 h-5 ${
                        selectedTemplate === index ? 'text-blue-600' : 'text-slate-600'
                      }`} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{preset.name}</h3>
                  </div>
                  {selectedTemplate === index && <Check className="w-6 h-6 text-blue-600" />}
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

          {/* 완료 버튼 */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleComplete}
              disabled={selectedTemplate === null || saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium flex items-center gap-2"
            >
              {saving ? '설정 중...' : '완료'}
              {!saving && <Check className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}