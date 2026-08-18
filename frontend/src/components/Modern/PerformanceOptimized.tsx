import { memo, useMemo, useCallback, useState } from 'react';
import {
    ShieldCheck,
    Zap,
    Eye,
    Code,
    Database,
    Globe,
    Smartphone,
    Moon,
    Sun
} from 'lucide-react';
import { Card } from '../Common/Card.tsx';
import { Button } from '../Common/Button';
import { Badge } from '../Common/Badge';

// Memoized Performance Metrics Component
const PerformanceMetrics = memo(() => {
    const metrics = useMemo(() => [
        { label: 'Lighthouse Score', value: '95/100', color: 'green' },
        { label: 'First Contentful Paint', value: '0.8s', color: 'blue' },
        { label: 'Largest Contentful Paint', value: '1.2s', color: 'green' },
        { label: 'Cumulative Layout Shift', value: '0.01', color: 'green' },
        { label: 'First Input Delay', value: '12ms', color: 'green' },
    ], []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {metrics.map((metric, index) => (
                <Card key={index} className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm text-slate-600">{metric.label}</div>
                            <div className="text-lg font-bold text-slate-900">{metric.value}</div>
                        </div>
                        <div className={`w-10 h-10 bg-${metric.color}-100 rounded-lg flex items-center justify-center`}>
                            <ShieldCheck className={`w-5 h-5 text-${metric.color}-600`} />
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
});

PerformanceMetrics.displayName = 'PerformanceMetrics';

// Memoized Feature Grid Component
const FeatureGrid = memo(() => {
    const features = useMemo(() => [
        {
            title: 'Lightning Fast',
            description: 'Optimized for speed with minimal bundle size',
            icon: Zap,
            color: 'blue'
        },
        {
            title: 'Accessible',
            description: 'WCAG AA compliant with keyboard navigation',
            icon: Eye,
            color: 'green'
        },
        {
            title: 'Responsive',
            description: 'Works perfectly on all devices',
            icon: Smartphone,
            color: 'purple'
        },
        {
            title: 'Secure',
            description: 'Built with security best practices',
            icon: ShieldCheck,
            color: 'red'
        },
        {
            title: 'Modern',
            description: 'Latest web standards and technologies',
            icon: Code,
            color: 'indigo'
        },
        {
            title: 'Scalable',
            description: 'Architecture designed for growth',
            icon: Database,
            color: 'orange'
        }
    ], []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                    <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300">
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 bg-${feature.color}-100 rounded-xl flex items-center justify-center`}>
                                <Icon className={`w-6 h-6 text-${feature.color}-600`} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 mb-2">{feature.title}</h3>
                                <p className="text-slate-600 text-sm">{feature.description}</p>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
});

FeatureGrid.displayName = 'FeatureGrid';

// Memoized Dashboard Component
const Dashboard = memo(() => {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    const toggleTheme = useCallback(() => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    }, []);

    const stats = useMemo(() => [
        { label: 'Active Users', value: '2,156', change: '+12%' },
        { label: 'Revenue', value: 'KES 1.2M', change: '+8%' },
        { label: 'System Uptime', value: '99.9%', change: '+0.1%' },
        { label: 'Response Time', value: '142ms', change: '-15%' },
    ], []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Performance Dashboard</h1>
                    <p className="text-slate-600 mt-1">Real-time system metrics and optimization insights</p>
                </div>
                <Button onClick={toggleTheme} className="flex items-center gap-2">
                    {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </Button>
            </div>

            {/* Performance Metrics */}
            <PerformanceMetrics />

            {/* Key Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <Card key={index} className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm text-slate-600">{stat.label}</div>
                                <div className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</div>
                                <div className="text-xs text-green-600 mt-1">↑ {stat.change}</div>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                <Globe className="w-6 h-6 text-white" />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Features */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Optimization Features</h2>
                    <Badge variant="outline">Performance First</Badge>
                </div>
                <FeatureGrid />
            </div>

            {/* Optimization Tips */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Performance Tips</h3>
                    <div className="space-y-3">
                        {[
                            'Enable browser caching for static assets',
                            'Compress images and use modern formats',
                            'Minimize JavaScript bundle size',
                            'Use CDN for global content delivery',
                            'Implement lazy loading for images',
                            'Optimize database queries and indexes'
                        ].map((tip, index) => (
                            <div key={index} className="flex items-center gap-3 text-sm text-slate-600">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span>{tip}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Accessibility Features</h3>
                    <div className="space-y-3">
                        {[
                            'Keyboard navigation support',
                            'Screen reader compatibility',
                            'High contrast mode support',
                            'Focus management and indicators',
                            'Semantic HTML structure',
                            'ARIA labels and roles'
                        ].map((feature, index) => (
                            <div key={index} className="flex items-center gap-3 text-sm text-slate-600">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>{feature}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
});

Dashboard.displayName = 'Dashboard';

// Main Performance Optimized Component
const PerformanceOptimized: React.FC = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto px-6 py-8">
                <Dashboard />
            </div>
        </div>
    );
};

export default PerformanceOptimized;
