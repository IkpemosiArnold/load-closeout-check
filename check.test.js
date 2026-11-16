import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLoad, checkAll, detentionSupported, readPacket, apCsv, pastedLines } from "./check.js";
import { loads, lateReceipt40119 } from "./samples.js";

const clone = (x) => JSON.parse(JSON.stringify(x));
const byId = (id) => clone(loads.find((l) => l.id === id));
const holdIds = (r) => r.holds.map((h) => `${h.id}:${h.state}`);

test("sample: 3 of 8 ready, 5 held, one reason each", () => {
  const s = checkAll(loads);
  assert.equal(s.results.length, 8);
  assert.deepEqual(s.ready.map((r) => r.id), ["40117", "40123", "40124"]);
  assert.equal(s.readyTotal, 5487.5);
  assert.equal(s.heldTotal, 9905);
  for (const r of s.held) assert.equal(r.holds.length, 1, `${r.id} has one hold`);
});

test("detention: the POD supports 1.5 hrs, the invoice bills 3.0", () => {
  const r = checkLoad(byId("40118"));
  assert.deepEqual(holdIds(r), ["lines:fail"]);
  const d = r.lines.find((l) => l.label === "Detention");
  assert.equal(d.agreed, 75);
  assert.equal(d.diff, 75);
});

test("detention clock starts at the later of appointment and arrival", () => {
  const p = readPacket(byId("40123").docs);
  const d = detentionSupported(p);
  assert.equal(d.onSiteMin, 195);
  assert.equal(d.billableMin, 75);
  assert.equal(d.amount, 62.5);
  const late = byId("40123");
  late.docs.pod[4] = "Arrived: 13:40"; // late truck: clock starts on arrival
  const d2 = detentionSupported(readPacket(late.docs));
  assert.equal(d2.onSiteMin, 155);
  assert.equal(d2.billableMin, 30);
});

test("detention rounds down to the quarter hour", () => {
  const l = byId("40123");
  l.docs.pod[5] = "In: 13:00 Out: 16:14";
  assert.equal(detentionSupported(readPacket(l.docs)).billableMin, 60);
});

test("no times on the POD: detention is not found, never guessed", () => {
  const l = byId("40118");
  l.docs.pod = l.docs.pod.filter((s) => !s.startsWith("In:"));
  const r = checkLoad(l);
  const d = r.lines.find((x) => x.label === "Detention");
  assert.equal(d.state, "none");
  assert.match(d.why, /^Not found/);
});

test("lumper without a receipt is not found; adding the receipt clears it", () => {
  const l = byId("40119");
  assert.deepEqual(holdIds(checkLoad(l)), ["lines:none"]);
  l.docs.receipt = lateReceipt40119;
  assert.equal(checkLoad(l).ready, true);
});

test("lumper billed above its receipt is held", () => {
  const l = byId("40124");
  l.docs.receipt[3] = "Amount paid: $150.00";
  const r = checkLoad(l);
  assert.deepEqual(holdIds(r), ["lines:fail"]);
  assert.equal(r.lines.find((x) => x.label === "Lumper").diff, 15);
});

test("unsigned, undated POD is held as not found", () => {
  const r = checkLoad(byId("40120"));
  assert.deepEqual(holdIds(r), ["pod:none"]);
});

test("POD exceptions hold the load", () => {
  const l = byId("40117");
  l.docs.pod[8] = "Exceptions: 2 pallets short";
  const r = checkLoad(l);
  assert.deepEqual(holdIds(r), ["pod:fail"]);
  assert.match(r.holds[0].text, /2 pallets short/);
});

test("linehaul above the rate con is held with the difference", () => {
  const r = checkLoad(byId("40121"));
  const lh = r.lines.find((x) => x.label === "Linehaul");
  assert.equal(lh.state, "fail");
  assert.equal(lh.diff, 150);
});

test("invoice from a different MC is held, with the bank details change", () => {
  const r = checkLoad(byId("40122"));
  assert.deepEqual(holdIds(r), ["carrier:fail"]);
  assert.match(r.holds[0].text, /9990262.*9990226/);
  assert.match(r.holds[0].text, /bank details/);
});

test("a charge the rate con does not list is held", () => {
  const l = byId("40117");
  l.docs.inv.splice(5, 0, "Layover $250.00");
  l.docs.inv[6] = "Total due $1,810.00";
  const r = checkLoad(l);
  assert.deepEqual(holdIds(r), ["lines:fail"]);
  assert.match(r.holds[0].text, /Layover is not on the rate con/);
});

test("lines that do not add up to the total due are held", () => {
  const l = byId("40117");
  l.docs.inv[5] = "Total due $1,650.00";
  assert.deepEqual(holdIds(checkLoad(l)), ["sum:fail"]);
});

test("different load number on the POD is held", () => {
  const l = byId("40117");
  l.docs.pod[1] = "Load: 40171";
  assert.deepEqual(holdIds(checkLoad(l)), ["load:fail"]);
});

test("missing POD: not found", () => {
  const l = byId("40117");
  delete l.docs.pod;
  const r = checkLoad(l);
  assert.equal(r.ready, false);
  assert.equal(r.checks.find((c) => c.id === "packet").state, "none");
});

test("every reference points at the exact text it claims", () => {
  for (const load of loads) {
    const r = checkLoad(load);
    const refs = [...r.checks.flatMap((c) => c.refs), ...r.lines.flatMap((l) => l.refs)];
    for (const ref of refs) {
      const line = load.docs[ref.doc][ref.line];
      assert.ok(line != null, `${load.id} ${ref.doc}:${ref.line} exists`);
      assert.ok(ref.start >= 0 && ref.end <= line.length && ref.end > ref.start, `${load.id} ${ref.doc}:${ref.line} in range`);
    }
  }
  const p = readPacket(loads[1].docs);
  const mc = p.rc.mc.groups[0];
  assert.equal(loads[1].docs.rc[mc.ref.line].slice(mc.ref.start, mc.ref.end), "9990187");
});

test("AP export lists the ready loads", () => {
  const s = checkAll(loads);
  const csv = apCsv(s.ready);
  assert.equal(csv.split("\n")[1], "40117,Kettle Creek Transport LLC,9990114,KCT-2231,1560.00");
  assert.equal(csv.trim().split("\n").length, 4);
});

test("pasted invoice text is split into clean lines", () => {
  assert.deepEqual(pastedLines("  INVOICE 1 \n\n Linehaul   $1,350.00\r\n"), ["INVOICE 1", "Linehaul $1,350.00"]);
});
