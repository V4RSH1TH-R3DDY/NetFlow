import React, { useState } from 'react';
import { SlidersHorizontal, Shield, Bell, Database } from 'lucide-react';
import { api } from '../lib/api';

const Toggle = ({ label, enabled, onChange }) => (
   <div className="flex items-center justify-between p-3 border border-dark-border bg-dark-surface/40">
      <span className="text-xs font-mono text-zinc-300 uppercase">{label}</span>
      <button
         onClick={() => onChange(!enabled)}
         className={`px-2.5 py-1 text-[10px] font-mono border transition-colors ${
            enabled 
               ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' 
               : 'border-zinc-700 text-zinc-500 bg-zinc-900'
         }`}
      >
         {enabled ? 'ENABLED' : 'DISABLED'}
      </button>
   </div>
);

const Settings = () => {
   const [settings, setSettings] = useState({
      stealthMode: true,
      encryptTraffic: true,
      autoPurge: false,
      alertNotifications: true,
      deepInspection: false
   });
   const [schemaCount, setSchemaCount] = useState(0);
   const [healthStatus, setHealthStatus] = useState('CHECKING');
   const [syncStatus, setSyncStatus] = useState('SYNCING');
   const [alertId, setAlertId] = useState('');
   const [statusUpdate, setStatusUpdate] = useState('acknowledged');
   const [actionMsg, setActionMsg] = useState('');

   React.useEffect(() => {
      const loadSystemData = async () => {
         try {
            const [health, schemas] = await Promise.all([api.health(), api.schemas()]);
            setHealthStatus((health?.status || 'UNKNOWN').toUpperCase());
            const requestSchemas = Object.keys(schemas?.request || {}).length;
            const responseSchemas = Object.keys(schemas?.response || {}).length;
            setSchemaCount(requestSchemas + responseSchemas);
            setSyncStatus('SYNCHRONIZED');
         } catch {
            setHealthStatus('DEGRADED');
            setSyncStatus('OFFLINE');
         }
      };
      loadSystemData();
   }, []);

   const handleAlertStatusUpdate = async () => {
      if (!alertId) {
         setActionMsg('Provide an alert id first.');
         return;
      }
      try {
         await api.updateAlertStatus(Number(alertId), statusUpdate);
         setActionMsg(`Alert #${alertId} updated to ${statusUpdate}.`);
      } catch (err) {
         setActionMsg(err.message || 'Failed to update alert status.');
      }
   };

   return (
      <div className="space-y-4 font-mono text-xs max-w-4xl mx-auto">
         {/* Top bar */}
         <div className="box-panel px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
               <span className="font-semibold text-zinc-100 uppercase">SYSTEM_CONFIGURATION</span>
            </div>
            <span className="text-zinc-500">RUNTIME_PARAMETERS</span>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Security Section */}
            <div className="box-panel flex flex-col">
               <div className="box-panel-header">
                  <span className="flex items-center gap-2">
                     <Shield className="w-3.5 h-3.5 text-zinc-400" />
                     SECURITY_RULES
                  </span>
               </div>
               <div className="p-3 space-y-2">
                  <Toggle
                     label="STEALTH_MODE_INSPECTION"
                     enabled={settings.stealthMode}
                     onChange={(v) => setSettings({ ...settings, stealthMode: v })}
                  />
                  <Toggle
                     label="AUTO_DEEP_INSPECTION"
                     enabled={settings.deepInspection}
                     onChange={(v) => setSettings({ ...settings, deepInspection: v })}
                  />
                  <Toggle
                     label="ENCRYPT_INTERNALS"
                     enabled={settings.encryptTraffic}
                     onChange={(v) => setSettings({ ...settings, encryptTraffic: v })}
                  />
               </div>
            </div>

            {/* Notifications */}
            <div className="box-panel flex flex-col">
               <div className="box-panel-header">
                  <span className="flex items-center gap-2">
                     <Bell className="w-3.5 h-3.5 text-zinc-400" />
                     DISPATCH_SETTINGS
                  </span>
               </div>
               <div className="p-3 space-y-2">
                  <Toggle
                     label="BROADCAST_HIGH_SEV_ALERTS"
                     enabled={settings.alertNotifications}
                     onChange={(v) => setSettings({ ...settings, alertNotifications: v })}
                  />
                  <Toggle
                     label="AUTO_PURGE_STAGING_TABLES"
                     enabled={settings.autoPurge}
                     onChange={(v) => setSettings({ ...settings, autoPurge: v })}
                  />
               </div>
            </div>

            {/* Health & Status */}
            <div className="box-panel md:col-span-2 flex flex-col">
               <div className="box-panel-header">
                  <span className="flex items-center gap-2">
                     <Database className="w-3.5 h-3.5 text-zinc-400" />
                     TELEMETRY_STATUS & CONTROL
                  </span>
               </div>
               <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                     <div className="p-2 border border-dark-border bg-dark-surface/40">
                        <div className="text-[10px] text-zinc-500 uppercase">BACKEND_API</div>
                        <div className="text-zinc-200 font-bold mt-1">{healthStatus}</div>
                     </div>
                     <div className="p-2 border border-dark-border bg-dark-surface/40">
                        <div className="text-[10px] text-zinc-500 uppercase">DB_SYNC</div>
                        <div className="text-zinc-200 font-bold mt-1">{syncStatus}</div>
                     </div>
                     <div className="p-2 border border-dark-border bg-dark-surface/40">
                        <div className="text-[10px] text-zinc-500 uppercase">SCHEMAS_REGISTERED</div>
                        <div className="text-zinc-200 font-bold mt-1">{schemaCount} ENDPOINTS</div>
                     </div>
                     <div className="p-2 border border-dark-border bg-dark-surface/40">
                        <div className="text-[10px] text-zinc-500 uppercase">MODEL_ENGINE</div>
                        <div className="text-zinc-200 font-bold mt-1">RANDOM_FOREST</div>
                     </div>
                  </div>

                  {/* Manual Alert Status Override */}
                  <div className="border border-dark-border p-3 space-y-2 bg-dark-surface/20 mt-3">
                     <span className="text-[11px] text-zinc-400 font-semibold uppercase">MANUAL_ALERT_STATUS_UPDATE</span>
                     <div className="flex flex-wrap gap-2">
                        <input
                           value={alertId}
                           onChange={(e) => setAlertId(e.target.value)}
                           placeholder="ALERT_ID (e.g. 1)"
                           className="bg-dark-surface border border-dark-border px-2.5 py-1 text-zinc-200 placeholder:text-zinc-600 focus:outline-none w-44"
                        />
                        <select
                           value={statusUpdate}
                           onChange={(e) => setStatusUpdate(e.target.value)}
                           className="bg-dark-surface border border-dark-border px-2.5 py-1 text-zinc-200 focus:outline-none"
                        >
                           <option value="open">OPEN</option>
                           <option value="acknowledged">ACKNOWLEDGED</option>
                           <option value="resolved">RESOLVED</option>
                        </select>
                        <button
                           onClick={handleAlertStatusUpdate}
                           className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-zinc-100 font-semibold"
                        >
                           APPLY
                        </button>
                     </div>
                     {actionMsg && <div className="text-zinc-400 mt-1">{actionMsg}</div>}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default Settings;
