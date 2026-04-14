import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Info, Clock, ExternalLink } from 'lucide-react';
import { alertsData } from '../data/mockData';

const AlertCard = ({ alert }) => {
  const isHigh = alert.severity === 'high';
  const isMedium = alert.severity === 'medium';
  
  const colorClass = isHigh ? 'neon-red' : isMedium ? 'neon-yellow' : 'neon-green';
  const Icon = isHigh ? AlertCircle : isMedium ? AlertTriangle : Info;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01, x: 5 }}
      className={`bg-dark-panel p-6 rounded-2xl border-l-4 border-l-${colorClass} border border-dark-border shadow-skeuo-flat relative group`}
    >
      <div className="flex justify-between items-start gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-dark-bg rounded-xl shadow-skeuo-beveled border border-white/5 relative">
             <Icon className={`w-5 h-5 text-${colorClass}`} />
             <div className={`absolute top-0 right-0 w-2 h-2 rounded-full bg-${colorClass} animate-led-blink translate-x-1/3 -translate-y-1/3 shadow-[0_0_8px_rgba(255,255,255,0.4)]`} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
               <h3 className="text-sm font-bold text-white tracking-widest uppercase">{alert.title}</h3>
               <span className={`px-2 py-0.5 bg-${colorClass}/10 border border-${colorClass}/30 rounded text-[8px] font-bold text-${colorClass} uppercase tracking-[0.2em]`}>
                 {alert.severity}_PRIORITY
               </span>
            </div>
            <p className="text-[11px] text-gray-400 font-mono mb-4 leading-relaxed">{alert.description}</p>
            <div className="flex items-center gap-4 text-[9px] text-gray-500 font-mono tracking-widest">
               <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {alert.timestamp}</span>
               <span className="flex items-center gap-1.5 uppercase">ID: EXT_{alert.id}X99</span>
            </div>
          </div>
        </div>
        
        <button className="p-2 bg-dark-bg border border-dark-border rounded-lg text-gray-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-skeuo-beveled">
           <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {isHigh && (
        <motion.div 
          animate={{ opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-neon-red/5 pointer-events-none rounded-2xl"
        />
      )}
    </motion.div>
  );
};

const Alerts = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-end mb-8">
         <div>
            <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
               <AlertCircle className="text-neon-red" />
               INCIDENT_LOGS
            </h2>
            <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">REAL_TIME_THREAT_DETECTION | ACTIVE</p>
         </div>
         <div className="flex gap-4">
            <button className="px-6 py-2 bg-dark-panel border border-dark-border rounded-xl text-[10px] font-bold text-gray-400 hover:text-white transition-all uppercase tracking-widest shadow-skeuo-beveled">
               Mark All Read
            </button>
         </div>
      </div>

      <div className="space-y-4">
        {alertsData.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
        {/* Placeholder for more history */}
        <button className="w-full py-4 bg-dark-panel/30 border border-dark-border border-dashed rounded-2xl text-[10px] font-bold text-gray-600 hover:text-gray-400 hover:bg-dark-panel/50 transition-all uppercase tracking-widest">
           Load_Historical_Incidents...
        </button>
      </div>
    </div>
  );
};

export default Alerts;
