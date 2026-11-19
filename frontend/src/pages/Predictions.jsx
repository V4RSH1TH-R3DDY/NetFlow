import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BrainCircuit, Download, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const Predictions = () => {
  const [modelFilter, setModelFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['predictions', page, modelFilter, labelFilter],
    queryFn: async () => {
      const params = { limit: pageSize, offset: page * pageSize };
      if (modelFilter) params.model_version = modelFilter;
      if (labelFilter.trim()) params.predicted_label = labelFilter.trim();
      return api.listPredictions(params);
    },
    keepPreviousData: true,
  });

  const predictions = data || [];

  const histogramData = [
    { range: '0-20%', count: predictions.filter(p => (p.confidence || 0) < 0.2).length },
    { range: '20-40%', count: predictions.filter(p => (p.confidence || 0) >= 0.2 && (p.confidence || 0) < 0.4).length },
    { range: '40-60%', count: predictions.filter(p => (p.confidence || 0) >= 0.4 && (p.confidence || 0) < 0.6).length },
    { range: '60-80%', count: predictions.filter(p => (p.confidence || 0) >= 0.6 && (p.confidence || 0) < 0.8).length },
    { range: '80-100%', count: predictions.filter(p => (p.confidence || 0) >= 0.8).length },
  ];

  const handleExportCSV = () => {
    if (!predictions.length) return;
    const headers = ['Prediction ID', 'Session ID', 'Label', 'Confidence', 'Model Version', 'Timestamp'];
    const csvContent = [
      headers.join(','),
      ...predictions.map(p => [
        p.prediction_id, p.session_id, p.predicted_label, p.confidence, p.model_version, p.created_at
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'inference_predictions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Control Box */}
      <div className="box-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-zinc-100 uppercase">ML_INFERENCE_CLASSIFICATION</span>
          <span className="text-zinc-500">({predictions.length} PREDICTED)</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="FILTER VERSION"
            value={modelFilter}
            onChange={(e) => { setModelFilter(e.target.value); setPage(0); }}
            className="bg-dark-surface border border-dark-border px-2.5 py-1 text-zinc-300 placeholder:text-zinc-600 focus:outline-none w-36"
          />

          <input
            type="text"
            aria-label="Filter by predicted label"
            placeholder="FILTER LABEL"
            value={labelFilter}
            onChange={(e) => { setLabelFilter(e.target.value); setPage(0); }}
            className="bg-dark-surface border border-dark-border px-2.5 py-1 text-zinc-300 placeholder:text-zinc-600 focus:outline-none w-36"
          />

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

      {/* Confidence Distribution Box */}
      <div className="box-panel flex flex-col">
        <div className="box-panel-header">
          <span>CONFIDENCE_HISTOGRAM (CURRENT_VIEW)</span>
          <span className="text-[10px] text-zinc-500">DISTRIBUTION</span>
        </div>
        <div className="p-4 h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData}>
              <CartesianGrid stroke="#27272a" strokeDasharray="2 2" vertical={false} />
              <XAxis dataKey="range" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#0e0e11', border: '1px solid #27272a', fontSize: '11px', fontFamily: 'monospace' }} />
              <Bar dataKey="count" fill="#06b6d4" barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Boxed Table */}
      <div className="box-panel overflow-hidden">
        <div className="box-panel-header">
          <span>CLASSIFICATION_LOG</span>
          <span className="text-[10px] text-zinc-500">PAGE {page + 1}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface/40 text-[10px] text-zinc-500 uppercase">
                <th className="py-2.5 px-3">PRED_ID</th>
                <th className="py-2.5 px-3">SESSION</th>
                <th className="py-2.5 px-3">MODEL_VERSION</th>
                <th className="py-2.5 px-3">PREDICTED_LABEL</th>
                <th className="py-2.5 px-3">CONFIDENCE</th>
                <th className="py-2.5 px-3 text-right">TIMESTAMP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {predictions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    {isLoading ? "EVALUATING_FEATURES..." : "NO_PREDICTIONS_RECORDED"}
                  </td>
                </tr>
              ) : (
                predictions.map((p) => (
                  <tr key={p.prediction_id} className="hover:bg-dark-surface/50 transition-colors">
                    <td className="py-2 px-3 text-zinc-400">#{p.prediction_id}</td>
                    <td className="py-2 px-3 text-zinc-200">Session #{p.session_id}</td>
                    <td className="py-2 px-3 text-zinc-400 font-mono text-[10px]">{p.model_version}</td>
                    <td className="py-2 px-3">
                      <span className={`px-1.5 py-0.5 border text-[10px] ${
                        p.predicted_label === 'BENIGN' 
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' 
                          : 'border-rose-500/40 text-rose-400 bg-rose-500/10 font-bold'
                      }`}>
                        {p.predicted_label}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold text-zinc-200">
                      {p.confidence != null ? `${(p.confidence * 100).toFixed(1)}%` : '--'}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-500">
                      {p.created_at ? new Date(p.created_at).toLocaleString() : '--'}
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
          disabled={predictions.length < pageSize}
          onClick={() => setPage(p => p + 1)}
          className="px-3 py-1 border border-dark-border bg-dark-panel hover:bg-dark-surface disabled:opacity-30 disabled:pointer-events-none"
        >
          [NEXT]
        </button>
      </div>
    </div>
  );
};

export default Predictions;
