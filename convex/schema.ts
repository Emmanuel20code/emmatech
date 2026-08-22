import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  }).index("by_token", ["tokenIdentifier"]),

  routers: defineTable({
    tenantId: v.string(),
    name: v.string(),
    host: v.string(),
    port: v.number(),
    username: v.string(),
    password: v.string(),
    location: v.optional(v.string()),
    isOnline: v.boolean(),
    identity: v.optional(v.string()),
    validationStatus: v.string(), // PENDING | VALIDATED | FAILED
    lastSeen: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_host", ["tenantId", "host"]),

  packages: defineTable({
    tenantId: v.string(),
    name: v.string(),
    price: v.number(), // KES cents
    type: v.string(), // HOTSPOT | PPPOE
    durationMinutes: v.optional(v.number()),
    dataLimitMb: v.optional(v.number()),
    downloadSpeed: v.string(),
    uploadSpeed: v.string(),
    validity: v.number(), // days
    isEnabled: v.boolean(),
    description: v.optional(v.string()),
  }).index("by_tenant", ["tenantId"]),

  subscribers: defineTable({
    tenantId: v.string(),
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    packageId: v.optional(v.id("packages")),
    routerId: v.optional(v.id("routers")),
    status: v.string(), // ACTIVE | INACTIVE | SUSPENDED | EXPIRED
    expiresAt: v.optional(v.number()),
    lastPaymentAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"]),

  payments: defineTable({
    tenantId: v.string(),
    subscriberId: v.optional(v.id("subscribers")),
    phone: v.string(),
    amount: v.number(),
    packageId: v.optional(v.id("packages")),
    routerId: v.optional(v.id("routers")),
    macAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    status: v.string(), // PENDING | SUCCESS | FAILED
    checkoutRequestId: v.optional(v.string()),
    mpesaReceiptCode: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    paymentMethod: v.string(), // MPESA_STK | VOUCHER
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_status", ["tenantId", "status"])
    .index("by_checkout", ["checkoutRequestId"]),

  pppoeAccounts: defineTable({
    tenantId: v.string(),
    username: v.string(),
    password: v.string(),
    service: v.string(),
    profile: v.string(),
    routerId: v.optional(v.id("routers")),
    status: v.string(), // ACTIVE | DISABLED | SUSPENDED
    phone: v.optional(v.string()),
    name: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    lastConnected: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_username", ["tenantId", "username"]),

  pppoeProfiles: defineTable({
    tenantId: v.string(),
    name: v.string(),
    downloadSpeed: v.string(),
    uploadSpeed: v.string(),
    sessionTimeout: v.optional(v.string()),
    idleTimeout: v.optional(v.string()),
    price: v.optional(v.number()),
    isDefault: v.boolean(),
  }).index("by_tenant", ["tenantId"]),
});
