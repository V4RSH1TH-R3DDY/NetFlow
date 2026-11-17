import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, RefreshCw, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock, Upload } from 'lucide-react';
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'running': return <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />;
      default: return <Clock className="w-3.5 h-3.5 text-zinc-500" />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'success': return 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10';
      case 'failed': return 'border-rose-500/40 text-rose-400 bg-rose-500/10';
      case 'running': return 'border-amber-500/40 text-amber-400 bg-amber-500/10';
      default: return 'border-zinc-700 text-zinc-500';
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Control Box */}
      <div className="box-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Database className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-zinc-100 uppercase">BATCH_INGESTION_JOBS</span>
          <span className="text-zinc-500">({runs.length} JOBS_LOGGED)</span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => refetch()}
            className="p-1 border border-dark-border bg-dark-surface text-zinc-400 hover:text-zinc-100"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400">
          ERR: {error.message || "Failed to load ingestion runs"}
        </div>
      )}

      {/* Boxed Table */}
      <div className="box-panel overflow-hidden">
        <div className="box-panel-header">
          <span>INGESTION_RUN_AUDIT_LOG</span>
          <span className="text-[10px] text-zinc-500">PAGE {page + 1}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface/40 text-[10px] text-zinc-500 uppercase">
                <th className="py-2.5 px-3 w-8"></th>
                <th className="py-2.5 px-3">RUN_ID</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">SOURCE_NAME</th>
                <th className="py-2.5 px-3">STARTED</th>
                <th className="py-2.5 px-3 text-right">RECEIVED</th>
                <th className="py-2.5 px-3 text-right">INSERTED</th>
                <th className="py-2.5 px-3 text-right">REJECTED</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-500">
                    {isLoading ? "POLLING_AUDIT_LOGS..." : "NO_INGESTION_RUNS_LOGGED"}
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <React.Fragment key={run.run_id}>
                    <tr 
                      className="hover:bg-dark-surface/50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === run.run_id ? null : run.run_id)}
                    >
                      <td className="py-2 px-3 text-zinc-500">
                        {expandedId === run.run_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </td>
                      <td className="py-2 px-3 text-zinc-400">#{run.run_id}</td>
                      <td className="py-2 px-3">
                        <span className={`px-1.5 py-0.5 border text-[10px] uppercase inline-flex items-center gap-1 ${getStatusClass(run.status)}`}>
                          {getStatusIcon(run.status)}
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-200" title={run.source_path}>{run.source_name}</td>
                      <td className="py-2 px-3 text-zinc-400">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : '--'}
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-400">{run.rows_received}</td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-semibold">{run.rows_inserted}</td>
                      <td className="py-2 px-3 text-right text-rose-400">{run.rows_rejected}</td>
                    </tr>
                    {expandedId === run.run_id && (
                      <tr className="bg-dark-surface/30 border-b border-dark-border">
                        <td colSpan={8} className="p-3 text-[11px] text-zinc-400 space-y-2">
                          <div><span className="text-zinc-500">SOURCE_PATH:</span> {run.source_path}</div>
                          <div><span className="text-zinc-500">FINISHED_AT:</span> {run.finished_at ? new Date(run.finished_at).toLocaleString() : 'IN_PROGRESS'}</div>
                          {run.error_message && (
                            <div className="p-2 border border-rose-500/40 bg-rose-500/10 text-rose-400">
                              {run.error_message}
                            </div>
                          )}
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
          disabled={runs.length < pageSize}
          onClick={() => setPage(p => p + 1)}
          className="px-3 py-1 border border-dark-border bg-dark-panel hover:bg-dark-surface disabled:opacity-30 disabled:pointer-events-none"
        >
          [NEXT]
        </button>
      </div>
    </div>
  );
};

export default Ingestion;
