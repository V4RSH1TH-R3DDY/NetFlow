import React, { useState, useEffect } from 'react';
import { Cpu, Wifi, AlertTriangle, Monitor } from 'lucide-react';
import { systemStats } from '../data/mockData';

const Topbar = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-16 bg-dark-panel border-b border-dark-border flex items-center justify-between px-8 shadow-sm relative z-30">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="p-1 px-3 bg-dark-bg rounded border border-dark-border flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-500 tracking-wider">TACTICAL_INTEL_V1.0</span>
            <div className="h-3 w-px bg-dark-border" />
            <span className="text-[10px] font-mono text-neon-cyan animate-pulse">PACKET_STREAM_LIVE</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-green animate-led-blink shadow-neon-glow-green" />
            <span className="text-[10px] font-bold text-gray-400">UPLINK_ALPHA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-green/40 shadow-[0_0_5px_rgba(57,255,20,0.2)]" />
            <span className="text-[10px] font-bold text-gray-400">PARSER_V4</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-neon-red animate-pulse shadow-neon-glow-red" />
            <span className="text-[10px] font-bold text-gray-400">INTRUSION_DET</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-6 text-[10px] font-mono">
          <div className="flex flex-col items-end">
            <span className="text-gray-500 text-[8px] tracking-widest uppercase">Traffic Rate</span>
            <span className="text-neon-cyan">{systemStats.trafficRate}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-gray-500 text-[8px] tracking-widest uppercase">Packet Count</span>
            <span className="text-white">{systemStats.packetCount}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-gray-500 text-[8px] tracking-widest uppercase">Alerts</span>
            <span className="text-neon-red">{systemStats.activeAlerts}</span>
          </div>
        </div>

        <div className="h-8 w-px bg-dark-border" />

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs font-bold text-white tracking-widest">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[9px] text-gray-500 font-mono">
              {time.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full border border-dark-border bg-dark-bg p-1 shadow-skeuo-beveled">
             <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-black flex items-center justify-center overflow-hidden border border-white/5">
                <Monitor className="w-5 h-5 text-gray-400" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topbar;
