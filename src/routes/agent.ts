import { Router } from 'express';
import { Package, Voucher } from '../models';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { AgentService } from '../services/agent.service';

const router = Router();

// Ensure only agents can access these
router.use((req: AuthRequest, res, next) => {
    if (req.user?.role !== 'AGENT') {
        return res.status(403).json({ error: 'Access denied. Agents only.' });
    }
    next();
});

// 1. Get Agent Stats & Wallet
router.get('/stats', async (req: AuthRequest, res) => {
    try {
        const stats = await AgentService.getStats(req.user?.id as string);
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Get Available Vouchers (to sell)
router.get('/vouchers/available', async (req: AuthRequest, res) => {
    const vouchers = await Voucher.findAll({
        where: {
            tenantId: req.user?.tenantId,
            status: 'AVAILABLE'
        },
        include: [Package]
    });
    res.json(vouchers);
});

// 3. Sell (Collect Cash & Mark Used)
router.post('/vouchers/:id/sell', async (req: AuthRequest, res) => {
    try {
        const result = await AgentService.sellVoucher(
            req.user?.id as string,
            req.params.id as string
        );
        res.json({ message: 'Voucher sold successfully', ...result });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// 4. Sales History
router.get('/history', async (req: AuthRequest, res) => {
    const history = await Voucher.findAll({
        where: { soldByAgentId: req.user?.id },
        include: [Package],
        order: [['usedAt', 'DESC']]
    });
    res.json(history);
});

export default router;
