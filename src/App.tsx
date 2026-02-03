// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OKRStatus from './pages/OKRStatus';
import Organization from './pages/Organization';
import KPIPool from './pages/KPIPool';
import Wizard from './pages/Wizard';

// Checkin 페이지는 Phase 5에서 구현 예정
// import Checkin from './pages/Checkin';

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
            
            {/* OKR 현황 */}
            <Route path="okr" element={<OKRStatus />} />
            <Route path="okr/company" element={<OKRStatus />} />
            <Route path="okr/division" element={<OKRStatus />} />
            <Route path="okr/team" element={<OKRStatus />} />
            
            {/* 목표 수립 위저드 */}
            <Route path="wizard" element={<Wizard />} />
            <Route path="wizard/:orgId" element={<Wizard />} />
            
            {/* 체크인 - Phase 5에서 구현 예정, 임시로 Dashboard */}
            <Route path="checkin" element={<Dashboard />} />
            
            {/* 조직 관리 */}
            <Route path="organization" element={<Organization />} />
            
            {/* KPI Pool */}
            <Route path="kpi-pool" element={<KPIPool />} />
          </Route>

          {/* 없는 경로 → 대시보드로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;