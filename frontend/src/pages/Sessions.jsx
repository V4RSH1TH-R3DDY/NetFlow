import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layers, Download, Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';

const Sessions = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const [expandedId, setExpandedId] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sessions', page, searchTerm, protocolFilter],
    queryFn: async () => {
      const params = { limit: pageSize, offset: page * pageSize };
      if (protocolFilter) params.protocol = protocolFilter;
      if (searchTerm && searchTerm.includes('.')) params.src_ip = searchTerm;
      return api.listSessions(params);
    },
    keepPreviousData: true,
  });

  const sessions = data || [];

  const handleExportCSV = () => {
    if (!sessions.length) return;
    const headers = ['Session ID', 'Src IP', 'Dst IP', 'Protocol', 'Started At', 'Ended At', 'Packets', 'Bytes'];
    const csvContent = [
      headers.join(','),
      ...sessions.map(s => [
        s.session_id, s.src_ip, s.dst_ip, s.protocol, s.started_at, s.ended_at, s.packet_count, s.total_bytes
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sessions_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Control Box */}
      <div className="box-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-zinc-100 uppercase">SESSION_FLOW_MONITOR</span>
          <span className="text-zinc-500">({sessions.length} ACTIVE)</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="FILTER IP (e.g. 192.168.1.1)"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            className="bg-dark-surface border border-dark-border px-2.5 py-1 text-zinc-300 placeholder:text-zinc-600 focus:outline-none w-52"
          />

          <select
            value={protocolFilter}
            onChange={(e) => { setProtocolFilter(e.target.value); setPage(0); }}
            className="bg-dark-surface border border-dark-border px-2.5 py-1 text-zinc-300 focus:outline-none"
          >
            <option value="">ALL_PROTO</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
            <option value="ICMP">ICMP</option>
          </select>

          <button
            onClick={() => refetch()}
            className="p-1 border border-dark-border bg-dark-surface text-zinc-400 hover:text-zinc-100"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleExportCSV}
            className="px-2.5 py-1 border border-dark-border bg-dark-surface hover:bg-zinc-800 text-zinc-300 flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" /> CSV
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
          <span>STATEFUL_CONVERSATIONS</span>
          <span className="text-[10px] text-zinc-500">PAGE {page + 1}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface/40 text-[10px] text-zinc-500 uppercase">
                <th className="py-2 px-3 w-8"></th>
                <th className="py-2 px-3">ID</th>
                <th className="py-2 px-3">SOURCE_NODE</th>
                <th className="py-2 px-3">DEST_NODE</th>
                <th className="py-2 px-3">PROTO</th>
                <th className="py-2 px-3">STARTED</th>
                <th className="py-2 px-3 text-right">PACKETS</th>
                <th className="py-2 px-3 text-right">VOLUME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500">
                    {isLoading ? "POLLING_SESSIONS..." : "NO_SESSIONS_RECORDED"}
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <React.Fragment key={s.session_id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === s.session_id ? null : s.session_id)}
                      className="hover:bg-dark-surface/50 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 text-zinc-500">
                        {expandedId === s.session_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </td>
                      <td className="py-2 px-3 text-zinc-400">#{s.session_id}</td>
                      <td className="py-2 px-3 text-zinc-200">
                        {(s.src_ip || '').replace('/32', '')}{s.src_port ? `:${s.src_port}` : ''}
                      </td>
                      <td className="py-2 px-3 text-zinc-200">
                        {(s.dst_ip || '').replace('/32', '')}{s.dst_port ? `:${s.dst_port}` : ''}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1 py-0.5 border border-dark-border text-[10px] text-zinc-300">
                          {s.protocol}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-400">
                        {s.started_at ? new Date(s.started_at).toLocaleTimeString() : '--'}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-semibold">{s.packet_count}</td>
                      <td className="py-2 px-3 text-right text-zinc-400">{s.total_bytes ? `${s.total_bytes} B` : '--'}</td>
                    </tr>
                    {expandedId === s.session_id && (
                      <tr className="bg-dark-surface/30 border-b border-dark-border">
                        <td colSpan={8} className="p-3 text-[11px] text-zinc-400 space-y-1">
                          <div><span className="text-zinc-500">FLOW_HASH:</span> {s.flow_hash}</div>
                          <div><span className="text-zinc-500">STARTED_AT:</span> {s.started_at ? new Date(s.started_at).toLocaleString() : '--'}</div>
                          <div><span className="text-zinc-500">ENDED_AT:</span> {s.ended_at ? new Date(s.ended_at).toLocaleString() : 'ACTIVE_IN_WINDOW'}</div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
          disabled={sessions.length < pageSize}
          onClick={() => setPage(p => p + 1)}
          className="px-3 py-1 border border-dark-border bg-dark-panel hover:bg-dark-surface disabled:opacity-30 disabled:pointer-events-none"
        >
          [NEXT]
        </button>
      </div>
    </div>
  );
};

export default Sessions;
