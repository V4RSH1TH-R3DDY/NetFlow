import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PieChart as PieIcon, TrendingUp, Cpu, HardDrive } from 'lucide-react';
import { api } from '../lib/api';

const Shield = ({ className }) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
};

const Analytics = () => {
    const [protocolStats, setProtocolStats] = useState([]);
    const [trafficHistory, setTrafficHistory] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadAnalytics = async () => {
            setError('');
            try {
                const [packets, trends] = await Promise.all([
                    api.listPackets({ limit: 500 }),
                    api.trafficTrends({ limit: 120 }),
                ]);

                const protocolCounts = (packets || []).reduce((acc, packet) => {
                    const key = (packet.protocol || 'OTHER').toUpperCase();
                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                }, {});

                const total = Object.values(protocolCounts).reduce((sum, count) => sum + count, 0) || 1;
                const palette = {
                    TCP: '#00f7ff',
                    UDP: '#39ff14',
                    ICMP: '#ff003c',
                    OTHER: '#f4e04d',
                };

                const computedProtocols = Object.entries(protocolCounts)
                    .map(([name, count]) => ({
                        name,
                        value: Math.max(1, Math.round((count / total) * 100)),
                        color: palette[name] || '#f4e04d',
                    }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 6);

                setProtocolStats(computedProtocols.length ? computedProtocols : [{ name: 'NO_DATA', value: 100, color: '#6b7280' }]);

                setTrafficHistory(
                    (trends || [])
                        .slice()
                        .reverse()
                        .map((item) => ({
                            time: item.minute_bucket
                                ? new Date(item.minute_bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '--',
                            traffic: Math.round(((item.bytes_per_minute || 0) * 8) / 1_000_000),
                        }))
                );
            } catch (err) {
                setError(err.message || 'Failed to load analytics');
            }
        };

        loadAnalytics();
    }, []);

    const peakVolume = useMemo(() => {
        if (!trafficHistory.length) return 0;
        return Math.max(...trafficHistory.map((entry) => entry.traffic));
    }, [trafficHistory]);

    const hardwareStats = [
        { label: 'CPU_CORE_UTILI', value: 42, icon: Cpu, colorText: 'text-neon-cyan', barColor: 'bg-neon-cyan' },
        { label: 'DISK_I/O_STREAM', value: 68, icon: HardDrive, colorText: 'text-neon-green', barColor: 'bg-neon-green' },
        { label: 'ARRAY_STABILITY', value: 94, icon: Shield, colorText: 'text-neon-yellow', barColor: 'bg-neon-yellow' },
    ];

    return (
        <div className="space-y-6">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
                    <PieIcon className="text-neon-cyan" />
                    ANALYTICS_READOUT
                </h2>
                <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">
                    Synchronizing global packet flow for nodes: <span className="text-neon-green">ACTIVE</span>
                </p>
            </div>

            {error && (
                <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[11px] text-neon-red font-mono">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                <div className="bg-dark-panel p-8 rounded-3xl border border-dark-border shadow-skeuo-flat">
                    <div className="flex justify-between items-center mb-12">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">THROUGHPUT_ANALYSIS</h3>
                        <div className="flex gap-2">
                            <span className="px-2 py-1 bg-dark-bg text-[8px] font-mono text-gray-500 border border-dark-border rounded">LIVE_WINDOW</span>
                        </div>
                    </div>

                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trafficHistory}>
                                <defs>
                                    <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00f7ff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00f7ff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                <XAxis dataKey="time" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} label={{ value: 'MBPS', angle: -90, position: 'insideLeft', fill: '#444', fontSize: 10 }} />
                                <Tooltip
                                    cursor={{ stroke: '#00f7ff', strokeWidth: 1 }}
                                    contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }}
                                />
                                <Area type="stepAfter" dataKey="traffic" stroke="#00f7ff" fill="url(#colorThroughput)" strokeWidth={2} animationDuration={2500} />
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
                                <div className="text-lg font-bold text-neon-cyan leading-tight">{peakVolume} Mbps</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[9px] font-mono text-gray-500">HISTORY_DEPTH</div>
                            <div className="text-[10px] font-bold text-neon-green uppercase tracking-widest">{trafficHistory.length} PTS</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {hardwareStats.map((hw, idx) => (
                    <div key={idx} className="bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat flex items-center gap-6">
                        <div className="p-3 bg-dark-bg rounded-xl shadow-skeuo-beveled border border-white/5">
                            <hw.icon className={`w-5 h-5 ${hw.colorText}`} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">{hw.label}</h4>
                            <div className="h-1.5 w-full bg-dark-bg rounded-full overflow-hidden border border-white/5">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${hw.value}%` }}
                                    transition={{ duration: 2, delay: idx * 0.3 }}
                                    className={`h-full ${hw.barColor} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                                />
                            </div>
                        </div>
                        <span className={`text-xs font-mono font-bold ${hw.colorText}`}>{hw.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Analytics;
