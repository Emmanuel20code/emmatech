


import { useState, useEffect } from 'react';
import {
    Menu,
    X,
    Home,
    Users,
    Wifi,
    Settings,
    LogOut,
    BarChart3,
    Package,
    DollarSign,
    Shield,
    Smartphone,
    Globe
} from 'lucide-react';
import { Button } from '../Common/Button';
import { Input } from '../Common/Input.tsx';

interface LayoutProps {
    children: React.ReactNode;
    title?: string;
    breadcrumbs?: string[];
}

const ResponsiveLayout: React.FC<LayoutProps> = ({ children, title, breadcrumbs = [] }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const checkScreenSize = () => {
            // Mobile detection logic can be added here if needed
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);

        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: Home },
        { name: 'Subscribers', href: '/subscribers', icon: Users },
        { name: 'PPPoE Manager', href: '/tenant/pppoe', icon: Globe },
        { name: 'Packages', href: '/packages', icon: Package },
        { name: 'Analytics', href: '/analytics', icon: BarChart3 },
        { name: 'Payments', href: '/payments', icon: DollarSign },
        { name: 'Routers', href: '/routers', icon: Wifi },
        { name: 'Settings', href: '/settings', icon: Settings },
    ];

    const userNavigation = [
        { name: 'Profile', href: '/profile', icon: Shield },
        { name: 'Mobile App', href: '/mobile', icon: Smartphone },
        { name: 'Logout', href: '/logout', icon: LogOut },
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Mobile Header */}
            <header className="lg:hidden bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-50">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden"
                        >
                            {sidebarOpen ? (
                                <X className="w-6 h-6" />
                            ) : (
                                <Menu className="w-6 h-6" />
                            )}
                        </Button>
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <Wifi className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-slate-900">Jevish</h1>
                            <p className="text-xs text-slate-500">Admin Portal</p>
                        </div>
                    </div>

                    <div className="relative">
                        <Input
                            type="search"
                            placeholder="Search..."
                            className="w-48 pl-10 pr-4 py-2"
                        />
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </header>

            {/* Sidebar */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    } lg:translate-x-0`}
            >
                {/* Sidebar Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                            <Wifi className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900">Jevish</h2>
                            <p className="text-xs text-slate-500">Admin Portal</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-2">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Button
                                key={item.name}
                                variant="ghost"
                                className="w-full justify-start gap-3 text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                            >
                                <Icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </Button>
                        );
                    })}
                </nav>

                {/* User Section */}
                <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full flex items-center justify-center text-white font-semibold">
                                A
                            </div>
                            <div>
                                <div className="font-medium text-slate-900">Admin User</div>
                                <div className="text-xs text-slate-500">admin@company.com</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-red-600">
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="lg:ml-64 flex-1">
                {/* Desktop Header */}
                <header className="hidden lg:block bg-white border-b border-slate-200 sticky top-0 z-30">
                    <div className="flex items-center justify-between px-8 py-4">
                        <div>
                            {title && (
                                <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                            )}
                            {breadcrumbs.length > 0 && (
                                <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                    {breadcrumbs.map((crumb, index) => (
                                        <span key={index}>
                                            {crumb}
                                            {index < breadcrumbs.length - 1 && (
                                                <span className="mx-2">/</span>
                                            )}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Input
                                    type="search"
                                    placeholder="Search..."
                                    className="w-64 pl-10 pr-4 py-2"
                                />
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {userNavigation.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Button
                                            key={item.name}
                                            variant="ghost"
                                            size="sm"
                                            className="text-slate-600 hover:text-slate-900"
                                        >
                                            <Icon className="w-4 h-4 mr-2" />
                                            <span className="hidden md:inline">{item.name}</span>
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="p-6 lg:p-8">
                    {children}
                </div>
            </main>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </div>
    );
};

export default ResponsiveLayout;
