import { Router } from 'express';
import { authorize } from '../middleware/auth';
import { SmsGatewayService } from '../services/sms-gateway.service';
import { SmsPackage } from '../models';
import { AuditService } from '../services/audit.service';

const router = Router();

// All routes here are Super Admin only
router.use(authorize(['SUPER_ADMIN']));

// ================================================================
// SMS GATEWAY MANAGEMENT
// ================================================================

// GET all gateways (sanitized)
router.get('/gateways', async (_req, res) => {
    try {
        const gateways = await SmsGatewayService.getAllGatewaysSafe();
        res.json(gateways);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// GET single gateway (sanitized)
router.get('/gateways/:id', async (req, res) => {
    try {
        const gw = await SmsGatewayService.getGatewaySafe(req.params.id);
        if (!gw) return res.status(404).json({ error: 'Gateway not found' });
        res.json(gw);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST create gateway
router.post('/gateways', async (req: any, res) => {
    try {
        const gw = await SmsGatewayService.createGateway(req.body);
        await AuditService.log('SMS_GATEWAY_CREATED', `SMS gateway "${req.body.name}" created`, undefined, req.user?.id);
        const safe = await SmsGatewayService.getGatewaySafe(gw.id);
        res.status(201).json(safe);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// PUT update gateway
router.put('/gateways/:id', async (req: any, res) => {
    try {
        const gw = await SmsGatewayService.updateGateway(req.params.id, req.body);
        await AuditService.log('SMS_GATEWAY_UPDATED', `SMS gateway "${gw.name}" updated`, undefined, req.user?.id);
        const safe = await SmsGatewayService.getGatewaySafe(gw.id);
        res.json(safe);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// DELETE gateway
router.delete('/gateways/:id', async (req: any, res) => {
    try {
        await SmsGatewayService.deleteGateway(req.params.id);
        await AuditService.log('SMS_GATEWAY_DELETED', `SMS gateway ${req.params.id} deleted`, undefined, req.user?.id);
        res.json({ message: 'Gateway deleted successfully' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST test gateway connection
router.post('/gateways/:id/test-connection', async (req: any, res) => {
    try {
        const result = await SmsGatewayService.testConnection(req.params.id);
        await AuditService.log('SMS_GATEWAY_TEST_CONNECTION', `Gateway ${req.params.id} connection tested: ${result.success}`, undefined, req.user?.id);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST test SMS via gateway
router.post('/gateways/:id/test-sms', async (req: any, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Phone number is required' });
        const result = await SmsGatewayService.testSms(req.params.id, phone);
        await AuditService.log('SMS_GATEWAY_TEST_SMS', `Test SMS sent via gateway ${req.params.id} to ${phone}`, undefined, req.user?.id);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// ================================================================
// SMS PACKAGE MANAGEMENT
// ================================================================

// GET all packages (including cost price for super admin)
router.get('/packages', async (_req, res) => {
    try {
        const packages = await SmsPackage.findAll({ order: [['sortOrder', 'ASC'], ['smsCount', 'ASC']] });
        res.json(packages.map(p => ({
            id: p.id,
            name: p.name,
            smsCount: p.smsCount,
            sellingPrice: Number(p.sellingPrice),
            costPrice: Number(p.costPrice),
            status: p.status,
            description: p.description,
            isCustom: p.isCustom,
            sortOrder: p.sortOrder,
            createdAt: (p as any).createdAt,
        })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST create package
router.post('/packages', async (req: any, res) => {
    try {
        const { name, smsCount, sellingPrice, costPrice, status, description, isCustom, sortOrder } = req.body;
        if (!name || !smsCount || !sellingPrice) {
            return res.status(400).json({ error: 'name, smsCount, and sellingPrice are required' });
        }

        const pkg = await SmsPackage.create({
            name,
            smsCount: Number(smsCount),
            sellingPrice: Number(sellingPrice),
            costPrice: Number(costPrice) || 0,
            status: status || 'ACTIVE',
            description: description || null,
            isCustom: isCustom || false,
            sortOrder: sortOrder || 0,
        });

        await AuditService.log('SMS_PACKAGE_CREATED', `SMS package "${name}" created (${smsCount} SMS)`, undefined, req.user?.id);
        res.status(201).json(pkg);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// PUT update package
router.put('/packages/:id', async (req: any, res) => {
    try {
        const pkg = await SmsPackage.findByPk(req.params.id);
        if (!pkg) return res.status(404).json({ error: 'Package not found' });

        const { name, smsCount, sellingPrice, costPrice, status, description, isCustom, sortOrder } = req.body;
        await pkg.update({
            name: name !== undefined ? name : pkg.name,
            smsCount: smsCount !== undefined ? Number(smsCount) : pkg.smsCount,
            sellingPrice: sellingPrice !== undefined ? Number(sellingPrice) : pkg.sellingPrice,
            costPrice: costPrice !== undefined ? Number(costPrice) : pkg.costPrice,
            status: status !== undefined ? status : pkg.status,
            description: description !== undefined ? description : pkg.description,
            isCustom: isCustom !== undefined ? isCustom : pkg.isCustom,
            sortOrder: sortOrder !== undefined ? sortOrder : pkg.sortOrder,
        });

        await AuditService.log('SMS_PACKAGE_UPDATED', `SMS package "${pkg.name}" updated`, undefined, req.user?.id);
        res.json(pkg);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// DELETE (soft) — set status to INACTIVE
router.delete('/packages/:id', async (req: any, res) => {
    try {
        const pkg = await SmsPackage.findByPk(req.params.id);
        if (!pkg) return res.status(404).json({ error: 'Package not found' });
        await pkg.update({ status: 'INACTIVE' });
        await AuditService.log('SMS_PACKAGE_DEACTIVATED', `SMS package "${pkg.name}" deactivated`, undefined, req.user?.id);
        res.json({ message: 'Package deactivated successfully' });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

export default router;
