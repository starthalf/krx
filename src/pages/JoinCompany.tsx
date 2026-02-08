// src/pages/JoinCompany.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';

export default function JoinCompany() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    fullName: ''
  });

  useEffect(() => {
    loadCompanyInfo();
  }, [token]);

  const loadCompanyInfo = async () => {
    try {
      setLoading(true);
      const { supabase } = await import('../lib/supabase');

      // 토큰으로 회사 조회
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, industry, invite_domain, invite_enabled, invite_expires_at')
        .eq('invite_token', token)
        .single();

      if (error || !data) {
        setError('유효하지 않은 초대 링크입니다');
        return;
      }

      if (!data.invite_enabled) {
        setError('이 초대 링크는 비활성화되었습니다');
        return;
      }

      if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
        setError('이 초대 링크는 만료되었습니다');
        return;
      }

      setCompany(data);
    } catch (err) {
      console.error('Failed to load company:', err);
      setError('회사 정보를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    if (!company?.invite_domain) return true;
    
    const domain = email.split('@')[1];
    return domain === company.invite_domain;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!company) return;

    // 유효성 검사
    if (!formData.email || !formData.password || !formData.fullName) {
      alert('모든 필드를 입력해주세요');
      return;
    }

    if (formData.password !== formData.passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다');
      return;
    }

    if (formData.password.length < 6) {
      alert('비밀번호는 최소 6자 이상이어야 합니다');
      return;
    }

    if (!validateEmail(formData.email)) {
      alert(`@${company.invite_domain} 이메일만 가입할 수 있습니다`);
      return;
    }

    try {
      setSubmitting(true);
      const { supabase } = await import('../lib/supabase');

      // 1. 회원가입
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('User creation failed');

      // 2. 프로필 업데이트 (company_id 설정, 온보딩 완료)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_id: company.id,
          full_name: formData.fullName,
          onboarding_completed: true
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;

      // 3. 기본 역할 할당 (team_member)
      const { data: teamMemberRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'team_member')
        .single();

      if (teamMemberRole) {
        await supabase
          .from('user_roles')
          .insert({
            profile_id: authData.user.id,
            role_id: teamMemberRole.id
          });
      }

      // 4. 완료 → 대시보드로
      alert(`${company.name}에 가입되었습니다!`);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Failed to join:', err);
      
      if (err.message?.includes('already registered')) {
        alert('이미 등록된 이메일입니다. 로그인해주세요.');
        navigate('/login');
      } else {
        alert('가입에 실패했습니다: ' + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">초대 링크 오류</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            로그인 페이지로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {company.name}에 합류하기
          </h1>
          <p className="text-slate-600">
            팀 초대 링크로 가입하고 있습니다
          </p>
        </div>

        {/* 회사 정보 */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-900">가입 정보</span>
          </div>
          <div className="text-sm text-blue-800">
            <div>회사: {company.name}</div>
            {company.industry && <div>산업: {company.industry}</div>}
            {company.invite_domain && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                허용 이메일: @{company.invite_domain}
              </div>
            )}
          </div>
        </div>

        {/* 가입 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              이름
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="홍길동"
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              이메일
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder={`user@${company.invite_domain || 'company.com'}`}
              required
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {company.invite_domain && (
              <p className="text-xs text-slate-500 mt-1">
                @{company.invite_domain} 이메일만 가입 가능합니다
              </p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              비밀번호
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="최소 6자"
              required
              minLength={6}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Lock className="w-4 h-4 inline mr-1" />
              비밀번호 확인
            </label>
            <input
              type="password"
              value={formData.passwordConfirm}
              onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
              placeholder="비밀번호 재입력"
              required
              minLength={6}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '가입 중...' : '가입하고 시작하기'}
          </button>
        </form>

        {/* 기존 계정 */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-600">
            이미 계정이 있으신가요?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-blue-600 hover:underline font-medium"
            >
              로그인
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}