import React, { useState, useEffect } from 'react';
import { Sun, Moon, Radio } from 'lucide-react';
import { api } from '../lib/api';

const Topbar = () => {
  const [time, setTime] = useState(new Date());
  const [theme, setTheme] = useState('dark');
  const [stats, setStats] = useState({
    trafficRate: '0.00 Mbps',
    packetCount: '0',
    activeAlerts: 0,
  });

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    const stored = localStorage.getItem('netflow-theme') || 'dark';
    setTheme(stored);
    document.documentElement.setAttribute('data-theme', stored);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('netflow-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  useEffect(() => {
    const loadTopbarStats = async () => {
      try {
        const [packets, alerts, trends] = await Promise.all([
          api.listPackets({ limit: 1 }),
          api.listAlerts({ limit: 1, status: 'open' }),
          api.trafficTrends({ limit: 1 }),
        ]);

        const latestTrend = (trends || [])[0];
        const mbps = latestTrend ? (((latestTrend.bytes_per_minute || 0) * 8) / 1_000_000 / 60).toFixed(2) : '0.00';

        setStats({
          trafficRate: `${mbps} Mbps`,
          packetCount: new Intl.NumberFormat().format((packets || []).length),
          activeAlerts: (alerts || []).length,
        });
      } catch {
        setStats({
          trafficRate: '0.00 Mbps',
          packetCount: '0',
          activeAlerts: 0,
        });
      }
    };

    loadTopbarStats();
    const poll = setInterval(loadTopbarStats, 15000);
    return () => clearInterval(poll);
  }, []);

  return (
    <header className="h-14 bg-dark-panel border-b border-dark-border px-5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-dark-surface border border-dark-border text-zinc-300">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>INTRUSION_DETECTION_SYS</span>
        </div>
        <div className="hidden md:flex items-center gap-4 text-zinc-500">
          <span>PORT: 8000</span>
          <span>•</span>
          <span>STREAM: ACTIVE</span>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[11px] uppercase">Rate</span>
            <span className="text-zinc-200">{stats.trafficRate}</span>
          </div>
          <span className="text-zinc-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[11px] uppercase">Alerts</span>
            <span className={stats.activeAlerts > 0 ? "text-rose-400 font-semibold" : "text-zinc-200"}>
              {stats.activeAlerts}
            </span>
          </div>
        </div>

        <div className="h-4 w-px bg-dark-border" />

        <div className="flex items-center gap-3 font-mono text-xs text-zinc-400">
          <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          <button
            onClick={toggleTheme}
            className="p-1.5 border border-dark-border bg-dark-surface text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
