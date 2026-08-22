// Internal mutations and queries for M-Pesa — runs in Convex V8 runtime
import { internalMutation, internalQuery, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

export const getUserByToken = internalQuery({
  args: { tokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier)).unique();
  },
});

export const getPackageById = internalQuery({
  args: { id: v.id("packages") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const getPaymentById = internalQuery({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => ctx.db.get(args.id),
});

export const getPaymentByCheckout = internalQuery({
  args: { checkoutRequestId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("payments").withIndex("by_checkout", (q) => q.eq("checkoutRequestId", args.checkoutRequestId)).first();
  },
});

export const createPendingPayment = internalMutation({
  args: {
    tenantId: v.string(),
    phone: v.string(),
    amount: v.number(),
    packageId: v.id("packages"),
    routerId: v.optional(v.id("routers")),
    macAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    checkoutRequestId: v.string(),
    paymentMethod: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"payments">> => {
    return await ctx.db.insert("payments", {
      tenantId: args.tenantId,
      phone: args.phone,
      amount: args.amount,
      packageId: args.packageId,
      routerId: args.routerId,
      macAddress: args.macAddress,
      ipAddress: args.ipAddress,
      checkoutRequestId: args.checkoutRequestId,
      status: "PENDING",
      paymentMethod: args.paymentMethod,
    });
  },
});

export const updatePaymentStatus = internalMutation({
  args: {
    id: v.id("payments"),
    status: v.string(),
    mpesaReceiptCode: v.optional(v.string()),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      ...(args.mpesaReceiptCode ? { mpesaReceiptCode: args.mpesaReceiptCode } : {}),
      ...(args.failureReason ? { failureReason: args.failureReason } : {}),
    });
  },
});

export const getPaymentStatus = query({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    return await ctx.db.get(args.id);
  },
});
