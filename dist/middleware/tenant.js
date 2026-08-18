"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantMiddleware = void 0;
const models_1 = require("../models");
const tenantMiddleware = async (req, res, next) => {
    const host = req.headers.host;
    const tenantIdFromHeader = req.headers['x-tenant-id'];
    let tenant = null;
    if (tenantIdFromHeader) {
        tenant = await models_1.Tenant.findByPk(tenantIdFromHeader);
    }
    else if (host) {
        const subdomain = host.split('.')[0];
        if (!['localhost', 'www', 'app', 'admin', 'portal'].includes(subdomain.toLowerCase())) {
            tenant = await models_1.Tenant.findOne({ where: { subdomain } });
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
exports.tenantMiddleware = tenantMiddleware;
