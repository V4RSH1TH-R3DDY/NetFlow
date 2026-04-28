import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Plus, Activity, Download, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../lib/api';

const Packets = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const [expandedId, setExpandedId] = useState(null);
  const [actionError, setActionError] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['packets', page, searchTerm, protocolFilter],
    queryFn: async () => {
      const params = { limit: pageSize, offset: page * pageSize };
      if (protocolFilter) params.protocol = protocolFilter;
      if (searchTerm) {
        if (searchTerm.includes('.')) params.src_ip = searchTerm; 
      }
      return api.listPackets(params);
    },
    keepPreviousData: true,
  });

  const { data: totalData } = useQuery({
    queryKey: ['packetCount'],
    queryFn: () => api.packetCount(),
  });

  const packets = data || [];
  const totalPackets = totalData?.count || 0;

  const normalizeIp = (ip) => (ip || '').replace('/32', '');

  const handleAddPacket = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    setActionError('');
    try {
      await api.createPacket({
        captured_at: new Date().toISOString(),
        src_ip: formData.get('src_ip'),
        dst_ip: formData.get('dest_ip'),
        protocol: formData.get('protocol'),
        packet_size: Number(formData.get('size')),
      });
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      setActionError(err.message || 'Failed to create packet');
    }
  };

  const handleDeletePacket = async (packetId) => {
    setActionError('');
    try {
      await api.deletePacket(packetId);
      refetch();
    } catch (err) {
      setActionError(err.message || 'Failed to delete packet');
    }
  };

  const handleExportCSV = () => {
    if (!packets.length) return;
    const headers = ['Packet ID', 'Status', 'Timestamp', 'Source IP', 'Destination IP', 'Protocol', 'Size', 'TCP Flags'];
    const csvContent = [
      headers.join(','),
      ...packets.map(p => [
        p.packet_id, 
        (p.packet_size || 0) > 1200 ? 'alert' : 'normal',
        p.captured_at, 
        normalizeIp(p.src_ip), 
        normalizeIp(p.dst_ip), 
        p.protocol, 
        p.packet_size,
        p.tcp_flags || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'packets_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
            <Activity className="text-neon-cyan" />
            PACKET_REGISTRY
          </h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">LOGGING_ACTIVE | BUFFER_1024_KIB</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-dark-panel border border-dark-border rounded-xl text-[10px] font-bold text-gray-400 hover:text-white transition-all shadow-skeuo-beveled"
          >
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

      {(error || actionError) && (
        <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[11px] text-neon-red font-mono">
          {error?.message || actionError}
        </div>
      )}

      {/* Filters Bar */}
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
          {['TCP', 'UDP', 'HTTPS', 'ICMP'].map(p => (
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
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 min-h-0 bg-dark-panel rounded-2xl border border-dark-border shadow-skeuo-flat flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left font-mono text-[11px]">
            <thead className="sticky top-0 bg-dark-surface z-10">
              <tr className="text-gray-500 border-b border-dark-border uppercase tracking-widest text-[9px]">
                <th className="p-4 px-6 w-10"></th>
                <th className="p-4">Status</th>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Source_IP</th>
                <th className="p-4">Destination_IP</th>
                <th className="p-4">Protocol</th>
                <th className="p-4">Size (B)</th>
                <th className="p-4 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[11px] text-gray-500 animate-pulse">LOADING_DATA...</td>
                </tr>
              ) : packets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-[11px] text-gray-500">NO_PACKETS_FOUND</td>
                </tr>
              ) : (
                packets.map((packet) => {
                  const isAlert = (packet.packet_size || 0) > 1200;
                  return (
                    <React.Fragment key={packet.packet_id}>
                      <tr 
                        className={`group hover:bg-neon-cyan/5 transition-colors cursor-pointer ${expandedId === packet.packet_id ? 'bg-dark-surface/50' : ''}`}
                        onClick={() => setExpandedId(expandedId === packet.packet_id ? null : packet.packet_id)}
                      >
                        <td className="p-4 px-6 text-gray-600">
                          {expandedId === packet.packet_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                        <td className="p-4">
                          <div className={`w-2.5 h-2.5 rounded-full ${isAlert ? 'bg-neon-red animate-led-blink shadow-neon-glow-red' : 'bg-neon-green shadow-neon-glow-green'} `} />
                        </td>
                        <td className="p-4 text-gray-500">{packet.captured_at ? new Date(packet.captured_at).toLocaleTimeString() : '--'}</td>
                        <td className="p-4 text-neon-cyan font-bold">{normalizeIp(packet.src_ip)}</td>
                        <td className="p-4 text-white">{normalizeIp(packet.dst_ip)}</td>
                        <td className="p-4">
                          <span className={`px-3 py-1 bg-dark-bg border rounded-lg font-bold text-[9px]
                             ${packet.protocol === 'TCP' ? 'border-neon-cyan text-neon-cyan' :
                              packet.protocol === 'UDP' ? 'border-neon-green text-neon-green' :
                                'border-neon-yellow text-neon-yellow'}
                           `}>
                            {packet.protocol}
                          </span>
                        </td>
                        <td className="p-4 text-gray-400">{packet.packet_size}</td>
                        <td className="p-4 text-right pr-6" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDeletePacket(packet.packet_id)}
                              className="p-1.5 bg-dark-bg/80 border border-dark-border rounded-lg text-gray-500 hover:text-neon-red transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === packet.packet_id && (
                        <tr className="bg-dark-bg/50 border-b border-dark-border">
                          <td colSpan={8} className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                              <div>
                                <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Packet ID</span>
                                <span className="text-[10px] text-white">{packet.packet_id}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Captured At</span>
                                <span className="text-[10px] text-white">{packet.captured_at ? new Date(packet.captured_at).toLocaleString() : '--'}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">TCP Flags</span>
                                <span className="text-[10px] text-neon-yellow">{packet.tcp_flags || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-gray-500 uppercase tracking-widest mb-1">Payload Hash</span>
                                <span className="text-[10px] text-gray-400 break-all">{packet.payload_hash || 'N/A'}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Info */}
        <div className="p-4 border-t border-dark-border bg-dark-surface/30 flex justify-between items-center text-[9px] text-gray-600 font-mono tracking-widest uppercase mt-auto">
          <span>Total_Packets: {totalPackets} | Displayed: {packets.length}</span>
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
              disabled={packets.length < pageSize || isLoading}
              className="hover:text-white disabled:opacity-30 transition-colors"
            >
              NEXT
            </button>
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
