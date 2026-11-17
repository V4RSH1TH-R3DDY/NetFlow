import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, RefreshCw, X, ChevronRight, Check } from 'lucide-react';
import { api } from '../lib/api';

const AlertDetailDrawer = ({ alertId, onClose, onStatusChange }) => {
  const { data: alertDetail, isLoading } = useQuery({
    queryKey: ['alert', alertId],
    queryFn: () => api.getAlert(alertId),
    enabled: !!alertId,
  });

  if (!alertId) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-dark-panel border-l border-dark-border z-50 flex flex-col font-mono text-xs">
      <div className="h-12 border-b border-dark-border px-4 flex items-center justify-between bg-dark-surface/50">
        <span className="font-semibold text-zinc-100">INCIDENT_FILE #{alertId}</span>
        <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading || !alertDetail ? (
          <div className="text-zinc-500 py-10 text-center">FETCHING_TELEMETRY...</div>
        ) : (
          <>
            <div className="border border-dark-border p-3 space-y-2 bg-dark-surface/20">
              <div className="text-[10px] text-zinc-500 uppercase">STATUS & SEVERITY</div>
              <div className="flex items-center justify-between">
                <span className={`px-1.5 py-0.5 border text-[10px] uppercase ${
                  alertDetail.status === 'open' ? 'border-rose-500/40 text-rose-400 bg-rose-500/10' : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                }`}>
                  {alertDetail.status}
                </span>
                <span className="text-zinc-300 font-bold">SEVERITY {alertDetail.severity}</span>
              </div>
            </div>

            <div className="border border-dark-border p-3 space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase">SUMMARY</div>
              <p className="text-zinc-300 leading-relaxed">{alertDetail.description || 'No description logged.'}</p>
            </div>

            {alertDetail.session && (
              <div className="border border-dark-border p-3 space-y-2">
                <div className="text-[10px] text-zinc-500 uppercase">SESSION_FLOW</div>
                <div className="space-y-1 text-zinc-400">
                  <div>SRC: {alertDetail.session.src_ip}:{alertDetail.session.src_port || '--'}</div>
                  <div>DST: {alertDetail.session.dst_ip}:{alertDetail.session.dst_port || '--'}</div>
                  <div>PROTO: {alertDetail.session.protocol}</div>
                  <div>PACKETS: {alertDetail.session.packet_count}</div>
                </div>
              </div>
            )}

            <div className="border-t border-dark-border pt-4 flex gap-2">
              {alertDetail.status === 'open' && (
                <button
                  onClick={() => onStatusChange(alertId, 'resolved')}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-zinc-100 font-mono text-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> RESOLVE_INCIDENT
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Alerts = () => {
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['alerts', page, statusFilter],
    queryFn: async () => {
      const params = { limit: pageSize, offset: page * pageSize };
      if (statusFilter) params.status = statusFilter;
      return api.listAlerts(params);
    },
    keepPreviousData: true,
  });

  const alerts = data || [];

  const handleStatusChange = async (alertId, newStatus) => {
    try {
      await api.updateAlertStatus(alertId, newStatus);
      refetch();
      if (selectedAlertId === alertId) setSelectedAlertId(null);
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Top box */}
      <div className="box-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span className="font-semibold text-zinc-100 uppercase">INCIDENT_REGISTRY</span>
          <span className="text-zinc-500">({alerts.length} LOADED)</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-dark-surface border border-dark-border px-2.5 py-1 text-zinc-300 focus:outline-none"
          >
            <option value="">ALL_STATUSES</option>
            <option value="open">OPEN</option>
            <option value="acknowledged">ACKNOWLEDGED</option>
            <option value="resolved">RESOLVED</option>
          </select>

          <button
            onClick={() => refetch()}
            className="p-1 border border-dark-border bg-dark-surface text-zinc-400 hover:text-zinc-100"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400">
          ERR: {error.message}
        </div>
      )}

      {/* Boxed Table */}
      <div className="box-panel overflow-hidden">
        <div className="box-panel-header">
          <span>THREAT_EVENT_STREAM</span>
          <span className="text-[10px] text-zinc-500">PAGE {page + 1}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface/40 text-[10px] text-zinc-500 uppercase">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">RULE / TYPE</th>
                <th className="py-2.5 px-3">SEVERITY</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">TIMESTAMP</th>
                <th className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    {isLoading ? "LOADING_DATA..." : "NO_ALERTS_FOUND"}
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr 
                    key={alert.alert_id}
                    onClick={() => setSelectedAlertId(alert.alert_id)}
                    className="hover:bg-dark-surface/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-zinc-400">#{alert.alert_id}</td>
                    <td className="py-2 px-3 font-semibold text-zinc-200">
                      {(alert.rule_name || alert.alert_type || 'ALERT').toUpperCase()}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 border text-[10px] ${
                        (alert.severity || 1) >= 4 
                          ? 'border-rose-500/40 text-rose-400 bg-rose-500/10' 
                          : 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                      }`}>
                        SEV-{alert.severity || 1}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 border text-[10px] ${
                        alert.status === 'open' ? 'border-rose-500/40 text-rose-400' : 'border-emerald-500/40 text-emerald-400'
                      }`}>
                        {alert.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-zinc-500">
                      {alert.triggered_at ? new Date(alert.triggered_at).toLocaleString() : '--'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <ChevronRight className="w-3.5 h-3.5 inline text-zinc-500" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center text-zinc-500">
        <button
          disabled={page === 0}
          onClick={() => setPage(p => Math.max(0, p - 1))}
          className="px-3 py-1 border border-dark-border bg-dark-panel hover:bg-dark-surface disabled:opacity-30 disabled:pointer-events-none"
        >
          [PREV]
        </button>
        <span>PAGE {page + 1}</span>
        <button
          disabled={alerts.length < pageSize}
          onClick={() => setPage(p => p + 1)}
          className="px-3 py-1 border border-dark-border bg-dark-panel hover:bg-dark-surface disabled:opacity-30 disabled:pointer-events-none"
        >
          [NEXT]
        </button>
      </div>

      {/* Drawer */}
      <AlertDetailDrawer 
        alertId={selectedAlertId} 
        onClose={() => setSelectedAlertId(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default Alerts;
