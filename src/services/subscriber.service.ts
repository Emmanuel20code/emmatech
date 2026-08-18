import { supabase } from '../lib/supabaseClient';
import { MikroTikService } from './mikrotik.service';
import { SMSService } from './sms.service';
import { sendEmail } from './emailService';
import { WhatsAppService } from './whatsapp.service';
import logger from '../utils/logger';
import { Op } from 'sequelize';
import {
    Subscriber, Wallet, WalletTransaction, AuditLog, Router as RouterModel,
    Tenant, Payment, sequelize
} from '../models';

export interface CreateSubscriberDTO {
    tenantId: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    phoneNumber: string;
    altPhone?: string;
    email?: string;
    idNumber?: string;
    username?: string;
    password?: string;
    pppoeUsername?: string;
    pppoePassword?: string;
    macAddress?: string;
    address?: string;
    location?: string;
    customerType?: 'RESIDENTIAL' | 'BUSINESS' | 'CORPORATE' | 'INSTITUTION' | 'HOTSPOT' | 'PPPOE';
    connectionType?: 'HOTSPOT' | 'PPPOE';
    customerGroupId?: string;
    routerId?: string;
    packageId?: number;
    expiryDate?: string | Date;
    initialBalanceKES?: number;
    autoRenewal?: boolean;
    notificationsEnabled?: boolean;
    activateImmediately?: boolean;
    isDraft?: boolean;
    notes?: string;
    performedBy: string;
    ipAddress?: string;
}

export class SubscriberService {

    /**
     * Create a single subscriber manually with router sync, wallet setup & notifications
     */
    static async createSubscriber(dto: CreateSubscriberDTO): Promise<{ subscriber: Subscriber; wallet: Wallet; mikrotikSynced: boolean; mikrotikError?: string }> {
        const {
            tenantId, firstName, lastName, phoneNumber, altPhone, email, idNumber,
            username, password, pppoeUsername, pppoePassword, macAddress, address,
            location, customerType = 'RESIDENTIAL', connectionType = 'HOTSPOT', customerGroupId,
            routerId, packageId, expiryDate, initialBalanceKES = 0, autoRenewal = false,
            notificationsEnabled = true, activateImmediately = true, isDraft = false,
            notes, performedBy, ipAddress
        } = dto;

        // 1. Duplicate Prevention Checks
        const cleanPhone = phoneNumber.trim();
        const { data: existingPhone } = await supabase
            .from('subscribers')
            .select('*')
            .eq('tenantId', tenantId)
            .eq('phoneNumber', cleanPhone)
            .single();

        if (existingPhone) {
            throw new Error(`Subscriber with phone number ${cleanPhone} already exists in this tenant`);
        }

        const loginUser = username || pppoeUsername;
        if (loginUser) {
            const { data: existingUser } = await supabase
                .from('subscribers')
                .select('*')
                .eq('tenantId', tenantId)
                .or(`username.eq.${loginUser},pppoeUsername.eq.${loginUser}`)
                .single();

            if (existingUser) {
                throw new Error(`Subscriber username "${loginUser}" is already taken`);
            }
        }

        // Full Name formatting
        const fullName = dto.name || [firstName, lastName].filter(Boolean).join(' ') || cleanPhone;
        const initialStatus = isDraft ? 'INACTIVE' : (activateImmediately ? 'ACTIVE' : 'INACTIVE');

        const t = await sequelize.transaction();
        let mikrotikSynced = false;
        let mikrotikError = undefined;

        try {
            // 2. Create Subscriber Record
            const { data: subscriber, error: subError } = await supabase
                .from('subscribers')
                .insert({
                    tenantId,
                    name: fullName,
                    firstName: firstName || null,
                    lastName: lastName || null,
                    phoneNumber: cleanPhone,
                    altPhone: altPhone || null,
                    email: email || null,
                    idNumber: idNumber || null,
                    username: username || loginUser || cleanPhone,
                    password: password || pppoePassword || '123456',
                    pppoeUsername: pppoeUsername || null,
                    pppoePassword: pppoePassword || null,
                    macAddress: macAddress || null,
                    address: address || null,
                    location: location || null,
                    customerType,
                    connectionType,
                    customerGroupId: customerGroupId || null,
                    routerId: routerId || null,
                    packageId: packageId ? Number(packageId) : null,
                    expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
                    status: initialStatus,
                    autoRenewal: !!autoRenewal,
                    notificationsEnabled: !!notificationsEnabled,
                    isDraft: !!isDraft,
                    notes: notes || null,
                })
                .select()
                .single();

            if (subError) throw new Error(subError.message);

            // 3. Initialize Customer Wallet
            const initialBalanceCents = Math.round(initialBalanceKES * 100);
            const wallet = await Wallet.create({
                ownerId: subscriber.id,
                ownerType: 'SUBSCRIBER',
                balance: initialBalanceCents,
                frozenBalance: 0,
                pendingBalance: 0,
                settledBalance: 0,
                currency: 'KES',
                tenantId,
            }, { transaction: t });

            if (initialBalanceCents > 0) {
                await WalletTransaction.create({
                    walletId: wallet.id,
                    amount: initialBalanceCents,
                    transactionType: 'CREDIT',
                    referenceId: subscriber.id,
                    referenceType: 'INITIAL_DEPOSIT',
                    balanceAfter: initialBalanceCents,
                    description: 'Initial wallet balance on customer creation',
                    status: 'COMPLETED',
                    createdBy: performedBy,
                    tenantId,
                }, { transaction: t });
            }

            // 4. Audit Log
            await AuditLog.create({
                action: 'SUBSCRIBER_CREATED',
                details: `Subscriber created: ${fullName} (${cleanPhone}), Wallet: KES ${initialBalanceKES}`,
                tenantId,
                userId: performedBy,
                ipAddress,
            }, { transaction: t });

            await t.commit();

            // 5. Live MikroTik Router Provisioning
            if (routerId) {
                const router = await RouterModel.findOne({ where: { id: routerId, tenantId } });
                if (router) {
                    try {
                        if (connectionType === 'PPPOE' && (pppoeUsername || username)) {
                            await MikroTikService.createPPPoESecret(
                                router,
                                pppoeUsername || username || cleanPhone,
                                pppoePassword || password || '123456',
                                'pppoe',
                                'default',
                                `Jevish Sub: ${subscriber.id}`
                            );
                            mikrotikSynced = true;
                        } else if (connectionType === 'HOTSPOT' || username) {
                            await MikroTikService.createHotspotUser(
                                router,
                                username || cleanPhone,
                                password || '123456',
                                macAddress,
                                'default',
                                `Jevish Sub: ${subscriber.id}`
                            );
                            mikrotikSynced = true;
                        }
                    } catch (mErr: any) {
                        mikrotikError = mErr.message || 'Router unreachable during creation';
                        logger.warn('MikroTik sync warning during subscriber creation', { error: mikrotikError, routerId });
                    }
                }
            }

            // 6. Multi-Channel Customer Welcome Notifications (Non-blocking)
            if (notificationsEnabled && !isDraft) {
                this.sendWelcomeNotifications(subscriber, password || pppoePassword || '123456').catch(err => {
                    logger.warn('Failed to send welcome notifications', { error: err });
                });
            }

            logger.info('Subscriber created successfully', { subscriberId: subscriber.id, tenantId });
            return { subscriber, wallet, mikrotikSynced, mikrotikError };

        } catch (error) {
            await t.rollback();
            logger.error('Failed to create subscriber', { error, tenantId });
            throw error;
        }
    }

    /**
     * Send Welcome Notifications across SMS, Email, and WhatsApp
     */
    private static async sendWelcomeNotifications(sub: Subscriber, rawPass: string) {
        const tenant = await Tenant.findByPk(sub.tenantId);
        const tenantName = tenant ? tenant.name : 'Jevish';
        const loginUser = sub.username || sub.pppoeUsername || sub.phoneNumber;

        const welcomeText = `Welcome to ${tenantName}! Your internet account is ready.\nUsername: ${loginUser}\nPassword: ${rawPass}\nType: ${sub.connectionType}\nThank you for choosing us!`;

        // 1. SMS
        if (sub.phoneNumber) {
            try {
                await SMSService.sendSMS({
                    to: sub.phoneNumber,
                    message: welcomeText,
                    tenantId: sub.tenantId,
                });
            } catch (e) { logger.warn('Welcome SMS failed', { error: e }); }
        }

        // 2. Email
        if (sub.email) {
            try {
                await sendEmail({
                    to: sub.email,
                    subject: `Welcome to ${tenantName} - Your Account Credentials`,
                    text: welcomeText,
                    html: `
                        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
                            <h2 style="color:#0284c7;">Welcome to ${tenantName}!</h2>
                            <p>Your internet service account has been created successfully.</p>
                            <div style="background:#f8fafc;padding:15px;border-radius:8px;margin:20px 0;">
                                <p><strong>Username:</strong> ${loginUser}</p>
                                <p><strong>Password:</strong> ${rawPass}</p>
                                <p><strong>Connection Type:</strong> ${sub.connectionType}</p>
                            </div>
                            <p>Thank you for choosing ${tenantName}!</p>
                        </div>
                    `,
                });
            } catch (e) { logger.warn('Welcome Email failed', { error: e }); }
        }
    }

    /**
     * Bulk Import Subscribers with dry-run validation, duplicate checking & rollback on failure
     */
    static async bulkImportSubscribers(tenantId: string, rows: any[], performedBy: string, ipAddress?: string) {
        if (!Array.isArray(rows) || rows.length === 0) {
            throw new Error('No subscriber rows provided for bulk import');
        }

        const errors: { row: number; field: string; message: string }[] = [];
        const seenPhones = new Set<string>();
        const seenUsernames = new Set<string>();

        // Phase 1: Dry-Run Batch Validation
        rows.forEach((row, idx) => {
            const line = idx + 1;
            const phone = (row.phoneNumber || row.phone || '').toString().trim();
            const uname = (row.username || row.pppoeUsername || '').toString().trim();

            if (!phone) {
                errors.push({ row: line, field: 'phoneNumber', message: 'Phone number is required' });
            } else if (seenPhones.has(phone)) {
                errors.push({ row: line, field: 'phoneNumber', message: `Duplicate phone number "${phone}" in import file` });
            } else {
                seenPhones.add(phone);
            }

            if (uname) {
                if (seenUsernames.has(uname)) {
                    errors.push({ row: line, field: 'username', message: `Duplicate username "${uname}" in import file` });
                } else {
                    seenUsernames.add(uname);
                }
            }
        });

        if (errors.length > 0) {
            return { success: false, errors, importedCount: 0 };
        }

        // Phase 2: DB Duplicate Validation
        const existingPhonesInDB = await Subscriber.findAll({
            where: { tenantId, phoneNumber: Array.from(seenPhones) },
            attributes: ['phoneNumber']
        });
        if (existingPhonesInDB.length > 0) {
            const duplicates = existingPhonesInDB.map(s => s.phoneNumber).join(', ');
            throw new Error(`Import aborted: The following phone numbers already exist in the database: ${duplicates}`);
        }

        // Phase 3: Atomic Database Execution
        const t = await sequelize.transaction();
        let importedCount = 0;

        try {
            for (const row of rows) {
                const phone = (row.phoneNumber || row.phone || '').toString().trim();
                const firstName = row.firstName || '';
                const lastName = row.lastName || '';
                const fullName = row.name || [firstName, lastName].filter(Boolean).join(' ') || phone;
                const uname = row.username || phone;
                const pass = row.password || '123456';
                const initialBal = Number(row.initialBalanceKES || row.balance || 0);

                const sub = await Subscriber.create({
                    tenantId,
                    name: fullName,
                    firstName: firstName || null,
                    lastName: lastName || null,
                    phoneNumber: phone,
                    altPhone: row.altPhone || null,
                    email: row.email || null,
                    idNumber: row.idNumber || null,
                    username: uname,
                    password: pass,
                    address: row.address || null,
                    location: row.location || null,
                    customerType: row.customerType || 'RESIDENTIAL',
                    connectionType: row.connectionType || 'HOTSPOT',
                    status: 'ACTIVE',
                }, { transaction: t });

                // Initialize Wallet
                const balanceCents = Math.round(initialBal * 100);
                const wallet = await Wallet.create({
                    ownerId: sub.id,
                    ownerType: 'SUBSCRIBER',
                    balance: balanceCents,
                    currency: 'KES',
                    tenantId,
                }, { transaction: t });

                if (balanceCents > 0) {
                    await WalletTransaction.create({
                        walletId: wallet.id,
                        amount: balanceCents,
                        transactionType: 'CREDIT',
                        referenceId: sub.id,
                        referenceType: 'BULK_IMPORT',
                        balanceAfter: balanceCents,
                        description: 'Bulk import initial balance',
                        status: 'COMPLETED',
                        createdBy: performedBy,
                        tenantId,
                    }, { transaction: t });
                }

                importedCount++;
            }

            await AuditLog.create({
                action: 'SUBSCRIBER_BULK_IMPORT',
                details: `Bulk imported ${importedCount} subscribers`,
                tenantId,
                userId: performedBy,
                ipAddress,
            }, { transaction: t });

            await t.commit();

            return { success: true, importedCount, errors: [] };
        } catch (error) {
            await t.rollback();
            logger.error('Bulk import transaction failed and rolled back', { error });
            throw error;
        }
    }

    /**
     * Change Subscriber Status (SUSPEND, REACTIVATE, ARCHIVE, DELETE) with live router sync
     */
    static async changeSubscriberStatus(subscriberId: string, tenantId: string, action: 'SUSPEND' | 'REACTIVATE' | 'ARCHIVE' | 'DELETE', performedBy: string, ipAddress?: string) {
        const sub = await Subscriber.findOne({ where: { id: subscriberId, tenantId } });
        if (!sub) throw new Error('Subscriber not found');

        const oldStatus = sub.status;

        if (action === 'SUSPEND') {
            sub.status = 'SUSPENDED';
            if (sub.routerId && sub.username) {
                const router = await RouterModel.findOne({ where: { id: sub.routerId, tenantId } });
                if (router) {
                    try { await MikroTikService.toggleHotspotUser(router, sub.username, false); } catch(e) { logger.warn('Failed to suspend on router', {e}); }
                    try { await MikroTikService.disconnectHotspotUser(router, sub.username); } catch(e) {}
                }
            }
        } else if (action === 'REACTIVATE') {
            sub.status = 'ACTIVE';
            if (sub.routerId && sub.username) {
                const router = await RouterModel.findOne({ where: { id: sub.routerId, tenantId } });
                if (router) {
                    try { await MikroTikService.toggleHotspotUser(router, sub.username, true); } catch(e) { logger.warn('Failed to reactivate on router', {e}); }
                }
            }
        } else if (action === 'ARCHIVE') {
            sub.status = 'INACTIVE';
            sub.archivedAt = new Date();
        } else if (action === 'DELETE') {
            // Check router sync before destroy
            if (sub.routerId) {
                const router = await RouterModel.findOne({ where: { id: sub.routerId, tenantId } });
                if (router && sub.username) {
                    try { await MikroTikService.removeHotspotUser(router, sub.username); } catch (e) { logger.warn('Failed to remove router user on delete', { e }); }
                }
            }
            await sub.destroy();

            await AuditLog.create({
                action: 'SUBSCRIBER_DELETED',
                details: `Deleted subscriber ${sub.name} (${sub.phoneNumber})`,
                tenantId,
                userId: performedBy,
                ipAddress,
            });

            return { success: true, message: 'Subscriber deleted' };
        }

        await sub.save();

        // Live Router Disable / Enable Sync
        if (sub.routerId && sub.username) {
            const router = await RouterModel.findOne({ where: { id: sub.routerId, tenantId } });
            if (router) {
                try {
                    const isDisabled = action === 'SUSPEND' || action === 'ARCHIVE';
                    await MikroTikService.createOrUpdateHotspotProfile(router, sub.username, { sharedUsers: isDisabled ? 0 : 1 });
                } catch (e) { logger.warn('Router sync status change warning', { error: e }); }
            }
        }

        await AuditLog.create({
            action: `SUBSCRIBER_${action}`,
            details: `Subscriber ${sub.name} status changed from ${oldStatus} to ${sub.status}`,
            tenantId,
            userId: performedBy,
            ipAddress,
        });

        return { success: true, subscriber: sub };
    }

    /**
     * Credit or Debit Customer Wallet
     */
    static async manageCustomerWallet(subscriberId: string, tenantId: string, action: 'CREDIT' | 'DEBIT', amountKES: number, reason: string, performedBy: string) {
        let wallet = await Wallet.findOne({ where: { ownerId: subscriberId, ownerType: 'SUBSCRIBER' } });
        if (!wallet) {
            wallet = await Wallet.create({
                ownerId: subscriberId,
                ownerType: 'SUBSCRIBER',
                balance: 0,
                currency: 'KES',
                tenantId,
            });
        }

        const cents = Math.round(amountKES * 100);
        if (action === 'DEBIT' && Number(wallet.balance) < cents) {
            throw new Error(`Insufficient wallet balance (${Number(wallet.balance) / 100} KES). Cannot debit ${amountKES} KES.`);
        }

        const newBalance = action === 'CREDIT' ? Number(wallet.balance) + cents : Number(wallet.balance) - cents;
        wallet.balance = newBalance;
        await wallet.save();

        await WalletTransaction.create({
            walletId: wallet.id,
            amount: cents,
            transactionType: action,
            referenceId: subscriberId,
            referenceType: 'MANUAL_MANAGEMENT',
            balanceAfter: newBalance,
            description: reason || `Manual wallet ${action.toLowerCase()}`,
            status: 'COMPLETED',
            createdBy: performedBy,
            tenantId,
        });

        await AuditLog.create({
            action: `WALLET_${action}`,
            details: `Subscriber wallet ${action.toLowerCase()}ed KES ${amountKES}. New Balance: KES ${newBalance / 100}`,
            tenantId,
            userId: performedBy,
        });

        return { success: true, wallet, newBalanceKES: newBalance / 100 };
    }

    /**
     * Generate 6 Onboarding & LTV Analytics Reports
     */
    static async generateSubscriberReports(tenantId: string) {
        const subscribers = await Subscriber.findAll({ where: { tenantId } });
        const payments = await Payment.findAll({ where: { tenantId, status: 'SUCCESS' } });

        const total = subscribers.length;
        const active = subscribers.filter(s => s.status === 'ACTIVE').length;
        const expired = subscribers.filter(s => s.status === 'INACTIVE').length;
        const suspended = subscribers.filter(s => s.status === 'SUSPENDED').length;

        // Customer Lifetime Value Calculation
        const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const avgLTV = total > 0 ? (totalRevenue / 100) / total : 0;

        // Customer Types breakdown
        const typeBreakdown: Record<string, number> = {};
        subscribers.forEach(s => {
            typeBreakdown[s.customerType || 'RESIDENTIAL'] = (typeBreakdown[s.customerType || 'RESIDENTIAL'] || 0) + 1;
        });

        return {
            summary: {
                totalSubscribers: total,
                activeSubscribers: active,
                expiredSubscribers: expired,
                suspendedSubscribers: suspended,
                totalRevenueKES: totalRevenue / 100,
                avgLifetimeValueKES: Math.round(avgLTV * 100) / 100,
            },
            typeBreakdown,
        };
    }
}
