export interface UserAuth {
    id: string;
    email: string;
    role: 'PLATFORM_OWNER' | 'SUPER_ADMIN' | 'TENANT' | 'STAFF' | 'AGENT';
    tenantId: string | null;
}

declare global {
    namespace Express {
        interface Request {
            rawBody?: Buffer;
            user?: UserAuth;
            tenant?: any; // Import would be better but any is safer for global d.ts simplicity here to avoid circulars
        }
    }
}
