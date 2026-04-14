import React from 'react';
import { motion } from 'framer-motion';

const StatsCard = ({ title, value, subtext, icon: Icon, trend, colorClass = "text-neon-cyan" }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat relative group overflow-hidden"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-[10px] font-bold text-gray-500 tracking-[0.2em] uppercase">{title}</h3>
          <div className={`text-2xl font-bold mt-1 ${colorClass} drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]`}>
            {value}
          </div>
        </div>
        <div className="p-3 bg-dark-bg rounded-xl shadow-skeuo-beveled border border-white/5">
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        {trend && (
          <span className={`text-[10px] font-bold ${trend.startsWith('+') ? 'text-neon-green' : 'text-neon-red'}`}>
            {trend}
          </span>
        )}
        <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">{subtext}</span>
      </div>

      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full -mr-16 -mt-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </motion.div>
  );
};

export default StatsCard;
