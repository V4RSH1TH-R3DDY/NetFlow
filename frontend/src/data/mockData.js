export const packetsData = [
  { id: 1, timestamp: '14:22:05:882', src_ip: '192.168.1.104', dest_ip: '10.0.0.45', protocol: 'TCP', size: '1440', status: 'normal' },
  { id: 2, timestamp: '14:22:06:012', src_ip: '172.16.254.1', dest_ip: '192.168.1.1', protocol: 'UDP', size: '64', status: 'alert' },
  { id: 3, timestamp: '14:22:06:145', src_ip: '192.168.1.104', dest_ip: '10.0.0.45', protocol: 'TCP', size: '1440', status: 'normal' },
  { id: 4, timestamp: '14:22:06:290', src_ip: '192.168.1.55', dest_ip: '142.250.190.46', protocol: 'HTTPS', size: '512', status: 'normal' },
  { id: 5, timestamp: '14:22:06:550', src_ip: '192.168.1.104', dest_ip: '10.0.0.45', protocol: 'TCP', size: '1440', status: 'normal' },
  { id: 6, timestamp: '14:22:07:012', src_ip: '10.0.0.42', dest_ip: '172.16.0.5', protocol: 'ICMP', size: '32', status: 'normal' },
  { id: 7, timestamp: '14:22:07:115', src_ip: '192.168.1.104', dest_ip: '10.0.0.45', protocol: 'TCP', size: '1440', status: 'normal' },
  { id: 8, timestamp: '14:22:07:290', src_ip: '192.168.1.104', dest_ip: '10.0.0.45', protocol: 'TCP', size: '1440', status: 'normal' },
];

export const alertsData = [
  { id: 1, severity: 'high', title: 'Unauthorized Access Attempt', description: 'Multiple failed SSH logins from 172.16.254.1', timestamp: '2 mins ago' },
  { id: 2, severity: 'medium', title: 'High Bandwidth Usage', description: 'Node Uplink Alpha exceeding 80% capacity', timestamp: '15 mins ago' },
  { id: 3, severity: 'low', title: 'System Patch Available', description: 'Security patch V4.2.1 is ready for installation', timestamp: '1 hour ago' },
];

export const trafficHistory = [
  { time: '14:00', traffic: 400, alerts: 2 },
  { time: '14:05', traffic: 300, alerts: 1 },
  { time: '14:10', traffic: 600, alerts: 5 },
  { time: '14:15', traffic: 800, alerts: 3 },
  { time: '14:20', traffic: 500, alerts: 0 },
  { time: '14:25', traffic: 700, alerts: 2 },
];

export const protocolStats = [
  { name: 'HTTPS', value: 72, color: '#00f7ff' },
  { name: 'UDP', value: 22, color: '#39ff14' },
  { name: 'ICMP', value: 4, color: '#ff003c' },
  { name: 'OTHER', value: 2, color: '#f4e04d' },
];

export const systemStats = {
  cpu: 42,
  ram: 68,
  trafficRate: '842.4 Mbps',
  packetCount: '4,922,104',
  activeAlerts: 12,
};
