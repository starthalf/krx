// src/components/Layout.tsx
import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CycleBanner from './CycleBanner';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const { profile } = useAuth();
  const { fetchOrganizations, organizations, company, loading, error } = useStore();

  // ★ FIX: 이미 fetch한 company_id를 추적하여 중복 호출 방지
  const lastFetchedCompanyIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);

  // 디버깅 로그
  useEffect(() => {
    console.log('=== Layout Debug ===');
    console.log('profile:', profile);
    console.log('company_id:', profile?.company_id);
    console.log('company in store:', company?.id);
    console.log('organizations count:', organizations.length);
  }, [profile?.company_id, company?.id, organizations.length]);

  // 앱 진입 시 company + 조직 데이터 로딩
  useEffect(() => {
    const companyId = profile?.company_id;
    if (!companyId) {
      console.log('⏳ Waiting for profile with company_id...');
      return;
    }

    // ★ FIX: 같은 company_id로 이미 fetch했으면 건너뜀
    if (lastFetchedCompanyIdRef.current === companyId) {
      return;
    }

    // ★ FIX: 이미 fetch 진행 중이면 건너뜀
    if (isFetchingRef.current) {
      return;
    }

    console.log('🚀 Triggering fetchOrganizations + loadCompany for:', companyId);
    isFetchingRef.current = true;
    lastFetchedCompanyIdRef.current = companyId;

    const loadAll = async () => {
      try {
        // ★ company가 store에 없으면 로드하여 세팅
        if (!company || company.id !== companyId) {
          const { data: companyData } = await supabase
            .from('companies')
            .select('*')
            .eq('id', companyId)
            .single();

          if (companyData) {
            console.log('✅ Company loaded into store:', companyData.name);
            useStore.getState().setCompany({
              id: companyData.id,
              name: companyData.name,
              industry: companyData.industry,
              size: companyData.size,
              vision: companyData.vision || '',
            } as any);
          }
        }

        // organizations 로드
        await fetchOrganizations(companyId);
      } finally {
        isFetchingRef.current = false;
      }
    };

    loadAll();
  }, [profile?.company_id]); // profile.company_id가 변경될 때만 실행

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 수립 기간 띠 배너 - 활성 사이클이 있을 때만 표시 */}
        <CycleBanner />
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 m-4 rounded-lg">
              오류: {error}
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
} 