import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
    tenantId: string | null;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export class ContextService {
    static getTenantId(): string | null {
        return tenantContextStorage.getStore()?.tenantId || null;
    }

    static runWithTenant(tenantId: string | null, fn: () => void) {
        return tenantContextStorage.run({ tenantId }, fn);
    }
}
