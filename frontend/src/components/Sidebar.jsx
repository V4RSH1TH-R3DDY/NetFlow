import React from 'react';
import { 
  LayoutDashboard, 
  Activity, 
  Layers, 
  ShieldAlert, 
  BarChart3, 
  BrainCircuit, 
  Network as NetworkIcon, 
  Database, 
  SlidersHorizontal 
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'packets', label: 'Packets', icon: Activity },
  { id: 'sessions', label: 'Sessions', icon: Layers },
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert },
  { id: 'predictions', label: 'Inference', icon: BrainCircuit },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'network', label: 'Topology', icon: NetworkIcon },
  { id: 'ingestion', label: 'Ingestion', icon: Database },
  { id: 'settings', label: 'Config', icon: SlidersHorizontal },
];

const Sidebar = ({ activeTab, setActiveTab }) => {
  return (
    <aside className="w-56 h-full bg-dark-panel border-r border-dark-border flex flex-col shrink-0">
      {/* Brand box */}
      <div className="h-14 border-b border-dark-border px-4 flex items-center gap-2.5">
        <div className="w-5 h-5 bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center">
          <div className="w-2 h-2 bg-cyan-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-mono font-semibold tracking-wider text-zinc-100 uppercase">NetFlow</span>
          <span className="text-[10px] font-mono text-zinc-500">v1.2.0 • monitor</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-2.5 py-2 text-xs font-mono transition-colors text-left border ${
                isActive
                  ? 'bg-zinc-800/80 text-zinc-100 border-zinc-700'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer system status */}
      <div className="border-t border-dark-border p-3 bg-dark-surface/30">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-none inline-block" />
            ENGINE
          </span>
          <span className="text-zinc-500">READY</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
