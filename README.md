# EmmaTech — WiFi & ISP Management Platform

A multi-tenant SaaS platform for Kenyan hotspot operators and ISPs. Built on **React 19 + Vite + Convex + Tailwind CSS 4** via the [Hercules](https://hercules.app) app builder.

## Stack
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS 4, shadcn UI
- **Backend**: Convex (serverless functions + reactive DB)
- **Auth**: Hercules Auth (OIDC)
- **Payments**: Safaricom Daraja M-Pesa STK Push
- **Router integration**: MikroTik API (one-code onboarding script)

## Features
- **18-KPI BI Dashboard** — Revenue today/week/month/year, subscriber stats, router health, payment outcomes
- **One-Code MikroTik Onboarding** — enter only a router name; the script auto-detects IP, interface, creates API user, configures hotspot, walled garden, and registers with EmmaTech
- **Real M-Pesa STK Push** — full Daraja flow: access token → STK initiation → HTTP callback → reactive polling
- **Captive Portal** — live STK Push test, auto-login flow, package selection
- **PPPoE Manager** — accounts and bandwidth profiles CRUD
- **Multi-tenant billing** — subscription payments → EmmaTech super admin (Paybill 522522); WiFi customer payments → tenant's own till/paybill
- **Auth-gated app** — loading spinner → branded sign-in → full dashboard

## M-Pesa Secrets (add in Hercules Secrets tab)
```
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_SHORTCODE
MPESA_PASSKEY
MPESA_ENVIRONMENT     (sandbox | production)
MPESA_CALLBACK_BASE_URL  (https://glorious-donkey-656.convex.site)
MPESA_TILL            (optional, if using Till instead of Paybill)
```

## Callback URL
```
https://glorious-donkey-656.convex.site/mpesa/callback
```

## Routes
| Path | Page |
|------|------|
| `/` | Landing page |
| `/app/dashboard` | 18-KPI BI Dashboard |
| `/app/onboarding` | One-code MikroTik onboarding |
| `/app/routers` | Router management |
| `/app/packages` | Internet packages |
| `/app/subscribers` | Subscriber management |
| `/app/captive-portal` | Live M-Pesa STK Push test |
| `/app/pppoe` | PPPoE accounts + profiles |
| `/app/analytics` | Analytics |
| `/app/settings` | Subscription + WiFi Payments + Branding |
