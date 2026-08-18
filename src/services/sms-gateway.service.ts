import crypto from 'crypto';
import axios from 'axios';
import logger from '../utils/logger';
import { supabase } from '../lib/supabaseClient';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * Must be a 32-byte (64-char hex) string.
 */
function getEncryptionKey(): Buffer {
    const keyHex = process.env.SMS_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length < 64) {
        // Fallback to JWT_SECRET hash in dev — not acceptable for production
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SMS_ENCRYPTION_KEY must be set in production (64-char hex string).');
        }
        const fallback = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'dev-fallback').digest();
        logger.warn('[SmsGateway] SMS_ENCRYPTION_KEY not set. Using JWT_SECRET hash as fallback (DEV ONLY).');
        return fallback;
    }
    return Buffer.from(keyHex, 'hex');
}

function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv:tag:encrypted (all hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext: string): string {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const [ivHex, tagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

function maskKey(key: string | null): string {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
}

export interface GatewayCreateInput {
    name: string;
    provider: string;
    apiBaseUrl?: string;
    apiKey?: string;
    apiSecret?: string;
    senderId?: string;
    callbackUrl?: string;
    isActive?: boolean;
    supportedCountries?: string[];
    supportedCurrencies?: string[];
    taxRate?: number;
    minPurchaseAmount?: number;
    maxPurchaseAmount?: number;
    metadata?: Record<string, unknown>;
}

export class SmsGatewayService {

    /**
     * Create a new SMS gateway. Encrypts API key/secret before saving.
     */
    static async createGateway(input: GatewayCreateInput): Promise<any> {
        const { data: gateway, error } = await supabase
            .from('sms_gateways')
            .insert({
                name: input.name,
                provider: input.provider,
                apiBaseUrl: input.apiBaseUrl || null,
                apiKeyEncrypted: input.apiKey ? encrypt(input.apiKey) : null,
                apiSecretEncrypted: input.apiSecret ? encrypt(input.apiSecret) : null,
                senderId: input.senderId || null,
                callbackUrl: input.callbackUrl || null,
                isActive: input.isActive !== undefined ? input.isActive : true,
                supportedCountries: input.supportedCountries ? input.supportedCountries : null,
                supportedCurrencies: input.supportedCurrencies ? input.supportedCurrencies : null,
                taxRate: input.taxRate || 0,
                minPurchaseAmount: input.minPurchaseAmount || 10000,
                maxPurchaseAmount: input.maxPurchaseAmount || 10000000,
                metadata: input.metadata ? input.metadata : null,
            })
            .select()
            .single();
        if (error) throw error;
        return gateway;
    }

    /**
     * Update an existing gateway. Re-encrypts keys only if new values provided.
     */
    static async updateGateway(id: string, input: Partial<GatewayCreateInput>): Promise<any> {
        const { data: gateway, error: fetchError } = await supabase
            .from('sms_gateways')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError || !gateway) throw new Error('Gateway not found');

        const updateData: any = {
            name: input.name !== undefined ? input.name : gateway.name,
            provider: input.provider !== undefined ? input.provider : gateway.provider,
            apiBaseUrl: input.apiBaseUrl !== undefined ? input.apiBaseUrl : gateway.apiBaseUrl,
            senderId: input.senderId !== undefined ? input.senderId : gateway.senderId,
            callbackUrl: input.callbackUrl !== undefined ? input.callbackUrl : gateway.callbackUrl,
            isActive: input.isActive !== undefined ? input.isActive : gateway.isActive,
            taxRate: input.taxRate !== undefined ? input.taxRate : gateway.taxRate,
            minPurchaseAmount: input.minPurchaseAmount !== undefined ? input.minPurchaseAmount : gateway.minPurchaseAmount,
            maxPurchaseAmount: input.maxPurchaseAmount !== undefined ? input.maxPurchaseAmount : gateway.maxPurchaseAmount,
        };

        if (input.apiKey !== undefined && input.apiKey !== '') {
            updateData.apiKeyEncrypted = encrypt(input.apiKey);
        }
        if (input.apiSecret !== undefined && input.apiSecret !== '') {
            updateData.apiSecretEncrypted = encrypt(input.apiSecret);
        }
        if (input.supportedCountries !== undefined) {
            updateData.supportedCountries = input.supportedCountries;
        }
        if (input.supportedCurrencies !== undefined) {
            updateData.supportedCurrencies = input.supportedCurrencies;
        }
        if (input.metadata !== undefined) {
            updateData.metadata = input.metadata;
        }

        const { data: updatedGateway, error: updateError } = await supabase
            .from('sms_gateways')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (updateError) throw updateError;

        return updatedGateway;
    }

    /**
     * Delete a gateway.
     */
    static async deleteGateway(id: string): Promise<void> {
        const { error } = await supabase
            .from('sms_gateways')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }

    /**
     * Get all gateways — SANITIZED (API keys masked). Safe for API response.
     */
    static async getAllGatewaysSafe(): Promise<object[]> {
        const { data: gateways, error } = await supabase
            .from('sms_gateways')
            .select('*')
            .order('createdAt', { ascending: false });
        if (error) throw error;
        return (gateways || []).map(gw => this.sanitizeGateway(gw));
    }

    /**
     * Get a single gateway — SANITIZED.
     */
    static async getGatewaySafe(id: string): Promise<object | null> {
        const { data: gw, error } = await supabase
            .from('sms_gateways')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !gw) return null;
        return this.sanitizeGateway(gw);
    }

    /**
     * Get active gateway with DECRYPTED credentials — INTERNAL USE ONLY.
     * Never call this from a tenant-facing endpoint.
     */
    static async getActiveGatewayDecrypted(): Promise<{
        id: string;
        name: string;
        provider: string;
        apiBaseUrl: string | null;
        apiKey: string | null;
        apiSecret: string | null;
        senderId: string | null;
    } | null> {
        const { data: gw, error } = await supabase
            .from('sms_gateways')
            .select('*')
            .eq('isActive', true)
            .single();
        if (error || !gw) return null;

        return {
            id: gw.id,
            name: gw.name,
            provider: gw.provider,
            apiBaseUrl: gw.apiBaseUrl,
            apiKey: gw.apiKeyEncrypted ? decrypt(gw.apiKeyEncrypted) : null,
            apiSecret: gw.apiSecretEncrypted ? decrypt(gw.apiSecretEncrypted) : null,
            senderId: gw.senderId,
        };
    }

    /**
     * Test gateway connection — ping provider health endpoint.
     */
    static async testConnection(id: string): Promise<{ success: boolean; message: string; responseTime?: number }> {
        const { data: gw, error } = await supabase
            .from('sms_gateways')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !gw) throw new Error('Gateway not found');

        const start = Date.now();
        try {
            const apiKey = gw.apiKeyEncrypted ? decrypt(gw.apiKeyEncrypted) : null;

            if (gw.provider === 'TALKSASA') {
                const targetUrl = gw.apiBaseUrl || 'https://api.talksasa.com/v1/send';
                await axios.get(targetUrl, {
                    headers: { 'Authorization': `Bearer ${apiKey || ''}`, 'Accept': 'application/json' },
                    timeout: 8000,
                });
            } else if (gw.provider === 'AFRICASTALKING') {
                await axios.get('https://api.africastalking.com/version1/user', {
                    params: { username: 'sandbox' },
                    headers: { 'apiKey': apiKey || '', 'Accept': 'application/json' },
                    timeout: 8000,
                });
            } else if (gw.apiBaseUrl) {
                await axios.get(gw.apiBaseUrl, { timeout: 8000 });
            } else {
                return { success: false, message: 'No API base URL configured for this provider' };
            }

            const responseTime = Date.now() - start;
            return { success: true, message: 'Connection successful', responseTime };
        } catch (error: any) {
            // A 401 from the provider means we reached it (connectivity ok, just bad key)
            if (error.response?.status === 401 || error.response?.status === 403) {
                return { success: true, message: `Provider reachable (authentication may need verification). Response: ${error.response.status}`, responseTime: Date.now() - start };
            }
            return { success: false, message: `Connection failed: ${error.message}` };
        }
    }

    /**
     * Send a test SMS via this gateway.
     */
    static async testSms(id: string, to: string): Promise<{ success: boolean; message: string }> {
        const { data: gw, error } = await supabase
            .from('sms_gateways')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !gw) throw new Error('Gateway not found');

        const apiKey = gw.apiKeyEncrypted ? decrypt(gw.apiKeyEncrypted) : null;
        const apiSecret = gw.apiSecretEncrypted ? decrypt(gw.apiSecretEncrypted) : null;

        try {
            if (gw.provider === 'TALKSASA') {
                const targetUrl = gw.apiBaseUrl || 'https://api.talksasa.com/v1/send';
                const response = await axios.post(
                    targetUrl,
                    {
                        sender_id: gw.senderId || 'TALKSASA',
                        recipient: to,
                        message: 'Jevish SMS Gateway Test — Connection Verified ✓',
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${apiKey || ''}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        timeout: 10000,
                    }
                );
                if (response.data?.status === 'success' || response.data?.status === true || response.data?.code === 200) {
                    const msgId = response.data?.message_id || response.data?.id || 'TS_VERIFIED';
                    return { success: true, message: `TalkSasa Test SMS sent to ${to}. Reference ID: ${msgId}` };
                }
                return { success: false, message: `TalkSasa returned: ${response.data?.message || 'Failed'}` };
            }

            if (gw.provider === 'AFRICASTALKING') {
                const response = await axios.post(
                    (gw.apiBaseUrl || 'https://api.africastalking.com') + '/version1/messaging',
                    new URLSearchParams({
                        username: apiSecret || 'sandbox',
                        to,
                        message: 'Jevish SMS Gateway Test — Connection Verified ✓',
                        from: gw.senderId || '',
                    }),
                    {
                        headers: { 'apiKey': apiKey || '', 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
                        timeout: 10000,
                    }
                );
                const recipient = response.data?.SMSMessageData?.Recipients?.[0];
                if (recipient?.status === 'Success') {
                    return { success: true, message: `Test SMS sent to ${to}. Message ID: ${recipient.messageId}` };
                }
                return { success: false, message: `Provider returned: ${recipient?.status || 'Unknown'}` };
            }

            if (process.env.NODE_ENV !== 'production') {
                logger.warn(`[SmsGateway] Test SMS mock for provider ${gw.provider} → ${to}`);
                return { success: false, message: `[DEV] Test SMS not implemented for provider ${gw.provider}` };
            }

            return { success: false, message: `Test SMS not implemented for provider: ${gw.provider}` };
        } catch (error: any) {
            return { success: false, message: `Test SMS failed: ${error.message}` };
        }
    }

    // ----------------------------------------------------------------
    // Private helpers
    // ----------------------------------------------------------------

    private static sanitizeGateway(gw: any): object {
        return {
            id: gw.id,
            name: gw.name,
            provider: gw.provider,
            apiBaseUrl: gw.apiBaseUrl,
            apiKeyMasked: gw.apiKeyEncrypted
                ? maskKey(gw.apiKeyEncrypted.split(':')[2]?.slice(0, 12) || '****')
                : '',
            apiSecretMasked: gw.apiSecretEncrypted ? '****' : '',
            senderId: gw.senderId,
            callbackUrl: gw.callbackUrl,
            isActive: gw.isActive,
            supportedCountries: gw.supportedCountries || [],
            supportedCurrencies: gw.supportedCurrencies || [],
            taxRate: gw.taxRate,
            minPurchaseAmount: Number(gw.minPurchaseAmount),
            maxPurchaseAmount: Number(gw.maxPurchaseAmount),
            metadata: gw.metadata || {},
            createdAt: gw.createdAt,
            updatedAt: gw.updatedAt,
        };
    }
}
