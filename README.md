# ClausePay

ClausePay turns contractor agreement clauses into a reviewable payment plan. The sample includes a USD 1,000 contractor milestone, a separate USD 100 employer-funded benefit, and an amendment that changes only the benefit deadline.

## Run

Requires Node.js 22. From this directory:

```text
npm start
```

Open the printed local URL. Set PORT in .env if the default port is occupied. Use **Analyze agreement**, inspect the two source clauses, check the approval box, and click **Run payout simulation**. The benefit fails once. **Retry benefit only** leaves the worker payout reference unchanged.

```text
npm test
npm run build
```

## Enable PayPal Sandbox

Copy .env.example to .env and set the four PAYPAL_ entries using a PayPal Sandbox REST app with Payouts enabled, a funded sandbox business sender, and two distinct sandbox recipient accounts. Restart the server, choose **PayPal Sandbox** before approving the plan, and use **Refresh status** after sending. Each obligation has its own PayPal batch and item ID. Sandbox sends are immediate when approved. The dates are contract deadlines in the review timeline.

Use synthetic contracts and dedicated sandbox recipients. Payouts always go to the configured recipients for their role, which are shown in the timeline. The server is bound to loopback for local use. The hosted deployment is intended for owner-private access.

The simulation is a separate mode. Server tests use stubbed PayPal responses. Repeated submits for the same agreement reference, obligation type, and attempt reuse the same PayPal sender batch ID. PayPal's deduplication window is 30 days. This prototype keeps the review and payment status in the open browser tab. Reconcile past payouts in PayPal before reusing an agreement reference.

## Extraction

The default classifier is trained at startup on a small labeled set of worker pay, employer-funded benefit, and unrelated clauses. Classification decides the obligation type. Deterministic extraction checks explicit USD amounts, ISO-format dates, named recipients and amendment references. For the built-in classifier, put each payment clause on its own line, use “will pay” or “shall pay,” and use “in addition to” for employer-funded benefits. Use a unique reference such as CP-2026-015.

An optional CLAUSEPAY_OPENAI_API_KEY enables structured extraction for more varied wording. Text is sent to the configured OpenAI model when enabled. The server checks that the amount, named payee and date are supported by exact quotes. Always review clauses and recipient mappings before approving. This prototype supports fixed USD obligations and employer-funded benefits for contractors. It has no statutory tax, withholding, recurring execution, or background scheduler.

## Hosting

The dependency-free build creates a Cloudflare Worker ES module and a Sites manifest in dist. To deploy elsewhere, serve the web directory and route /api/ requests to handleApi, with equivalent owner-only access if PayPal is configured.
