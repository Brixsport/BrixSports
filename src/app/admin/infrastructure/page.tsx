'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Server,
    Database,
    Activity,
    Cpu,
    HardDrive,
    Zap,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    Clock,
    RefreshCw,
    Wifi,
    WifiOff,
    ChevronDown,
    ChevronUp,
    Layers
} from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface InfrastructureData {
    status: string;
    timestamp: string;
    database: {
        status: string;
        latency: number;
        tables: Record<string, number>;
        totalRecords: number;
    };
    system: {
        cpu: number;
        memory: number;
        disk: number;
        uptime: number;
        nodeVersion: string;
        platform: string;
    };
    api: {
        endpoints: Array<{
            name: string;
            path: string;
            avgResponseTime: number;
            status: string;
            error: string | null;
        }>;
        categories: {
            core: Array<{
                name: string;
                path: string;
                avgResponseTime: number;
                status: string;
                error: string | null;
            }>;
            content: Array<{
                name: string;
                path: string;
                avgResponseTime: number;
                status: string;
                error: string | null;
            }>;
            admin: Array<{
                name: string;
                path: string;
                avgResponseTime: number;
                status: string;
                error: string | null;
            }>;
            features: Array<{
                name: string;
                path: string;
                avgResponseTime: number;
                status: string;
                error: string | null;
            }>;
            auth: Array<{
                name: string;
                path: string;
                avgResponseTime: number;
                status: string;
                error: string | null;
            }>;
            basketball: Array<{
                name: string;
                path: string;
                avgResponseTime: number;
                status: string;
                error: string | null;
            }>;
        };
        totalCount: number;
        avgResponseTime: number;
        operationalCount: number;
        degradedCount: number;
        downCount: number;
    };
    performance: {
        requestLatency: number;
    };
}

// Category display config with initial visible count
const CATEGORY_CONFIG = {
    core: { label: 'Core APIs', icon: Layers, initialVisible: 3 },
    content: { label: 'Content APIs', icon: Layers, initialVisible: 3 },
    admin: { label: 'Admin APIs', icon: Layers, initialVisible: 3 },
    features: { label: 'Feature APIs', icon: Layers, initialVisible: 2 },
    auth: { label: 'Auth APIs', icon: Layers, initialVisible: 1 },
    basketball: { label: 'Basketball APIs', icon: Layers, initialVisible: 2 },
};

export default function InfrastructurePage() {
    const [data, setData] = useState<InfrastructureData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('disconnected');
    
    const { socket, isConnected } = useWebSocket({ autoConnect: true });

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/infrastructure');
            const result = await response.json();
            setData(result);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch infrastructure data:', error);
        } finally {
            setLoading(false);
        }
    };

    // WebSocket real-time updates
    useEffect(() => {
        setWsStatus(isConnected ? 'connected' : 'disconnected');
        
        if (!socket || !isConnected) return;

        // Subscribe to infrastructure updates
        socket.emit('admin:infrastructure:subscribe');

        // Handle real-time infrastructure updates
        const handleInfrastructureUpdate = (update: Partial<InfrastructureData>) => {
            setData(prev => prev ? { ...prev, ...update, timestamp: new Date().toISOString() } : null);
            setLastUpdated(new Date());
        };

        // Handle endpoint status changes
        const handleEndpointUpdate = (endpointUpdate: { path: string; status: string; responseTime: number }) => {
            setData(prev => {
                if (!prev) return null;
                
                const updatedEndpoints = prev.api.endpoints.map(e => 
                    e.path === endpointUpdate.path 
                        ? { ...e, status: endpointUpdate.status, avgResponseTime: endpointUpdate.responseTime }
                        : e
                );
                
                // Recalculate category endpoints
                const updatedCategories = { ...prev.api.categories };
                Object.keys(updatedCategories).forEach(cat => {
                    updatedCategories[cat as keyof typeof updatedCategories] = updatedEndpoints.filter(e => {
                        const catName = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG]?.label || '';
                        return catName.includes('Core') && ['Matches', 'Teams', 'Players', 'Competitions', 'Fixtures'].some(t => e.name.includes(t)) ||
                               catName.includes('Content') && ['News', 'Transfers', 'Polls', 'Events', 'Brackets'].some(t => e.name.includes(t)) ||
                               catName.includes('Admin') && e.name.includes('Admin') ||
                               catName.includes('Feature') && ['Ads', 'Analytics', 'Notifications'].some(t => e.name.includes(t)) ||
                               catName.includes('Auth') && e.name.includes('Auth') ||
                               catName.includes('Basketball') && e.name.includes('Basketball');
                    });
                });
                
                return {
                    ...prev,
                    api: {
                        ...prev.api,
                        endpoints: updatedEndpoints,
                        categories: updatedCategories,
                        operationalCount: updatedEndpoints.filter(e => e.status === 'operational').length,
                        degradedCount: updatedEndpoints.filter(e => e.status === 'degraded').length,
                        downCount: updatedEndpoints.filter(e => e.status === 'down').length,
                    }
                };
            });
            setLastUpdated(new Date());
        };

        socket.on('infrastructure:update', handleInfrastructureUpdate);
        socket.on('infrastructure:endpoint', handleEndpointUpdate);

        return () => {
            socket.off('infrastructure:update', handleInfrastructureUpdate);
            socket.off('infrastructure:endpoint', handleEndpointUpdate);
            socket.emit('admin:infrastructure:unsubscribe');
        };
    }, [socket, isConnected]);

    // Initial data fetch
    useEffect(() => {
        fetchData();
        // Fallback polling every 30 seconds if WebSocket is not connected
        const interval = setInterval(() => {
            if (!isConnected) fetchData();
        }, 30000);
        return () => clearInterval(interval);
    }, [isConnected]);

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    };

    // Helper to render an endpoint row
    const renderEndpoint = (endpoint: {
        name: string;
        path: string;
        avgResponseTime: number;
        status: string;
        error: string | null;
    }) => (
        <div
            key={endpoint.path}
            className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    endpoint.status === 'operational' ? 'bg-green-500' :
                    endpoint.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                }`} />
                <div className="min-w-0">
                    <span className="text-sm font-bold block truncate">{endpoint.name}</span>
                    <span className="text-xs text-white/40 font-mono truncate block">{endpoint.path}</span>
                    {endpoint.error && (
                        <span className="text-xs text-red-400 truncate block">{endpoint.error}</span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
                <span className="text-xs text-white/40">
                    {Math.round(endpoint.avgResponseTime)}ms
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${
                    endpoint.status === 'operational' ? 'bg-green-500/10 text-green-500' :
                    endpoint.status === 'degraded' ? 'bg-yellow-500/10 text-yellow-500' :
                    'bg-red-500/10 text-red-500'
                }`}>
                    {endpoint.status}
                </span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 lg:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-display text-4xl tracking-tight italic uppercase leading-none mb-2">
                            Infrastructure
                        </h1>
                        <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                            System health & performance monitoring
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* WebSocket Status */}
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                            wsStatus === 'connected' 
                                ? 'bg-green-500/10 border-green-500/20 text-green-500' 
                                : 'bg-red-500/10 border-red-500/20 text-red-500'
                        }`}>
                            {wsStatus === 'connected' ? <Wifi size={14} /> : <WifiOff size={14} />}
                            <span className="text-[10px] font-black uppercase">
                                {wsStatus === 'connected' ? 'Live' : 'Polling'}
                            </span>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            <span className="text-xs font-bold uppercase">Refresh</span>
                        </button>
                    </div>
                </div>

                {loading && !data ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : data ? (
                    <>
                        {/* Status Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <StatusCard
                                icon={<Server size={20} />}
                                label="System Status"
                                value={data.status}
                                status={data.status === 'operational' ? 'healthy' : 'warning'}
                            />
                            <StatusCard
                                icon={<Database size={20} />}
                                label="Database"
                                value={data.database.status}
                                status={data.database.status === 'healthy' ? 'healthy' : 'error'}
                                subValue={`${data.database.latency}ms latency`}
                            />
                            <StatusCard
                                icon={<Activity size={20} />}
                                label="API Health"
                                value="Operational"
                                status="healthy"
                                subValue={`${Math.round(data.api.avgResponseTime)}ms avg`}
                            />
                            <StatusCard
                                icon={<Clock size={20} />}
                                label="Uptime"
                                value={formatUptime(data.system.uptime)}
                                status="healthy"
                            />
                        </div>

                        {/* System Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <MetricCard
                                icon={<Cpu size={20} />}
                                label="CPU Usage"
                                value={data.system.cpu}
                                unit="%"
                                color="blue"
                            />
                            <MetricCard
                                icon={<Activity size={20} />}
                                label="Memory Usage"
                                value={data.system.memory}
                                unit="%"
                                color="purple"
                            />
                            <MetricCard
                                icon={<HardDrive size={20} />}
                                label="Disk Usage"
                                value={data.system.disk}
                                unit="%"
                                color="green"
                            />
                        </div>

                        {/* Database Tables */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <Database className="text-primary" size={24} />
                                <h2 className="font-display text-2xl italic uppercase">Database Tables</h2>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.entries(data.database.tables).map(([table, count]) => (
                                    <div key={table} className="bg-white/5 rounded-2xl p-4">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">
                                            {table}
                                        </p>
                                        <p className="text-2xl font-display italic">{count.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 pt-6 border-t border-white/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase text-white/40">Total Records</span>
                                    <span className="text-xl font-display italic text-primary">
                                        {data.database.totalRecords.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* API Endpoints */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <Zap className="text-primary" size={24} />
                                    <h2 className="font-display text-2xl italic uppercase">API Endpoints</h2>
                                    <span className="text-xs text-white/40">({data.api.totalCount} total)</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="px-2 py-1 bg-green-500/10 text-green-500 rounded">
                                        {data.api.operationalCount} OK
                                    </span>
                                    {data.api.degradedCount > 0 && (
                                        <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded">
                                            {data.api.degradedCount} Slow
                                        </span>
                                    )}
                                    {data.api.downCount > 0 && (
                                        <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded">
                                            {data.api.downCount} Down
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Collapsible Category Sections */}
                            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                                const endpoints = data.api.categories?.[key as keyof typeof data.api.categories] || [];
                                if (endpoints.length === 0) return null;
                                
                                const isExpanded = expandedCategories[key];
                                const visibleCount = isExpanded ? endpoints.length : config.initialVisible;
                                const visibleEndpoints = endpoints.slice(0, visibleCount);
                                const hasMore = endpoints.length > config.initialVisible;
                                
                                return (
                                    <div key={key} className="mb-6 last:mb-0">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-white/40">
                                                {config.label}
                                                <span className="ml-2 text-white/20">({endpoints.length})</span>
                                            </h3>
                                            {hasMore && (
                                                <button
                                                    onClick={() => setExpandedCategories(prev => ({ ...prev, [key]: !prev[key] }))}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-[10px] font-bold uppercase"
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            <ChevronUp size={14} />
                                                            Show Less
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown size={14} />
                                                            Show {endpoints.length - config.initialVisible} More
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {visibleEndpoints.map(renderEndpoint)}
                                        </div>
                                        <AnimatePresence>
                                            {isExpanded && visibleEndpoints.length < endpoints.length && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className="space-y-2 mt-2"
                                                >
                                                    {endpoints.slice(visibleCount).map(renderEndpoint)}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>

                        {/* System Info */}
                        <div className="bg-white/5 border border-white/10 rounded-[32px] p-8">
                            <h2 className="font-display text-2xl italic uppercase mb-6">System Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <InfoItem label="Node Version" value={data.system.nodeVersion} />
                                <InfoItem label="Platform" value={data.system.platform} />
                                <InfoItem
                                    label="Last Updated"
                                    value={lastUpdated.toLocaleTimeString()}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-20 text-white/40">
                        Failed to load infrastructure data
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusCard({
    icon,
    label,
    value,
    status,
    subValue
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    status: 'healthy' | 'warning' | 'error';
    subValue?: string;
}) {
    const statusColors = {
        healthy: 'text-green-500',
        warning: 'text-yellow-500',
        error: 'text-red-500',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-[32px] p-6"
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="text-white/40">{icon}</div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    {label}
                </span>
            </div>
            <div className="flex items-center gap-2">
                {status === 'healthy' ? (
                    <CheckCircle2 className={statusColors[status]} size={20} />
                ) : (
                    <AlertCircle className={statusColors[status]} size={20} />
                )}
                <p className="text-xl font-display italic capitalize">{value}</p>
            </div>
            {subValue && (
                <p className="text-[10px] text-white/40 mt-2 uppercase tracking-widest">{subValue}</p>
            )}
        </motion.div>
    );
}

function MetricCard({
    icon,
    label,
    value,
    unit,
    color
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    unit: string;
    color: 'blue' | 'purple' | 'green';
}) {
    const colorClasses = {
        blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
        purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20',
        green: 'from-green-500/20 to-green-500/5 border-green-500/20',
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-gradient-to-br ${colorClasses[color]} border rounded-[32px] p-6`}
        >
            <div className="flex items-center gap-3 mb-4">
                <div className="text-white/60">{icon}</div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    {label}
                </span>
            </div>
            <div className="flex items-baseline gap-2">
                <p className="text-4xl font-display italic">{Math.round(value)}</p>
                <span className="text-white/40 text-sm">{unit}</span>
            </div>
            <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full bg-gradient-to-r ${color === 'blue' ? 'from-blue-500 to-blue-400' :
                            color === 'purple' ? 'from-purple-500 to-purple-400' :
                                'from-green-500 to-green-400'
                        }`}
                />
            </div>
        </motion.div>
    );
}

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                {label}
            </p>
            <p className="text-lg font-bold">{value}</p>
        </div>
    );
}
