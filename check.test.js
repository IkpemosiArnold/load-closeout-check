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

test("a charge billed twice is held, never paid twice", () => {
  const l = byId("40118");
  l.docs.inv = ["INVOICE 0918", "Bluestem Haulers Inc, MC 9990187", "Load: 40118", "Linehaul $1,180.00", "Linehaul $1,180.00", "Fuel surcharge $190.00", "Total due $2,550.00"];
  const r = checkLoad(l);
  assert.deepEqual(holdIds(r), ["lines:fail"]);
  assert.match(r.holds[0].text, /Linehaul is on the invoice twice/);
});

test("a second lumper line against one receipt is held", () => {
  const l = byId("40124");
  l.docs.inv.splice(6, 0, "Lumper $165.00");
  l.docs.inv[7] = "Total due $3,200.00";
  assert.deepEqual(holdIds(checkLoad(l)), ["lines:fail"]);
});

test("an invoice line the reader cannot read holds the load", () => {
  const l = byId("40123");
  l.docs.inv.splice(6, 0, "Tarp fee 75");
  const r = checkLoad(l);
  assert.deepEqual(holdIds(r), ["lines:none"]);
  assert.match(r.holds[0].text, /Not read: invoice line 7, "Tarp fee 75"/);
});

test("a remit-to line holds the load even when the MC matches", () => {
  const l = byId("40117");
  l.docs.inv.push("Remit to: new bank details attached");
  const r = checkLoad(l);
  assert.deepEqual(holdIds(r), ["carrier:fail"]);
  assert.match(r.holds[0].text, /number you have on file/);
});

test("a different name and a different MC is not called a name match", () => {
  const l = byId("40118");
  l.docs.inv[1] = "Prairie Wind Freight LLC, MC 9990555";
  assert.match(checkLoad(l).holds[0].text, /The names differ too/);
});

test("carrier name in capitals and MC written MC#: still the same carrier", () => {
  const l = byId("40117");
  l.docs.inv[1] = "KETTLE CREEK TRANSPORT LLC MC# 9990114";
  assert.equal(checkLoad(l).ready, true);
});

test("detention billed under what the POD supports reads as under", () => {
  const l = byId("40118");
  l.docs.inv[5] = "Detention 1.0 hrs @ $50.00 $50.00";
  l.docs.inv[6] = "Total due $1,420.00";
  const d = checkLoad(l).lines.find((x) => x.label === "Detention");
  assert.equal(d.diff, -25);
  assert.equal(d.short, "Detention billed 1.0 hrs, POD supports 1.5");
});

test("detention with no hours on the line passes when the amount is right", () => {
  const l = byId("40118");
  l.docs.inv[5] = "Detention $75.00";
  l.docs.inv[6] = "Total due $1,445.00";
  assert.equal(checkLoad(l).ready, true);
});

test("the row reason says what is wrong", () => {
  const s = checkAll(loads);
  const short = (id) => s.results.find((r) => r.id === id).lines.find((l) => l.state !== "pass").short;
  assert.equal(short("40118"), "Detention billed 3.0 hrs, POD supports 1.5");
  assert.equal(short("40121"), "Linehaul $150.00 over the rate con");
  assert.match(s.results.find((r) => r.id === "40118").holds[0].text, /Appointment 07:00 to out 10:30 = 3\.5 hrs, less 2 free = 1\.5 hrs/);
});

test("40122: red goes under the MC and the remit-to line, not under the matching name", () => {
  const r = checkLoad(byId("40122"));
  const invRefs = r.holds[0].refs.filter((x) => x.doc === "inv").map((x) => r.docs.inv[x.line].slice(x.start, x.end));
  assert.deepEqual(invRefs, ["9990262", "new bank details attached"]);
});
