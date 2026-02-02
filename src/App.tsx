import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OKRStatus from './pages/OKRStatus';
import CheckIn from './pages/CheckIn';
import Wizard from './pages/Wizard';
import Organization from './pages/Organization';
import KPIPool from './pages/KPIPool';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="wizard" element={<Wizard />} />
          <Route path="okr/company" element={<OKRStatus />} />
          <Route path="okr/division" element={<OKRStatus />} />
          <Route path="okr/team" element={<OKRStatus />} />
          <Route path="checkin" element={<CheckIn />} />
          <Route path="organization" element={<Organization />} />
          <Route path="kpi-pool" element={<KPIPool />} />
          <Route path="settings" element={<div className="p-6">설정 페이지</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
