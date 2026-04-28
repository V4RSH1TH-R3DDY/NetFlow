import React, { useMemo, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Activity, Shield, Globe, AlertCircle, Clock, Zap, DatabaseZap } from 'lucide-react';
import StatsCard from '../components/StatsCard';
import { api } from '../lib/api';

const Dashboard = () => {

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard_data'],
    queryFn: async () => {
      const [
        trends,
        latestPackets,
        latestAlerts,
        topIps,
        packetCount,
        sessionsCount,
        ingestions
      ] = await Promise.all([
        api.trafficTrends({ limit: 24 }),
        api.listPackets({ limit: 8 }),
        api.listAlerts({ limit: 6, status: 'open' }),
        api.topIps({ limit: 5 }),
        api.packetCount(),
        api.listSessions({ limit: 1 }), // just to get total count
        api.listIngestionRuns({ limit: 1 })
      ]);

      // Calculate protocol stats from packets (in real app, would be aggregated on backend)
      const allPackets = await api.listPackets({ limit: 500 });
      const protocolCounts = (allPackets || []).reduce((acc, packet) => {
        const key = (packet.protocol || 'OTHER').toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const totalProtos = Object.values(protocolCounts).reduce((sum, count) => sum + count, 0) || 1;
      const palette = { TCP: '#00f7ff', UDP: '#39ff14', ICMP: '#ff003c', OTHER: '#f4e04d' };
      const computedProtocols = Object.entries(protocolCounts)
        .map(([name, count]) => ({
          name,
          value: Math.max(1, Math.round((count / totalProtos) * 100)),
          color: palette[name] || '#f4e04d',
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 4);

      return {
        trends,
        latestPackets,
        latestAlerts,
        topIps,
        totalPackets: packetCount?.count || 0,
        activeSessions: sessionsCount?.meta?.returned || 0, // Mocked as returned count for now
        lastIngestion: ingestions?.[0]?.started_at,
        protocolStats: computedProtocols.length ? computedProtocols : [{ name: 'NO_DATA', value: 100, color: '#6b7280' }]
      };
    },
    refetchInterval: 30000, // 30 seconds auto-refresh
  });

  const [liveMetrics, setLiveMetrics] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [toasts, setToasts] = useState([]);
  const [liveTraffic, setLiveTraffic] = useState([]);

  useEffect(() => {
    const metricsSse = new EventSource('/api/stream/metrics');
    const alertsSse = new EventSource('/api/stream/alerts');

    metricsSse.onopen = () => setConnectionStatus('connected');
    metricsSse.onerror = () => setConnectionStatus('error');

    metricsSse.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        setLiveMetrics(parsed);

        setLiveTraffic(prev => {
          const newData = [...prev, {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            traffic: parsed.pps || 0,
            rawCount: parsed.packet_count
          }].slice(-60);
          return newData;
        });
      } catch (err) {
        console.error("Metrics SSE parse error", err);
      }
    };

    alertsSse.onmessage = (e) => {
      try {
        const alert = JSON.parse(e.data);
        const id = Date.now();
        setToasts(prev => [...prev, { id, ...alert }]);
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
      } catch (err) {
        console.error("Alerts SSE parse error", err);
      }
    };

    return () => {
      metricsSse.close();
      alertsSse.close();
    };
  }, []);

  const dashboardData = data || {
    trends: [], latestPackets: [], latestAlerts: [], topIps: [],
    totalPackets: 0, activeSessions: 0, lastIngestion: null, protocolStats: []
  };

  const displayTotalPackets = liveMetrics?.packet_count ?? dashboardData.totalPackets;
  const displayActiveSessions = liveMetrics?.active_sessions ?? dashboardData.activeSessions;
  const displayOpenAlerts = liveMetrics?.open_alerts ?? dashboardData.latestAlerts.length;
  const displayLastIngestion = liveMetrics?.last_ingestion ?? dashboardData.lastIngestion;

  const trafficHistory = useMemo(() => {
    if (liveTraffic.length > 5) return liveTraffic;
    return (dashboardData.trends || [])
      .slice()
      .reverse()
      .map((item) => ({
        time: item.minute_bucket ? new Date(item.minute_bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        traffic: Math.round(((item.bytes_per_minute || 0) * 8) / 1_000_000),
      }));
  }, [dashboardData.trends, liveTraffic]);

  const mapSeverity = (severity) => {
    if (severity >= 4) return 'critical';
    if (severity >= 2) return 'medium';
    return 'low';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3">
            <Activity className="text-neon-cyan" />
            SYSTEM_OVERVIEW
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">REAL_TIME_ANALYSIS_ENGINE_ACTIVE</p>
            <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-neon-green shadow-neon-glow-green' : 'bg-neon-red animate-pulse'} `} />
            <span className="text-[8px] text-gray-600 font-mono uppercase">{connectionStatus}</span>
          </div>
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-2 bg-dark-surface border border-dark-border rounded text-[10px] font-mono text-neon-cyan uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse shadow-neon-glow-cyan" />
            SYNCING_DATA...
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[11px] text-neon-red font-mono">
          {error.message || "Failed to load dashboard data"}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Packets"
          value={new Intl.NumberFormat().format(displayTotalPackets)}
          subtext="Processed"
          icon={Activity}
          trend={isLoading ? '...' : '+live'}
          colorClass="text-neon-cyan"
        />
        <StatsCard
          title="Active Sessions"
          value={new Intl.NumberFormat().format(displayActiveSessions)}
          subtext="Connected"
          icon={Globe}
          trend={isLoading ? '...' : `+${displayActiveSessions}`}
          colorClass="text-neon-green"
        />
        <StatsCard
          title="Open Alerts"
          value={new Intl.NumberFormat().format(displayOpenAlerts)}
          subtext="Requires Action"
          icon={Shield}
          trend={displayOpenAlerts > 0 ? "ATTENTION" : "CLEAR"}
          colorClass={displayOpenAlerts > 0 ? "text-neon-red" : "text-neon-green"}
        />
        <StatsCard
          title="Last Ingestion"
          value={displayLastIngestion ? new Date(displayLastIngestion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
          subtext={displayLastIngestion ? new Date(displayLastIngestion).toLocaleDateString() : '--'}
          icon={DatabaseZap}
          trend={isLoading ? '...' : 'SYNCED'}
          colorClass="text-neon-yellow"
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Traffic Area Chart */}
        <div className="lg:col-span-2 bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat relative">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xs font-bold text-white tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon-cyan" />
              TRAFFIC_OSCILLOSCOPE
            </h3>
          </div>
          <div className="h-[250px] w-full">
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
                <Area type="monotone" dataKey="traffic" stroke="#00f7ff" fillOpacity={1} fill="url(#colorTraffic)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Protocol Donut */}
        <div className="bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat flex flex-col">
          <h3 className="text-xs font-bold text-white tracking-widest flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-neon-yellow" />
            PROTOCOL_DIST
          </h3>
          <div className="flex-1 min-h-[150px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardData.protocolStats}
                  cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5}
                  dataKey="value" stroke="none"
                >
                  {dashboardData.protocolStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {dashboardData.protocolStats.map((stat) => (
              <div key={stat.name} className="flex justify-between items-center p-2 bg-dark-bg/50 rounded-lg border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stat.color }} />
                  <span className="text-[9px] font-bold text-white uppercase">{stat.name}</span>
                </div>
                <span className="text-[9px] font-mono text-gray-400">{stat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top IPs Bar Chart */}
        <div className="bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat">
          <h3 className="text-xs font-bold text-white tracking-widest flex items-center gap-2 mb-6">
            <Globe className="w-4 h-4 text-neon-green" />
            TOP_IP_NODES
          </h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.topIps} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis dataKey="ip" type="category" stroke="#888" fontSize={10} tickLine={false} axisLine={false} width={100} tickFormatter={(val) => val.replace('/32', '')} />
                <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }} />
                <Bar dataKey="packet_count" fill="#39ff14" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts Preview */}
        <div className="bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat flex flex-col">
          <h3 className="text-xs font-bold text-white tracking-widest flex items-center gap-2 mb-6">
            <AlertCircle className="w-4 h-4 text-neon-red" />
            CRITICAL_ALERTS
          </h3>
          <div className="space-y-4 flex-1 overflow-auto">
            {dashboardData.latestAlerts.slice(0, 4).map((alert) => (
              <div key={alert.alert_id} className="p-3 bg-dark-bg/50 border-l-2 border-neon-red rounded-r-lg hover:bg-dark-bg transition-colors group">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {(alert.rule_name || alert.alert_type || 'alert').replace(/_/g, ' ')}
                  </h4>
                  <span className="text-[8px] text-gray-600 font-mono">
                    {alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() : '--'}
                  </span>
                </div>
                <p className="text-[9px] text-gray-500 line-clamp-1">{alert.description || 'No description'}</p>
              </div>
            ))}
            {dashboardData.latestAlerts.length === 0 && (
              <div className="h-full flex items-center justify-center text-[10px] text-gray-500 uppercase tracking-widest">
                NO_ACTIVE_ALERTS
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Real-time Toast Overlay */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="p-4 bg-dark-panel border border-neon-red shadow-neon-glow-red rounded-xl animate-in slide-in-from-right duration-300 pointer-events-auto max-w-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-neon-red w-5 h-5" />
              <div>
                <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">CRITICAL_DETECTION</h4>
                <p className="text-[11px] text-gray-300 font-mono">{toast.alert_type}: {toast.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
