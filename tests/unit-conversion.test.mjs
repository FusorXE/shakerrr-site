import { test } from "node:test";
import assert from "node:assert/strict";
import { amount } from "../src/core.js";

test("convert published volume amounts in both directions", () => {
  assert.equal(amount("1 oz", "ml"), "29.6 ml");
  assert.equal(amount("1½ oz", "ml"), "44.4 ml");
  assert.equal(amount("¾ oz", "ml"), "22.2 ml");
  assert.equal(amount("2 fluid ounces", "ml"), "59.1 ml");
  assert.equal(amount("1 ½ ounces", "ml"), "44.4 ml");
  assert.equal(amount("2 fl oz", "ml"), "59.1 ml");
  assert.equal(amount("1–2 oz", "ml"), "29.6–59.1 ml");
  assert.equal(amount("scant ¾ oz", "ml"), "scant 22.2 ml");
  assert.equal(amount("44.4 ml", "oz"), "1.5 oz");
});
test("do not change non-volume quantities or already-selected units", () => {
  for (const q of ["2 DASHES", "to taste", "1 tsp", "3 dashes", "1 egg white", "½ cup"]) {
    assert.equal(amount(q, "ml"), q);
  }
  assert.equal(amount("1 oz", "oz"), "1 oz");
  assert.equal(amount("30 ml", "ml"), "30 ml");
});
