import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Packets from './pages/Packets';
import Alerts from './pages/Alerts';
import Analytics from './pages/Analytics';
import Network from './pages/Network';
import Settings from './pages/Settings';
import Sessions from './pages/Sessions';
import Predictions from './pages/Predictions';
import Ingestion from './pages/Ingestion';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'packets': return <Packets />;
      case 'sessions': return <Sessions />;
      case 'alerts': return <Alerts />;
      case 'analytics': return <Analytics />;
      case 'predictions': return <Predictions />;
      case 'network': return <Network />;
      case 'ingestion': return <Ingestion />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-dark-bg text-zinc-300 font-sans overflow-hidden">
      {/* Boxed Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <Topbar />
        <main className="flex-1 overflow-auto p-5 bg-dark-bg/60">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
