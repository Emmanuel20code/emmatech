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
    return await ctx.db.query("packages").withIndex("by_tenant", (q) => q.eq("tenantId", user._id)).collect();
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    price: v.number(),
    type: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    dataLimitMb: v.optional(v.number()),
    downloadSpeed: v.optional(v.string()),
    uploadSpeed: v.optional(v.string()),
    validity: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Not authenticated" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    return await ctx.db.insert("packages", {
      tenantId: user._id,
      name: args.name,
      price: args.price,
      type: args.type ?? "HOTSPOT",
      durationMinutes: args.durationMinutes,
      dataLimitMb: args.dataLimitMb,
      downloadSpeed: args.downloadSpeed ?? "2M",
      uploadSpeed: args.uploadSpeed ?? "1M",
      validity: args.validity ?? 30,
      isEnabled: true,
      description: args.description,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("packages"),
    name: v.optional(v.string()),
    price: v.optional(v.number()),
    downloadSpeed: v.optional(v.string()),
    uploadSpeed: v.optional(v.string()),
    isEnabled: v.optional(v.boolean()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;
    await ctx.db.patch(id, rest);
  },
});

export const remove = mutation({
  args: { id: v.id("packages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
