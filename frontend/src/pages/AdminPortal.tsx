import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminDashboard from '../components/Admin/Dashboard';
import axios from 'axios';
import SupportFooter from '../components/Common/SupportFooter';
import BackButton from '../components/Common/BackButton';

const AdminPortal = () => {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            const user = localStorage.getItem('user');

            // Check if we have authentication token
            if (token) {
                try {
                    // Try to verify token with backend
                    await axios.get('/api/v1/auth/verify', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    setIsAuthenticated(true);
                } catch (err: unknown) {
                    console.error('[AdminPortal] Auth verification failed:', err);
                    // Token invalid, redirect to login
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    navigate('/login');
                }
            } else {
                // No token, redirect to login
                navigate('/login');
            }
            setIsLoading(false);
        };

        checkAuth();
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-sky-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-bold">Authenticating...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-sky-50">
            {/* Admin Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-6">
                        <BackButton to="/" label="Home" variant="dark" />
                        <div className="flex-1 flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-black text-slate-900">Admin Dashboard</h1>
                                <p className="text-slate-600 font-bold">Jevish Platform Management</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-600 text-xs font-black rounded-full">
                                    AUTHENTICATED
                                </span>
                                <button
                                    onClick={() => {
                                        localStorage.removeItem('token');
                                        localStorage.removeItem('user');
                                        navigate('/login');
                                    }}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-8 space-y-8">
                <AdminDashboard />
                {/* Future admin sections such as TenantList, AuditLog, Settings can be added here */}
            </div>

            <div className="mt-8 pb-8">
                <SupportFooter />
            </div>
        </div>
    );
};

export default AdminPortal;
