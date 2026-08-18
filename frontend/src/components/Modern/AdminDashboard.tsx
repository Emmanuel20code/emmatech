import { useState, useEffect } from 'react';
import { TrendingUp, Building2, Users, CreditCard, Wifi, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../Common/Card.tsx';
import { Button } from '../Common/Button';
import { Badge } from '../Common/Badge';
import { Progress } from '../Common/Progress';
import axios from 'axios';

import type { AdminStats } from '../../types';

const AdminDashboard = () => {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/api/v1/admin/analytics/full-stats');
                const data = res.data;
                setStats({
                    totalRevenue: data.totalRevenue || data.revenue || 0,
                    activeTenants: data.activeTenants || 1,
                    totalTenants: data.totalTenants || 1,
                    totalPayments: data.totalPayments || data.paymentsCount || 0,
                    systemHealth: data.systemHealth || 99,
                    activeUsers: data.activeUsers || data.activeSubscribers || 0,
                    networkLoad: data.networkLoad || 45
                });
            } catch (err) {
                console.error('Failed to load admin stats, using defaults', err);
                setStats({
                    totalRevenue: 0,
                    activeTenants: 1,
                    totalTenants: 1,
                    totalPayments: 0,
                    systemHealth: 99,
                    activeUsers: 0,
                    networkLoad: 0
                });
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="container mx-auto px-6 py-8">
                    <div className="animate-pulse space-y-6">
                        <div className="h-8 bg-slate-200 rounded-lg w-1/3"></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const revenueCards = [
        {
            title: "Total Revenue",
            value: `KES ${stats.totalRevenue.toLocaleString()}`,
            change: "+12.5%",
            icon: TrendingUp,
            color: "emerald"
        },
        {
            title: "Active Tenants",
            value: `${stats.activeTenants}/${stats.totalTenants}`,
            change: "+3 this month",
            icon: Building2,
            color: "blue"
        },
        {
            title: "Transactions",
            value: stats.totalPayments.toLocaleString(),
            change: "+24 today",
            icon: CreditCard,
            color: "violet"
        },
        {
            title: "System Health",
            value: `${stats.systemHealth}%`,
            change: "Optimal",
            icon: Wifi,
            color: "green"
        }
    ];

    type ButtonVariant = 'default' | 'secondary' | 'ghost' | 'link' | 'destructive' | 'outline';

    const quickActions: { label: string; icon: typeof Users; variant: ButtonVariant }[] = [
        { label: "Add New Tenant", icon: Users, variant: "default" },
        { label: "View Reports", icon: TrendingUp, variant: "secondary" },
        { label: "System Logs", icon: AlertTriangle, variant: "ghost" }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
                            <p className="text-slate-600 mt-1">Platform overview and system management</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant="success" className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                System Online
                            </Badge>
                            <Button variant="ghost" size="sm">
                                Refresh
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {revenueCards.map((card, index) => {
                        const Icon = card.icon;
                        return (
                            <Card key={index} className="group hover:shadow-lg transition-all duration-300">
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium text-slate-600">{card.title}</CardTitle>
                                        <div className={`p-2 rounded-lg bg-${card.color}-50 text-${card.color}-600`}>
                                            <Icon size={20} />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
                                            <div className="text-xs text-slate-500 mt-1">{card.change}</div>
                                        </div>
                                        <div className={`w-8 h-8 rounded-full bg-${card.color}-100 flex items-center justify-center`}>
                                            <div className={`w-3 h-3 rounded-full bg-${card.color}-500`}></div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* System Overview */}
                        <Card>
                            <CardHeader>
                                <CardTitle>System Overview</CardTitle>
                                <CardDescription>Real-time platform metrics</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-600">Active Users</span>
                                            <span className="text-sm font-bold text-slate-900">{stats.activeUsers.toLocaleString()}</span>
                                        </div>
                                        <Progress value={stats.networkLoad} className="h-2" />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-600">Network Load</span>
                                            <span className="text-sm font-bold text-slate-900">{stats.networkLoad}%</span>
                                        </div>
                                        <Progress value={stats.networkLoad} className="h-2" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                                        <div className="text-2xl font-bold text-slate-900">24/7</div>
                                        <div className="text-xs text-slate-600">Uptime</div>
                                    </div>
                                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                                        <div className="text-2xl font-bold text-slate-900">99.9%</div>
                                        <div className="text-xs text-slate-600">Reliability</div>
                                    </div>
                                    <div className="text-center p-4 bg-slate-50 rounded-lg">
                                        <div className="text-2xl font-bold text-slate-900">156</div>
                                        <div className="text-xs text-slate-600">Active Sessions</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Activity */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Activity</CardTitle>
                                <CardDescription>Latest system events</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {[
                                        { action: "New tenant created", time: "2 minutes ago", type: "success" },
                                        { action: "Payment processed", time: "15 minutes ago", type: "info" },
                                        { action: "System backup completed", time: "1 hour ago", type: "success" },
                                        { action: "High usage alert", time: "3 hours ago", type: "warning" }
                                    ].map((activity, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-3 h-3 rounded-full ${activity.type === 'success' ? 'bg-emerald-500' : activity.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                                                <div>
                                                    <div className="font-medium text-slate-900">{activity.action}</div>
                                                    <div className="text-xs text-slate-500">{activity.time}</div>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm">View</Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Quick Actions</CardTitle>
                                <CardDescription>Common administrative tasks</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {quickActions.map((action, index) => {
                                    const Icon = action.icon;
                                    return (
                                        <Button key={index} variant={action.variant} className="w-full justify-start">
                                            <Icon size={18} className="mr-2" />
                                            {action.label}
                                        </Button>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {/* Performance Metrics */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Performance Metrics</CardTitle>
                                <CardDescription>System response times</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">API Response Time</span>
                                        <span className="text-sm font-bold text-slate-900">142ms</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Database Queries</span>
                                        <span className="text-sm font-bold text-slate-900">45ms</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Cache Hit Rate</span>
                                        <span className="text-sm font-bold text-slate-900">94%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Alerts */}
                        <Card>
                            <CardHeader>
                                <CardTitle>System Alerts</CardTitle>
                                <CardDescription>Monitor and resolve issues</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={16} className="text-amber-600" />
                                            <span className="text-sm font-medium text-amber-800">High Usage</span>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-amber-600">Resolve</Button>
                                    </div>
                                    <div className="text-center py-4 text-slate-500 text-sm">
                                        No critical alerts
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
