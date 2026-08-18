"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const agent_service_1 = require("../services/agent.service");
const router = (0, express_1.Router)();
// Ensure only agents can access these
router.use((req, res, next) => {
    if (req.user?.role !== 'AGENT') {
        return res.status(403).json({ error: 'Access denied. Agents only.' });
    }
    next();
});
// 1. Get Agent Stats & Wallet
router.get('/stats', async (req, res) => {
    try {
        const stats = await agent_service_1.AgentService.getStats(req.user?.id);
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// 2. Get Available Vouchers (to sell)
router.get('/vouchers/available', async (req, res) => {
    const vouchers = await models_1.Voucher.findAll({
        where: {
            tenantId: req.user?.tenantId,
            status: 'AVAILABLE'
        },
        include: [models_1.Package]
    });
    res.json(vouchers);
});
// 3. Sell (Collect Cash & Mark Used)
router.post('/vouchers/:id/sell', async (req, res) => {
    try {
        const result = await agent_service_1.AgentService.sellVoucher(req.user?.id, req.params.id);
        res.json({ message: 'Voucher sold successfully', ...result });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
// 4. Sales History
router.get('/history', async (req, res) => {
    const history = await models_1.Voucher.findAll({
        where: { soldByAgentId: req.user?.id },
        include: [models_1.Package],
        order: [['usedAt', 'DESC']]
    });
    res.json(history);
});
exports.default = router;
