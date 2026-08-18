/** Raw API response shape from /api/v1/admin/subscribers */
export interface ApiSubscriberRaw {
    id: string;
    name?: string | null;
    phoneNumber: string;
    macAddress?: string | null;
    pppoeUsername?: string | null;
    pppoePassword?: string | null;
    address?: string | null;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    tenantId: string;
    routerId?: string | null;
    packageId?: number | string | null;
    expiryDate?: string | null;
    lastPaymentDate?: string | null;
    email?: string | null;
    notes?: string | null;
    phone?: string; // Add back for legacy component compatibility
    displayStatus?: string; // Add back for display compatibility
    usagePercent?: number; // Add back for display compatibility
    expiresIn?: string; // Add back for display compatibility
    package?: {
        id: number;
        name: string;
        price: number;
    } | null;
    activeSession?: {
        ipAddress?: string;
        bytesIn?: number;
        bytesOut?: number;
        startTime?: string;
    } | null;
}

export interface Subscriber {
    id: string;
    name: string;
    ip?: string;
    status: 'Active' | 'Inactive' | 'Suspended' | 'Warning' | 'Expired';
    plan: string;
    usage: number;
    data_usage?: number;
    upload?: number;
    download?: number;
    phone: string;
    location?: string;
    expires?: string;
    lastSeen?: string;
    ipAddress?: string;
    deviceType?: string;
    raw?: ApiSubscriberRaw;
}

export interface SubscriberFormData {
    name: string;
    phoneNumber: string;
    pppoeUsername?: string;
    pppoePassword?: string;
    packageId: string | number;
    routerId: string;
    address?: string;
    notes?: string;
}

export interface Package {
    id: string | number;
    name: string;
    price: number;
    speed?: string;
    type?: 'HOTSPOT' | 'ISP';
    duration?: number;
    durationMinutes?: number | null;
    speedLimit?: string | null;
    dataLimitBytes?: number | null;
    description?: string | null;
    isEnabled: boolean;
    tenantId?: string;
}

export interface AdminStats {
    totalRevenue: number;
    activeTenants: number;
    totalTenants: number;
    totalPayments: number;
    systemHealth: number;
    activeUsers: number;
    networkLoad: number;
}

export interface TenantStats {
    totalRevenue: number;
    activeSessions: number;
    totalSubscribers: number;
    voucherSales: number;
}

export interface Payment {
    id: string;
    mpesaReceiptNumber?: string;
    checkoutRequestId?: string;
    amount: number;
    phoneNumber: string;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
    packageId: number;
    package?: { name: string };
    completedAt?: string;
    date?: string; // For legacy UI compatibility
    paymentMethod?: string;
    paymentChannel?: string;
}

export interface Router {
    id: string;
    name: string;
    host: string;
    ip?: string; // Add back as alias/compatibility
    port?: number;
    location?: string | null;
    isOnline: boolean;
    lastSeen?: string | null;
    status?: 'online' | 'offline'; // For legacy UI compatibility
    cpuLoad?: number;
    activeUsers?: number;
    validationStatus?: 'PENDING' | 'VALIDATED' | 'FAILED';
}
