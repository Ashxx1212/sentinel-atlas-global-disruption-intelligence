import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/AppShell';
import { AuthGate } from './components/AuthGate';
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
import AuthPage from './pages/AuthPage';

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route element={<AppShell />}>
            <Route path="/command-centre" element={<CommandCentrePage />} />
            <Route path="/global-map" element={<GlobalMapPage />} />
            <Route path="/my-world" element={<AuthGate><MyWorldPage /></AuthGate>} />
            <Route path="/incidents" element={<IncidentRoomsPage />} />
            <Route path="/incidents/:incidentId" element={<IncidentRoomPage />} />
            <Route path="/alerts" element={<AuthGate><AlertsPage /></AuthGate>} />
            <Route path="/briefing" element={<AuthGate><BriefingPage /></AuthGate>} />
            <Route path="/data-trust" element={<DataTrustPage />} />
            <Route path="/settings" element={<AuthGate><SettingsPage /></AuthGate>} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
