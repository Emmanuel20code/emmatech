import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel.d.ts";

export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"subscribers">[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) return [];
    return await ctx.db.query("subscribers").withIndex("by_tenant", (q) => q.eq("tenantId", user._id)).collect();
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    packageId: v.optional(v.id("packages")),
    routerId: v.optional(v.id("routers")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    return await ctx.db.insert("subscribers", {
      tenantId: user._id,
      name: args.name,
      phone: args.phone,
      email: args.email,
      macAddress: args.macAddress,
      packageId: args.packageId,
      routerId: args.routerId,
      status: "ACTIVE",
      notes: args.notes,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("subscribers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    status: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

export const remove = mutation({
  args: { id: v.id("subscribers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
