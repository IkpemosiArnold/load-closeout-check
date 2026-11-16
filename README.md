# Load Closeout

A load is delivered. Before the broker pays the carrier, someone in the back office opens the packet: the rate confirmation, the carrier's invoice, the signed proof of delivery and any receipts. They check that every dollar on the invoice was agreed and is backed by the paperwork.

This page does that check for eight sample loads. Each invoice line links to the rate con line and the POD line it relies on. When a line cannot be traced, the load is held back with the reason and the lines it looked at.

The sample is a made-up brokerage week. Three loads are ready to pay. Five are held back on purpose, one for each kind of problem.

## The checks

A load is ready to pay only when all of these hold:

1. **The packet is complete.** Rate con, carrier invoice and POD are all there.
2. **One load number.** The same load number is on all three.
3. **The right carrier.** The invoice comes from the carrier name and MC number on the rate con. A remit-to line on the invoice holds the load, because the sample has no bank file to check it against.
4. **A clean POD.** The receiver signed it, it is dated, and there are no exceptions (shortage, damage, refusal).
5. **Every line agreed and supported.**
   - Linehaul and fuel surcharge match the rate con to the cent.
   - Detention is worked out from the POD under the rate con's terms: the clock starts at the later of the appointment and the truck's arrival, stops at the out time, less the free hours, counted in whole quarter hours.
   - A lumper needs a receipt for at least the amount billed.
   - A charge the rate con does not list is held.
   - A charge is paid once. A second line with the same name is held.
   - A line the reader cannot read is quoted and holds the load.
6. **The arithmetic.** The invoice lines add up to the total due.

The five held back in the sample:

- **40118:** detention billed for 3.0 hours. The POD supports 1.5 hours ($75.00, not $150.00).
- **40119:** a $185.00 lumper with no receipt in the packet. Press "Add the receipt the carrier sent" and the load goes through.
- **40120:** the POD has no signature and no date.
- **40121:** linehaul billed $2,400.00 against $2,250.00 on the rate con.
- **40122:** the invoice carries a different MC number from the rate con, and it asks to pay new bank details. The page says to confirm with the carrier on the number on file before paying.

Ready loads can be approved one by one. Approved loads download as a generic accounts payable CSV. Nothing is paid from the page.

Paste your own invoice text into "Try your own invoice". It is checked against the sample rate con and POD for the load number it names.

## Where a model would go

The reader here is plain rules over text lines: `Label: value` rows, dollar amounts, `HH:MM` times and a fixed list of charge names. Real packets arrive as scanned PDFs, photos of a signed BOL and emails in every layout. A model would read those. Its output would then pass through the same checks, so a person only approves loads whose every dollar already traces back to the rate con, the POD or a receipt.

## Limits

- Detention is read for the delivery stop only, on one day. Pickup detention, overnight stays and layover are not worked out.
- The detention terms come from the sample rate con. Real terms vary by broker, shipper and carrier, for example the free time, the hourly rate, whether a late truck loses detention, and whether notice was given while the truck waited.
- A pickup appointment, multi-stop loads, TONU, driver assist and other accessorials are not read. Any charge outside the rate con is held.
- The MC check compares numbers on the documents. It does not look the carrier up in FMCSA records or check insurance or authority status.
- POD exceptions are read as text. Any text other than "none" holds the load.
- There is no quick pay, factoring or bank file. Any remit-to line holds the load. A factoring company's notice of assignment would need its own check.
- The rates are made up and are not market rates. Fuel is a flat figure per load. A real fuel surcharge is usually cents per mile off a diesel index, or folded into an all-in rate.
- Detention and lumper are checked against the rate con's terms, the POD and the receipt. Many brokers pay an accessorial only once it is on a revised rate con. That step is not modelled.
- The sample POD carries the broker's load number. A real POD often carries only the shipper's BOL or PO number, and the match runs on the reference numbers listed on the rate con.
- An invoice line billed under the agreed amount is held, not paid at the lower figure.

## Run the tests

```
node --test
```

Needs Node 20 or later. No dependencies. 28 tests cover the sample result, detention maths (the clock start, the quarter-hour rounding, missing times, a line with no hours), the lumper receipt, the POD signature and exceptions, the linehaul mismatch, the MC mismatch, a remit-to line, a charge billed twice, an unlisted charge, a line that cannot be read, the arithmetic, a missing POD, the AP export, and that every reference points at a real place in its document.

## Open the page locally

```
python3 -m http.server 8791
```

Then open http://localhost:8791. The page makes no network calls beyond its own files.

## Design

It follows the shared direction for these demos: the result first, rows split by hairlines, and an underline that draws under the exact words each figure came from. Red marks what is wrong on the invoice; green marks the paperwork it was checked against. Geist for the tool, Newsreader for the documents, and a safety-orange accent.

Fonts: Geist and Newsreader (SIL Open Font License), in `fonts/`.

## Provenance

Built on 16 Nov 2026 with AI coding agents, directed by Arnold Ikpemosi Adeyemi. Made-up loads, carriers, customers and MC numbers. The MC numbers start at 9,990,000, above the old sequential range. Since May 2026 FMCSA issues new numbers at random, so one could match a real carrier by chance. None is meant, and they were not checked against FMCSA records.

## Licence

MIT. See `LICENSE`.
