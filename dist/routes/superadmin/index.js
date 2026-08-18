"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const management_routes_1 = __importDefault(require("./management.routes"));
const command_routes_1 = __importDefault(require("./command.routes"));
const router = (0, express_1.Router)();
// Mount management routes directly under /api/v1/superadmin
router.use('/', management_routes_1.default);
// Mount command routes under /api/v1/superadmin/command
router.use('/command', command_routes_1.default);
exports.default = router;
