// src/components/Layout.tsx
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store/useStore';

export default function Layout() {
  const { profile } = useAuth(); // AuthContext에서 profile(company_id 포함) 가져오기
  const { fetchOrganizations, organizations } = useStore();

  // 앱 진입 시 조직 데이터 로딩
  useEffect(() => {
    if (profile?.company_id && organizations.length === 0) {
      fetchOrganizations(profile.company_id);
    }
  }, [profile, fetchOrganizations, organizations.length]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}