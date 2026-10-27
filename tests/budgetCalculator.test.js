const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateRemainingBalance } = require("../js/budgetCalculator.js");

test("Calculates remaining balance correctly", function() {
    assert.equal(calculateRemainingBalance(1000, 250), 750);
});

test("Handles zero expenses", function() {
    assert.equal(calculateRemainingBalance(500, 0), 500);
});
