# Payments and order verification

## Current model: manual ledger

BloodOra supports medical-supply orders with payment submissions that authorized admins review and confirm. It is **not** a hosted payment-gateway integration. There is no signed success callback, automatic settlement verification, or browser-return flow that can safely mark a transaction paid.

A transaction ID, screenshot, reference number, amount, success query parameter, or browser claim is evidence supplied by a user—not independent proof of settlement.

## Trust boundaries

- Product prices and payable totals are calculated on the server.
- Client-provided prices cannot override server pricing.
- Users can access only their own orders/payment submissions.
- Admin confirmation and status changes require server-side authorization and POST + CSRF for browser sessions.
- Legacy admin mutation GETs do not change payment state.
- Payment confirmation must remain an explicit auditable admin action.

## Admin listing and reconciliation

The admin transaction query is bounded with `limit`/`offset`, supports optional status filtering, joins usernames in SQL, and returns the actual total. It avoids N+1 user lookups. Pagination does not replace reconciliation: staff must compare the submitted reference and amount with the real mobile-banking/bank/cash record before confirming.

Recommended operating procedure:

1. Open the order and transaction detail together.
2. Confirm the server-calculated order total and currency.
3. Independently verify the sender, receiver, reference, amount, and settlement time in the payment provider's official record.
4. Reject duplicates, mismatches, and unverifiable submissions.
5. Confirm only after independent verification; record an audit note where available.
6. Reconcile pending, confirmed, rejected, cancelled, and refunded states regularly.

## Refunds, duplicates, and disputes

The current ledger does not prove that an external refund occurred. Process refunds in the external payment system first, then update internal records according to the available admin workflow. Do not interpret an internal status as evidence that money moved.

Unique/dedupe constraints and admin review reduce accidental duplication but cannot replace provider-side settlement IDs. If automatic gateway processing is added later, it must use server-to-server signature verification, amount/currency checks, idempotency, replay protection, and reconciliation before any existing manual-confirmation assumption is removed.

## Testing limits

Production-path tests verify server pricing, persistence, RBAC, and manual admin confirmation using local/test infrastructure. They do not contact bKash, Nagad, banks, card processors, or hosted checkout providers. No external settlement is claimed by the test suite.
