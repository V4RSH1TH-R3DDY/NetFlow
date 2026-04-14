import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, Globe, Server, Laptop, Database } from 'lucide-react';
import { api } from '../lib/api';

const baseNodes = [
  { id: 'gw', label: 'GATEWAY_01', x: 400, y: 300, type: 'gateway', icon: Globe },
  { id: 'srv1', label: 'DATACENTER_A', x: 200, y: 150, type: 'server', icon: Server },
  { id: 'srv2', label: 'DATACENTER_B', x: 600, y: 150, type: 'server', icon: Server },
  { id: 'db', label: 'SQL_CLUSTER', x: 400, y: 500, type: 'db', icon: Database },
];

const clientNodeSlots = [
  { id: 'usr1', x: 150, y: 400 },
  { id: 'usr2', x: 650, y: 400 },
  { id: 'usr3', x: 100, y: 250 },
  { id: 'usr4', x: 700, y: 250 },
];

const baseConnections = [
  { from: 'gw', to: 'srv1' },
  { from: 'gw', to: 'srv2' },
  { from: 'gw', to: 'db' },
  { from: 'db', to: 'srv1' },
];

const NetworkNode = ({ node }) => {
  const Icon = node.icon;
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.1 }}
      drag
      dragConstraints={{ left: 50, right: 750, top: 50, bottom: 550 }}
      className="cursor-pointer group"
    >
      {/* Glow Effect */}
      <motion.circle
        cx={node.x}
        cy={node.y}
        r="35"
        className="fill-neon-cyan/5 stroke-neon-cyan/20"
        animate={{ r: [35, 45, 35], opacity: [0.1, 0.3, 0.1] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Outer Ring */}
      <circle
        cx={node.x}
        cy={node.y}
        r="28"
        className="fill-dark-panel stroke-dark-border"
        strokeWidth="2"
      />

      {/* Node Content */}
      <foreignObject x={node.x - 15} y={node.y - 15} width="30" height="30">
        <div className="w-full h-full flex items-center justify-center">
          <Icon className="w-5 h-5 text-neon-cyan" />
        </div>
      </foreignObject>

      {/* Label */}
      <text
        x={node.x}
        y={node.y + 45}
        textAnchor="middle"
        className="fill-gray-400 text-[10px] font-mono font-bold tracking-widest uppercase pointer-events-none"
      >
        {node.label}
      </text>
    </motion.g>
  );
};

const Network = () => {
  const [clientNodes, setClientNodes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
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
            label: (ip || 'UNKNOWN').replace('/32', ''),
            x: slot.x,
            y: slot.y,
            type: 'client',
            icon: Laptop,
          };
        });

        setClientNodes(mappedClients);
      } catch (err) {
        setError(err.message || 'Failed to load topology');
        setClientNodes(
          clientNodeSlots.slice(0, 2).map((slot, index) => ({
            id: slot.id,
            label: `EXT_NODE_0${index + 1}`,
            x: slot.x,
            y: slot.y,
            type: 'client',
            icon: Laptop,
          }))
        );
      }
    };

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
    <div className="h-full flex flex-col space-y-6">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-widest flex items-center gap-3 uppercase">
            <Share2 className="text-neon-cyan" />
            NODE_TOPOLOGY_MAP
          </h2>
          <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">INTERACTIVE_VISUALIZATION | NODES: {nodes.length}</p>
        </div>
        <div className="flex gap-4">
          <button className="px-6 py-2 bg-dark-panel border border-dark-border rounded-xl text-[10px] font-bold text-gray-400 hover:text-white transition-all uppercase tracking-widest shadow-skeuo-beveled">
            Recenter View
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded-xl text-[11px] text-neon-red font-mono">
          {error}
        </div>
      )}

      <div className="flex-1 bg-dark-panel rounded-3xl border border-dark-border shadow-skeuo-flat overflow-hidden relative">
        {/* Background Grid */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '30px 30px' }}
        />

        <svg className="w-full h-full" viewBox="0 0 800 600">
          {/* Connections */}
          {connections.map((conn, idx) => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            return (
              <motion.line
                key={idx}
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.2 }}
                transition={{ duration: 1.5, delay: idx * 0.2 }}
                className="stroke-neon-cyan"
                strokeWidth="1.5"
                strokeDasharray="5,5"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => (
            <NetworkNode key={node.id} node={node} />
          ))}
        </svg>

        {/* Controls Overlay */}
        <div className="absolute bottom-6 right-6 p-4 bg-dark-surface/80 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-2.5 h-2.5 rounded-full bg-neon-green shadow-neon-glow-green" />
            <span className="text-[9px] font-bold text-white tracking-widest uppercase">Nodes_Stable</span>
          </div>
          <div className="flex items-center gap-3 px-2">
            <div className="w-2.5 h-2.5 rounded-full bg-neon-cyan shadow-neon-glow-cyan" />
            <span className="text-[9px] font-bold text-white tracking-widest uppercase">Data_Flow_Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Network;
