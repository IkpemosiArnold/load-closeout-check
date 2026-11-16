import { checkLoad, checkAll, apCsv, pastedLines, fmt, DOC_NAMES } from "./check.js?v=1";
import { loads as sampleLoads, lateReceipt40119 } from "./samples.js?v=1";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const icon = (name) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
};
const glyph = { pass: "check", fail: "cross", none: "none" };
const word = { pass: "Ready", fail: "Held", none: "Missing" };
const wide = window.matchMedia("(min-width: 960px)");
const clone = (x) => JSON.parse(JSON.stringify(x));

let loads = clone(sampleLoads);
let approved = new Set();
let openId = null;
let firstRender = true;

const usd = (n) => `$${fmt(n)}`;
const refName = (r) => `${DOC_NAMES[r.doc]}, line ${r.line + 1}`;
const stateOf = (r) => (r.ready ? "pass" : r.holds.some((h) => h.state === "fail") ? "fail" : "none");

/** One source line with the referenced ranges underlined in place. */
function markedLine(text, ranges, kind) {
  // kind: "pass", "fail", or a function of the range
  const frag = document.createDocumentFragment();
  let at = 0;
  const rs = [...ranges].sort((a, b) => a.start - b.start);
  for (const r of rs) {
    if (r.start < at) continue;
    const k = typeof kind === "function" ? kind(r) : kind;
    frag.append(text.slice(at, r.start), el("span", `u ${k === "pass" ? "pass" : "fail"}`, text.slice(r.start, r.end)));
    at = r.end;
  }
  frag.append(text.slice(at));
  return frag;
}

/** The lines a check or an invoice line looked at, grouped by document line. */
function sources(docs, refs, kind, failDocs = ["inv"]) {
  const tone = kind === "pass" ? "pass" : (r) => (failDocs.includes(r.doc) ? "fail" : "pass");
  const box = el("div", "srcs");
  const by = new Map();
  for (const r of refs) {
    const k = `${r.doc}:${r.line}`;
    if (!by.has(k)) by.set(k, { doc: r.doc, line: r.line, ranges: [] });
    by.get(k).ranges.push(r);
  }
  const order = ["inv", "rc", "pod", "receipt"];
  for (const s of [...by.values()].sort((a, b) => order.indexOf(a.doc) - order.indexOf(b.doc) || a.line - b.line)) {
    const text = docs[s.doc][s.line];
    const f = el("div", "src");
    f.append(el("p", "src-h", refName(s)));
    const p = el("p", "src-line");
    p.append(markedLine(text, s.ranges.filter((r) => r.end > r.start), tone));
    if (/:\s*$/.test(text)) p.append(el("span", "blank", "  (blank)"));
    f.append(p);
    box.append(f);
  }
  return box;
}

function draw(node) {
  requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add("drawn")));
}

function invoiceLines(r) {
  const wrap = el("div", "qlines");
  for (const l of r.lines) {
    const item = el("div", "q-item");
    const b = el("button", "q-row");
    b.type = "button";
    b.setAttribute("aria-expanded", "false");
    const left = el("span", "q-l");
    left.append(el("span", "q-name", l.label));
    if (l.calc) left.append(el("span", "q-calc", l.calc));
    if (l.state !== "pass") left.append(el("span", "q-calc", l.why));
    const refs = el("span", "q-refs");
    const names = [...new Set(l.refs.filter((x) => x.doc !== "inv").map((x) => DOC_NAMES[x.doc]))];
    names.forEach((n) => refs.append(el("span", "chip", n)));
    if (names.length) left.append(refs);
    const right = el("span", `q-r st-${l.state}`);
    right.append(icon(glyph[l.state]), el("span", "q-amt", usd(l.billed)));
    if (l.diff) right.append(el("span", "q-note diff", `${usd(l.diff)} over`));
    b.append(left, right);
    item.append(b);
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-expanded") === "true";
      item.querySelector(".srcs")?.remove();
      b.setAttribute("aria-expanded", String(!on));
      if (!on) {
        const s = sources(r.docs, l.refs, l.state);
        s.classList.add("evidence", "enter");
        item.append(s);
        draw(s);
      }
    });
    wrap.append(item);
  }
  const tot = el("p", "q-total");
  tot.append(el("span", null, "Total due"), el("span", null, r.totalDue != null ? usd(r.totalDue) : "Not found"));
  wrap.append(tot);
  return wrap;
}

function packet(r) {
  const box = el("div", "docs");
  const allRefs = [...r.checks.flatMap((c) => c.refs), ...r.lines.flatMap((l) => l.refs)];
  for (const d of ["rc", "inv", "pod", "receipt"]) {
    if (!r.docs[d]) continue;
    const doc = el("div", "doc");
    doc.append(el("p", "doc-h", DOC_NAMES[d]));
    const body = el("div", "doc-body");
    r.docs[d].forEach((text, i) => {
      const p = el("p");
      p.append(el("span", "ln", String(i + 1)));
      const t = el("span");
      const rs = allRefs.filter((x) => x.doc === d && x.line === i && x.end > x.start);
      t.append(markedLine(text, dedupe(rs), "pass"));
      p.append(t);
      body.append(p);
    });
    doc.append(body);
    box.append(doc);
  }
  return box;
}

function dedupe(rs) {
  const seen = new Set();
  return rs.filter((r) => {
    const k = `${r.start}-${r.end}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).filter((r, _, all) => !all.some((o) => o !== r && o.start <= r.start && o.end >= r.end && (o.start !== r.start || o.end !== r.end)));
}

function detail(r, { own = false } = {}) {
  const st = stateOf(r);
  const box = el("div", "evidence");
  box.append(el("p", "side-h", `Load ${r.id}, ${r.lane}`));
  box.append(el("p", `side-title st-${st}`, r.ready ? `Ready to pay, ${usd(r.totalDue)}` : "Held back"));

  if (!r.ready) {
    box.append(el("p", "ev-h", "Why it is held back"));
    const ul = el("ul", "reasons");
    for (const h of r.holds) {
      const li = el("li");
      li.append(icon(glyph[h.state]));
      li.querySelector("svg").style.color = `var(--${h.state})`;
      li.append(el("span", null, h.text));
      ul.append(li);
    }
    box.append(ul);
    const hs = r.holds.flatMap((h) => h.refs);
    if (hs.length) {
      const s = sources(r.docs, hs, "fail", r.holds.some((h) => h.id === "pod" || h.id === "load") ? ["inv", "pod"] : ["inv"]);
      box.append(s);
      draw(s);
    }
    if (r.id === "40119" && !own && !r.docs.receipt) {
      const act = el("div", "inline-actions");
      const add = el("button", "btn text", "Add the receipt the carrier sent");
      add.type = "button";
      add.addEventListener("click", () => {
        loads.find((l) => l.id === "40119").docs.receipt = clone(lateReceipt40119);
        render();
      });
      act.append(add);
      box.append(act);
    }
  }

  box.append(el("p", "ev-h", `${DOC_NAMES.inv}${r.invoiceNo ? ` ${r.invoiceNo}` : ""}, ${r.carrier}. Tap a line for its source.`), invoiceLines(r));

  box.append(el("p", "ev-h", "Checks"));
  const ul = el("ul", "checks");
  for (const c of r.checks) {
    const li = el("li", `st-${c.state}`);
    li.append(icon(glyph[c.state]), el("span", null, c.name));
    ul.append(li);
  }
  box.append(ul);

  if (r.ready && !own) {
    if (approved.has(r.id)) {
      const p = el("p", "approved");
      p.append(icon("check"), "Approved for payment");
      box.append(p);
    } else {
      const act = el("div", "inline-actions");
      const ok = el("button", "btn primary", `Approve ${usd(r.totalDue)}`);
      ok.type = "button";
      ok.addEventListener("click", () => {
        approved.add(r.id);
        render();
      });
      act.append(ok);
      box.append(act);
    }
  }

  const tog = el("button", "btn text", "Show the whole packet");
  tog.type = "button";
  tog.setAttribute("aria-expanded", "false");
  const pk = packet(r);
  pk.hidden = true;
  tog.addEventListener("click", () => {
    pk.hidden = !pk.hidden;
    tog.setAttribute("aria-expanded", String(!pk.hidden));
    tog.textContent = pk.hidden ? "Show the whole packet" : "Hide the packet";
    if (!pk.hidden) draw(pk);
  });
  box.append(tog, pk);
  return box;
}

function row(r) {
  const st = stateOf(r);
  const item = el("div", "row-item");
  item.dataset.id = r.id;
  const b = el("button", "row");
  b.type = "button";
  b.setAttribute("aria-expanded", String(openId === r.id));
  const s = el("span", `status st-${st}`);
  s.append(icon(glyph[st]), el("span", null, word[st]));
  const v = el("span", "val");
  v.append(el("b", null, `${r.id}, ${usd(r.totalDue)}`));
  v.append(el("span", "meta", r.lane));
  v.append(el("span", "why-l", r.ready ? (approved.has(r.id) ? "Approved for payment" : r.carrier) : shortWhy(r)));
  const chev = icon("chev");
  chev.classList.add("chev");
  b.append(s, v, chev);
  item.append(b);
  b.addEventListener("click", () => {
    openId = openId === r.id ? null : r.id;
    render({ keep: true });
    if (!wide.matches && openId) {
      const n = document.querySelector(`.row-item[data-id="${r.id}"]`);
      const top = n.getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * 0.6) n.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });
  if (openId === r.id && !wide.matches) {
    const d = detail(r);
    d.classList.add("enter");
    item.append(d);
  }
  return item;
}

function shortWhy(r) {
  const h = r.holds[0];
  const map = {
    packet: "Paperwork missing",
    load: "Load numbers differ",
    carrier: "Invoice from a different MC",
    pod: h.state === "none" ? "POD not signed or dated" : "Exceptions on the POD",
    lines: h.text.split(";")[0].replace(/^Not found: no (.+) in the packet for the (.+)\.$/, "No $1 for the $2").replace(/^Not found: /, "").replace(/\.$/, ""),
    sum: "Lines do not add up",
  };
  const t = map[h.id] || h.text;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function render({ keep = false } = {}) {
  const s = checkAll(loads);
  const sum = $("summary");
  sum.replaceChildren(
    el("span", "sum-main", `${s.ready.length} of ${s.results.length} ready to pay`),
    el("span", "sum-side", usd(s.readyTotal)),
    el("span", "sum-side muted", `${s.held.length} held, ${usd(s.heldTotal)}`),
  );
  const groups = $("groups");
  groups.replaceChildren();
  for (const [title, list] of [["Held back", s.held], ["Ready to pay", s.ready]]) {
    if (!list.length) continue;
    groups.append(el("p", "group-h", `${title} (${list.length})`));
    const rows = el("div", "rows");
    if (firstRender === false && !keep) rows.classList.add("fresh");
    list.forEach((r) => rows.append(row(r)));
    groups.append(rows);
  }
  const side = $("side");
  side.replaceChildren();
  if (wide.matches) {
    const r = s.results.find((x) => x.id === (openId || s.held[0]?.id || s.results[0].id));
    if (!openId) {
      openId = r.id;
      document.querySelector(`.row-item[data-id="${r.id}"] .row`)?.setAttribute("aria-expanded", "true");
    }
    const d = detail(r);
    d.classList.add("enter");
    side.append(d);
  }
  const ap = s.ready.filter((r) => approved.has(r.id));
  $("ap-sub").textContent = ap.length
    ? `${ap.length} load${ap.length > 1 ? "s" : ""}, ${usd(ap.reduce((t, r) => t + r.totalDue, 0))}: ${ap.map((r) => r.id).join(", ")}. The file is a generic CSV; nothing is paid from here.`
    : "Nothing approved yet. Open a ready load and approve it.";
  $("ap-dl").disabled = !ap.length;
  firstRender = false;
}

$("why-btn").addEventListener("click", () => {
  const c = $("chain");
  c.hidden = !c.hidden;
  $("why-btn").setAttribute("aria-expanded", String(!c.hidden));
});

$("ap-dl").addEventListener("click", () => {
  const s = checkAll(loads);
  const csv = apCsv(s.ready.filter((r) => approved.has(r.id)));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "ap-approved-sample.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

$("reset").addEventListener("click", () => {
  loads = clone(sampleLoads);
  approved = new Set();
  openId = null;
  $("own-out").replaceChildren();
  render();
});

const EXAMPLE = `INVOICE KCT-2299
Kettle Creek Transport LLC, MC 9990114
Load: 40117
Linehaul $1,350.00
Fuel surcharge $210.00
Detention 1.0 hrs @ $50.00 $50.00
Total due $1,610.00`;

$("own-sample").addEventListener("click", () => {
  $("own-in").value = EXAMPLE;
  $("own-in").focus();
});

$("own-check").addEventListener("click", () => {
  const err = $("own-error");
  const out = $("own-out");
  err.hidden = true;
  out.replaceChildren();
  const lines = pastedLines($("own-in").value);
  if (!lines.length) {
    err.textContent = "Paste an invoice first, or fill in the example.";
    err.hidden = false;
    return;
  }
  const loadLine = lines.map((t) => /^Load: (\S+)/.exec(t)).find(Boolean);
  const base = loadLine && loads.find((l) => l.id === loadLine[1]);
  if (!base) {
    err.textContent = loadLine
      ? `Not found: there is no sample load ${loadLine[1]}. Use 40117 to 40124.`
      : "Not found: the invoice has no line like \"Load: 40117\", so there is no rate con to check it against.";
    err.hidden = false;
    return;
  }
  const r = checkLoad({ id: base.id, received: "now", docs: { ...clone(base.docs), inv: lines } });
  const d = detail(r, { own: true });
  d.classList.add("enter");
  out.append(d);
});

wide.addEventListener("change", () => render({ keep: true }));
render({ keep: true });
