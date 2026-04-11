'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
    RefreshCw
} from 'lucide-react';

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

export default function InfrastructurePage() {
    const [data, setData] = useState<InfrastructureData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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

    useEffect(() => {
        fetchData();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

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
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        <span className="text-xs font-bold uppercase">Refresh</span>
                    </button>
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
                            
                            {/* Category: Core */}
                            {data.api.categories?.core && data.api.categories.core.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">Core APIs</h3>
                                    <div className="space-y-2">
                                        {data.api.categories.core.map(renderEndpoint)}
                                    </div>
                                </div>
                            )}
                            
                            {/* Category: Content */}
                            {data.api.categories?.content && data.api.categories.content.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">Content APIs</h3>
                                    <div className="space-y-2">
                                        {data.api.categories.content.map(renderEndpoint)}
                                    </div>
                                </div>
                            )}
                            
                            {/* Category: Admin */}
                            {data.api.categories?.admin && data.api.categories.admin.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">Admin APIs</h3>
                                    <div className="space-y-2">
                                        {data.api.categories.admin.map(renderEndpoint)}
                                    </div>
                                </div>
                            )}
                            
                            {/* Category: Features */}
                            {data.api.categories?.features && data.api.categories.features.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">Feature APIs</h3>
                                    <div className="space-y-2">
                                        {data.api.categories.features.map(renderEndpoint)}
                                    </div>
                                </div>
                            )}
                            
                            {/* Category: Basketball */}
                            {data.api.categories?.basketball && data.api.categories.basketball.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-3">Basketball APIs</h3>
                                    <div className="space-y-2">
                                        {data.api.categories.basketball.map(renderEndpoint)}
                                    </div>
                                </div>
                            )}
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
