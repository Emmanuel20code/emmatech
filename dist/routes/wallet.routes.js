"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_service_1 = require("../services/wallet.service");
const verification_service_1 = require("../services/verification.service");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth"); // Assuming auth middleware exists
const express_validator_1 = require("express-validator");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
// Get wallet balance
router.get('/balance', auth_1.authMiddleware, async (req, res) => {
    try {
        let tenantId = req.user.tenantId;
        if (!tenantId) {
            const activeTenant = await models_1.Tenant.findOne({ where: { status: 'ACTIVE' }, order: [['createdAt', 'ASC']] });
            if (activeTenant)
                tenantId = activeTenant.id;
        }
        if (!tenantId) {
            return res.json({ balance: 0, settledBalance: 0, pendingBalance: 0, frozenBalance: 0, currency: 'KES' });
        }
        const wallet = await wallet_service_1.WalletService.getWalletBalanceByOwner(tenantId);
        res.json(wallet);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get wallet transactions
router.get('/transactions', auth_1.authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { limit, offset } = req.query;
        const transactions = await wallet_service_1.WalletService.getWalletTransactionsByOwner(tenantId, 'TENANT', Number(limit) || 50, Number(offset) || 0);
        res.json(transactions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Request withdrawal (initiates OTP)
router.post('/withdraw/request', [
    auth_1.authMiddleware,
    (0, express_validator_1.body)('amount').isFloat({ min: 1 }).withMessage('Amount must be at least KES 1'),
    (0, express_validator_1.body)('method').isIn(['MPESA', 'BANK', 'PAYPAL']).withMessage('Invalid withdrawal method'),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const { amount, method } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than 0' });
        }
        const tenant = await models_1.Tenant.findByPk(tenantId);
        if (!tenant)
            return res.status(404).json({ error: 'Tenant not found' });
        if (tenant.withdrawalVerificationMethod !== 'NONE') {
            const target = req.user.email; // Default to email for OTP
            await verification_service_1.VerificationService.sendOTP(target, 'EMAIL', tenantId, userId);
            return res.json({ message: 'OTP sent for verification', step: 'VERIFICATION_REQUIRED' });
        }
        const settlement = await wallet_service_1.WalletService.createSettlement(tenantId, amount, method, userId);
        res.json({ message: 'Withdrawal request created', settlement });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Verify and complete withdrawal
router.post('/withdraw/verify', [
    auth_1.authMiddleware,
    (0, express_validator_1.body)('amount').isFloat({ min: 1 }).withMessage('Amount must be at least KES 1'),
    (0, express_validator_1.body)('method').isIn(['MPESA', 'BANK', 'PAYPAL']).withMessage('Invalid withdrawal method'),
    (0, express_validator_1.body)('otp').isString().isLength({ min: 4, max: 6 }).withMessage('Invalid OTP format'),
    validation_1.handleValidationErrors
], async (req, res) => {
    try {
        const { amount, method, otp } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;
        const target = req.user.email;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than 0' });
        }
        const verified = await verification_service_1.VerificationService.verifyOTP(target, otp, userId);
        if (!verified)
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        const settlement = await wallet_service_1.WalletService.createSettlement(tenantId, amount, method, userId);
        res.json({ message: 'Withdrawal request verified and created', settlement });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Reconcile wallet balance
router.post('/reconcile', auth_1.authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const result = await wallet_service_1.WalletService.reconcileWallet(tenantId);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get transaction trace
router.get('/transactions/:id/trace', auth_1.authMiddleware, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const transactionId = req.params.id;
        const trace = await wallet_service_1.WalletService.getTransactionTrace(transactionId, tenantId);
        res.json(trace);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
