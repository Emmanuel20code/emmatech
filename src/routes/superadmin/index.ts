import { Router } from 'express';
import managementRoutes from './management.routes';
import commandRoutes from './command.routes';

const router = Router();

// Mount management routes directly under /api/v1/superadmin
router.use('/', managementRoutes);
// Mount command routes under /api/v1/superadmin/command
router.use('/command', commandRoutes);

export default router;
