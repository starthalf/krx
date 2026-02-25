// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

// Profile 타입 (간소화)
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
  setSkipAutoProfile: (skip: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const skipAutoProfileRef = useRef(false);
  const initialSessionDoneRef = useRef(false);
  const profileRef = useRef<Profile | null>(null);

  // 프로필 조회
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
        console.log('ℹ️ 프로필이 아직 없음 (초대 플로우 중일 수 있음)');
        return null;
      }
      console.log('✅ 프로필 조회 성공:', data);
      return data as Profile;
    } catch (error) {
      console.error('❌ 프로필 조회 예외:', error);
      return null;
    }
  };

  // ★ profile을 set할 때 이전 값과 비교 → 같으면 참조 변경 안 함
  const setProfileSafe = (newProfile: Profile | null) => {
    const prev = profileRef.current;
    if (!prev && !newProfile) return;
    if (prev && newProfile &&
        prev.id === newProfile.id &&
        prev.company_id === newProfile.company_id &&
        prev.full_name === newProfile.full_name &&
        prev.role === newProfile.role) {
      console.log('⏭️ 프로필 변경 없음 — setProfile 건너뜀');
      return;
    }
    profileRef.current = newProfile;
    setProfile(newProfile);
  };

  // 프로필 새로고침 (외부에서 호출 가능)
  const refreshProfile = async () => {
    const currentUser = user || (await supabase.auth.getUser()).data.user;
    if (currentUser) {
      const profileData = await fetchProfile(currentUser.id);
      profileRef.current = profileData;
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

        if (error) console.error('❌ 세션 조회 실패:', error);
        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          console.log('✅ 세션 있음. 프로필 조회 중...');
          const profileData = await fetchProfile(currentSession.user.id);
          if (mounted) {
            setProfileSafe(profileData);
          }
        } else {
          console.log('ℹ️ 세션 없음 (로그아웃 상태)');
        }

        if (mounted) {
          setLoading(false);
          initialSessionDoneRef.current = true;
        }
      } catch (error) {
        console.error('❌ 초기 세션 확인 예외:', error);
        if (mounted) {
          setLoading(false);
          initialSessionDoneRef.current = true;
        }
      }
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // ★ FIX: async 제거 — 콜백을 동기 함수로 만들어 deadlock 원천 차단
        console.log('🔄 Auth 상태 변경:', event);

        if (!mounted) return;

        if (event === 'INITIAL_SESSION') {
          console.log('⏭️ INITIAL_SESSION 건너뜀');
          return;
        }

        if (event === 'SIGNED_IN' && !initialSessionDoneRef.current) {
          console.log('⏭️ 초기 SIGNED_IN 건너뜀');
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 TOKEN_REFRESHED — 세션만 갱신');
          setSession(newSession);
          setUser(newSession?.user ?? null);
          return;
        }

        // SIGNED_IN (실제 로그인) 또는 SIGNED_OUT
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          if (skipAutoProfileRef.current) {
            console.log('⏭️ 초대 플로우 중 - 프로필 조회 건너뜀');
          } else if (!profileRef.current) {
            // ★ FIX: setTimeout(0)으로 콜백 밖에서 실행 → deadlock 방지
            const userId = newSession.user.id;
            setTimeout(async () => {
              if (!mounted) return;
              console.log('📡 SIGNED_IN 후 프로필 조회 (deferred):', userId);
              const profileData = await fetchProfile(userId);
              if (mounted) setProfileSafe(profileData);
            }, 0);
          } else {
            console.log('⏭️ 프로필 이미 있음 — 재조회 건너뜀');
          }
        } else {
          // SIGNED_OUT
          profileRef.current = null;
          setProfile(null);
        }

        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const setSkipAutoProfile = (skip: boolean) => {
    skipAutoProfileRef.current = skip;
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔑 로그인 시도:', email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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

  const signUp = async (email: string, password: string, fullName: string, companyId?: string) => {
    try {
      console.log('📝 회원가입 시도:', email);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_id: companyId || '00000000-0000-0000-0000-000000000001',
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

  const signOut = async () => {
    console.log('👋 로그아웃 시도');
    profileRef.current = null;
    setProfile(null);
    setUser(null);
    setSession(null);
    await supabase.auth.signOut();
    console.log('✅ 로그아웃 완료');
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    setSkipAutoProfile,
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