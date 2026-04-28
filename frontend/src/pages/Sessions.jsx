import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';

const Sessions = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [expandedId, setExpandedId] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sessions', page, searchTerm, protocolFilter],
    queryFn: async () => {
      const params = { limit: pageSize, offset: page * pageSize };
      if (protocolFilter) params.protocol = protocolFilter;
      // Simple search assumes IP search for demo purposes
      if (searchTerm) {
         if (searchTerm.includes('.')) params.src_ip = searchTerm; 
         // Could enhance backend to support full text search or 'any_ip' search
      }
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
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
            SESSIONS_MONITOR
          </h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">STATEFUL_FLOW_TRACKING</p>
        </div>
        <button 
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-dark-panel border border-dark-border rounded-xl text-[10px] font-bold text-gray-400 hover:text-white transition-all shadow-skeuo-beveled"
        >
          <Download className="w-3 h-3" /> EXPORT_CSV
        </button>
      </div>

      {error && (
        <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[11px] text-neon-red font-mono">
          {error.message || "Failed to load sessions"}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-dark-panel/50 rounded-2xl border border-dark-border shadow-skeuo-pressed">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            type="text"
            placeholder="SEARCH_BY_IP..."
            className="w-full bg-dark-bg border border-dark-border rounded-xl py-2 pl-12 pr-4 text-[10px] font-mono text-neon-cyan focus:outline-none focus:border-neon-cyan/50 transition-colors placeholder:text-gray-700 uppercase tracking-widest"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          />
        </div>
        <div className="flex gap-2">
          {['TCP', 'UDP', 'ICMP'].map(p => (
            <button 
              key={p} 
              onClick={() => { setProtocolFilter(protocolFilter === p ? '' : p); setPage(0); }}
              className={`px-4 py-2 bg-dark-bg border rounded-xl text-[9px] font-bold transition-all uppercase tracking-widest ${
                protocolFilter === p ? 'border-neon-cyan text-neon-cyan' : 'border-dark-border text-gray-500 hover:border-neon-yellow hover:text-neon-yellow'
              }`}
            >
              {p}
            </button>
          ))}
          <button 
            onClick={() => { setProtocolFilter(''); setSearchTerm(''); setPage(0); }}
            className="p-2 bg-dark-bg border border-dark-border rounded-xl text-gray-600 hover:text-white"
            title="Clear Filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-dark-panel rounded-2xl border border-dark-border shadow-skeuo-flat flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-dark-surface z-10">
              <tr className="text-gray-500 border-b border-dark-border uppercase tracking-widest text-[9px]">
                <th className="p-4 px-6 w-10"></th>
                <th className="p-4">ID</th>
                <th className="p-4">Source_IP</th>
                <th className="p-4">Destination_IP</th>
                <th className="p-4">Protocol</th>
                <th className="p-4">Started</th>
                <th className="p-4 text-right">Packets</th>
                <th className="p-4 text-right pr-6">Bytes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[11px] text-gray-500 animate-pulse">LOADING_DATA...</td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[11px] text-gray-500">NO_SESSIONS_FOUND</td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <React.Fragment key={session.session_id}>
                    <tr 
                      className={`group hover:bg-neon-cyan/5 transition-colors cursor-pointer ${expandedId === session.session_id ? 'bg-dark-surface/50' : ''}`}
                      onClick={() => setExpandedId(expandedId === session.session_id ? null : session.session_id)}
                    >
                      <td className="p-4 px-6 text-gray-600">
                        {expandedId === session.session_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                      <td className="p-4 text-gray-500">{session.session_id}</td>
                      <td className="p-4 text-neon-cyan font-bold">{session.src_ip}:{session.src_port || '*'}</td>
                      <td className="p-4 text-white">{session.dst_ip}:{session.dst_port || '*'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 bg-dark-bg border rounded text-[8px] font-bold
                          ${session.protocol === 'TCP' ? 'border-neon-cyan text-neon-cyan' :
                            session.protocol === 'UDP' ? 'border-neon-green text-neon-green' :
                              'border-neon-yellow text-neon-yellow'}
                        `}>
                          {session.protocol}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">
                        {session.started_at ? new Date(session.started_at).toLocaleTimeString() : '--'}
                      </td>
                      <td className="p-4 text-right text-neon-green">{session.packet_count}</td>
                      <td className="p-4 text-right pr-6 text-gray-400">{session.total_bytes}</td>
                    </tr>
                    {expandedId === session.session_id && (
                      <tr className="bg-dark-bg/50 border-b border-dark-border">
                        <td colSpan={8} className="p-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div>
                              <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Flow Hash</span>
                              <span className="text-[10px] text-white">{session.flow_hash}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Started At</span>
                              <span className="text-[10px] text-white">{session.started_at ? new Date(session.started_at).toLocaleString() : '--'}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Ended At</span>
                              <span className="text-[10px] text-white">{session.ended_at ? new Date(session.ended_at).toLocaleString() : 'ACTIVE'}</span>
                            </div>
                            <div>
                              <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Avg Packet Size</span>
                              <span className="text-[10px] text-white">
                                {session.packet_count > 0 ? Math.round(session.total_bytes / session.packet_count) : 0} B
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-dark-border bg-dark-surface/30 flex justify-between items-center text-[9px] text-gray-600 font-mono tracking-widest uppercase mt-auto">
          <span>Displayed: {sessions.length}</span>
          <div className="flex gap-4">
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="hover:text-white disabled:opacity-30 transition-colors"
            >
              PREVIOUS
            </button>
            <span className="text-white">Page {page + 1}</span>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={sessions.length < pageSize || isLoading}
              className="hover:text-white disabled:opacity-30 transition-colors"
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sessions;
