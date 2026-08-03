import test from "node:test";
import assert from "node:assert/strict";
import * as backendHelpers from "./groupStayPeriods.js";
import * as frontendHelpers from "../../src/lib/groupStayPeriods.js";

const continuous = [{ start_date: "2026-08-01", end_date: "2026-08-07" }];
const multi = [
  { start_date: "2026-08-20", end_date: "2026-08-31" },
  { start_date: "2026-08-01", end_date: "2026-08-07" },
  { start_date: "2026-08-09", end_date: "2026-08-18" },
];

function runSuite(name, helpers) {
  test(`${name}: continuous presence and sleeping nights`, () => {
    assert.equal(helpers.isDateInsideStayPeriods("2026-08-01", continuous), true);
    assert.equal(helpers.isDateInsideStayPeriods("2026-08-07", continuous), true);
    assert.equal(helpers.isDateInsideStayPeriods("2026-08-08", continuous), false);
    assert.equal(helpers.occupiesSleepingNight("2026-08-06", continuous), true);
    assert.equal(helpers.occupiesSleepingNight("2026-08-07", continuous), false);
  });

  test(`${name}: multi-period gaps, envelope, boundaries and dates`, () => {
    assert.deepEqual(helpers.deriveStayEnvelope(multi), { start_date: "2026-08-01", end_date: "2026-08-31" });
    assert.equal(helpers.isDateInsideStayPeriods("2026-08-08", multi), false);
    assert.equal(helpers.isDateInsideStayPeriods("2026-08-19", multi), false);
    assert.deepEqual(helpers.normalizeStayPeriods(multi).map(period => period.start_date), ["2026-08-01", "2026-08-09", "2026-08-20"]);
    assert.deepEqual(["2026-08-01", "2026-08-09", "2026-08-20"].filter(date => helpers.isArrivalDate(date, multi)), ["2026-08-01", "2026-08-09", "2026-08-20"]);
    assert.deepEqual(["2026-08-07", "2026-08-18", "2026-08-31"].filter(date => helpers.isDepartureDate(date, multi)), ["2026-08-07", "2026-08-18", "2026-08-31"]);
    const dates = helpers.getOperationalStayDates(multi);
    assert.equal(dates.includes("2026-08-08"), false);
    assert.equal(dates.includes("2026-08-19"), false);
    assert.equal(dates.length, 28);
  });

  test(`${name}: invalid periods are rejected`, () => {
    assert.equal(helpers.validateStayPeriods([{ start_date: "2026-08-01", end_date: "2026-08-07" }, { start_date: "2026-08-07", end_date: "2026-08-09" }]).valid, false);
    assert.equal(helpers.validateStayPeriods([{ start_date: "2026-08-01", end_date: "2026-08-07" }, { start_date: "2026-08-01", end_date: "2026-08-07" }]).valid, false);
    assert.equal(helpers.validateStayPeriods([{ start_date: "2026-08-07", end_date: "2026-08-01" }]).valid, false);
  });
}

runSuite("backend", backendHelpers);
runSuite("frontend", frontendHelpers);

test("frontend and backend expose the same helper API", () => {
  assert.deepEqual(Object.keys(frontendHelpers).sort(), Object.keys(backendHelpers).sort());
});