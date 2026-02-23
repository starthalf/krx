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
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      // 프로필이 아직 없으면 (초대 수락 진행 중) 통과
      if (!profile) {
        setShouldRender(true);
        return;
      }

      // 온보딩이 이미 완료되었는지 확인
      if (profile.onboarding_completed) {
        // Company Admin인 경우 조직 존재 여부 확인
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role:roles(level)')
          .eq('profile_id', user.id);

        const isCompanyAdmin = userRoles?.some(ur => ur.role?.level >= 90);

        if (isCompanyAdmin && profile.company_id) {
          // 조직 존재 여부 확인
          const { data: orgs } = await supabase
            .from('organizations')
            .select('id')
            .eq('company_id', profile.company_id)
            .limit(1);

          if (!orgs || orgs.length === 0) {
            // 온보딩 완료했는데 조직 없음 → 온보딩 재실행
            console.warn('온보딩 완료했지만 조직이 없습니다. 온보딩을 다시 실행합니다.');
            navigate('/onboarding');
            return;
          }
        }

        setShouldRender(true);
        return;
      }

      // 온보딩 미완료인 경우: Company Admin만 온보딩 필요
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role:roles(level)')
        .eq('profile_id', user.id);

      const isCompanyAdmin = userRoles?.some(ur => ur.role?.level >= 90);

      if (isCompanyAdmin && !profile.onboarding_completed) {
        navigate('/onboarding');
        return;
      }

      setShouldRender(true);
    } catch (error) {
      console.error('Onboarding check failed:', error);
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