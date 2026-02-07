// src/components/WithOnboardingCheck.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface WithOnboardingCheckProps {
  children: React.ReactNode;
}

export default function WithOnboardingCheck({ children }: WithOnboardingCheckProps) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const { supabase } = await import('../lib/supabase');
      
      // 현재 사용자 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // 로그인 안 되어 있으면 로그인 페이지로
        navigate('/login');
        return;
      }

      // 프로필 조회
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, company_id')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // 온보딩이 이미 완료되었으면 렌더링
      if (profile.onboarding_completed) {
        setShouldRender(true);
        return;
      }

      // 온보딩 미완료인 경우: Company Admin만 온보딩 필요
      // 일반 팀원은 초대로 가입했으므로 온보딩 스킵
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select(`
          role:roles(level)
        `)
        .eq('profile_id', user.id);

      const isCompanyAdmin = userRoles?.some(ur => ur.role?.level >= 90);

      if (isCompanyAdmin && !profile.onboarding_completed) {
        // Company Admin이고 온보딩 미완료 → 온보딩으로
        navigate('/onboarding');
        return;
      }

      // 일반 팀원이거나 이미 완료 → 렌더링 허용
      setShouldRender(true);
    } catch (error) {
      console.error('Onboarding check failed:', error);
      // 에러 발생 시 일단 렌더링 허용 (기존 동작 유지)
      setShouldRender(true);
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!shouldRender) {
    return null;
  }

  return <>{children}</>;
}