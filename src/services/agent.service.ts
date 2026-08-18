import { supabase } from '../lib/supabaseClient';

export class AgentService {
    static async getOrCreateWallet(agentId: string, tenantId: string) {
        let { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('ownerId', agentId)
            .eq('ownerType', 'AGENT')
            .single();

        if (!wallet) {
            const { data: newWallet, error } = await supabase
                .from('wallets')
                .insert({
                    ownerId: agentId,
                    ownerType: 'AGENT',
                    balance: 0,
                    tenantId: tenantId
                })
                .select()
                .single();
            if (error) throw error;
            wallet = newWallet;
        }
        return wallet;
    }

    static async sellVoucher(agentId: string, voucherId: string) {
        try {
            const { data: agent } = await supabase
                .from('admin_users')
                .select('*')
                .eq('id', agentId)
                .single();
            if (!agent || agent.role !== 'AGENT') throw new Error('Invalid agent');

            const { data: voucher } = await supabase
                .from('vouchers')
                .select('*, packages(*)')
                .eq('id', voucherId)
                .single();
            if (!voucher || voucher.status !== 'AVAILABLE') throw new Error('Voucher not available');

            const pkg = voucher.packages;
            const price = pkg.price;
            const commission = price * (agent.commissionRate || 0);

            // 1. Mark voucher as SOLD
            const { error: voucherError } = await supabase
                .from('vouchers')
                .update({ 
                    status: 'USED', 
                    usedAt: new Date().toISOString(), 
                    soldByAgentId: agentId 
                })
                .eq('id', voucherId);
            if (voucherError) throw voucherError;

            // 2. Credit Agent Wallet
            const wallet = await this.getOrCreateWallet(agentId, agent.tenantId);
            const { error: walletError } = await supabase
                .from('wallets')
                .update({ balance: wallet.balance + commission })
                .eq('id', wallet.id);
            if (walletError) throw walletError;

            return { voucher, commission };
        } catch (error) {
            throw error;
        }
    }

    static async getStats(agentId: string) {
        const { data: wallet } = await supabase
            .from('wallets')
            .select('balance')
            .eq('ownerId', agentId)
            .eq('ownerType', 'AGENT')
            .single();
            
        const { count: sales } = await supabase
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
