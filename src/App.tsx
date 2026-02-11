// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import WithOnboardingCheck from './components/WithOnboardingCheck';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OKRStatus from './pages/OKRStatus';
import Checkin from './pages/Checkin';
import Organization from './pages/Organization';
import KPIPool from './pages/KPIPool';
import Wizard from './pages/Wizard';
import AdminSettings from './pages/AdminSettings';
import OnboardingWizard from './pages/OnboardingWizard';
import AcceptInvite from './pages/AcceptInvite';
import JoinCompany from './pages/JoinCompany';
import MySettings from './pages/MySettings';
import Notifications from './pages/Notifications';
import ApprovalInbox from './pages/ApprovalInbox';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 로그인 페이지 (인증 불필요) */}
          <Route path="/login" element={<Login />} />
          
          {/* 초대 수락 (인증 불필요) */}
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />
          
          {/* 팀 초대 링크로 가입 (인증 불필요) */}
          <Route path="/join/:token" element={<JoinCompany />} />
          
          {/* 온보딩 (인증 필요, Layout 없음) */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingWizard />
              </ProtectedRoute>
            }
          />
          
          {/* 인증 필요한 페이지들 */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <WithOnboardingCheck>
                  <Layout />
                </WithOnboardingCheck>
              </ProtectedRoute>
            }
          >
            {/* 기본 경로 → 대시보드 */}
            <Route index element={<Dashboard />} />
            
            {/* 대시보드 */}
            <Route path="dashboard" element={<Dashboard />} />
            
            {/* 목표 현황 (계층별 Alignment 시각화) */}
            <Route path="okr" element={<Navigate to="/okr/company" replace />} />
            <Route path="okr/company" element={<OKRStatus />} />
            <Route path="okr/division" element={<OKRStatus />} />
            <Route path="okr/team" element={<OKRStatus />} />
            
            {/* 체크인 (실적 입력 및 KR 상세 관리) */}
            <Route path="checkin" element={<Checkin />} />
            
            {/* 목표 수립 위저드 */}
            <Route path="wizard" element={<Wizard />} />
            <Route path="wizard/:orgId" element={<Wizard />} />
            
            {/* [NEW] 승인 대기함 */}
            <Route path="approval-inbox" element={<ApprovalInbox />} />
            
            {/* [NEW] 알림 */}
            <Route path="notifications" element={<Notifications />} />
            
            {/* 조직 관리 */}
            <Route path="organization" element={<Organization />} />
            
            {/* KPI Pool */}
            <Route path="kpi-pool" element={<KPIPool />} />
            
            {/* 내 설정 */}
            <Route path="my-settings" element={<MySettings />} />
            
            {/* 관리자 설정 */}
            <Route path="admin" element={<AdminSettings />} />
            <Route path="admin/settings" element={<AdminSettings />} />
          </Route>
          
          {/* 없는 경로 → 대시보드로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;