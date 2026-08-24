import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadPricingSnapshot,
  lookupPrice,
  pricingRegistryPath,
  type PricingSnapshot,
} from "../src/pricing/registry.ts";

function loadOpenAi(): PricingSnapshot {
  const snap = loadPricingSnapshot("openai");
  assert.ok(snap, "openai snapshot exists");
  return snap!;
}

test("openai.json is a well-formed pricing snapshot", () => {
  const snap = loadOpenAi();
  assert.equal(snap.provider, "openai");
  assert.equal(snap.currency, "USD");
  assert.match(snap.snapshotDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Object.keys(snap.prices).length > 0, "at least one model priced");
  for (const [model, price] of Object.entries(snap.prices)) {
    assert.ok(model.length > 0);
    assert.ok(price.inputPerMillion > 0, `${model} input price > 0`);
    assert.ok(price.outputPerMillion > 0, `${model} output price > 0`);
    if (price.cachedInputPerMillion !== undefined) {
      assert.ok(
        price.cachedInputPerMillion < price.inputPerMillion,
        `${model} cached input cheaper than input`
      );
    }
  }
});

test("registry path points inside data/pricing", () => {
  const p = pricingRegistryPath("openai");
  assert.ok(p.endsWith("/data/pricing/openai.json"), p);
});

test("lookupPrice returns the entry for a published model", () => {
  const snap = loadOpenAi();
  assert.deepEqual(lookupPrice(snap, "gpt-4o-mini"), {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
    cachedInputPerMillion: 0.075,
  });
});

test("lookupPrice is undefined for an unpublished model (never guessed)", () => {
  const snap = loadOpenAi();
  assert.equal(lookupPrice(snap, "gpt-99-unknown"), undefined);
});

test("loadPricingSnapshot is undefined for an unknown provider", () => {
  assert.equal(loadPricingSnapshot("not-a-provider"), undefined);
});