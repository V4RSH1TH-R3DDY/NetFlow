import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, Info, Clock, ExternalLink, Filter, CheckCircle2, ChevronRight, Activity, BrainCircuit } from 'lucide-react';
import { api } from '../lib/api';

const AlertDetailDrawer = ({ alertId, onClose }) => {
  const { data: alertDetail, isLoading } = useQuery({
    queryKey: ['alert', alertId],
    queryFn: () => api.getAlert(alertId),
    enabled: !!alertId,
  });

  return (
    <AnimatePresence>
      {alertId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[400px] bg-dark-panel border-l border-dark-border z-[101] shadow-2xl flex flex-col"
          >
            {isLoading || !alertDetail ? (
              <div className="flex-1 flex items-center justify-center text-[10px] text-gray-500 font-mono animate-pulse">
                LOADING_CASE_FILE...
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-dark-border bg-dark-surface flex justify-between items-center">
                  <div>
                    <h2 className="text-[12px] font-bold text-white uppercase tracking-widest">
                      CASE_EXT_{alertDetail.alert_id}X99
                    </h2>
                    <span className="text-[9px] text-gray-500 font-mono tracking-widest">INCIDENT_REPORT</span>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-6 space-y-8">
                  {/* General Info */}
                  <div className="space-y-4">
                    <h3 className="text-[9px] font-bold text-neon-cyan uppercase tracking-widest border-b border-dark-border pb-2">
                      <AlertCircle className="w-3 h-3 inline mr-2" /> Metadata
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                      <div>
                        <div className="text-gray-500 mb-1">Status</div>
                        <div className={`uppercase ${alertDetail.status === 'open' ? 'text-neon-red' : 'text-neon-green'}`}>{alertDetail.status}</div>
                      </div>
                      <div>
                        <div className="text-gray-500 mb-1">Triggered At</div>
                        <div className="text-white">{alertDetail.triggered_at ? new Date(alertDetail.triggered_at).toLocaleString() : '--'}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-gray-500 mb-1">Description</div>
                        <div className="text-gray-300 bg-dark-bg p-3 rounded-lg border border-white/5 whitespace-pre-wrap">
                          {alertDetail.description || 'No description provided.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Linked Session Info */}
                  {alertDetail.session_details && (
                    <div className="space-y-4">
                      <h3 className="text-[9px] font-bold text-neon-yellow uppercase tracking-widest border-b border-dark-border pb-2">
                        <Activity className="w-3 h-3 inline mr-2" /> Session Telemetry
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                        <div>
                          <div className="text-gray-500 mb-1">Source Node</div>
                          <div className="text-neon-cyan">{alertDetail.session_details.src_ip}:{alertDetail.session_details.src_port || '*'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Target Node</div>
                          <div className="text-white">{alertDetail.session_details.dst_ip}:{alertDetail.session_details.dst_port || '*'}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Protocol</div>
                          <div className="text-neon-yellow">{alertDetail.session_details.protocol}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Session ID</div>
                          <div className="text-gray-400">#{alertDetail.session_id}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Linked Prediction Info */}
                  {alertDetail.prediction_details && (
                    <div className="space-y-4">
                      <h3 className="text-[9px] font-bold text-neon-green uppercase tracking-widest border-b border-dark-border pb-2">
                        <BrainCircuit className="w-3 h-3 inline mr-2" /> Inference Data
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-[10px] font-mono">
                        <div>
                          <div className="text-gray-500 mb-1">Model Version</div>
                          <div className="text-white">{alertDetail.prediction_details.model_version}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Classified As</div>
                          <div className="text-neon-red">{alertDetail.prediction_details.predicted_label}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-gray-500 mb-2">Confidence Score</div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-dark-bg rounded-full overflow-hidden border border-white/5">
                               <div 
                                 className="h-full bg-neon-cyan shadow-neon-glow-cyan" 
                                 style={{ width: `${(alertDetail.prediction_details.confidence || 0) * 100}%` }}
                               />
                            </div>
                            <span className="text-neon-cyan">
                               {((alertDetail.prediction_details.confidence || 0) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const AlertCard = ({ alert, onStatusChange, onOpenDetails }) => {
  const isHigh = alert.severity >= 4;
  const isMedium = alert.severity >= 2 && alert.severity < 4;

  const styleMap = {
    high: {
      border: 'border-l-neon-red',
      icon: 'text-neon-red',
      dot: 'bg-neon-red',
      pill: 'bg-neon-red/10 border-neon-red/30 text-neon-red',
      glow: 'bg-neon-red/5',
      label: 'CRITICAL',
    },
    medium: {
      border: 'border-l-neon-yellow',
      icon: 'text-neon-yellow',
      dot: 'bg-neon-yellow',
      pill: 'bg-neon-yellow/10 border-neon-yellow/30 text-neon-yellow',
      glow: 'bg-neon-yellow/5',
      label: 'ELEVATED',
    },
    low: {
      border: 'border-l-neon-green',
      icon: 'text-neon-green',
      dot: 'bg-neon-green',
      pill: 'bg-neon-green/10 border-neon-green/30 text-neon-green',
      glow: 'bg-neon-green/5',
      label: 'STANDARD',
    },
  };

  const severityLevel = isHigh ? 'high' : isMedium ? 'medium' : 'low';
  const colorStyle = styleMap[severityLevel];
  const Icon = isHigh ? AlertCircle : isMedium ? AlertTriangle : Info;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.01 }}
      className={`bg-dark-panel p-6 rounded-2xl border-l-4 ${colorStyle.border} border border-dark-border shadow-skeuo-flat relative group`}
    >
      <div className="flex justify-between items-start gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-dark-bg rounded-xl shadow-skeuo-beveled border border-white/5 relative">
            <Icon className={`w-5 h-5 ${colorStyle.icon}`} />
            {alert.status === 'open' && (
              <div className={`absolute top-0 right-0 w-2 h-2 rounded-full ${colorStyle.dot} animate-led-blink translate-x-1/3 -translate-y-1/3 shadow-[0_0_8px_rgba(255,255,255,0.4)]`} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-sm font-bold text-white tracking-widest uppercase cursor-pointer hover:text-neon-cyan transition-colors" onClick={() => onOpenDetails(alert.id)}>
                {alert.title}
              </h3>
              <span className={`px-2 py-0.5 border rounded text-[8px] font-bold uppercase tracking-[0.2em] ${colorStyle.pill}`}>
                {colorStyle.label}_PRIORITY
              </span>
              {alert.status !== 'open' && (
                <span className={`px-2 py-0.5 border rounded text-[8px] font-bold uppercase tracking-[0.2em] bg-dark-bg ${alert.status === 'resolved' ? 'border-neon-green text-neon-green' : 'border-gray-500 text-gray-500'}`}>
                  {alert.status}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 font-mono mb-4 leading-relaxed">{alert.description}</p>
            <div className="flex items-center gap-4 text-[9px] text-gray-500 font-mono tracking-widest">
              <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {alert.timestamp}</span>
              <span className="flex items-center gap-1.5 uppercase">ID: EXT_{alert.id}X99</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => onOpenDetails(alert.id)}
            className="p-2 bg-dark-bg border border-dark-border rounded-lg text-gray-600 hover:text-white transition-all shadow-skeuo-beveled"
            title="View Details"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          
          {alert.status === 'open' && (
            <button 
              onClick={() => onStatusChange(alert.id, 'acknowledged')}
              className="px-3 py-1 bg-neon-yellow/10 border border-neon-yellow/30 rounded text-[9px] font-bold text-neon-yellow hover:bg-neon-yellow/20 transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <Info className="w-3 h-3" /> Investigate
            </button>
          )}
          {alert.status === 'acknowledged' && (
            <button 
              onClick={() => onStatusChange(alert.id, 'resolved')}
              className="px-3 py-1 bg-neon-green/10 border border-neon-green/30 rounded text-[9px] font-bold text-neon-green hover:bg-neon-green/20 transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <CheckCircle2 className="w-3 h-3" /> Resolve
            </button>
          )}
        </div>
      </div>

      {isHigh && alert.status === 'open' && (
        <motion.div
          animate={{ opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`absolute inset-0 ${colorStyle.glow} pointer-events-none rounded-2xl`}
        />
      )}
    </motion.div>
  );
};

const Alerts = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [minSeverityFilter, setMinSeverityFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [selectedAlertId, setSelectedAlertId] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['alerts', page, statusFilter, minSeverityFilter],
    queryFn: async () => {
      const params = { limit: pageSize, offset: page * pageSize };
      if (statusFilter) params.status = statusFilter;
      if (minSeverityFilter) params.min_severity = minSeverityFilter;
      return api.listAlerts(params);
    },
    keepPreviousData: true,
  });

  const alerts = (data || []).map((item) => ({
    id: item.alert_id,
    severity: item.severity || 1,
    status: item.status,
    title: (item.rule_name || item.alert_type || 'alert').replace(/_/g, ' '),
    description: item.description || 'No description',
    timestamp: item.triggered_at ? new Date(item.triggered_at).toLocaleString() : '--',
  }));

  const handleStatusChange = async (alertId, newStatus) => {
    try {
      await api.updateAlertStatus(alertId, newStatus);
      refetch();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 h-full flex flex-col">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
            <AlertCircle className="text-neon-red" />
            INCIDENT_LOGS
          </h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">REAL_TIME_THREAT_DETECTION | ACTIVE</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[11px] text-neon-red font-mono">
          {error.message || "Failed to load alerts"}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-dark-panel/50 rounded-2xl border border-dark-border shadow-skeuo-pressed">
        <div className="flex gap-4 items-center flex-1">
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-bold text-gray-500 uppercase">STATUS:</span>
             <select
               value={statusFilter}
               onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
               className="bg-dark-bg border border-dark-border rounded-xl py-2 px-4 text-[10px] font-mono text-neon-cyan focus:outline-none focus:border-neon-cyan/50 appearance-none cursor-pointer uppercase"
             >
               <option value="">ALL_STATUSES</option>
               <option value="open">OPEN</option>
               <option value="acknowledged">ACKNOWLEDGED</option>
               <option value="resolved">RESOLVED</option>
             </select>
          </div>
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-bold text-gray-500 uppercase">MIN SEVERITY:</span>
             <select
               value={minSeverityFilter}
               onChange={(e) => { setMinSeverityFilter(e.target.value); setPage(0); }}
               className="bg-dark-bg border border-dark-border rounded-xl py-2 px-4 text-[10px] font-mono text-neon-yellow focus:outline-none focus:border-neon-yellow/50 appearance-none cursor-pointer uppercase"
             >
               <option value="">ALL_LEVELS</option>
               <option value="4">CRITICAL (4+)</option>
               <option value="2">ELEVATED (2+)</option>
             </select>
          </div>
        </div>
        <button 
          onClick={() => { setStatusFilter(''); setMinSeverityFilter(''); setPage(0); }}
          className="p-2 bg-dark-bg border border-dark-border rounded-xl text-gray-600 hover:text-white"
          title="Clear Filters"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto space-y-4 pb-12">
        {isLoading && (
           <div className="p-6 text-center text-[11px] text-gray-500 font-mono animate-pulse">
             FETCHING_INCIDENT_REPORTS...
           </div>
        )}
        
        {alerts.map((alert) => (
          <AlertCard 
            key={alert.id} 
            alert={alert} 
            onStatusChange={handleStatusChange} 
            onOpenDetails={setSelectedAlertId}
          />
        ))}
        
        {!isLoading && alerts.length === 0 && !error && (
          <div className="p-6 text-center bg-dark-panel/30 border border-dark-border rounded-2xl text-[11px] text-gray-500 font-mono uppercase tracking-widest">
            No alerts match the criteria
          </div>
        )}

        {/* Pagination Info */}
        {!isLoading && alerts.length > 0 && (
          <div className="p-4 flex justify-between items-center text-[9px] text-gray-600 font-mono tracking-widest uppercase mt-4">
            <div className="flex gap-4 mx-auto">
              <button 
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="hover:text-white disabled:opacity-30 transition-colors"
              >
                PREVIOUS
              </button>
              <span className="text-white">Page {page + 1}</span>
              <button 
                onClick={() => setPage(p => p + 1)}
                disabled={alerts.length < pageSize}
                className="hover:text-white disabled:opacity-30 transition-colors"
              >
                NEXT
              </button>
            </div>
          </div>
        )}
      </div>

      <AlertDetailDrawer 
        alertId={selectedAlertId} 
        onClose={() => setSelectedAlertId(null)} 
      />
    </div>
  );
};

export default Alerts;
