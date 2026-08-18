import crypto from 'crypto';
import { Voucher, Package, Router as RouterModel } from '../models';
import { SessionOrchestrator } from '../orchestrator';

export interface GenerateVoucherOptions {
    tenantId: string;
    packageId: number;
    count: number;
    batch?: string;
    prefix?: string;
    codeLength?: number;
}

export class VoucherService {
    static async generateVouchers(options: GenerateVoucherOptions | { tenantId: string; packageId: number; count: number }) {
        const { tenantId, packageId, count } = options;
        const batch = ('batch' in options && options.batch) ? options.batch.trim().toUpperCase() : `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;
        const prefix = ('prefix' in options && options.prefix) ? options.prefix.trim().toUpperCase() : '';
        const codeLength = ('codeLength' in options && options.codeLength) ? Math.max(4, Math.min(16, Number(options.codeLength))) : 6;

        const pkg = await Package.findOne({
            where: { id: packageId, tenantId }
        });

        if (!pkg) throw new Error('Invalid or non-existent package selected for voucher generation');

        const safeCount = Math.max(1, Math.min(1000, Number(count) || 1));
        const vouchersToCreate = [];
        const existingCodes = new Set<string>();

        for (let i = 0; i < safeCount; i++) {
            let uniqueCode = '';
            let attempts = 0;
            while (attempts < 10) {
                const randomPart = crypto.randomBytes(8).toString('hex').slice(0, codeLength).toUpperCase();
                uniqueCode = prefix ? `${prefix}-${randomPart}` : randomPart;
                if (!existingCodes.has(uniqueCode)) {
                    existingCodes.add(uniqueCode);
                    break;
                }
                attempts++;
            }

            vouchersToCreate.push({
                code: uniqueCode,
                packageId: pkg.id,
                tenantId,
                batch,
                status: 'AVAILABLE' as const
            });
        }

        const created = await Voucher.bulkCreate(vouchersToCreate);
        return created;
    }

    static async redeemVoucher(code: string, routerId: string, macAddress: string, ipAddress?: string) {
        const cleanCode = (code || '').trim().toUpperCase();
        const voucher = await Voucher.findOne({
            where: {
                code: cleanCode,
                status: 'AVAILABLE'
            },
            include: [{ model: Package }]
        });

        if (!voucher) {
            throw new Error('Invalid or already used voucher');
        }

        // Security: Ensure router belongs to the same tenant as voucher
        const router = await RouterModel.findByPk(routerId);
        if (!router) throw new Error('Invalid router');

        if (router.tenantId !== voucher.tenantId) {
            throw new Error('This voucher cannot be used on this hotspot network');
        }

        // 1. Mark as used
        await voucher.update({
            status: 'USED',
            usedAt: new Date()
        });

        // 2. Grant session access
        return await SessionOrchestrator.grantVoucherAccess(
            voucher.id,
            routerId,
            macAddress,
            ipAddress
        );
    }
}
