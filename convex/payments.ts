import { query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

// List all payments for the current tenant
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];
    return await ctx.db.query("payments").order("desc").take(100);
  },
});

// Public query for frontend polling
export const getPaymentStatus = query({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    return await ctx.db.get(args.id);
  },
});
