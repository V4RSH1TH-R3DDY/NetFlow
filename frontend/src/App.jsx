import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Packets from './pages/Packets';
import Alerts from './pages/Alerts';
import Analytics from './pages/Analytics';
import Network from './pages/Network';
import Settings from './pages/Settings';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'packets': return <Packets />;
      case 'alerts': return <Alerts />;
      case 'analytics': return <Analytics />;
      case 'network': return <Network />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-dark-bg text-gray-300 relative overflow-hidden font-sans">
      {/* Grain Overlay */}
      <div className="grain-overlay" />
      
      {/* Scanline Effect */}
      <div className="scanline" />

      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto p-8 relative">
          {renderPage()}
        </main>
      </div>

      {/* Ambient Background Glows */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neon-cyan/5 blur-[120px] rounded-full -mr-64 -mt-64" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neon-red/5 blur-[120px] rounded-full -ml-64 -mb-64" />
    </div>
  );
}

export default App;
