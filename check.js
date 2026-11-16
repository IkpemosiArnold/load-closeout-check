// Load closeout check. Plain code, no model.
// A load is ready to pay only when every line of the carrier's invoice traces
// back to the rate confirmation and the signed POD (and a receipt where the
// rate con asks for one). Anything it cannot trace is held with the reason
// and the lines it looked at. Nothing is guessed.

export const DOC_NAMES = { rc: "Rate con", inv: "Carrier invoice", pod: "POD", receipt: "Lumper receipt" };

const MONEY = String.raw`\$?(\d{1,3}(?:,\d{3})*\.\d{2})`;
const num = (s) => Number(String(s).replace(/,/g, ""));
export const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cents = (n) => Math.round(n * 100);

/** First line of a document matching re. Returns the captured groups with their exact positions. */
function find(docs, doc, re) {
  const lines = docs[doc];
  if (!lines) return null;
  const rx = new RegExp(re.source, re.flags.includes("d") ? re.flags : re.flags + "d");
  for (let i = 0; i < lines.length; i++) {
    const m = rx.exec(lines[i]);
    if (!m) continue;
    const groups = [];
    for (let g = 1; g < m.length; g++) {
      if (m[g] == null) { groups.push(null); continue; }
      const [s, e] = m.indices[g];
      groups.push({ text: m[g], ref: { doc, line: i, start: s, end: e } });
    }
    return { line: i, groups, whole: { doc, line: i, start: 0, end: lines[i].length } };
  }
  return null;
}

const lineRef = (doc, line, lines) => ({ doc, line, start: 0, end: lines[line].length });

function hm(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const hrs = (min) => {
  const h = min / 60;
  if (Number.isInteger(h * 4)) return `${h} hrs`;
  return `${Math.floor(min / 60)} hr ${min % 60} min`;
};

export function readPacket(docs) {
  const rc = {
    load: find(docs, "rc", /^Load: (\S+)/),
    carrier: find(docs, "rc", /^Carrier: (.+)$/),
    mc: find(docs, "rc", /^MC: (\d+)/),
    appt: find(docs, "rc", /^Delivery: .*appt (\d{1,2}:\d{2})/),
    lane: find(docs, "rc", /^Lane: (.+)$/),
    linehaul: find(docs, "rc", new RegExp(`^Linehaul: ${MONEY}`)),
    fuel: find(docs, "rc", new RegExp(`^Fuel surcharge: ${MONEY}`)),
    total: find(docs, "rc", new RegExp(`^Total: ${MONEY}`)),
    detention: find(docs, "rc", new RegExp(`^Detention: ${MONEY}/hr after (\\d+(?:\\.\\d+)?) hrs? free`)),
    clock: find(docs, "rc", /^Detention clock starts at the (later of appointment and arrival)/),
    quarter: find(docs, "rc", /^Billed in (quarter hours)/),
    lumper: find(docs, "rc", /^Lumper: (reimbursed at cost with the receipt)/),
    payOnly: find(docs, "rc", /^(Pay only the carrier and MC on this confirmation)/),
  };
  const inv = {
    number: find(docs, "inv", /^INVOICE (\S+)/),
    from: find(docs, "inv", /^(.+), MC (\d+)$/),
    load: find(docs, "inv", /^Load: (\S+)/),
    totalDue: find(docs, "inv", new RegExp(`^Total due ${MONEY}`)),
    remit: find(docs, "inv", /^Remit to: (.+)$/),
    lines: [],
  };
  const invLines = docs.inv || [];
  const lineRe = new RegExp(String.raw`^(Linehaul|Fuel surcharge|Detention|Lumper|Layover|TONU|Driver assist|Stop off)(?: (\d+(?:\.\d+)?) hrs? @ ${MONEY})? ${MONEY}$`, "d");
  const otherRe = new RegExp(String.raw`^([A-Za-z][A-Za-z /-]+?) ${MONEY}$`, "d");
  invLines.forEach((text, i) => {
    if (/^Total due/.test(text)) return;
    let m = lineRe.exec(text);
    if (m) {
      const at = (g) => (m[g] == null ? null : { text: m[g], ref: { doc: "inv", line: i, start: m.indices[g][0], end: m.indices[g][1] } });
      inv.lines.push({ label: m[1], line: i, qty: at(2), rate: at(3), amount: at(4), labelRef: at(1) });
      return;
    }
    m = otherRe.exec(text);
    if (m) {
      inv.lines.push({
        label: m[1], line: i, qty: null, rate: null, unknown: true,
        labelRef: { text: m[1], ref: { doc: "inv", line: i, start: m.indices[1][0], end: m.indices[1][1] } },
        amount: { text: m[2], ref: { doc: "inv", line: i, start: m.indices[2][0], end: m.indices[2][1] } },
      });
    }
  });
  const pod = {
    load: find(docs, "pod", /^Load: (\S+)/),
    arrived: find(docs, "pod", /^Arrived: (\d{1,2}:\d{2})/),
    inOut: find(docs, "pod", /^In: (\d{1,2}:\d{2}) Out: (\d{1,2}:\d{2})/),
    signedLine: find(docs, "pod", /^Received by:(.*)$/),
    dateLine: find(docs, "pod", /^Date:(.*)$/),
    exceptions: find(docs, "pod", /^Exceptions: (.+)$/),
  };
  const receipt = docs.receipt
    ? { load: find(docs, "receipt", /^Load: (\S+)/), amount: find(docs, "receipt", new RegExp(`^Amount paid: ${MONEY}`)) }
    : null;
  return { rc, inv, pod, receipt };
}

const g = (f, i = 0) => (f && f.groups[i]) || null;
const refsOf = (...xs) => xs.filter(Boolean).map((x) => x.ref || x);

/** Detention the POD supports, under the rate con's terms. */
export function detentionSupported(p) {
  const rate = g(p.rc.detention, 0);
  const free = g(p.rc.detention, 1);
  const appt = g(p.rc.appt);
  const arrived = g(p.pod.arrived);
  const out = g(p.pod.inOut, 1);
  const refs = refsOf(rate, free, appt, arrived, out, g(p.rc.clock), g(p.rc.quarter));
  if (!rate || !free) return { ok: false, why: "Not found: the rate con has no detention terms.", refs };
  if (!appt) return { ok: false, why: "Not found: no delivery appointment on the rate con.", refs };
  if (!arrived || !out) return { ok: false, why: "Not found: the POD has no arrival or out time.", refs };
  const start = Math.max(hm(appt.text), hm(arrived.text));
  const end = hm(out.text);
  if (end <= start) return { ok: false, why: "Not settled: the out time is before the clock starts (overnight stays are not read).", refs };
  const onSite = end - start;
  const billable = Math.max(0, Math.floor((onSite - num(free.text) * 60) / 15) * 15);
  const amount = (billable / 60) * num(rate.text);
  const startWord = hm(appt.text) >= hm(arrived.text) ? `appointment ${appt.text}` : `arrival ${arrived.text}`;
  return {
    ok: true, rate: num(rate.text), free: num(free.text), onSiteMin: onSite, billableMin: billable, amount, refs,
    calc: `${startWord} to out ${out.text} = ${hrs(onSite)}, less ${free.text} free = ${hrs(billable)} at $${rate.text}/hr`,
  };
}

export const CHECKS = [
  ["packet", "Rate con, invoice and POD all in the packet"],
  ["load", "Same load number on every document"],
  ["carrier", "Invoice from the carrier and MC on the rate con"],
  ["pod", "POD signed and dated, no exceptions"],
  ["lines", "Every invoice line agreed on the rate con and supported"],
  ["sum", "Invoice lines add up to the total due"],
];

export function checkLoad(load) {
  const docs = load.docs;
  const p = readPacket(docs);
  const checks = [];
  const add = (id, state, text, refs = []) => checks.push({ id, name: CHECKS.find((c) => c[0] === id)[1], state, text, refs });

  // 1. Packet
  const missing = ["rc", "inv", "pod"].filter((d) => !docs[d] || !docs[d].length);
  if (missing.length) add("packet", "none", `Not found: no ${missing.map((d) => DOC_NAMES[d].toLowerCase()).join(" or ")} in the packet.`);
  else add("packet", "pass", "All three are here.");

  // 2. Load number
  const rcLoad = g(p.rc.load), invLoad = g(p.inv.load), podLoad = g(p.pod.load);
  const loadRefs = refsOf(rcLoad, invLoad, podLoad);
  if (!rcLoad || !invLoad || !podLoad) add("load", "none", "Not found: a document has no load number.", loadRefs);
  else if (rcLoad.text !== invLoad.text || rcLoad.text !== podLoad.text)
    add("load", "fail", `Load numbers differ: rate con ${rcLoad.text}, invoice ${invLoad.text}, POD ${podLoad.text}.`, loadRefs);
  else add("load", "pass", `Load ${rcLoad.text} on all three.`, loadRefs);

  // 3. Carrier and MC
  const rcMc = g(p.rc.mc), invMc = g(p.inv.from, 1), invName = g(p.inv.from, 0), rcName = g(p.rc.carrier);
  const remit = g(p.inv.remit);
  const mcRefs = refsOf(rcName, rcMc, invName, invMc, g(p.rc.payOnly));
  if (!rcMc || !invMc) add("carrier", "none", "Not found: no MC number on the rate con or the invoice.", mcRefs);
  else if (rcMc.text !== invMc.text) {
    let t = `The invoice is from MC ${invMc.text}; the rate con is with MC ${rcMc.text}. The names match, the numbers do not.`;
    if (remit) t += ` It also asks to pay new bank details. Confirm with the carrier on the number you have on file before paying.`;
    add("carrier", "fail", t, [...mcRefs, ...refsOf(remit)]);
  } else if (rcName && invName && rcName.text !== invName.text)
    add("carrier", "fail", `Same MC, different name: "${invName.text}" against "${rcName.text}".`, mcRefs);
  else add("carrier", "pass", `${rcName ? rcName.text : "Carrier"}, MC ${rcMc.text}, on both.`, mcRefs);

  // 4. POD signed, dated, clean
  const signed = g(p.pod.signedLine), dated = g(p.pod.dateLine), exc = g(p.pod.exceptions);
  const sig = signed && signed.text.trim();
  const dat = dated && dated.text.trim();
  const podRefs = refsOf(signed && sig ? signed : null, dated && dat ? dated : null, exc);
  const podWhole = refsOf(p.pod.signedLine && p.pod.signedLine.whole, p.pod.dateLine && p.pod.dateLine.whole);
  if (!sig || !dat)
    add("pod", "none", `Not found: the POD has no ${[!sig && "receiver signature", !dat && "delivery date"].filter(Boolean).join(" and no ")}. The load cannot close out without it.`, podWhole);
  else if (exc && !/^none$/i.test(exc.text.trim()))
    add("pod", "fail", `The receiver noted: "${exc.text}". Check for a claim before paying.`, podRefs);
  else add("pod", "pass", `Signed by ${sig}, ${dat}, no exceptions.`, podRefs);

  // 5. Each invoice line against the rate con, POD and receipt
  const lines = p.inv.lines.map((l) => lineCheck(l, p));
  const bad = lines.filter((l) => l.state !== "pass");
  if (!lines.length) add("lines", "none", "Not found: no charge lines on the invoice.");
  else if (bad.length) add("lines", bad.some((l) => l.state === "fail") ? "fail" : "none", bad.map((l) => l.why).join(" "), bad.flatMap((l) => l.refs));
  else add("lines", "pass", `${lines.length} lines, each on the rate con.`, lines.flatMap((l) => l.refs));

  // 6. Arithmetic
  const due = g(p.inv.totalDue);
  const sum = lines.reduce((s, l) => s + (l.billed || 0), 0);
  if (!due) add("sum", "none", "Not found: no total due on the invoice.");
  else if (cents(sum) !== cents(num(due.text))) add("sum", "fail", `Lines add up to $${fmt(sum)}; the total due says $${due.text}.`, refsOf(due, ...lines.map((l) => l.amountRef)));
  else add("sum", "pass", `$${due.text}.`, refsOf(due));

  const ready = checks.every((c) => c.state === "pass");
  return {
    id: load.id,
    received: load.received,
    docs,
    packet: p,
    lane: g(p.rc.lane) ? g(p.rc.lane).text : "Lane not found",
    carrier: rcName ? rcName.text : invName ? invName.text : "Carrier not found",
    invoiceNo: g(p.inv.number) ? g(p.inv.number).text : null,
    totalDue: due ? num(due.text) : null,
    lines,
    checks,
    ready,
    holds: checks.filter((c) => c.state !== "pass"),
  };
}

function lineCheck(l, p) {
  const billed = l.amount ? num(l.amount.text) : null;
  const base = { label: l.label, billed, amountRef: l.amount && l.amount.ref };
  const invLine = { doc: "inv", line: l.line, start: l.labelRef.ref.start, end: l.amount.ref.end };
  const out = (state, why, refs, extra = {}) => ({ ...base, state, why, refs: [invLine, ...refs], ...extra });

  if (l.label === "Linehaul" || l.label === "Fuel surcharge") {
    const agreed = g(l.label === "Linehaul" ? p.rc.linehaul : p.rc.fuel);
    if (!agreed) return out("none", `Not found: no ${l.label.toLowerCase()} on the rate con.`, []);
    const a = num(agreed.text);
    if (cents(a) !== cents(billed))
      return out("fail", `${l.label} billed $${fmt(billed)}; the rate con agreed $${agreed.text}.`, refsOf(agreed), { agreed: a, diff: billed - a });
    return out("pass", `Matches the rate con.`, refsOf(agreed), { agreed: a, calc: `Rate con $${agreed.text}` });
  }

  if (l.label === "Detention") {
    const d = detentionSupported(p);
    if (!d.ok) return out("none", d.why, d.refs);
    const qtyOk = l.qty && l.rate && cents(num(l.qty.text) * num(l.rate.text)) === cents(billed);
    const ref2 = refsOf(l.qty, l.rate);
    if (cents(d.amount) === cents(billed) && qtyOk)
      return out("pass", "Supported by the POD times.", [...ref2, ...d.refs], { agreed: d.amount, calc: `${d.calc} = $${fmt(d.amount)}` });
    return out("fail", `Detention billed ${l.qty ? l.qty.text : "?"} hrs ($${fmt(billed)}); the POD supports ${hrs(d.billableMin)} ($${fmt(d.amount)}).`, [...ref2, ...d.refs], {
      agreed: d.amount, diff: billed - d.amount, calc: `${d.calc} = $${fmt(d.amount)}`,
    });
  }

  if (l.label === "Lumper") {
    const term = g(p.rc.lumper);
    if (!term) return out("fail", "Lumper billed, but the rate con does not allow it.", []);
    if (!p.receipt) return out("none", `Not found: no lumper receipt in the packet for the $${fmt(billed)} lumper.`, refsOf(term));
    const ra = g(p.receipt.amount), rl = g(p.receipt.load);
    if (!ra) return out("none", "Not found: the receipt shows no amount.", refsOf(term));
    if (rl && g(p.rc.load) && rl.text !== g(p.rc.load).text)
      return out("fail", `The receipt is for load ${rl.text}.`, refsOf(term, rl));
    if (cents(num(ra.text)) < cents(billed))
      return out("fail", `Lumper billed $${fmt(billed)}; the receipt shows $${ra.text}.`, refsOf(term, ra), { agreed: num(ra.text), diff: billed - num(ra.text) });
    return out("pass", "Matches the receipt.", refsOf(term, ra, rl), { agreed: num(ra.text), calc: `Receipt $${ra.text}` });
  }

  return out("fail", `${l.label} is not on the rate con.`, []);
}

export function checkAll(loads) {
  const results = loads.map(checkLoad);
  const ready = results.filter((r) => r.ready);
  const held = results.filter((r) => !r.ready);
  return {
    results, ready, held,
    readyTotal: ready.reduce((s, r) => s + (r.totalDue || 0), 0),
    heldTotal: held.reduce((s, r) => s + (r.totalDue || 0), 0),
  };
}

/** Accounts payable export for the loads a person approved. */
export function apCsv(results) {
  const rows = [["load", "carrier", "mc", "invoice", "amount_usd"]];
  for (const r of results) {
    rows.push([r.id, r.carrier, g(r.packet.rc.mc).text, r.invoiceNo || "", fmt(r.totalDue).replace(/,/g, "")]);
  }
  return rows.map((row) => row.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n";
}

/** Split a pasted invoice into lines. */
export function pastedLines(text) {
  return text.split(/\r?\n/).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
}
