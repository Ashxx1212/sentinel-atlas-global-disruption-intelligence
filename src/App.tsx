import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import LandingPage from './pages/LandingPage';
import CommandCentrePage from './pages/CommandCentrePage';
import GlobalMapPage from './pages/GlobalMapPage';
import MyWorldPage from './pages/MyWorldPage';
import IncidentRoomsPage from './pages/IncidentRoomsPage';
import IncidentRoomPage from './pages/IncidentRoomPage';
import AlertsPage from './pages/AlertsPage';
import BriefingPage from './pages/BriefingPage';
import DataTrustPage from './pages/DataTrustPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppShell />}>
          <Route path="/command-centre" element={<CommandCentrePage />} />
          <Route path="/global-map" element={<GlobalMapPage />} />
          <Route path="/my-world" element={<MyWorldPage />} />
          <Route path="/incidents" element={<IncidentRoomsPage />} />
          <Route path="/incidents/:incidentId" element={<IncidentRoomPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/briefing" element={<BriefingPage />} />
          <Route path="/data-trust" element={<DataTrustPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
