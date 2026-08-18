"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextService = exports.tenantContextStorage = void 0;
const async_hooks_1 = require("async_hooks");
exports.tenantContextStorage = new async_hooks_1.AsyncLocalStorage();
class ContextService {
    static getTenantId() {
        return exports.tenantContextStorage.getStore()?.tenantId || null;
    }
    static runWithTenant(tenantId, fn) {
        return exports.tenantContextStorage.run({ tenantId }, fn);
    }
}
exports.ContextService = ContextService;
