import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: ('PLATFORM_OWNER' | 'SUPER_ADMIN' | 'TENANT' | 'STAFF' | 'AGENT')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    // DEBUG: Trace Role Evaluation
    useEffect(() => {
        if (!loading) {
            console.log(`[ProtectedRoute] Path: ${location.pathname} | User Role: ${user?.role} | TenantID: ${user?.tenantId}`);
        }
    }, [user, loading, location]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // PLATFORM_OWNER bypasses all path restrictions
    if (user.role === 'PLATFORM_OWNER') {
        return <>{children}</>;
    }

    // FIX: Hard separation for Super Admin
    if (user.role === 'SUPER_ADMIN') {
        const isSuperAdminRoute = location.pathname.startsWith('/superadmin') || location.pathname.startsWith('/platform-owner');
        if (!isSuperAdminRoute && allowedRoles && !allowedRoles.includes('SUPER_ADMIN')) {
            console.log(`[ProtectedRoute] Super Admin accessing restricted route ${location.pathname}. Redirecting to /superadmin.`);
            return <Navigate to="/superadmin" replace />;
        }
        return <>{children}</>;
    }

    // MANDATORY TENANT RESOLUTION: Redirect non-superadmin users without a workspace to setup
    const isTenantRoute = location.pathname.startsWith('/tenant') || location.pathname.startsWith('/admin');
    const isSetupRoute = location.pathname === '/tenant/setup';

    if (!user.tenantId && !isSetupRoute && isTenantRoute) {
        console.warn(`[ProtectedRoute] User ${user.id} (${user.role}) has no workspace. Redirecting to setup.`);
        return <Navigate to="/tenant/setup" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        console.warn(`[ProtectedRoute] Access denied to ${location.pathname}. Job Role: ${user.role}. Allowed: [${allowedRoles}]`);

        // FIX: Precise Redirection Logic
        let redirectPath = '/login';
        if (user.role === 'TENANT') {
            redirectPath = user.tenantId ? '/tenant' : '/tenant/setup';
        } else if (user.role === 'STAFF' || user.role === 'AGENT') {
            redirectPath = '/admin'; // Legacy/Standard Admin Portal
        }

        // Prevent infinite redirect loops
        if (location.pathname.startsWith(redirectPath)) {
            console.error(`[ProtectedRoute] Loop detected for ${user.role} at ${location.pathname}. Rendering children as fallback.`);
            return <>{children}</>;
        }

        console.log(`[ProtectedRoute] Redirecting ${user.role} from ${location.pathname} to ${redirectPath}`);
        return <Navigate to={redirectPath} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
