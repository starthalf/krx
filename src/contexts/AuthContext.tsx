// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface Profile {
  id: string;
  company_id: string | null;
  full_name: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, companyId?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 프로필 조회 — .maybeSingle()로 0건이어도 에러 안 남
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      console.log('📡 프로필 조회 시도:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ 프로필 조회 실패:', error);
        return null;
      }

      if (!data) {
        console.log('ℹ️ 프로필이 아직 없음 (초대 수락 진행 중일 수 있음)');
        return null;
      }

      console.log('✅ 프로필 조회 성공:', data);
      return data as Profile;
    } catch (error) {
      console.error('❌ 프로필 조회 예외:', error);
      return null;
    }
  };

  // 프로필 새로고침
  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  // 초기 세션 확인 및 Auth 상태 리스너
  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      try {
        console.log('🔐 초기 세션 확인 중...');
        
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ 세션 조회 실패:', error);
        }

        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          console.log('✅ 세션 있음. 프로필 조회 중...');
          const profileData = await fetchProfile(currentSession.user.id);
          if (mounted) {
            setProfile(profileData);
          }
        } else {
          console.log('ℹ️ 세션 없음 (로그아웃 상태)');
        }

        if (mounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ 초기 세션 확인 예외:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Auth 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('🔄 Auth 상태 변경:', event);
        
        if (!mounted) return;
        
        // INITIAL_SESSION은 getInitialSession에서 이미 처리 — 스킵
        if (event === 'INITIAL_SESSION') return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // 초대 수락 페이지에서는 프로필 조회를 스킵 (AcceptInvite가 직접 처리)
          const isAcceptInvitePage = window.location.pathname.startsWith('/accept-invite');
          if (isAcceptInvitePage) {
            console.log('ℹ️ 초대 수락 페이지 — 프로필 조회 스킵');
            if (mounted) setLoading(false);
            return;
          }

          // 약간의 딜레이 후 프로필 조회 (트리거가 생성할 시간 확보)
          await new Promise(r => setTimeout(r, 300));
          if (!mounted) return;
          const profileData = await fetchProfile(newSession.user.id);
          if (mounted) {
            setProfile(profileData);
          }
        } else {
          setProfile(null);
        }

        if (mounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 로그인
  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔑 로그인 시도:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ 로그인 실패:', error);
        return { error };
      }

      console.log('✅ 로그인 성공');
      return { error: null };
    } catch (error) {
      console.error('❌ 로그인 예외:', error);
      return { error: error as Error };
    }
  };

  // 회원가입
  const signUp = async (
    email: string, 
    password: string, 
    fullName: string, 
    companyId?: string
  ) => {
    try {
      console.log('📝 회원가입 시도:', email);
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_id: companyId,
            role: 'member',
          },
        },
      });

      if (error) {
        console.error('❌ 회원가입 실패:', error);
        return { error };
      }

      console.log('✅ 회원가입 성공');
      return { error: null };
    } catch (error) {
      console.error('❌ 회원가입 예외:', error);
      return { error: error as Error };
    }
  };

  // 로그아웃
  const signOut = async () => {
    console.log('👋 로그아웃 시도');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    console.log('✅ 로그아웃 완료');
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}