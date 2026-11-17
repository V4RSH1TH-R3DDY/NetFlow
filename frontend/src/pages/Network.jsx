import React, { useEffect, useMemo, useState } from 'react';
import { Share2, Globe, Server, Laptop, Database, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

const baseNodes = [
  { id: 'gw', label: 'GATEWAY_01', x: 380, y: 260, type: 'gateway', icon: Globe },
  { id: 'srv1', label: 'EDGE_ROUTER_A', x: 200, y: 140, type: 'server', icon: Server },
  { id: 'srv2', label: 'EDGE_ROUTER_B', x: 560, y: 140, type: 'server', icon: Server },
  { id: 'db', label: 'DATASTORE_01', x: 380, y: 420, type: 'db', icon: Database },
];

const clientNodeSlots = [
  { id: 'usr1', x: 120, y: 340 },
  { id: 'usr2', x: 640, y: 340 },
  { id: 'usr3', x: 100, y: 200 },
  { id: 'usr4', x: 660, y: 200 },
];

const baseConnections = [
  { from: 'gw', to: 'srv1' },
  { from: 'gw', to: 'srv2' },
  { from: 'gw', to: 'db' },
  { from: 'db', to: 'srv1' },
];

const Network = () => {
  const [clientNodes, setClientNodes] = useState([]);
  const [error, setError] = useState('');

  const loadNetwork = async () => {
    setError('');
    try {
      const [topIps, sessions] = await Promise.all([
        api.topIps({ limit: 4 }),
        api.listSessions({ limit: 4 }),
      ]);

      const mappedClients = clientNodeSlots.map((slot, index) => {
        const ip = topIps?.[index]?.ip || sessions?.[index]?.src_ip || `10.0.0.${index + 10}`;
        return {
          id: slot.id,
          label: (ip || 'NODE').replace('/32', ''),
          x: slot.x,
          y: slot.y,
          type: 'client',
          icon: Laptop,
        };
      });

      setClientNodes(mappedClients);
    } catch (err) {
      setError(err.message || 'Failed to load live topology');
      setClientNodes(
        clientNodeSlots.slice(0, 2).map((slot, index) => ({
          id: slot.id,
          label: `EXT_IP_0${index + 1}`,
          x: slot.x,
          y: slot.y,
          type: 'client',
          icon: Laptop,
        }))
      );
    }
  };

  useEffect(() => {
    loadNetwork();
  }, []);

  const nodes = useMemo(() => [...baseNodes, ...clientNodes], [clientNodes]);
  const connections = useMemo(
    () => [
      ...baseConnections,
      ...clientNodes.map((node, index) => ({
        from: index % 2 === 0 ? 'srv1' : 'srv2',
        to: node.id,
      })),
    ],
    [clientNodes]
  );

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Header */}
      <div className="box-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Share2 className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-zinc-100 uppercase">NODE_TOPOLOGY_GRID</span>
          <span className="text-zinc-500">({nodes.length} ACTIVE_NODES)</span>
        </div>

        <button
          onClick={loadNetwork}
          className="p-1 border border-dark-border bg-dark-surface text-zinc-400 hover:text-zinc-100"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && (
        <div className="border border-rose-500/30 bg-rose-500/10 p-3 text-rose-400">
          ERR: {error}
        </div>
      )}

      {/* SVG Canvas Box */}
      <div className="box-panel relative overflow-hidden h-[540px] flex items-center justify-center">
        <svg className="w-full h-full" viewBox="0 0 760 520">
          {/* Wire Connections */}
          {connections.map((conn, idx) => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return null;
            return (
              <line
                key={idx}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                stroke="#3f3f46"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const Icon = node.icon;
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                <rect
                  x="-32"
                  y="-18"
                  width="64"
                  height="36"
                  className="fill-dark-panel stroke-dark-border"
                  strokeWidth="1"
                />
                <foreignObject x="-26" y="-14" width="52" height="28">
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                </foreignObject>
                <text
                  x="0"
                  y="30"
                  textAnchor="middle"
                  className="fill-zinc-400 text-[10px] font-mono tracking-wider"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Status Box overlay */}
        <div className="absolute bottom-3 right-3 p-3 bg-dark-panel border border-dark-border space-y-1">
          <div className="flex items-center gap-2 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 bg-emerald-400 inline-block" />
            <span>GRID_BALANCED</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
            <span className="w-1.5 h-1.5 bg-cyan-400 inline-block" />
            <span>PACKET_FLOW: ACTIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Network;
