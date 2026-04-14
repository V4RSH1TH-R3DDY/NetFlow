import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Activity, Bell, PieChart, Settings, ShieldAlert } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { id: 'packets', label: 'PACKETS', icon: Activity },
  { id: 'alerts', label: 'ALERTS', icon: Bell },
  { id: 'analytics', label: 'ANALYTICS', icon: PieChart },
  { id: 'network', label: 'NETWORK', icon: Activity },
  { id: 'settings', label: 'SETTINGS', icon: Settings },
];

const Sidebar = ({ activeTab, setActiveTab }) => {
  return (
    <div className="w-64 h-full bg-dark-panel border-r border-dark-border flex flex-col p-6 shadow-skeuo-flat relative z-20">
      <div className="flex items-center gap-3 mb-12">
        <div className="w-10 h-10 bg-dark-surface rounded-lg shadow-skeuo-beveled flex items-center justify-center border border-white/5">
          <ShieldAlert className="text-neon-cyan w-6 h-6 drop-shadow-[0_0_8px_rgba(0,247,255,0.6)]" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-widest text-white leading-none">OPERATOR_01</h1>
          <span className="text-[10px] text-neon-green/80 font-mono">SYSTEM_NOMINAL</span>
        </div>
      </div>

      <nav className="flex-1 space-y-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 relative group
                ${isActive 
                  ? 'bg-dark-surface shadow-skeuo-pressed border border-white/5' 
                  : 'hover:bg-dark-surface/50 border border-transparent'}
              `}
            >
              <Icon 
                className={`w-5 h-5 transition-colors duration-300
                  ${isActive ? 'text-neon-cyan drop-shadow-[0_0_8px_rgba(0,247,255,0.6)]' : 'text-gray-500 group-hover:text-gray-300'}
                `} 
              />
              <span 
                className={`text-xs font-bold tracking-wider transition-colors duration-300
                  ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}
                `}
              >
                {item.label}
              </span>

              {isActive && (
                <motion.div 
                  layoutId="glow"
                  className="absolute inset-0 rounded-xl bg-neon-cyan/5 blur-md"
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      <div className="mt-auto pt-6 border-t border-dark-border">
        <button className="w-full py-3 bg-neon-red/10 border border-neon-red/30 rounded-lg text-neon-red text-[10px] font-bold tracking-[0.2em] hover:bg-neon-red/20 transition-colors shadow-neon-glow-red">
          EMERGENCY_SHUTDOWN
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
