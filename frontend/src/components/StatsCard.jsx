import React from 'react';

const StatsCard = ({ title, value, subtext, icon: Icon, trend, colorClass = "text-cyan-400" }) => {
  return (
    <div className="box-panel p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between text-zinc-400 mb-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">{title}</span>
        <Icon className="w-4 h-4 text-zinc-500" />
      </div>

      <div className="my-1">
        <div className="text-2xl font-mono font-bold text-zinc-100 tracking-tight">
          {value}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-dark-border text-[10px] font-mono text-zinc-500 mt-2">
        <span className="uppercase">{subtext}</span>
        {trend && (
          <span className={trend.startsWith('+') ? 'text-emerald-400' : 'text-zinc-400'}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
