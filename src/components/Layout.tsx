// src/components/Layout.tsx
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CycleBanner from './CycleBanner';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';

export default function Layout() {
  const { profile } = useAuth();
  const { fetchOrganizations, organizations, loading, error } = useStore();

  // 디버깅 로그
  useEffect(() => {
    console.log('=== Layout Debug ===');
    console.log('profile:', profile);
    console.log('company_id:', profile?.company_id);
    console.log('organizations count:', organizations.length);
    console.log('loading:', loading);
    console.log('error:', error);
  }, [profile, organizations, loading, error]);

  // 앱 진입 시 조직 데이터 로딩
  useEffect(() => {
    if (profile?.company_id) {
      console.log('🚀 Triggering fetchOrganizations for company:', profile.company_id);
      fetchOrganizations(profile.company_id);
    } else {
      console.log('⏳ Waiting for profile with company_id...');
    }
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