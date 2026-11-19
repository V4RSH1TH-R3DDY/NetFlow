import React, { useMemo, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Activity, Shield, Globe, Clock, Radio, ArrowUpRight } from 'lucide-react';
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
        api.listSessions({ limit: 1 }),
        api.listIngestionRuns({ limit: 1 })
      ]);

      const allPackets = await api.listPackets({ limit: 500 });
      const protocolCounts = (allPackets || []).reduce((acc, packet) => {
        const key = (packet.protocol || 'OTHER').toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const totalProtos = Object.values(protocolCounts).reduce((sum, count) => sum + count, 0) || 1;
      const palette = { TCP: '#06b6d4', UDP: '#10b981', ICMP: '#f43f5e', OTHER: '#a1a1aa' };
      const computedProtocols = Object.entries(protocolCounts)
        .map(([name, count]) => ({
          name,
          value: Math.max(1, Math.round((count / totalProtos) * 100)),
          color: palette[name] || '#71717a',
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 4);

      return {
        trends,
        latestPackets,
        latestAlerts,
        topIps,
        totalPackets: packetCount?.count || 0,
        activeSessions: sessionsCount?.meta?.returned || 0,
        lastIngestion: ingestions?.[0]?.started_at,
        protocolStats: computedProtocols.length ? computedProtocols : [{ name: 'NO_DATA', value: 100, color: '#3f3f46' }]
      };
    },
    refetchInterval: 15000,
  });

  const [liveMetrics, setLiveMetrics] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [liveTraffic, setLiveTraffic] = useState([]);
  const [liveToasts, setLiveToasts] = useState([]);

  useEffect(() => {
    const metricsSse = new EventSource('/api/stream/metrics');
    const alertsSse = new EventSource('/api/stream/alerts');

    metricsSse.onopen = () => setConnectionStatus('connected');
    metricsSse.onerror = () => setConnectionStatus('offline');

    metricsSse.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        setLiveMetrics(parsed);

        setLiveTraffic(prev => {
          const newData = [...prev, {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            traffic: parsed.pps || 0,
            rawCount: parsed.packet_count
          }].slice(-30);
          return newData;
        });
      } catch (err) {
        console.error("Metrics SSE parse error", err);
      }
    };

    alertsSse.onmessage = (e) => {
      try {
        const newAlert = JSON.parse(e.data);
        const toastId = Date.now() + Math.random();
        setLiveToasts(prev => [ { id: toastId, ...newAlert }, ...prev ].slice(0, 4));
        setTimeout(() => {
          setLiveToasts(prev => prev.filter(t => t.id !== toastId));
        }, 6000);
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
    if (liveTraffic.length > 3) return liveTraffic;
    return (dashboardData.trends || [])
      .slice()
      .reverse()
      .map((item) => ({
        time: item.minute_bucket ? new Date(item.minute_bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        traffic: Math.round(((item.bytes_per_minute || 0) * 8) / 1_000_000),
      }));
  }, [dashboardData.trends, liveTraffic]);

  return (
    <div className="space-y-4 font-mono relative">
      {/* Real-time Alert Toast Notification Popups */}
      {liveToasts.length > 0 && (
        <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-auto">
          {liveToasts.map(toast => (
            <div
              key={toast.id}
              className="border border-rose-500/50 bg-dark-panel p-3 shadow-2xl flex items-start gap-2.5 animate-in slide-in-from-right duration-200"
            >
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-[11px] font-bold text-rose-400 uppercase">
                  <span>LIVE_ALERT #{toast.alert_id}</span>
                  <span className="text-[9px] px-1 border border-rose-500/40">SEV-{toast.severity || 4}</span>
                </div>
                <div className="text-xs text-zinc-200 font-semibold truncate mt-0.5">{toast.alert_type}</div>
                <div className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">{toast.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header bar */}
      <div className="box-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">SYSTEM_DASHBOARD</span>
          <div className="h-3 w-px bg-dark-border" />
          <span className="text-xs text-zinc-400">STATUS: {connectionStatus.toUpperCase()}</span>
        </div>
        {isLoading && (
          <span className="text-xs text-zinc-500 animate-pulse">POLLING_DB...</span>
        )}
      </div>

      {error && (
        <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
          ERR: {error.message || "Failed to load dashboard telemetry"}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Total Packets"
          value={new Intl.NumberFormat().format(displayTotalPackets)}
          subtext="Processed count"
          icon={Activity}
          trend="+LIVE"
        />
        <StatsCard
          title="Active Sessions"
          value={new Intl.NumberFormat().format(displayActiveSessions)}
          subtext="Current tracked"
          icon={Globe}
          trend={`+${displayActiveSessions}`}
        />
        <StatsCard
          title="Open Alerts"
          value={new Intl.NumberFormat().format(displayOpenAlerts)}
          subtext="Pending review"
          icon={Shield}
          trend={displayOpenAlerts > 0 ? "ACTION_REQ" : "NORMAL"}
        />
        <StatsCard
          title="Last Sync"
          value={displayLastIngestion ? new Date(displayLastIngestion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
          subtext={displayLastIngestion ? new Date(displayLastIngestion).toLocaleDateString() : 'NO_DATA'}
          icon={Clock}
          trend="UTC"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Traffic Scope */}
        <div className="lg:col-span-2 box-panel flex flex-col">
          <div className="box-panel-header">
            <span>TRAFFIC_OSCILLOSCOPE (PPS)</span>
            <span className="text-[10px] text-zinc-500">WINDOW: 30S</span>
          </div>
          <div className="p-4 h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficHistory}>
                <CartesianGrid stroke="#27272a" strokeDasharray="2 2" vertical={false} />
                <XAxis dataKey="time" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0e0e11', border: '1px solid #27272a', fontSize: '11px', fontFamily: 'monospace' }}
                  itemStyle={{ color: '#06b6d4' }}
                />
                <Area type="stepAfter" dataKey="traffic" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Protocol Distribution */}
        <div className="box-panel flex flex-col">
          <div className="box-panel-header">
            <span>PROTOCOL_DISTRIBUTION</span>
            <span className="text-[10px] text-zinc-500">SHARE</span>
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dashboardData.protocolStats}
                    cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2}
                    dataKey="value" stroke="#0e0e11" strokeWidth={2}
                  >
                    {dashboardData.protocolStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0e0e11', border: '1px solid #27272a', fontSize: '11px', fontFamily: 'monospace' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 border-t border-dark-border pt-3">
              {dashboardData.protocolStats.map((stat) => (
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

      {/* Bottom Grid: Top IPs & Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top Talker IPs */}
        <div className="box-panel flex flex-col">
          <div className="box-panel-header">
            <span>TOP_TALKER_NODES</span>
            <span className="text-[10px] text-zinc-500">PACKETS</span>
          </div>
          <div className="p-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardData.topIps} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="2 2" horizontal={false} />
                <XAxis type="number" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis dataKey="ip" type="category" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} width={100} tickFormatter={(val) => (val || '').replace('/32', '')} />
                <Tooltip contentStyle={{ backgroundColor: '#0e0e11', border: '1px solid #27272a', fontSize: '11px', fontFamily: 'monospace' }} />
                <Bar dataKey="packet_count" fill="#10b981" radius={0} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="box-panel flex flex-col">
          <div className="box-panel-header">
            <span>RECENT_INCIDENTS</span>
            <span className="text-[10px] text-zinc-500">LIVE</span>
          </div>
          <div className="p-2 space-y-1.5 flex-1 overflow-auto max-h-52">
            {dashboardData.latestAlerts.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">NO_ACTIVE_INCIDENTS_DETECTED</div>
            ) : (
              dashboardData.latestAlerts.slice(0, 4).map((alert) => (
                <div key={alert.alert_id} className="p-2 border border-dark-border bg-dark-surface/40 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-zinc-200">
                      {(alert.rule_name || alert.alert_type || 'ALERT').toUpperCase()}
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate max-w-xs">{alert.description}</div>
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {alert.triggered_at ? new Date(alert.triggered_at).toLocaleTimeString() : '--'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
