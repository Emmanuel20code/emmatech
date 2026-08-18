"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MikroTikAutoConfigService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("../models");
const mikrotik_service_1 = require("./mikrotik.service");
const logger_1 = __importDefault(require("../utils/logger"));
class MikroTikAutoConfigService {
    /**
     * Generate unique API credentials for a router
     */
    static generateApiCredentials(tenantId, routerId) {
        const apiUser = `jevish_${tenantId.substring(0, 8)}_${routerId.substring(0, 8)}`;
        const apiPassword = crypto_1.default.randomBytes(16).toString('hex');
        return { apiUser, apiPassword };
    }
    /**
     * Generate universal auto-configuration script compatible with both RouterOS v6 and v7
     */
    static generateUniversalAutoConfigScript(router, tenant, onboardToken, appBaseUrl) {
        const locationName = (router.location || router.name || 'Main_Hub').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const tenantName = tenant.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const tenantSubdomain = (tenant.subdomain || tenantName).toLowerCase();
        const apiUser = router.apiUser || `jevish_${tenant.id.substring(0, 6)}_${router.id.substring(0, 6)}`;
        const apiPassword = router.apiPassword || 'JevishSecret123!';
        let billingHost = 'jevish.site';
        try {
            const parsed = new URL(appBaseUrl.startsWith('http') ? appBaseUrl : `https://${appBaseUrl}`);
            billingHost = parsed.hostname;
        }
        catch (_) {
            billingHost = 'jevish.site';
        }
        return `# ========================================================
# Jevish Universal MikroTik Automated Onboarding Script
# Location Name: ${locationName}
# RouterOS Version: Compatible with v6.x & v7.x
# Tenant: ${tenant.name}
# Features: All-Port Bridging, Hotspot & PPPoE Bridge Mode
# ========================================================

:log info "Jevish: Initiating automated setup for location [${locationName}]..."

# STEP 1: API User & Group Setup
:if ([:len [/user group find name=jevish_api]] = 0) do={
    /user group add name=jevish_api policy=api,read,write,test
}
:if ([:len [/user find name="${apiUser}"]] = 0) do={
    /user add name="${apiUser}" password="${apiPassword}" group=jevish_api comment="Jevish API Access"
} else={
    /user set [find name="${apiUser}"] password="${apiPassword}" group=jevish_api comment="Jevish API Access"
}

# STEP 2: Enable API Service & Firewall Access
/ip service set api disabled=no port=8728
:if ([:len [/ip firewall filter find comment="Jevish API Access"]] = 0) do={
    /ip firewall filter add chain=input protocol=tcp dst-port=8728 action=accept comment="Jevish API Access" place-before=0
}

# STEP 3: Automated All-Port Bridging (Bridge Mode)
# We assume ether1 is WAN, all other ports will be bridged for Hotspot/PPPoE
:log info "Jevish: Configuring all-port bridge [bridge_jevish]..."
:if ([:len [/interface bridge find name=bridge_jevish]] = 0) do={
    /interface bridge add name=bridge_jevish comment="Jevish Main Service Bridge"
}

# Loop through all ethernet ports and add to bridge (excluding ether1/WAN)
:foreach i in=[/interface ethernet find] do={
    :local ifName [/interface get $i name];
    :if ($ifName != "ether1") do={
        :if ([:len [/interface bridge port find interface=$ifName]] = 0) do={
            /interface bridge port add bridge=bridge_jevish interface=$ifName
            :log info "Jevish: Added $ifName to bridge_jevish"
        }
    }
}

# STEP 4: IP Address & Pools for Bridge
:if ([:len [/ip address find interface=bridge_jevish]] = 0) do={
    /ip address add address=10.5.50.1/24 interface=bridge_jevish comment="Jevish Gateway"
}

:if ([:len [/ip pool find name=pool_jevish]] = 0) do={
    /ip pool add name=pool_jevish ranges=10.5.50.10-10.5.50.250
}

# STEP 5: Hotspot Setup on Bridge
:log info "Jevish: Setting up Hotspot on bridge_jevish..."
:if ([:len [/ip hotspot profile find name="Jevish_${tenantSubdomain}"]] = 0) do={
    /ip hotspot profile add name="Jevish_${tenantSubdomain}" login-by=http-chap,http-pap,mac dns-name="${tenantSubdomain}.jevish.site" hotspot-address=10.5.50.1
}

:if ([:len [/ip hotspot find interface=bridge_jevish]] = 0) do={
    /ip hotspot add name="Hotspot_Jevish" interface=bridge_jevish profile="Jevish_${tenantSubdomain}" address-pool=pool_jevish disabled=no
}

# STEP 6: PPPoE Server Setup on Bridge
:log info "Jevish: Setting up PPPoE Server on bridge_jevish..."
:if ([:len [/ppp profile find name="Jevish_PPPoE"]] = 0) do={
    /ppp profile add name="Jevish_PPPoE" local-address=10.5.50.1 remote-address=pool_jevish dns-server=8.8.8.8,1.1.1.1 comment="Jevish PPPoE Profile"
}

:if ([:len [/interface pppoe-server server find interface=bridge_jevish]] = 0) do={
    /interface pppoe-server server add service-name="Jevish_Internet" interface=bridge_jevish default-profile="Jevish_PPPoE" disabled=no authentication=pap,chap,mschap1,mschap2 keepalive-timeout=10
}

# STEP 7: Walled Garden Rules (Payment Gateways & System)
/ip hotspot walled-garden
add dst-host="*.intasend.com" comment="Jevish IntaSend"
add dst-host="*.safaricom.co.ke" comment="Jevish M-Pesa"
add dst-host="${billingHost}" comment="Jevish Billing"
add dst-host="*.cloudflare.com" comment="Jevish Cloudflare"

# STEP 8: Default User Profiles
:catch {
    /ip hotspot user profile set [ find default=yes ] shared-users=1 rate-limit=512k/512k
}

# STEP 9: System Auto-Sync Script & Scheduler
:if ([:len [/system script find name=Jevish_Sync_Script]] = 0) do={
    /system script add name=Jevish_Sync_Script source=":log info \"Jevish Cloud Sync Active\""
}
:if ([:len [/system scheduler find name=Jevish_Sync]] = 0) do={
    /system scheduler add name=Jevish_Sync interval=5m on-event=Jevish_Sync_Script comment="Jevish Auto-Sync"
}

# STEP 10: Set Router Identity to Location Name
/system identity set name="Jevish_${locationName}"

# STEP 11: Auto-Register Phone-Home Notification
:log info "Jevish: Calling home to finalize onboarding for ${locationName}..."
:local rosVer [/system resource get version]
:local identity [/system identity get name]
:catch {
    /tool fetch url="${appBaseUrl}/api/v1/routers/onboard/${onboardToken}/register?version=$rosVer&identity=$identity" check-certificate=no keep-result=no
}

:log info "Jevish: Automated onboarding successfully completed for ${locationName}!"
`;
    }
    /**
     * Generate auto-configuration script for a router
     */
    static async generateAutoConfigScript(router, tenant, version = 'v7') {
        const { apiUser, apiPassword } = this.generateApiCredentials(tenant.id, router.id);
        const billingSystemIP = process.env.APP_URL || 'http://localhost:3010';
        const billingHost = new URL(billingSystemIP).hostname;
        // Store credentials in router model
        await router.update({
            apiUser,
            apiPassword,
            username: apiUser, // Use apiUser for future connections
            password: apiPassword, // Use apiPassword for future connections
            autoConfigStatus: 'PENDING'
        });
        const script = version === 'v7' ? this.generateV7Script(router, tenant, apiUser, apiPassword, billingHost)
            : this.generateV6Script(router, tenant, apiUser, apiPassword, billingHost);
        // Store script in router
        await router.update({ autoConfigScript: script });
        // Log the generation (safely caught for unpersisted test routers)
        try {
            await models_1.RouterConnectionLog.create({
                routerId: router.id,
                tenantId: tenant.id,
                action: 'CONNECT',
                status: 'PENDING',
                details: `Auto-config script generated for RouterOS ${version}`,
                metadata: JSON.stringify({ version, apiUser })
            });
        }
        catch (err) {
            logger_1.default.warn(`Could not log auto-config script generation: ${err.message}`);
        }
        return script;
    }
    /**
     * Generate RouterOS v7 configuration script
     */
    static generateV7Script(router, tenant, apiUser, apiPassword, billingHost) {
        const tenantName = tenant.name.replace(/[^a-zA-Z0-9]/g, '_');
        const tenantSubdomain = tenant.subdomain || tenantName.toLowerCase();
        return `# ========================================
# Jevish Auto-Configuration Script
# RouterOS v7
# ========================================
# Tenant: ${tenant.name}
# Router: ${router.name}
# Generated: ${new Date().toISOString()}
# ========================================

# STEP 1: Create API User (Least Privilege)
/user group add name=jevish_api policy=api,read,write,test,!local,!telnet,!ssh,!ftp,!reboot,!policy,!password,!web,!winbox,!sensitive
/user add name=${apiUser} password=${apiPassword} group=jevish_api comment="Jevish Billing System API Access"

# STEP 2: Firewall Rules (Allow Billing System API Access)
/ip firewall filter add chain=input protocol=tcp dst-port=8728 src-address=${billingHost} action=accept comment="Jevish API Access" place-before=0

# STEP 3: Hotspot Profile Configuration
/ip hotspot profile
add name=Jevish_${tenantSubdomain} \\
    login-by=http-chap,http-pap,mac \\
    use-radius=no \\
    dns-name=${tenantSubdomain}.jevish.site \\
    hotspot-address=10.5.50.1 \\
    smtp-server=0.0.0.0 \\
    http-cookie-lifetime=1d \\
    trial-uptime-limit=0s \\
    trial-user-profile=default

# STEP 4: Walled Garden (Payment Gateways & APIs)
/ip hotspot walled-garden
add dst-host=*.intasend.com comment="IntaSend Payment Gateway"
add dst-host=*.safaricom.co.ke comment="M-Pesa Gateway"
add dst-host=${billingHost} comment="Jevish Billing System"
add dst-host=*.googleapis.com comment="Google APIs"
add dst-host=*.cloudflare.com comment="Cloudflare CDN"

# STEP 5: User Profile (Default Settings)
/ip hotspot user profile
set [ find default=yes ] shared-users=1 rate-limit=512k/512k

# STEP 6: Scheduler - Sync with Billing System (Every 5 minutes)
/system script
add name=Jevish_Sync_Script source={
    :log info "Jevish: Running sync with billing system"
    # This script will be enhanced by the billing system via API
    # to perform automated user cleanup and session management
}

/system scheduler
add name=Jevish_Sync interval=5m on-event=Jevish_Sync_Script comment="Jevish Auto-Sync"

# STEP 7: Scheduler - Cleanup Expired Users (Daily at 2 AM)
/system script
add name=Jevish_Cleanup_Script source={
    :log info "Jevish: Cleaning up expired users"
    # Cleanup logic will be managed by billing system
}

/system scheduler
add name=Jevish_Cleanup interval=1d start-time=02:00:00 on-event=Jevish_Cleanup_Script comment="Jevish Daily Cleanup"

# STEP 8: Set Router Identity
/system identity set name="Jevish_${tenantName}_${router.name}"

# ========================================
# CONFIGURATION COMPLETE
# ========================================
# Next Steps:
# 1. Verify connection in Jevish dashboard
# 2. Create your first package
# 3. Start accepting payments!
# ========================================
`;
    }
    /**
     * Generate RouterOS v6 configuration script (Legacy)
     */
    static generateV6Script(router, tenant, apiUser, apiPassword, billingHost) {
        const tenantName = tenant.name.replace(/[^a-zA-Z0-9]/g, '_');
        const tenantSubdomain = tenant.subdomain || tenantName.toLowerCase();
        return `# ========================================
# Jevish Auto-Configuration Script
# RouterOS v6 (Legacy)
# ========================================
# Tenant: ${tenant.name}
# Router: ${router.name}
# Generated: ${new Date().toISOString()}
# ========================================

# STEP 1: Create API User
/user group add name=jevish_api policy=api,read,write,test
/user add name=${apiUser} password=${apiPassword} group=jevish_api comment="Jevish API"

# STEP 2: Firewall Rules
/ip firewall filter add chain=input protocol=tcp dst-port=8728 src-address=${billingHost} action=accept comment="Jevish API" place-before=0

# STEP 3: Hotspot Profile
/ip hotspot profile add name=Jevish_${tenantSubdomain} login-by=http-chap,http-pap,mac use-radius=no dns-name=${tenantSubdomain}.jevish.site hotspot-address=10.5.50.1

# STEP 4: Walled Garden
/ip hotspot walled-garden add dst-host=*.intasend.com comment="Payment Gateway"
/ip hotspot walled-garden add dst-host=*.safaricom.co.ke comment="M-Pesa"
/ip hotspot walled-garden add dst-host=${billingHost} comment="Jevish"

# STEP 5: User Profile
/ip hotspot user profile set [ find default=yes ] shared-users=1

# STEP 6: Scheduler Scripts
/system script add name=Jevish_Sync_Script source=":log info \\"Jevish Sync\\""
/system scheduler add name=Jevish_Sync interval=5m on-event=Jevish_Sync_Script

# STEP 7: Set Identity
/system identity set name="Jevish_${tenantName}_${router.name}"

# Configuration Complete
`;
    }
    /**
     * Verify router configuration after script execution
     */
    static async verifyConfiguration(router, userId) {
        try {
            // Test connection with API credentials
            const testResult = await mikrotik_service_1.MikroTikService.testConnection(router);
            if (!testResult.status) {
                await router.update({
                    autoConfigStatus: 'FAILED',
                    autoConfigError: testResult.message
                });
                await models_1.RouterConnectionLog.create({
                    routerId: router.id,
                    tenantId: router.tenantId,
                    action: 'VERIFY',
                    status: 'FAILED',
                    errorMessage: testResult.message,
                    userId
                });
                return {
                    success: false,
                    message: 'Connection test failed: ' + testResult.message
                };
            }
            // Update router with system info
            await router.update({
                autoConfigStatus: 'CONFIGURED',
                isOnline: true,
                lastSeen: new Date(),
                identity: testResult.identity,
                version: testResult.version,
                autoConfigError: null
            });
            // Check capabilities
            const capabilities = await this.detectCapabilities(router);
            await router.update({
                capabilities: JSON.stringify(capabilities)
            });
            await models_1.RouterConnectionLog.create({
                routerId: router.id,
                tenantId: router.tenantId,
                action: 'VERIFY',
                status: 'SUCCESS',
                details: 'Router configured and verified successfully',
                metadata: JSON.stringify({
                    version: testResult.version,
                    identity: testResult.identity,
                    capabilities
                }),
                userId
            });
            return {
                success: true,
                message: 'Router configured successfully',
                details: {
                    version: testResult.version,
                    identity: testResult.identity,
                    capabilities
                }
            };
        }
        catch (error) {
            logger_1.default.error('Router verification failed', {
                routerId: router.id,
                error: error.message
            });
            await router.update({
                autoConfigStatus: 'FAILED',
                autoConfigError: error.message
            });
            await models_1.RouterConnectionLog.create({
                routerId: router.id,
                tenantId: router.tenantId,
                action: 'VERIFY',
                status: 'FAILED',
                errorMessage: error.message,
                userId
            });
            return {
                success: false,
                message: 'Verification failed: ' + error.message
            };
        }
    }
    /**
     * Detect router capabilities (hotspot, pppoe, etc.)
     */
    static async detectCapabilities(router) {
        try {
            const compatibility = await mikrotik_service_1.MikroTikService.validateCompatibility(router);
            return {
                hotspot: !compatibility.issues.includes('No Hotspot server configured'),
                pppoe: true, // Assume PPPoE is available
                radius: !compatibility.issues.includes('RADIUS client not configured'),
                queues: true // Assume queue support
            };
        }
        catch (error) {
            return {
                hotspot: false,
                pppoe: false,
                radius: false,
                queues: false
            };
        }
    }
    /**
     * Generate rollback script to remove Jevish configuration
     */
    static async generateRollbackScript(router) {
        const apiUser = router.apiUser || 'jevish_api';
        return `# ========================================
# Jevish Rollback Script
# ========================================
# This script removes Jevish configuration
# ========================================

# Remove API User
/user remove [find name="${apiUser}"]

# Remove Firewall Rules
/ip firewall filter remove [find comment="Jevish API Access"]

# Remove Walled Garden Entries
/ip hotspot walled-garden remove [find comment~"Jevish"]
/ip hotspot walled-garden remove [find comment~"IntaSend"]
/ip hotspot walled-garden remove [find comment~"M-Pesa"]

# Remove Scheduler Jobs
/system scheduler remove [find name~"Jevish"]

# Remove Scripts
/system script remove [find name~"Jevish"]

# Configuration Removed
:log info "Jevish configuration has been removed"
`;
    }
    /**
     * Test router connection before generating script
     */
    static async testInitialConnection(host, port, username, password) {
        try {
            // Create temporary router object for testing
            const tempRouter = {
                host,
                port,
                username,
                password
            };
            const result = await mikrotik_service_1.MikroTikService.testConnection(tempRouter);
            return {
                success: result.status,
                message: result.message,
                version: result.version,
                identity: result.identity
            };
        }
        catch (error) {
            return {
                success: false,
                message: error.message || 'Connection test failed'
            };
        }
    }
}
exports.MikroTikAutoConfigService = MikroTikAutoConfigService;
