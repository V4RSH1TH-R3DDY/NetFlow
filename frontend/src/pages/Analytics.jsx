import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart3, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const Analytics = () => {
    const [protocolStats, setProtocolStats] = useState([]);
    const [trafficHistory, setTrafficHistory] = useState([]);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const loadAnalytics = async () => {
        setError('');
        setIsLoading(true);
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
                TCP: '#06b6d4',
                UDP: '#10b981',
                ICMP: '#f43f5e',
                OTHER: '#a1a1aa',
            };

            const computedProtocols = Object.entries(protocolCounts)
                .map(([name, count]) => ({
                    name,
                    value: Math.max(1, Math.round((count / total) * 100)),
                    color: palette[name] || '#71717a',
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 6);

            setProtocolStats(computedProtocols.length ? computedProtocols : [{ name: 'NO_DATA', value: 100, color: '#3f3f46' }]);

            setTrafficHistory(
                (trends || [])
                    .slice()
                    .reverse()
                    .map((item) => ({
                        time: item.minute_bucket
                            ? new Date(item.minute_bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '--',
                        mbps: Math.round(((item.bytes_per_minute || 0) * 8) / 1_000_000),
                        packets: item.packet_count || 0,
                    }))
            );
        } catch (err) {
            setError(err.message || 'Failed to load analytics telemetry');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, []);

    return (
        <div className="space-y-4 font-mono text-xs">
            {/* Header Control Box */}
            <div className="box-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <span className="font-semibold text-zinc-100 uppercase">TELEMETRY_ANALYTICS</span>
                    <span className="text-zinc-500">AGGREGATION_ENGINE</span>
                </div>

                <button
                    onClick={loadAnalytics}
                    className="p-1 border border-dark-border bg-dark-surface text-zinc-400 hover:text-zinc-100"
                    title="Refresh"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {error && (
                <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400">
                    ERR: {error}
                </div>
            )}

            {/* Top Chart Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Traffic Volume (Area) */}
                <div className="lg:col-span-2 box-panel flex flex-col">
                    <div className="box-panel-header">
                        <span>THROUGHPUT_HISTORY (MBPS)</span>
                        <span className="text-[10px] text-zinc-500">WINDOW: 120M</span>
                    </div>
                    <div className="p-4 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trafficHistory}>
                                <CartesianGrid stroke="#27272a" strokeDasharray="2 2" vertical={false} />
                                <XAxis dataKey="time" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0e0e11', border: '1px solid #27272a', fontSize: '11px', fontFamily: 'monospace' }} />
                                <Area type="stepAfter" dataKey="mbps" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} strokeWidth={1.5} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Protocol Breakdown */}
                <div className="box-panel flex flex-col">
                    <div className="box-panel-header">
                        <span>PROTOCOL_RATIO</span>
                        <span className="text-[10px] text-zinc-500">SHARE</span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={protocolStats}
                                        cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}
                                        dataKey="value" stroke="#0e0e11" strokeWidth={2}
                                    >
                                        {protocolStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0e0e11', border: '1px solid #27272a', fontSize: '11px', fontFamily: 'monospace' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 border-t border-dark-border pt-3">
                            {protocolStats.map((stat) => (
                                <div key={stat.name} className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 inline-block" style={{ backgroundColor: stat.color }} />
                                        <span className="text-zinc-300">{stat.name}</span>
                                    </div>
                                    <span className="text-zinc-500">{stat.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="box-panel p-4">
                    <div className="text-[10px] text-zinc-500 uppercase">ENGINE_PROCESSING_LATENCY</div>
                    <div className="text-xl font-bold text-zinc-100 my-1">&lt; 12 ms</div>
                    <div className="text-[10px] text-emerald-400">NOMINAL_OPERATING_RANGE</div>
                </div>
                <div className="box-panel p-4">
                    <div className="text-[10px] text-zinc-500 uppercase">INGESTION_STAGING_BUFFER</div>
                    <div className="text-xl font-bold text-zinc-100 my-1">0 PENDING</div>
                    <div className="text-[10px] text-emerald-400">FLUSH_CYCLE_ACTIVE</div>
                </div>
                <div className="box-panel p-4">
                    <div className="text-[10px] text-zinc-500 uppercase">MODEL_MEMORY_FOOTPRINT</div>
                    <div className="text-xl font-bold text-zinc-100 my-1">42.8 MB</div>
                    <div className="text-[10px] text-zinc-400">RANDOM_FOREST + ISO</div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
