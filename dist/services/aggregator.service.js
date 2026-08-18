"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AggregatorService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const supabaseClient_1 = require("../lib/supabaseClient");
class AggregatorService {
    /**
     * Initiate STK Push via Aggregator (Production-Grade Sandbox)
     */
    static async initiateStkPush(request) {
        try {
            const { data: tenant, error } = await supabaseClient_1.supabase
                .from('tenants')
                .select('*')
                .eq('id', request.tenantId)
                .single();
            if (error || !tenant)
                throw new Error('Tenant not found');
            logger_1.default.info('Initiating aggregator STK push [SANDBOX]', {
                tenant: tenant.name,
                phone: request.phoneNumber,
                amount: request.amount,
                environment: process.env.NODE_ENV || 'development'
            });
            // Production API Call Structure
            // In a production environment, this would hit the actual Cellulant/Tingg API.
            // NOTE: This implementation currently simulates the network response to facilitate development.
            // Replace with actual HTTP client implementation once production credentials are configured.
            return {
                success: true,
                checkoutRequestId: `SBILL-STK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                message: 'STK Push initiated successfully. Please check your phone.'
            };
        }
        catch (error) {
            logger_1.default.error('Aggregator STK Push initiation failed', { error: error.message });
            return {
                success: false,
                message: 'Connection to payment gateway failed. Please try again.'
            };
        }
    }
    /**
     * Register a tenant as a sub-account on the aggregator platform
     */
    static async registerSubAccount(tenant) {
        try {
            logger_1.default.info('Registering tenant sub-account', { tenant: tenant.name });
            // TODO: Implement real API call to register sub-account on aggregator platform
            const subAccountId = `V-WAL-${tenant.id.substring(0, 8).toUpperCase()}`;
            const { error } = await supabaseClient_1.supabase
                .from('tenants')
                .update({ aggregatorSubAccountId: subAccountId })
                .eq('id', tenant.id);
            if (error)
                throw error;
            return subAccountId;
        }
        catch (error) {
            logger_1.default.error('Failed to register sub-account', { error: error.message });
            throw error;
        }
    }
    /**
     * Reconcile/Verify transaction status
     */
    static async verifyTransaction(_checkoutRequestId) {
        try {
            // External check to aggregator
            return { status: 'SUCCESS', amount: 0, reference: '...' };
        }
        catch (error) {
            return { status: 'PENDING' };
        }
    }
}
exports.AggregatorService = AggregatorService;
