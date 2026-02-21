// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'; 
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import WithOnboardingCheck from './components/WithOnboardingCheck';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OKRStatus from './pages/OKRStatus';
import OKRSetupStatus from './pages/OKRSetupStatus';
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
import OKRMap from './pages/OKRMap';
import CEOOKRSetup from './pages/CEOOKRSetup';
import PeriodCloseWizard from './pages/PeriodCloseWizard';

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
          
          {/* 관리자 설정 (인증 필요, 전체 화면 - Layout 없음) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <WithOnboardingCheck>
                  <AdminSettings />
                </WithOnboardingCheck>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute>
                <WithOnboardingCheck>
                  <AdminSettings />
                </WithOnboardingCheck>
              </ProtectedRoute>
            }
          />
          
          {/* ✅ 기간 마감 위저드 (전체 화면) - periodId 사용 */}
          <Route
            path="/period-close/:periodId"
            element={
              <ProtectedRoute>
                <WithOnboardingCheck>
                  <PeriodCloseWizard />
                </WithOnboardingCheck>
              </ProtectedRoute>
            }
          />
          
          {/* ✅ [LEGACY REDIRECTS] 기존 경로들을 통합 Admin 페이지로 리다이렉트 */}
          {/* 기간 히스토리 → Admin periods 탭 */}
          <Route
            path="/period-history"
            element={<Navigate to="/admin?tab=periods" replace />}
          />
          <Route
            path="/period-history/:periodId"
            element={<Navigate to="/admin?tab=periods" replace />}
          />
          
          {/* ✅ [NEW] 사이클 관련 레거시 경로 → Admin periods 탭으로 통합 */}
          <Route
            path="/cycles"
            element={<Navigate to="/admin?tab=periods" replace />}
          />
          <Route
            path="/cycle-management"
            element={<Navigate to="/admin?tab=periods" replace />}
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
            
            {/* OKR Cascading Map */}
            <Route path="okr-map" element={<OKRMap />} />
            
            {/* ✅ OKR 수립 현황 - CEO/본부장용 독촉 페이지 */}
            <Route path="okr-setup" element={<OKRSetupStatus />} />
            
            {/* 체크인 (실적 입력 및 KR 상세 관리) */}
            <Route path="checkin" element={<Checkin />} />
            
            {/* ✅ 목표 수립 위저드 - CEO 전사 OKR 수립 */}
            <Route path="ceo-okr-setup" element={<CEOOKRSetup />} />
            <Route path="wizard" element={<Wizard />} />
            <Route path="wizard/:orgId" element={<Wizard />} />
            
            {/* 승인 대기함 */}
            <Route path="approval-inbox" element={<ApprovalInbox />} />
            
            {/* 알림 */}
            <Route path="notifications" element={<Notifications />} />
            
            {/* 조직 관리 */}
            <Route path="organization" element={<Organization />} />
            
            {/* KPI Pool */}
            <Route path="kpi-pool" element={<KPIPool />} />
            
            {/* 내 설정 */}
            <Route path="my-settings" element={<MySettings />} />
          </Route>
          
          {/* 없는 경로 → 대시보드로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;