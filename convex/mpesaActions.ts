"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel.d.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getEnv = (key: string): string => ((globalThis as any).process?.env?.[key] ?? "") as string;

function getBaseUrl(env: string): string {
  return env === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";
}

function getTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}${mo}${d}${h}${mi}${s}`;
}

function normalizePhone(phone: string): { formatted: string; error?: string } {
  const clean = phone.replace(/\D/g, "");
  if ((clean.startsWith("2547") || clean.startsWith("2541")) && clean.length === 12) return { formatted: clean };
  if ((clean.startsWith("07") || clean.startsWith("01")) && clean.length === 10) return { formatted: "254" + clean.slice(1) };
  if ((clean.startsWith("7") || clean.startsWith("1")) && clean.length === 9) return { formatted: "254" + clean };
  return { formatted: clean, error: "Invalid Kenyan phone number. Use 07xxxxxxxx." };
}

async function getDarajaToken(consumerKey: string, consumerSecret: string, env: string): Promise<string> {
  const creds = btoa(`${consumerKey}:${consumerSecret}`);
  const res = await fetch(`${getBaseUrl(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) throw new ConvexError({ message: `M-Pesa auth failed: ${await res.text()}`, code: "EXTERNAL_SERVICE_ERROR" });
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new ConvexError({ message: `No access_token: ${data.error ?? "unknown"}`, code: "EXTERNAL_SERVICE_ERROR" });
  return data.access_token;
}

function getFailureReason(code: number, desc: string): string {
  const map: Record<number, string> = {
    1032: "Payment cancelled or timed out on your phone.",
    1: "Insufficient M-Pesa balance.",
    2001: "Incorrect M-Pesa PIN entered.",
    1037: "Could not reach your phone. Ensure your SIM is active.",
    1025: "Another transaction is in progress on your phone.",
    1019: "Transaction expired. Please try again.",
  };
  return map[code] ?? desc ?? `Transaction failed (code ${code}).`;
}

export const initiateStkPush = action({
  args: {
    phone: v.string(),
    packageId: v.id("packages"),
    routerId: v.optional(v.id("routers")),
    macAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ paymentId: Id<"payments">; checkoutRequestId: string; message: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ message: "Not authenticated", code: "UNAUTHENTICATED" });
    const user = await ctx.runQuery(internal.mpesa.getUserByToken, { tokenIdentifier: identity.tokenIdentifier });
    if (!user) throw new ConvexError({ message: "User not found", code: "NOT_FOUND" });
    const pkg = await ctx.runQuery(internal.mpesa.getPackageById, { id: args.packageId });
    if (!pkg) throw new ConvexError({ message: "Package not found", code: "NOT_FOUND" });
    const phoneResult = normalizePhone(args.phone);
    if (phoneResult.error) throw new ConvexError({ message: phoneResult.error, code: "BAD_REQUEST" });
    const consumerKey = getEnv("MPESA_CONSUMER_KEY");
    const consumerSecret = getEnv("MPESA_CONSUMER_SECRET");
    const shortcode = getEnv("MPESA_SHORTCODE");
    const passkey = getEnv("MPESA_PASSKEY");
    const env = (getEnv("MPESA_ENVIRONMENT") || "sandbox").toLowerCase().trim();
    const callbackBase = (getEnv("MPESA_CALLBACK_BASE_URL") || "https://glorious-donkey-656.convex.site").replace(/\/$/, "");
    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
      throw new ConvexError({ message: "M-Pesa credentials not configured. Add MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_ENVIRONMENT, MPESA_CALLBACK_BASE_URL in Hercules Secrets.", code: "BAD_REQUEST" });
    }
    const timestamp = getTimestamp();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const tillNumber = getEnv("MPESA_TILL");
    const transactionType = tillNumber ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline";
    const partyB = tillNumber || shortcode;
    const amountKes = Math.max(1, Math.round(pkg.price / 100));
    const callbackUrl = `${callbackBase}/mpesa/callback`;
    const accountRef = `ET-${pkg._id.toString().slice(-8).toUpperCase()}`.slice(0, 12);
    const accessToken = await getDarajaToken(consumerKey, consumerSecret, env);
    const stkRes = await fetch(`${getBaseUrl(env)}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: shortcode, Password: password, Timestamp: timestamp,
        TransactionType: transactionType, Amount: amountKes, PartyA: phoneResult.formatted,
        PartyB: partyB, PhoneNumber: phoneResult.formatted, CallBackURL: callbackUrl,
        AccountReference: accountRef, TransactionDesc: `${pkg.name}`.slice(0, 13),
      }),
    });
    if (!stkRes.ok) throw new ConvexError({ message: `STK Push failed: ${await stkRes.text()}`, code: "EXTERNAL_SERVICE_ERROR" });
    const stkData = await stkRes.json() as { CheckoutRequestID?: string; ResponseCode?: string; CustomerMessage?: string; ResponseDescription?: string; errorMessage?: string };
    if (stkData.ResponseCode !== "0") throw new ConvexError({ message: stkData.errorMessage ?? stkData.ResponseDescription ?? "STK Push initiation failed", code: "EXTERNAL_SERVICE_ERROR" });
    const checkoutRequestId = stkData.CheckoutRequestID ?? `STK-${Date.now()}`;
    const paymentId = await ctx.runMutation(internal.mpesa.createPendingPayment, {
      tenantId: user.tokenIdentifier, phone: phoneResult.formatted, amount: pkg.price,
      packageId: pkg._id, routerId: args.routerId, macAddress: args.macAddress,
      ipAddress: args.ipAddress, checkoutRequestId, paymentMethod: "MPESA_STK",
    });
    return { paymentId, checkoutRequestId, message: stkData.CustomerMessage ?? `STK Push sent to ${args.phone}. Enter your M-Pesa PIN to complete payment.` };
  },
});

export const queryStkStatus = action({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args): Promise<{ status: string; receipt?: string; failureReason?: string }> => {
    const payment = await ctx.runQuery(internal.mpesa.getPaymentById, { id: args.paymentId });
    if (!payment) throw new ConvexError({ message: "Payment not found", code: "NOT_FOUND" });
    if (payment.status === "SUCCESS") return { status: "SUCCESS", receipt: payment.mpesaReceiptCode };
    if (payment.status === "FAILED") return { status: "FAILED", failureReason: payment.failureReason };
    const consumerKey = getEnv("MPESA_CONSUMER_KEY");
    const consumerSecret = getEnv("MPESA_CONSUMER_SECRET");
    const shortcode = getEnv("MPESA_SHORTCODE");
    const passkey = getEnv("MPESA_PASSKEY");
    const env = (getEnv("MPESA_ENVIRONMENT") || "sandbox").toLowerCase().trim();
    if (!consumerKey || !shortcode || !payment.checkoutRequestId) return { status: payment.status };
    try {
      const accessToken = await getDarajaToken(consumerKey, consumerSecret, env);
      const timestamp = getTimestamp();
      const password = btoa(`${shortcode}${passkey}${timestamp}`);
      const res = await fetch(`${getBaseUrl(env)}/mpesa/stkpushquery/v1/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, CheckoutRequestID: payment.checkoutRequestId }),
      });
      if (!res.ok) return { status: payment.status };
      const data = await res.json() as { ResultCode?: string | number; ResultDesc?: string; CallbackMetadata?: { Item?: Array<{ Name: string; Value: unknown }> } };
      const resultCode = String(data.ResultCode ?? "");
      if (resultCode === "0") {
        const items = data.CallbackMetadata?.Item ?? [];
        const receipt = String(items.find((i) => i.Name === "MpesaReceiptNumber")?.Value ?? "") || `QRY-${payment._id.toString().slice(-8).toUpperCase()}`;
        await ctx.runMutation(internal.mpesa.updatePaymentStatus, { id: args.paymentId, status: "SUCCESS", mpesaReceiptCode: receipt });
        return { status: "SUCCESS", receipt };
      } else if (["1032", "2001", "1", "1037", "1019", "1025"].includes(resultCode)) {
        const reason = getFailureReason(Number(resultCode), data.ResultDesc ?? "");
        await ctx.runMutation(internal.mpesa.updatePaymentStatus, { id: args.paymentId, status: "FAILED", failureReason: reason });
        return { status: "FAILED", failureReason: reason };
      }
      return { status: payment.status };
    } catch {
      return { status: payment.status };
    }
  },
});
