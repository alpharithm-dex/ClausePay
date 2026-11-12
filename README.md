# ClausePay

ClausePay turns contractor agreement clauses into a reviewable payment plan. The sample includes a USD 1,000 contractor milestone, a separate USD 100 employer-funded benefit, and an amendment that changes only the benefit deadline.

## Run

Requires Node.js 22 and npm. From this directory:

```text
npm ci --ignore-scripts
npm start
```

Open the printed local URL. Set PORT in .env if the default port is occupied. The Bryntum Scheduler trial dependency is pinned in the lockfile and installed separately from ClausePay's MIT-licensed code.

### Judge walkthrough

1. Select **Analyze agreement**. The inference cards show the predicted obligation type, influential terms, the score margin between the two most likely classes, and the exact source quote. The benefit shows its original and amended deadlines.
2. In **Settlement calendar**, select the benefit event to inspect its evidence. Approve the plan, select **Next due date**, and release the worker payout. The benefit remains scheduled.
3. Advance to the amended benefit date and release it. The **Clearing ledger** shows processing and each result independently. In the default simulation the benefit fails once. **Retry benefit only** produces a new benefit reference and preserves the worker's cleared reference.
4. To show actual PayPal Sandbox clearing, select Sandbox before approving a fresh plan. Use a unique agreement reference for a new sandbox run. Point out PayPal's batch and item IDs in the ledger.

```text
npm test
npm run build
```

## Enable PayPal Sandbox

Copy .env.example to .env and set the four PAYPAL_ entries using a PayPal Sandbox REST app with Payouts enabled, a funded sandbox business sender, and two distinct sandbox recipient accounts. Restart the server and choose **PayPal Sandbox** before approving the plan. ClausePay checks pending item statuses automatically, and **Refresh clearing status** is available while a payout is pending. Each obligation has its own PayPal batch and item ID. The sandbox run date selects which obligations can be released. Clicking release sends those eligible test payouts immediately.

Use synthetic contracts and dedicated sandbox recipients. Payouts always go to the configured recipients for their role, which are shown in the timeline. The server is bound to loopback for local use. The hosted deployment is intended for owner-private access.

The simulation is a separate mode. Server tests use stubbed PayPal responses. Repeated submits for the same agreement reference, obligation type, and attempt reuse the same PayPal sender batch ID. PayPal's deduplication window is 30 days. This prototype keeps the review and payment status in the open browser tab. Reconcile past payouts in PayPal before reusing an agreement reference.

## Extraction

The default classifier is trained at startup on a small labeled set of worker pay, employer-funded benefit, and unrelated clauses. Classification decides the obligation type. Deterministic extraction checks explicit USD amounts, ISO-format dates, named recipients and amendment references. For the built-in classifier, put each payment clause on its own line, use “will pay” or “shall pay,” and use “in addition to” for employer-funded benefits. Use a unique reference such as CP-2026-015.

An optional CLAUSEPAY_OPENAI_API_KEY enables structured extraction for more varied wording. Text is sent to the configured OpenAI model when enabled. The server checks that the amount, named payee and date are supported by exact quotes. Always review clauses and recipient mappings before approving. This prototype supports fixed USD obligations and employer-funded benefits for contractors. It has no statutory tax, withholding, recurring execution, or background scheduler.

## Hosting

The build creates a Cloudflare Worker ES module and a Sites manifest in dist. The local app serves the Bryntum package from node_modules. The source ZIP excludes vendor binaries, credentials and generated builds. The Bryntum trial is for evaluation and time-limited. Use a trial or appropriate license covering your evaluation period and verify the license terms before hosting a build containing Bryntum assets. Preserve owner-only access anywhere PayPal credentials are configured.
