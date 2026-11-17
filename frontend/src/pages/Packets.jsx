import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Plus, Trash2, RefreshCw } from 'lucide-react';
import Modal from '../components/Modal';
import { api } from '../lib/api';

const Packets = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 30;

  const [actionError, setActionError] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['packets', page, searchTerm, protocolFilter],
    queryFn: async () => {
      const params = { limit: pageSize, offset: page * pageSize };
      if (protocolFilter) params.protocol = protocolFilter;
      if (searchTerm && searchTerm.includes('.')) params.src_ip = searchTerm;
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

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Control Box */}
      <div className="box-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-zinc-100 uppercase">PACKET_LOG</span>
          <span className="text-zinc-500">({new Intl.NumberFormat().format(totalPackets)} CAPTURED)</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="FILTER IP (e.g. 192.168.1.1)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-dark-surface border border-dark-border px-2.5 py-1 text-zinc-300 placeholder:text-zinc-600 focus:outline-none w-52"
          />

          <select
            value={protocolFilter}
            onChange={(e) => setProtocolFilter(e.target.value)}
            className="bg-dark-surface border border-dark-border px-2.5 py-1 text-zinc-300 focus:outline-none"
          >
            <option value="">ALL_PROTO</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
            <option value="ICMP">ICMP</option>
          </select>

          <button
            onClick={() => refetch()}
            className="p-1 border border-dark-border bg-dark-surface text-zinc-400 hover:text-zinc-100"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-zinc-100 font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> INJECT
          </button>
        </div>
      </div>

      {actionError && (
        <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400">
          ERR: {actionError}
        </div>
      )}

      {/* Table Box */}
      <div className="box-panel overflow-hidden">
        <div className="box-panel-header">
          <span>RAW_CAPTURE_STREAM</span>
          <span className="text-[10px] text-zinc-500">PAGE {page + 1}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface/40 text-[10px] text-zinc-500 uppercase">
                <th className="py-2 px-3">TIME</th>
                <th className="py-2 px-3">SRC_NODE</th>
                <th className="py-2 px-3">DST_NODE</th>
                <th className="py-2 px-3">PROTO</th>
                <th className="py-2 px-3">SIZE</th>
                <th className="py-2 px-3">FLAGS</th>
                <th className="py-2 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {packets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    {isLoading ? "INGESTING_STREAM..." : "NO_PACKETS_RECORDED"}
                  </td>
                </tr>
              ) : (
                packets.map((pkt) => (
                  <tr key={pkt.packet_id} className="hover:bg-dark-surface/50 transition-colors">
                    <td className="py-2 px-3 text-zinc-400">
                      {pkt.captured_at ? new Date(pkt.captured_at).toLocaleTimeString() : '--'}
                    </td>
                    <td className="py-2 px-3 text-zinc-200">
                      {(pkt.src_ip || '').replace('/32', '')}{pkt.src_port ? `:${pkt.src_port}` : ''}
                    </td>
                    <td className="py-2 px-3 text-zinc-200">
                      {(pkt.dst_ip || '').replace('/32', '')}{pkt.dst_port ? `:${pkt.dst_port}` : ''}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1 py-0.5 border border-dark-border text-[10px] text-zinc-300">
                        {pkt.protocol}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-zinc-400">{pkt.packet_size}B</td>
                    <td className="py-2 px-3 text-zinc-500">{pkt.tcp_flags || '--'}</td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleDeletePacket(pkt.packet_id)}
                        className="text-zinc-600 hover:text-rose-400 p-0.5"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
          disabled={packets.length < pageSize}
          onClick={() => setPage(p => p + 1)}
          className="px-3 py-1 border border-dark-border bg-dark-panel hover:bg-dark-surface disabled:opacity-30 disabled:pointer-events-none"
        >
          [NEXT]
        </button>
      </div>

      {/* Manual Packet Injection Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="INJECT_CUSTOM_PACKET">
        <form onSubmit={handleAddPacket} className="space-y-3 font-mono text-xs">
          <div>
            <label className="block text-zinc-400 mb-1">SRC_IP</label>
            <input name="src_ip" defaultValue="192.168.1.100" required className="w-full bg-dark-surface border border-dark-border px-3 py-1.5 text-zinc-200 focus:outline-none" />
          </div>
          <div>
            <label className="block text-zinc-400 mb-1">DEST_IP</label>
            <input name="dest_ip" defaultValue="10.0.0.1" required className="w-full bg-dark-surface border border-dark-border px-3 py-1.5 text-zinc-200 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-400 mb-1">PROTOCOL</label>
              <select name="protocol" className="w-full bg-dark-surface border border-dark-border px-3 py-1.5 text-zinc-200 focus:outline-none">
                <option value="TCP">TCP</option>
                <option value="UDP">UDP</option>
                <option value="ICMP">ICMP</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-400 mb-1">SIZE (BYTES)</label>
              <input type="number" name="size" defaultValue={512} required className="w-full bg-dark-surface border border-dark-border px-3 py-1.5 text-zinc-200 focus:outline-none" />
            </div>
          </div>
          <div className="pt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-1.5 border border-dark-border hover:bg-dark-surface text-zinc-400">
              CANCEL
            </button>
            <button type="submit" className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-zinc-100 font-semibold">
              TRANSMIT
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Packets;
