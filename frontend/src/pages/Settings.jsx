import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Shield, Bell, Eye, Database, Cpu } from 'lucide-react';
import { api } from '../lib/api';

const Toggle = ({ label, enabled, onChange }) => (
   <div className="flex items-center justify-between p-4 bg-dark-bg/50 rounded-2xl border border-white/5 shadow-skeuo-beveled transition-all hover:bg-dark-bg">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
      <button
         onClick={() => onChange(!enabled)}
         className={`w-12 h-6 rounded-full relative transition-all duration-300 shadow-skeuo-pressed ${enabled ? 'bg-neon-green/20' : 'bg-dark-surface'}`}
      >
         <motion.div
            animate={{ x: enabled ? 26 : 2 }}
            className={`absolute top-1 w-4 h-4 rounded-full border border-white/10 ${enabled ? 'bg-neon-green shadow-neon-glow-green' : 'bg-gray-600'}`}
         />
      </button>
   </div>
);

const Slider = ({ label, value, min = 0, max = 100, unit = "%" }) => (
   <div className="space-y-3">
      <div className="flex justify-between items-center">
         <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{label}</label>
         <span className="text-[10px] font-mono text-neon-cyan">{value}{unit}</span>
      </div>
      <div className="relative h-6 flex items-center">
         <div className="absolute w-full h-1.5 bg-dark-bg rounded-full border border-dark-border shadow-skeuo-pressed" />
         <div className="absolute h-1.5 bg-neon-cyan rounded-full" style={{ width: `${(value - min) / (max - min) * 100}%` }} />
         <div
            className="absolute w-4 h-6 bg-dark-surface border border-dark-border rounded shadow-skeuo-beveled cursor-pointer"
            style={{ left: `calc(${(value - min) / (max - min) * 100}% - 8px)` }}
         >
            <div className="w-px h-3 bg-white/20 mx-auto mt-1.5" />
         </div>
      </div>
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
         setActionMsg(`Alert ${alertId} set to ${statusUpdate}.`);
      } catch (err) {
         setActionMsg(err.message || 'Failed to update alert status.');
      }
   };

   return (
      <div className="max-w-4xl mx-auto space-y-8">
         <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
               <SettingsIcon className="text-neon-cyan" />
               SYSTEM_CONFIGURATION
            </h2>
            <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">CONFIG_REGISTRY | ACCESS_LEVEL_01</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Security Section */}
            <section className="bg-dark-panel p-8 rounded-3xl border border-dark-border shadow-skeuo-flat space-y-6">
               <h3 className="text-xs font-bold text-white tracking-[0.2em] flex items-center gap-3 mb-2">
                  <Shield className="w-4 h-4 text-neon-yellow" />
                  SECURITY_PROTOCOLS
               </h3>
               <Toggle
                  label="Stealth_Mode"
                  enabled={settings.stealthMode}
                  onChange={(v) => setSettings({ ...settings, stealthMode: v })}
               />
               <Toggle
                  label="End-to-End_Encryption"
                  enabled={settings.encryptTraffic}
                  onChange={(v) => setSettings({ ...settings, encryptTraffic: v })}
               />
               <Toggle
                  label="Deep_Packet_Inspection"
                  enabled={settings.deepInspection}
                  onChange={(v) => setSettings({ ...settings, deepInspection: v })}
               />
            </section>

            {/* Global Controls */}
            <section className="bg-dark-panel p-8 rounded-3xl border border-dark-border shadow-skeuo-flat space-y-8">
               <h3 className="text-xs font-bold text-white tracking-[0.2em] flex items-center gap-3 mb-2">
                  <Cpu className="w-4 h-4 text-neon-cyan" />
                  HARDWARE_CONTROLS
               </h3>
               <Slider label="SCAN_RATE" value={450} min={100} max={1000} unit="ms" />
               <Slider label="HISTORY_DEPTH" value={24} min={1} max={72} unit="hrs" />
               <Slider label="THRESHOLD_GRIP" value={85} />
            </section>

            {/* Monitoring Section */}
            <section className="bg-dark-panel p-8 rounded-3xl border border-dark-border shadow-skeuo-flat space-y-6">
               <h3 className="text-xs font-bold text-white tracking-[0.2em] flex items-center gap-3 mb-2">
                  <Bell className="w-4 h-4 text-neon-red" />
                  NOTIFICATION_SYSTEM
               </h3>
               <Toggle
                  label="Active_Alerting"
                  enabled={settings.alertNotifications}
                  onChange={(v) => setSettings({ ...settings, alertNotifications: v })}
               />
               <Toggle
                  label="Auto-Purge_Logs"
                  enabled={settings.autoPurge}
                  onChange={(v) => setSettings({ ...settings, autoPurge: v })}
               />
            </section>

            {/* System Status Section */}
            <section className="bg-dark-panel p-8 rounded-3xl border border-dark-border shadow-skeuo-flat">
               <h3 className="text-xs font-bold text-white tracking-[0.2em] flex items-center gap-3 mb-6">
                  <Database className="w-4 h-4 text-neon-green" />
                  SYSTEM_ENVIRONMENT
               </h3>
               <div className="space-y-4">
                  <div className="p-4 bg-dark-bg/50 rounded-2xl border border-white/5 flex justify-between items-center font-mono">
                     <span className="text-[9px] text-gray-500 uppercase tracking-widest">Client_Version</span>
                     <span className="text-[10px] text-neon-cyan">V1.4.2_STABLE</span>
                  </div>
                  <div className="p-4 bg-dark-bg/50 rounded-2xl border border-white/5 flex justify-between items-center font-mono">
                     <span className="text-[9px] text-gray-500 uppercase tracking-widest">Kernel_Uptime</span>
                     <span className="text-[10px] text-white">API: {healthStatus}</span>
                  </div>
                  <div className="p-4 bg-dark-bg/50 rounded-2xl border border-white/5 flex justify-between items-center font-mono">
                     <span className="text-[9px] text-gray-500 uppercase tracking-widest">Database_Sync</span>
                     <span className="text-[10px] text-neon-green">{syncStatus}</span>
                  </div>
                  <div className="p-4 bg-dark-bg/50 rounded-2xl border border-white/5 flex justify-between items-center font-mono">
                     <span className="text-[9px] text-gray-500 uppercase tracking-widest">Schema_Registry</span>
                     <span className="text-[10px] text-neon-yellow">{schemaCount} DEFINITIONS</span>
                  </div>

                  <div className="p-4 bg-dark-bg/50 rounded-2xl border border-white/5 space-y-3">
                     <div className="text-[9px] text-gray-500 uppercase tracking-widest font-mono">Alert_Status_Control</div>
                     <div className="grid grid-cols-2 gap-3">
                        <input
                           value={alertId}
                           onChange={(e) => setAlertId(e.target.value)}
                           placeholder="alert id"
                           className="bg-dark-bg border border-dark-border rounded-xl py-2 px-3 text-[10px] font-mono text-white"
                        />
                        <select
                           value={statusUpdate}
                           onChange={(e) => setStatusUpdate(e.target.value)}
                           className="bg-dark-bg border border-dark-border rounded-xl py-2 px-3 text-[10px] font-mono text-neon-cyan"
                        >
                           <option value="open">open</option>
                           <option value="acknowledged">acknowledged</option>
                           <option value="resolved">resolved</option>
                        </select>
                     </div>
                     <button
                        onClick={handleAlertStatusUpdate}
                        className="w-full py-2 bg-neon-cyan/10 border border-neon-cyan/30 rounded-xl text-[10px] font-bold text-neon-cyan uppercase tracking-widest"
                     >
                        Apply Alert Status
                     </button>
                     {actionMsg && <div className="text-[10px] text-gray-400 font-mono">{actionMsg}</div>}
                  </div>
               </div>

               <button className="w-full mt-8 py-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[10px] font-bold text-neon-red hover:bg-neon-red/20 transition-all uppercase tracking-widest shadow-neon-glow-red">
                  Factory_Reset_Configuration
               </button>
            </section>
         </div>
      </div>
   );
};

export default Settings;
