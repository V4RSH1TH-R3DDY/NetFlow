import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Plus, Activity, Download, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../lib/api';

const Packets = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [packets, setPackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const normalizeIp = (ip) => (ip || '').replace('/32', '');

  const mapPacket = (packet) => ({
    id: packet.packet_id,
    timestamp: packet.captured_at ? new Date(packet.captured_at).toLocaleTimeString() : '--',
    src_ip: normalizeIp(packet.src_ip),
    dest_ip: normalizeIp(packet.dst_ip),
    protocol: packet.protocol || 'N/A',
    size: packet.packet_size,
    status: (packet.packet_size || 0) > 1200 ? 'alert' : 'normal',
  });

  const loadPackets = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listPackets({ limit: 500 });
      setPackets((data || []).map(mapPacket));
    } catch (err) {
      setError(err.message || 'Failed to load packets');
      setPackets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackets();
  }, []);

  const handleAddPacket = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    setError('');
    try {
      await api.createPacket({
        captured_at: new Date().toISOString(),
        src_ip: formData.get('src_ip'),
        dst_ip: formData.get('dest_ip'),
        protocol: formData.get('protocol'),
        packet_size: Number(formData.get('size')),
      });
      setIsModalOpen(false);
      await loadPackets();
    } catch (err) {
      setError(err.message || 'Failed to create packet');
    }
  };

  const handleDeletePacket = async (packetId) => {
    setError('');
    try {
      await api.deletePacket(packetId);
      setPackets((prev) => prev.filter((packet) => packet.id !== packetId));
    } catch (err) {
      setError(err.message || 'Failed to delete packet');
    }
  };

  const filteredPackets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return packets;
    return packets.filter(
      (packet) =>
        packet.src_ip.toLowerCase().includes(term) ||
        packet.dest_ip.toLowerCase().includes(term) ||
        packet.protocol.toLowerCase().includes(term)
    );
  }, [packets, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
            <Activity className="text-neon-cyan" />
            PACKET_REGISTRY
          </h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">LOGGING_ACTIVE | BUFFER_1024_KIB</p>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-dark-panel border border-dark-border rounded-xl text-[10px] font-bold text-gray-400 hover:text-white transition-all shadow-skeuo-beveled">
            <Download className="w-3 h-3" /> EXPORT_LOGS
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-2 bg-neon-cyan/10 border border-neon-cyan/50 rounded-xl text-[10px] font-bold text-neon-cyan hover:bg-neon-cyan/20 transition-all shadow-neon-glow-cyan"
          >
            <Plus className="w-4 h-4" /> CAPTURE_NEW
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[11px] text-neon-red font-mono">
          {error}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-4 p-4 bg-dark-panel/50 rounded-2xl border border-dark-border shadow-skeuo-pressed">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            type="text"
            placeholder="SEARCH_BY_IP_OR_PROTOCOL..."
            className="w-full bg-dark-bg border border-dark-border rounded-xl py-2 pl-12 pr-4 text-[10px] font-mono text-neon-cyan focus:outline-none focus:border-neon-cyan/50 transition-colors placeholder:text-gray-700 uppercase tracking-widest"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['TCP', 'UDP', 'HTTPS', 'ICMP'].map(p => (
            <button key={p} className="px-4 py-2 bg-dark-bg border border-dark-border rounded-xl text-[9px] font-bold text-gray-500 hover:border-neon-yellow hover:text-neon-yellow transition-all uppercase tracking-widest">
              {p}
            </button>
          ))}
          <button className="p-2 bg-dark-bg border border-dark-border rounded-xl text-gray-600 hover:text-white">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-dark-panel rounded-2xl border border-dark-border shadow-skeuo-flat overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead>
              <tr className="bg-dark-surface/50 text-gray-500 border-b border-dark-border uppercase tracking-widest text-[9px]">
                <th className="p-4 px-6">Status</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Source_IP</th>
                <th className="p-4">Destination_IP</th>
                <th className="p-4">Protocol</th>
                <th className="p-4">Size (B)</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPackets.map((packet) => (
                <tr key={packet.id} className="group hover:bg-neon-cyan/5 transition-colors">
                  <td className="p-4 px-6">
                    <div className={`w-2.5 h-2.5 rounded-full ${packet.status === 'alert' ? 'bg-neon-red animate-led-blink shadow-neon-glow-red' : 'bg-neon-green shadow-neon-glow-green'} `} />
                  </td>
                  <td className="p-4 text-gray-500">{packet.timestamp}</td>
                  <td className="p-4 text-neon-cyan font-bold">{packet.src_ip}</td>
                  <td className="p-4 text-white">{packet.dest_ip}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 bg-dark-bg border rounded-lg font-bold text-[9px]
                       ${packet.protocol === 'TCP' ? 'border-neon-cyan text-neon-cyan' :
                        packet.protocol === 'UDP' ? 'border-neon-green text-neon-green' :
                          'border-neon-yellow text-neon-yellow'}
                     `}>
                      {packet.protocol}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400">{packet.size}</td>
                  <td className="p-4 text-right pr-6">
                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 bg-dark-bg/80 border border-dark-border rounded-lg text-gray-500 hover:text-white transition-colors">
                        <Activity className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeletePacket(packet.id)}
                        className="p-1.5 bg-dark-bg/80 border border-dark-border rounded-lg text-gray-500 hover:text-neon-red transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredPackets.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-[11px] text-gray-500 font-mono">
                    NO_PACKETS_FOUND
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Info */}
        <div className="p-4 border-t border-dark-border bg-dark-surface/30 flex justify-between items-center text-[9px] text-gray-600 font-mono tracking-widest uppercase">
          <span>Total_Packets: {packets.length} | Displayed: {filteredPackets.length}</span>
          <div className="flex gap-4">
            <button className="hover:text-white disabled:opacity-30" disabled>PREVIOUS</button>
            <span className="text-white">Page 01 / 88,402</span>
            <button className="hover:text-white">NEXT</button>
          </div>
        </div>
      </div>

      {/* Add Packet Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Manual_Packet_Injection"
      >
        <form onSubmit={handleAddPacket} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-gray-500 tracking-widest uppercase ml-1">Src_Address</label>
                <input
                  name="src_ip"
                  required
                  placeholder="0.0.0.0"
                  className="w-full bg-dark-bg border border-dark-border rounded-xl py-3 px-4 text-[11px] font-mono text-neon-cyan focus:outline-none focus:border-neon-cyan/50 shadow-skeuo-pressed"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-gray-500 tracking-widest uppercase ml-1">Dest_Address</label>
                <input
                  name="dest_ip"
                  required
                  placeholder="0.0.0.0"
                  className="w-full bg-dark-bg border border-dark-border rounded-xl py-3 px-4 text-[11px] font-mono text-white focus:outline-none focus:border-white/20 shadow-skeuo-pressed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-gray-500 tracking-widest uppercase ml-1">Protocol</label>
                <select
                  name="protocol"
                  className="w-full bg-dark-bg border border-dark-border rounded-xl py-3 px-4 text-[11px] font-mono text-neon-yellow focus:outline-none focus:border-neon-yellow/50 shadow-skeuo-pressed appearance-none cursor-pointer"
                >
                  <option value="TCP">TCP</option>
                  <option value="UDP">UDP</option>
                  <option value="HTTPS">HTTPS</option>
                  <option value="ICMP">ICMP</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-gray-500 tracking-widest uppercase ml-1">Payload_Size</label>
                <input
                  name="size"
                  type="number"
                  required
                  placeholder="64"
                  className="w-full bg-dark-bg border border-dark-border rounded-xl py-3 px-4 text-[11px] font-mono text-gray-300 focus:outline-none focus:border-white/20 shadow-skeuo-pressed"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3 bg-dark-surface border border-dark-border rounded-xl text-[10px] font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest shadow-skeuo-beveled"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-neon-cyan/20 border border-neon-cyan/50 rounded-xl text-[10px] font-bold text-neon-cyan hover:bg-neon-cyan/30 transition-colors uppercase tracking-widest shadow-neon-glow-cyan"
            >
              Inject_Payload
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Packets;
