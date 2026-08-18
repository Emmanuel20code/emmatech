import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const listAccounts = query({
  args: {},
  handler: async (ctx): Promise<unknown[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) return [];
    return await ctx.db.query("pppoeAccounts").withIndex("by_tenant", (q) => q.eq("tenantId", user._id)).collect();
  },
});

export const listProfiles = query({
  args: {},
  handler: async (ctx): Promise<unknown[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) return [];
    return await ctx.db.query("pppoeProfiles").withIndex("by_tenant", (q) => q.eq("tenantId", user._id)).collect();
  },
});

export const addAccount = mutation({
  args: {
    username: v.string(),
    password: v.string(),
    profile: v.string(),
    service: v.optional(v.string()),
    routerId: v.optional(v.id("routers")),
    phone: v.optional(v.string()),
    name: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    const existing = await ctx.db.query("pppoeAccounts").withIndex("by_tenant_username", (q) => q.eq("tenantId", user._id).eq("username", args.username)).unique();
    if (existing) throw new ConvexError({ code: "CONFLICT", message: "Username already exists" });
    return await ctx.db.insert("pppoeAccounts", {
      tenantId: user._id,
      username: args.username,
      password: args.password,
      profile: args.profile,
      service: args.service ?? "pppoe",
      routerId: args.routerId,
      phone: args.phone,
      name: args.name,
      status: "ACTIVE",
      expiresAt: args.expiresAt,
      notes: args.notes,
    });
  },
});

export const updateAccount = mutation({
  args: {
    id: v.id("pppoeAccounts"),
    password: v.optional(v.string()),
    profile: v.optional(v.string()),
    status: v.optional(v.string()),
    phone: v.optional(v.string()),
    name: v.optional(v.string()),
    notes: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

export const removeAccount = mutation({
  args: { id: v.id("pppoeAccounts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const addProfile = mutation({
  args: {
    name: v.string(),
    downloadSpeed: v.string(),
    uploadSpeed: v.string(),
    sessionTimeout: v.optional(v.string()),
    idleTimeout: v.optional(v.string()),
    price: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    return await ctx.db.insert("pppoeProfiles", {
      tenantId: user._id,
      name: args.name,
      downloadSpeed: args.downloadSpeed,
      uploadSpeed: args.uploadSpeed,
      sessionTimeout: args.sessionTimeout,
      idleTimeout: args.idleTimeout,
      price: args.price,
      isDefault: false,
    });
  },
});
