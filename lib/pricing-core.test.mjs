import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PRICES,
  assertCompatiblePriceVersion,
  assertPresentedPriceVersion,
  defaultPrice,
  formatPriceLabel,
  nextPrice,
  recordedAmount,
  resolvePrice,
} from "./pricing-core.mjs";

test("every paid variant has an integer EUR default at version one", () => {
  assert.equal(Object.keys(DEFAULT_PRICES).length, 8);
  for (const key of Object.keys(DEFAULT_PRICES)) {
    const price = defaultPrice(key);
    assert.equal(price.currency, "eur");
    assert.equal(price.version, 1);
    assert.ok(Number.isSafeInteger(price.priceCents) && price.priceCents > 0);
  }
});

test("a stale presented version cannot silently create a higher-priced order", () => {
  const original = defaultPrice("booking:anglais:solo");
  const changed = nextPrice(original, 1, 6100);
  assert.throws(() => assertPresentedPriceVersion(changed, 1), /PRICE_CHANGED/);
  assert.equal(assertPresentedPriceVersion(changed, 2).priceCents, 6100);
});

test("an old open tab may use only an unchanged default price during rollout", () => {
  const initial = defaultPrice("booking:anglais:solo");
  const edited = nextPrice(initial, 1, 6100);
  assert.equal(assertCompatiblePriceVersion(initial, undefined).priceCents, 5500);
  assert.throws(() => assertCompatiblePriceVersion(edited, undefined), /PRICE_CHANGED/);
  assert.equal(assertCompatiblePriceVersion(edited, 2).priceCents, 6100);
});

test("simultaneous admin edits require the current version", () => {
  const changed = nextPrice(defaultPrice("request:review"), 1, 3100);
  assert.throws(() => nextPrice(changed, 1, 3200), /PRICE_VERSION_CONFLICT/);
  assert.throws(() => nextPrice(changed, 2, 31.5), /INVALID_PRICE/);
  assert.equal(nextPrice(changed, 2, 3200).version, 3);
});

test("a frozen checkout amount and description outlive a catalog edit", () => {
  const key = "booking:anglais:solo-4h";
  const held = defaultPrice(key);
  const edited = nextPrice(held, 1, 23500);
  const persisted = resolvePrice(key, { ...edited, variantKey: key });
  assert.equal(persisted.priceCents, 23500);
  assert.equal(recordedAmount(held.priceCents, edited.priceCents), 20000);
  assert.equal(formatPriceLabel(recordedAmount(held.priceCents, edited.priceCents), key), "200 € le pack");
  // An old booking without a stored price retains its original source default.
  assert.equal(recordedAmount(undefined, defaultPrice(key).priceCents), 20000);
});
