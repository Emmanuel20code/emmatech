import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../models';

export interface TenantRequest extends Request {
    tenant?: Tenant;
}

export const tenantMiddleware = async (req: TenantRequest, res: Response, next: NextFunction) => {
    const host = req.headers.host;
    const tenantIdFromHeader = req.headers['x-tenant-id'];

    let tenant: Tenant | null = null;

    if (tenantIdFromHeader) {
        tenant = await Tenant.findByPk(tenantIdFromHeader as string);
    } else if (host) {
        const subdomain = host.split('.')[0];
        if (!['localhost', 'www', 'app', 'admin', 'portal'].includes(subdomain.toLowerCase())) {
            tenant = await Tenant.findOne({ where: { subdomain } });
        }
    }

    // Enforce active status
    if (tenant && tenant.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Tenant account is suspended or inactive.' });
    }

    if (tenant) {
        req.tenant = tenant;
    }

    next();
};
