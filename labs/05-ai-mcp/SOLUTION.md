# Lab 5 — Solution (spoilers: agents are denied reading this file)

`git diff lab-5-start lab-5-solution` shows the D9 fix. incident-5 isn't in any tag: it
only exists after `make incident-5`.

## D9 — personal data in telemetry (Collector)

fake-psp is third-party code: its instrumentation puts `customer.email` and
`card.last4` on every charge span. You can't change it, but every span passes through
your Collector before it is stored:

```yaml
processors:
  redaction/pii:
    allow_all_keys: true
    blocked_values:                       # any attribute value that looks like an email
      - "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
    blocked_key_patterns:                 # card data, whatever its value
      - "card\\..*"
    summary: info                         # adds redaction.* attributes saying what was masked

service:
  pipelines:
    traces:
      processors: [redaction/pii, batch]
```

Values are masked (`****`) rather than dropped, so you still see *that* the PSP sent
an email, not which one. Alternatives: the `attributes` processor (`delete` / `hash`),
or `transform` with OTTL for finer rules. In production, run this in a gateway
Collector that every service and third party goes through.

## incident-5 — gold members can't check out

The "refactor" moved the loyalty discounts into a rate table and forgot `gold`:

```ts
const LOYALTY_RATES: Record<string, { rate: number }> = {
  standard: { rate: 0 },
  silver: { rate: 0.05 },
  gold: { rate: 0.1 },        // ← the missing entry
};
```

The evidence an agent (or a human) follows: the error reference is a correlation id →
Loki: gateway's `checkout failed: upstream error` with its `trace_id` → Tempo: the
orders span `CheckoutService.placeOrder` in ERROR, exception `TypeError: Cannot read
properties of undefined (reading 'rate')` at `LoyaltyTier.discountPercent`,
`customer.tier = gold`, `code.file.path` → the file.

The typed `Record<string, …>` let it compile; `Record<Tier, …>` would have made the
compiler reject the missing key — a better fix than just adding the line. The orders
unit test for gold discounts also fails on the regression: it shipped anyway.
