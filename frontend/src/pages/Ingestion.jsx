import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DatabaseZap, RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../lib/api';

const Ingestion = () => {
  const [page, setPage] = useState(0);
  const pageSize = 15;
  const [expandedId, setExpandedId] = useState(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ingestionRuns', page],
    queryFn: async () => {
      const params = { limit: pageSize, offset: page * pageSize };
      return api.listIngestionRuns(params);
    },
    keepPreviousData: true,
  });

  const runs = data || [];

  const handleRefresh = () => {
    refetch();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-neon-green" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-neon-red" />;
      case 'running': return <Clock className="w-4 h-4 text-neon-yellow animate-pulse" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'success': return 'border-neon-green text-neon-green';
      case 'failed': return 'border-neon-red text-neon-red';
      case 'running': return 'border-neon-yellow text-neon-yellow';
      default: return 'border-gray-500 text-gray-500';
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
            <DatabaseZap className="text-neon-cyan" />
            INGESTION_PIPELINE
          </h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">BATCH_JOB_HISTORY & STATUS</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-dark-panel border border-dark-border rounded-xl text-[10px] font-bold text-gray-400 hover:text-white transition-all shadow-skeuo-beveled"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} /> REFRESH
          </button>
          <button 
            className="flex items-center gap-2 px-6 py-2 bg-neon-cyan/10 border border-neon-cyan/50 rounded-xl text-[10px] font-bold text-neon-cyan hover:bg-neon-cyan/20 transition-all shadow-neon-glow-cyan"
            onClick={() => alert('Manual ingestion trigger not yet wired to backend')}
          >
            TRIGGER_RUN
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[11px] text-neon-red font-mono">
          {error.message || "Failed to load ingestion runs"}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 bg-dark-panel rounded-2xl border border-dark-border shadow-skeuo-flat flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-dark-surface z-10">
              <tr className="text-gray-500 border-b border-dark-border uppercase tracking-widest text-[9px]">
                <th className="p-4 px-6 w-10"></th>
                <th className="p-4">Run_ID</th>
                <th className="p-4">Status</th>
                <th className="p-4">Source_File</th>
                <th className="p-4">Started_At</th>
                <th className="p-4 text-right">Received</th>
                <th className="p-4 text-right">Inserted</th>
                <th className="p-4 text-right pr-6">Rejected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[11px] text-gray-500 animate-pulse">LOADING_DATA...</td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[11px] text-gray-500">NO_INGESTION_RUNS_FOUND</td>
                </tr>
              ) : (
                runs.map((run) => (
                  <React.Fragment key={run.run_id}>
                    <tr 
                      className={`group hover:bg-neon-cyan/5 transition-colors cursor-pointer ${expandedId === run.run_id ? 'bg-dark-surface/50' : ''}`}
                      onClick={() => setExpandedId(expandedId === run.run_id ? null : run.run_id)}
                    >
                      <td className="p-4 px-6 text-gray-600">
                        {expandedId === run.run_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                      <td className="p-4 text-gray-500">{run.run_id}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(run.status)}
                          <span className={`px-2 py-0.5 bg-dark-bg border rounded text-[8px] font-bold uppercase tracking-widest ${getStatusClass(run.status)}`}>
                            {run.status}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-white" title={run.source_path}>{run.source_name}</td>
                      <td className="p-4 text-gray-400">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : '--'}
                      </td>
                      <td className="p-4 text-right text-gray-300">{run.rows_received}</td>
                      <td className="p-4 text-right text-neon-green">{run.rows_inserted}</td>
                      <td className="p-4 text-right pr-6 text-neon-red">{run.rows_rejected}</td>
                    </tr>
                    {expandedId === run.run_id && (
                      <tr className="bg-dark-bg/50 border-b border-dark-border">
                        <td colSpan={8} className="p-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                              <div>
                                <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Source Path</span>
                                <span className="text-[10px] text-neon-cyan break-all">{run.source_path}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Finished At</span>
                                <span className="text-[10px] text-white">{run.finished_at ? new Date(run.finished_at).toLocaleString() : 'IN_PROGRESS'}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Duration</span>
                                <span className="text-[10px] text-white">
                                  {run.started_at && run.finished_at 
                                    ? `${((new Date(run.finished_at) - new Date(run.started_at)) / 1000).toFixed(2)}s` 
                                    : '--'}
                                </span>
                              </div>
                            </div>
                            
                            {run.error_message && (
                              <div className="mt-4 p-4 border border-neon-red/30 bg-neon-red/10 rounded-xl">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertCircle className="w-4 h-4 text-neon-red" />
                                  <span className="text-[9px] font-bold text-neon-red uppercase tracking-widest">Error Log</span>
                                </div>
                                <pre className="text-[10px] text-neon-red font-mono whitespace-pre-wrap overflow-x-auto">
                                  {run.error_message}
                                </pre>
                              </div>
                            )}
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
          <span>Displayed: {runs.length}</span>
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
              disabled={runs.length < pageSize || isLoading}
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

export default Ingestion;
