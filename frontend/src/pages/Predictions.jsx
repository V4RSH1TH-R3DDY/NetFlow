import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BrainCircuit, Filter, Download } from 'lucide-react';
import { api } from '../lib/api';

const Predictions = () => {
  const [modelFilter, setModelFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const { data, isLoading, error } = useQuery({
    queryKey: ['predictions', page, modelFilter, labelFilter],
    queryFn: async () => {
      const params = { limit: pageSize, offset: page * pageSize };
      if (modelFilter) params.model_version = modelFilter;
      if (labelFilter) params.predicted_label = labelFilter;
      return api.listPredictions(params);
    },
    keepPreviousData: true,
  });

  const predictions = data || [];

  // Generate mock histogram data for the confidence distribution
  // In a real app this would ideally come from the backend, but we can compute over the current page as a demo
  const histogramData = [
    { range: '0-20%', count: predictions.filter(p => p.confidence < 0.2).length },
    { range: '20-40%', count: predictions.filter(p => p.confidence >= 0.2 && p.confidence < 0.4).length },
    { range: '40-60%', count: predictions.filter(p => p.confidence >= 0.4 && p.confidence < 0.6).length },
    { range: '60-80%', count: predictions.filter(p => p.confidence >= 0.6 && p.confidence < 0.8).length },
    { range: '80-100%', count: predictions.filter(p => p.confidence >= 0.8).length },
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
    link.setAttribute('download', 'predictions_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
            <BrainCircuit className="text-neon-cyan" />
            ML_INFERENCE_LOGS
          </h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">MODEL_REGISTRY & PREDICTION_TRACKING</p>
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
          {error.message || "Failed to load predictions"}
        </div>
      )}

      {/* Histogram Chart */}
      <div className="bg-dark-panel p-6 rounded-2xl border border-dark-border shadow-skeuo-flat flex flex-col">
        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-4">CONFIDENCE_DISTRIBUTION (CURRENT_VIEW)</h3>
        <div className="h-[150px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histogramData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
              <XAxis dataKey="range" stroke="#444" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#444" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px', fontSize: '10px' }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="count" fill="#00f7ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-dark-panel/50 rounded-2xl border border-dark-border shadow-skeuo-pressed">
        <div className="flex gap-4 items-center flex-1">
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-bold text-gray-500 uppercase">MODEL:</span>
             <input
               type="text"
               placeholder="baseline-rules-v1"
               className="bg-dark-bg border border-dark-border rounded-xl py-2 px-4 text-[10px] font-mono text-white focus:outline-none focus:border-white/20 transition-colors placeholder:text-gray-700"
               value={modelFilter}
               onChange={(e) => { setModelFilter(e.target.value); setPage(0); }}
             />
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-bold text-gray-500 uppercase">LABEL:</span>
             <select
               value={labelFilter}
               onChange={(e) => { setLabelFilter(e.target.value); setPage(0); }}
               className="bg-dark-bg border border-dark-border rounded-xl py-2 px-4 text-[10px] font-mono text-neon-cyan focus:outline-none focus:border-neon-cyan/50 appearance-none cursor-pointer uppercase"
             >
               <option value="">ALL_LABELS</option>
               <option value="BENIGN">BENIGN</option>
               <option value="DOS">DOS</option>
               <option value="PROBE">PROBE</option>
               <option value="R2L">R2L</option>
               <option value="U2R">U2R</option>
             </select>
          </div>
        </div>
        <button 
          onClick={() => { setModelFilter(''); setLabelFilter(''); setPage(0); }}
          className="p-2 bg-dark-bg border border-dark-border rounded-xl text-gray-600 hover:text-white"
          title="Clear Filters"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-dark-panel rounded-2xl border border-dark-border shadow-skeuo-flat flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-dark-surface z-10">
              <tr className="text-gray-500 border-b border-dark-border uppercase tracking-widest text-[9px]">
                <th className="p-4 px-6">Pred_ID</th>
                <th className="p-4">Session_ID</th>
                <th className="p-4">Model_Version</th>
                <th className="p-4">Predicted_Label</th>
                <th className="p-4">Confidence</th>
                <th className="p-4 text-right pr-6">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[11px] text-gray-500 animate-pulse">RUNNING_INFERENCE...</td>
                </tr>
              ) : predictions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[11px] text-gray-500">NO_PREDICTIONS_FOUND</td>
                </tr>
              ) : (
                predictions.map((pred) => (
                  <tr key={pred.prediction_id} className="group hover:bg-neon-cyan/5 transition-colors">
                    <td className="p-4 px-6 text-gray-500">{pred.prediction_id}</td>
                    <td className="p-4 text-white">{pred.session_id}</td>
                    <td className="p-4 text-gray-400">{pred.model_version}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 bg-dark-bg border rounded text-[8px] font-bold tracking-widest
                        ${pred.predicted_label === 'BENIGN' ? 'border-neon-green text-neon-green' : 'border-neon-red text-neon-red'}
                      `}>
                        {pred.predicted_label}
                      </span>
                    </td>
                    <td className="p-4 text-neon-cyan">{(pred.confidence * 100).toFixed(1)}%</td>
                    <td className="p-4 text-right pr-6 text-gray-500">
                      {pred.created_at ? new Date(pred.created_at).toLocaleString() : '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-dark-border bg-dark-surface/30 flex justify-between items-center text-[9px] text-gray-600 font-mono tracking-widest uppercase mt-auto">
          <span>Displayed: {predictions.length}</span>
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
              disabled={predictions.length < pageSize || isLoading}
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

export default Predictions;
