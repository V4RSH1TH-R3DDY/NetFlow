import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';
import { Activity, Shield, Zap, Globe, AlertCircle, Clock } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { api } from '../lib/api';

const Dashboard = () => {
  const [trafficHistory, setTrafficHistory] = useState([]);
  const [packets, setPackets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const [trends, latestPackets, latestAlerts, topIps] = await Promise.all([
          api.trafficTrends({ limit: 24 }),
          api.listPackets({ limit: 8 }),
          api.listAlerts({ limit: 6 }),
          api.topIps({ limit: 200 }),
        ]);

        setTrafficHistory(
          (trends || [])
            .slice()
            .reverse()
            .map((item) => ({
              time: item.minute_bucket ? new Date(item.minute_bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
              traffic: Math.round(((item.bytes_per_minute || 0) * 8) / 1_000_000),
              alerts: 0,
            }))
        );

        setPackets(
          (latestPackets || []).map((packet) => ({
            id: packet.packet_id,
            timestamp: packet.captured_at ? new Date(packet.captured_at).toLocaleTimeString() : '--',
            src_ip: (packet.src_ip || '').replace('/32', ''),
            dest_ip: (packet.dst_ip || '').replace('/32', ''),
            protocol: packet.protocol,
            size: packet.packet_size,
            status: (packet.packet_size || 0) > 1200 ? 'alert' : 'normal',
          }))
        );

        setAlerts(
          (latestAlerts || []).map((alert) => ({
            id: alert.alert_id,
            title: (alert.rule_name || alert.alert_type || 'alert').replace(/_/g, ' '),
            description: alert.description || 'No description',
            timestamp: alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() : '--',
          }))
        );

        setActiveNodes((topIps || []).length);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const [activeNodes, setActiveNodes] = useState(0);

  const metrics = useMemo(() => {
    const latest = trafficHistory[trafficHistory.length - 1];
    const throughputMbps = latest?.traffic || 0;
    return {
      throughput: throughputMbps,
      activeNodes,
      securityScore: alerts.length === 0 ? 99.1 : Math.max(70, 99 - alerts.length * 2),
      threatsBlocked: alerts.length,
    };
  }, [trafficHistory, alerts.length, activeNodes]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3">
          <Activity className="text-neon-cyan" />
          SYSTEM_OVERVIEW
        </h2>
        <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">REAL_TIME_ANALYSIS_ENGINE_ACTIVE</p>
      </div>

      {error && (
        <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[11px] text-neon-red font-mono">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Throughput"
          value={metrics.throughput.toString()}
          subtext="Mbps Live"
          icon={Zap}
          trend={loading ? '...' : '+live'}
          colorClass="text-neon-cyan"
        />
        <StatsCard
          title="Active Nodes"
          value={metrics.activeNodes.toString()}
          subtext="Connected"
          icon={Globe}
          trend={loading ? '...' : `+${metrics.activeNodes}`}
          colorClass="text-neon-green"
        />
        <StatsCard
          title="Security Score"
          value={metrics.securityScore.toFixed(1)}
          subtext="Shield Optimal"
          icon={Shield}
          trend="Stable"
          colorClass="text-neon-yellow"
        />
        <StatsCard
          title="Threats Blocked"
          value={metrics.threatsBlocked.toString()}
          subtext="Last 24hrs"
          icon={Shield}
          trend={loading ? '...' : `+${metrics.threatsBlocked}`}
          colorClass="text-neon-red"
        />
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat relative">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-bold text-white tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon-cyan" />
              TRAFFIC_OSCILLOSCOPE
            </h3>
            <div className="flex gap-2">
              {['1H', '6H', '24H'].map(p => (
                <button key={p} className="px-3 py-1 bg-dark-bg border border-dark-border rounded text-[10px] font-bold text-gray-500 hover:text-neon-cyan transition-colors">
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficHistory}>
                <defs>
                  <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f7ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00f7ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="time" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }}
                  itemStyle={{ color: '#00f7ff' }}
                />
                <Area
                  type="monotone"
                  dataKey="traffic"
                  stroke="#00f7ff"
                  fillOpacity={1}
                  fill="url(#colorTraffic)"
                  strokeWidth={2}
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts Preview */}
        <div className="bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat flex flex-col">
          <h3 className="text-xs font-bold text-white tracking-widest flex items-center gap-2 mb-6">
            <AlertCircle className="w-4 h-4 text-neon-red" />
            CRITICAL_ALERTS
          </h3>
          <div className="space-y-4 flex-1">
            {alerts.slice(0, 3).map((alert) => (
              <div key={alert.id} className="p-3 bg-dark-bg/50 border-l-2 border-neon-red rounded-r-lg hover:bg-dark-bg transition-colors group">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">{alert.title}</h4>
                  <span className="text-[8px] text-gray-600 font-mono">{alert.timestamp}</span>
                </div>
                <p className="text-[9px] text-gray-500 line-clamp-1">{alert.description}</p>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full py-2 bg-dark-surface border border-dark-border rounded text-[10px] font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest shadow-skeuo-beveled">
            View All Reports
          </button>
        </div>
      </div>

      {/* Recent Packets Preview */}
      <div className="bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat overflow-hidden">
        <h3 className="text-xs font-bold text-white tracking-widest flex items-center gap-2 mb-6">
          <Clock className="w-4 h-4 text-neon-green" />
          RECENT_PACKET_STREAM
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[10px]">
            <thead>
              <tr className="text-gray-500 border-b border-dark-border">
                <th className="pb-3 uppercase tracking-widest">Status</th>
                <th className="pb-3 uppercase tracking-widest">Timestamp</th>
                <th className="pb-3 uppercase tracking-widest">Source_IP</th>
                <th className="pb-3 uppercase tracking-widest">Dest_IP</th>
                <th className="pb-3 uppercase tracking-widest">Proto</th>
                <th className="pb-3 uppercase tracking-widest">Size</th>
              </tr>
            </thead>
            <tbody>
              {packets.slice(0, 5).map((packet) => (
                <tr key={packet.id} className="group hover:bg-white/5 transition-colors border-b border-white/5">
                  <td className="py-3">
                    <div className={`w-2 h-2 rounded-full ${packet.status === 'alert' ? 'bg-neon-red animate-pulse' : 'bg-neon-green'} shadow-sm`} />
                  </td>
                  <td className="py-3 text-gray-400">{packet.timestamp}</td>
                  <td className="py-3 text-neon-cyan">{packet.src_ip}</td>
                  <td className="py-3 text-white">{packet.dest_ip}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 bg-dark-surface border border-dark-border rounded text-[8px] font-bold text-neon-yellow">
                      {packet.protocol}
                    </span>
                  </td>
                  <td className="py-3 text-gray-400">{packet.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
