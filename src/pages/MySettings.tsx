// src/pages/MySettings.tsx
import { useState, useEffect } from 'react';
import { User, Mail, Building2, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function MySettings() {
  const { profile } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.full_name || '',
        email: profile.email || '',
      });
      loadCompanyInfo();
    }
  }, [profile]);

  const loadCompanyInfo = async () => {
    if (!profile?.company_id) return;
    
    try {
      const { supabase } = await import('../lib/supabase');
      const { data } = await supabase
        .from('companies')
        .select('name, industry')
        .eq('id', profile.company_id)
        .single();
      
      setCompany(data);
    } catch (error) {
      console.error('Failed to load company:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const { supabase } = await import('../lib/supabase');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.fullName,
        })
        .eq('id', profile?.id);

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('저장에 실패했습니다: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">내 설정</h1>
        <p className="text-slate-600">
          프로필 정보를 관리합니다
        </p>
      </div>

      {saveSuccess && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-medium">변경사항이 저장되었습니다!</span>
        </div>
      )}

      <div className="grid gap-6">
        {/* 프로필 정보 카드 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            프로필 정보
          </h2>

          <div className="space-y-4">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                이름
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="이름을 입력하세요"
              />
            </div>

            {/* 이메일 (읽기 전용) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                이메일
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <span className="text-xs text-slate-500">변경 불가</span>
              </div>
            </div>

            {/* 저장 버튼 */}
            <div className="pt-4">
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {loading ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </div>

        {/* 회사 정보 카드 (읽기 전용) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            회사 정보
          </h2>

          {company ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">회사명</span>
                <span className="text-sm font-medium text-slate-900">{company.name}</span>
              </div>
              {company.industry && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-sm text-slate-600">산업</span>
                  <span className="text-sm font-medium text-slate-900">{company.industry}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              회사 정보를 불러오는 중...
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              회사 정보는 관리자만 변경할 수 있습니다
            </p>
          </div>
        </div>

        {/* 계정 정보 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            계정 정보
          </h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <span className="text-slate-600">사용자 ID</span>
              <span className="font-mono text-slate-900">{profile?.id.slice(0, 8)}...</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">가입일</span>
              <span className="text-slate-900">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('ko-KR') : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}