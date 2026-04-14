import React from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PieChart as PieIcon, TrendingUp, Cpu, HardDrive, LayoutGrid } from 'lucide-react';
import { protocolStats, trafficHistory } from '../data/mockData';

const Analytics = () => {
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
          <PieIcon className="text-neon-cyan" />
          ANALYTICS_READOUT
        </h2>
        <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">Synchronizing global packet flow for nodes: <span className="text-neon-green">ACTIVE</span></p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Protocol Distribution */}
        <div className="bg-dark-panel p-8 rounded-3xl border border-dark-border shadow-skeuo-flat flex flex-col items-center">
           <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-8 w-full">PROTOCOL_DISTRIBUTION</h3>
           <div className="h-[250px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={protocolStats}
                   cx="50%"
                   cy="50%"
                   innerRadius={60}
                   outerRadius={80}
                   paddingAngle={5}
                   dataKey="value"
                   animationBegin={0}
                   animationDuration={1500}
                 >
                   {protocolStats.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} stroke="rgba(255,255,255,0.05)" />
                   ))}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }}
                   itemStyle={{ color: '#fff' }}
                 />
               </PieChart>
             </ResponsiveContainer>
           </div>
           
           <div className="grid grid-cols-2 gap-4 mt-8 w-full">
              {protocolStats.map((stat) => (
                <div key={stat.name} className="flex justify-between items-center p-3 bg-dark-bg/50 rounded-xl border border-white/5 shadow-skeuo-beveled">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }} />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">{stat.name}</span>
                   </div>
                   <span className="text-[10px] font-mono text-gray-400">{stat.value}%</span>
                </div>
              ))}
           </div>
        </div>

        {/* Throughput Analysis */}
        <div className="bg-dark-panel p-8 rounded-3xl border border-dark-border shadow-skeuo-flat">
           <div className="flex justify-between items-center mb-12">
             <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">THROUGHPUT_ANALYSIS</h3>
             <div className="flex gap-2">
                <span className="px-2 py-1 bg-dark-bg text-[8px] font-mono text-gray-500 border border-dark-border rounded">TS_2023_09_12_44</span>
             </div>
           </div>
           
           <div className="h-[250px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={trafficHistory}>
                 <defs>
                   <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#00f7ff" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#00f7ff" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                 <XAxis dataKey="time" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                 <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} label={{ value: 'MBPS', angle: -90, position: 'insideLeft', fill: '#444', fontSize: 10 }} />
                 <Tooltip 
                    cursor={{ stroke: '#00f7ff', strokeWidth: 1 }}
                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }}
                 />
                 <Area 
                   type="stepAfter" 
                   dataKey="traffic" 
                   stroke="#00f7ff" 
                   fill="url(#colorThroughput)" 
                   strokeWidth={2}
                   animationDuration={2500}
                 />
               </AreaChart>
             </ResponsiveContainer>
           </div>

           <div className="mt-8 p-4 bg-dark-bg/80 border border-dark-border rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="p-2 bg-neon-cyan/10 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-neon-cyan" />
                 </div>
                 <div>
                    <div className="text-[10px] font-bold text-white uppercase tracking-widest">Peak_Volume</div>
                    <div className="text-lg font-bold text-neon-cyan leading-tight">842.4 Mbps</div>
                 </div>
              </div>
              <div className="text-right">
                 <div className="text-[9px] font-mono text-gray-500">HISTORY_DEPTH</div>
                 <div className="text-[10px] font-bold text-neon-green uppercase tracking-widest">48 HRS</div>
              </div>
           </div>
        </div>
      </div>

      {/* Hardware Utilization Overlay */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {[
           { label: 'CPU_CORE_UTILI', value: 42, icon: Cpu, color: 'neon-cyan' },
           { label: 'DISK_I/O_STREAM', value: 68, icon: HardDrive, color: 'neon-green' },
           { label: 'ARRAY_STABILITY', value: 94, icon: Shield, color: 'neon-yellow' }
         ].map((hw, idx) => (
           <div key={idx} className="bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat flex items-center gap-6">
              <div className="p-3 bg-dark-bg rounded-xl shadow-skeuo-beveled border border-white/5">
                 <hw.icon className={`w-5 h-5 text-${hw.color}`} />
              </div>
              <div className="flex-1">
                 <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">{hw.label}</h4>
                 <div className="h-1.5 w-full bg-dark-bg rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${hw.value}%` }}
                      transition={{ duration: 2, delay: idx * 0.3 }}
                      className={`h-full bg-${hw.color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                    />
                 </div>
              </div>
              <span className={`text-xs font-mono font-bold text-${hw.color}`}>{hw.value}%</span>
           </div>
         ))}
      </div>
    </div>
  );
};

// Placeholder for Shield icon since it was used in hardware util
const Shield = ({ className }) => {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}

export default Analytics;
