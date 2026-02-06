// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OKRStatus from './pages/OKRStatus';
import Checkin from './pages/Checkin';
import Organization from './pages/Organization';
import KPIPool from './pages/KPIPool';
import Wizard from './pages/Wizard';
import AdminSettings from './pages/AdminSettings';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 로그인 페이지 (인증 불필요) */}
          <Route path="/login" element={<Login />} />
          
          {/* 인증 필요한 페이지들 */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
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
            
            {/* 조직 관리 */}
            <Route path="organization" element={<Organization />} />
            
            {/* KPI Pool */}
            <Route path="kpi-pool" element={<KPIPool />} />
            
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