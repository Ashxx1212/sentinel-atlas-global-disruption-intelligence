import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-full w-64 border-r border-ink-700/60 bg-ink-900/90 backdrop-blur-md lg:block">
        <SideNav />
      </aside>

      {/* Mobile sidebar */}
      {mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="fixed left-0 top-0 z-50 h-full w-64 border-r border-ink-700/60 bg-ink-900 animate-slide-in-right lg:hidden">
            <SideNav onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;
