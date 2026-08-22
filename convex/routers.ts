import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx): Promise<unknown[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) return [];
    return await ctx.db.query("routers").withIndex("by_tenant", (q) => q.eq("tenantId", user._id)).collect();
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    host: v.string(),
    port: v.optional(v.number()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    return await ctx.db.insert("routers", {
      tenantId: user._id,
      name: args.name,
      host: args.host,
      port: args.port ?? 8728,
      username: args.username ?? "admin",
      password: args.password ?? "",
      location: args.location,
      isOnline: false,
      validationStatus: "PENDING",
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("routers"),
    name: v.optional(v.string()),
    host: v.optional(v.string()),
    port: v.optional(v.number()),
    username: v.optional(v.string()),
    password: v.optional(v.string()),
    location: v.optional(v.string()),
    isOnline: v.optional(v.boolean()),
    validationStatus: v.optional(v.string()),
    identity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

export const remove = mutation({
  args: { id: v.id("routers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
