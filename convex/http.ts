import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * M-Pesa Daraja STK Push Callback
 * Safaricom posts to: https://glorious-donkey-656.convex.site/mpesa/callback
 */
http.route({
  path: "/mpesa/callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json() as {
        Body?: {
          stkCallback?: {
            CheckoutRequestID?: string;
            ResultCode?: number | string;
            ResultDesc?: string;
            CallbackMetadata?: { Item?: Array<{ Name: string; Value: unknown }> };
          };
        };
      };
      const stkCallback = body?.Body?.stkCallback;
      if (!stkCallback?.CheckoutRequestID) {
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const resultCode = Number(stkCallback.ResultCode ?? -1);
      const resultDesc = stkCallback.ResultDesc ?? "";
      const payment = await ctx.runQuery(internal.mpesa.getPaymentByCheckout, { checkoutRequestId });
      if (!payment) {
        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (resultCode === 0) {
        const items = stkCallback.CallbackMetadata?.Item ?? [];
        const receipt = String(items.find((i) => i.Name === "MpesaReceiptNumber")?.Value ?? checkoutRequestId);
        await ctx.runMutation(internal.mpesa.updatePaymentStatus, { id: payment._id, status: "SUCCESS", mpesaReceiptCode: receipt });
      } else {
        let reason = resultDesc || `Payment failed (code ${resultCode})`;
        if (resultCode === 1032) reason = "Payment cancelled or timed out.";
        else if (resultCode === 1) reason = "Insufficient M-Pesa balance.";
        else if (resultCode === 2001) reason = "Incorrect M-Pesa PIN.";
        else if (resultCode === 1037) reason = "Could not reach phone.";
        else if (resultCode === 1025) reason = "Another transaction in progress.";
        else if (resultCode === 1019) reason = "Transaction expired.";
        await ctx.runMutation(internal.mpesa.updatePaymentStatus, { id: payment._id, status: "FAILED", failureReason: reason });
      }
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch {
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  }),
});

export default http;
