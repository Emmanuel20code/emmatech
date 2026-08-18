"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const supabaseClient_1 = require("../lib/supabaseClient");
class AgentService {
    static async getOrCreateWallet(agentId, tenantId) {
        let { data: wallet } = await supabaseClient_1.supabase
            .from('wallets')
            .select('*')
            .eq('ownerId', agentId)
            .eq('ownerType', 'AGENT')
            .single();
        if (!wallet) {
            const { data: newWallet, error } = await supabaseClient_1.supabase
                .from('wallets')
                .insert({
                ownerId: agentId,
                ownerType: 'AGENT',
                balance: 0,
                tenantId: tenantId
            })
                .select()
                .single();
            if (error)
                throw error;
            wallet = newWallet;
        }
        return wallet;
    }
    static async sellVoucher(agentId, voucherId) {
        try {
            const { data: agent } = await supabaseClient_1.supabase
                .from('admin_users')
                .select('*')
                .eq('id', agentId)
                .single();
            if (!agent || agent.role !== 'AGENT')
                throw new Error('Invalid agent');
            const { data: voucher } = await supabaseClient_1.supabase
                .from('vouchers')
                .select('*, packages(*)')
                .eq('id', voucherId)
                .single();
            if (!voucher || voucher.status !== 'AVAILABLE')
                throw new Error('Voucher not available');
            const pkg = voucher.packages;
            const price = pkg.price;
            const commission = price * (agent.commissionRate || 0);
            // 1. Mark voucher as SOLD
            const { error: voucherError } = await supabaseClient_1.supabase
                .from('vouchers')
                .update({
                status: 'USED',
                usedAt: new Date().toISOString(),
                soldByAgentId: agentId
            })
                .eq('id', voucherId);
            if (voucherError)
                throw voucherError;
            // 2. Credit Agent Wallet
            const wallet = await this.getOrCreateWallet(agentId, agent.tenantId);
            const { error: walletError } = await supabaseClient_1.supabase
                .from('wallets')
                .update({ balance: wallet.balance + commission })
                .eq('id', wallet.id);
            if (walletError)
                throw walletError;
            return { voucher, commission };
        }
        catch (error) {
            throw error;
        }
    }
    static async getStats(agentId) {
        const { data: wallet } = await supabaseClient_1.supabase
            .from('wallets')
            .select('balance')
            .eq('ownerId', agentId)
            .eq('ownerType', 'AGENT')
            .single();
        const { count: sales } = await supabaseClient_1.supabase
            .from('vouchers')
            .select('*', { count: 'exact', head: true })
            .eq('soldByAgentId', agentId)
            .eq('status', 'USED');
        return {
            balance: wallet?.balance || 0,
            totalSales: sales || 0
        };
    }
}
exports.AgentService = AgentService;
