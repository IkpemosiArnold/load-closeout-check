// Sample data. A made-up freight brokerage, made-up carriers, made-up loads.
// MC numbers start at 9,990,000, above the old sequential range. Since May 2026
// FMCSA issues new numbers at random, so a match with a real carrier is possible
// by chance. None is meant.
//
// Each load has the packet a broker's back office closes out before paying the
// carrier: the rate confirmation the broker sent, the carrier's invoice, the
// signed proof of delivery and, where there was one, a lumper receipt.
// Documents are kept as the lines of text a reader would pull from the PDFs.

const TERMS = [
  "Detention: $50.00/hr after 2 hrs free at each stop.",
  "Detention clock starts at the later of appointment and arrival.",
  "Billed in quarter hours from the arrival and out times on the signed POD.",
  "Lumper: reimbursed at cost with the receipt.",
  "Pay only the carrier and MC on this confirmation.",
];

function rc({ load, carrier, mc, pu, del, appt, lane, eq = "53' dry van", linehaul, fuel }) {
  const total = linehaul + fuel;
  return [
    "RATE CONFIRMATION",
    `Load: ${load}`,
    `Carrier: ${carrier}`,
    `MC: ${mc}`,
    `Pickup: ${pu}`,
    `Delivery: ${del}, appt ${appt}`,
    `Lane: ${lane}`,
    `Equipment: ${eq}`,
    `Linehaul: $${money(linehaul)}`,
    `Fuel surcharge: $${money(fuel)}`,
    `Total: $${money(total)}`,
    ...TERMS,
  ];
}

function money(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const loads = [
  {
    id: "40117",
    received: "Mon 16 Nov, 07:58",
    docs: {
      rc: rc({ load: "40117", carrier: "Kettle Creek Transport LLC", mc: "9990114", pu: "11/09/2026 08:00, San Antonio TX", del: "11/10/2026", appt: "07:00, Tulsa OK", lane: "San Antonio TX to Tulsa OK", linehaul: 1350, fuel: 210 }),
      inv: [
        "INVOICE KCT-2231",
        "Kettle Creek Transport LLC, MC 9990114",
        "Load: 40117",
        "Linehaul $1,350.00",
        "Fuel surcharge $210.00",
        "Total due $1,560.00",
      ],
      pod: [
        "BILL OF LADING / PROOF OF DELIVERY",
        "Load: 40117",
        "Consignee: Northgate Grocery DC, Tulsa OK",
        "Pieces: 22 pallets",
        "Arrived: 06:41",
        "In: 07:00 Out: 08:20",
        "Received by: J. Ortiz",
        "Date: 11/10/2026",
        "Exceptions: none",
      ],
    },
  },
  {
    id: "40118",
    received: "Mon 16 Nov, 08:04",
    docs: {
      rc: rc({ load: "40118", carrier: "Bluestem Haulers Inc", mc: "9990187", pu: "11/10/2026 06:00, Green Bay WI", del: "11/11/2026", appt: "07:00, Columbus OH", lane: "Green Bay WI to Columbus OH", linehaul: 1180, fuel: 190 }),
      inv: [
        "INVOICE 0918",
        "Bluestem Haulers Inc, MC 9990187",
        "Load: 40118",
        "Linehaul $1,180.00",
        "Fuel surcharge $190.00",
        "Detention 3.0 hrs @ $50.00 $150.00",
        "Total due $1,520.00",
      ],
      pod: [
        "BILL OF LADING / PROOF OF DELIVERY",
        "Load: 40118",
        "Consignee: Riverbend Paper Co, Columbus OH",
        "Pieces: 18 pallets",
        "Arrived: 06:52",
        "In: 07:00 Out: 10:30",
        "Received by: D. Mensah",
        "Date: 11/11/2026",
        "Exceptions: none",
      ],
    },
  },
  {
    id: "40119",
    received: "Mon 16 Nov, 08:11",
    docs: {
      rc: rc({ load: "40119", carrier: "Two Rivers Freight LLC", mc: "9990203", pu: "11/10/2026 14:00, Laredo TX", del: "11/12/2026", appt: "05:00, Atlanta GA", lane: "Laredo TX to Atlanta GA", eq: "53' reefer", linehaul: 2650, fuel: 420 }),
      inv: [
        "INVOICE TRF-5530",
        "Two Rivers Freight LLC, MC 9990203",
        "Load: 40119",
        "Linehaul $2,650.00",
        "Fuel surcharge $420.00",
        "Lumper $185.00",
        "Total due $3,255.00",
      ],
      pod: [
        "BILL OF LADING / PROOF OF DELIVERY",
        "Load: 40119",
        "Consignee: Peachtree Produce Terminal, Atlanta GA",
        "Pieces: 20 pallets",
        "Arrived: 04:35",
        "In: 05:00 Out: 06:40",
        "Received by: K. Abara",
        "Date: 11/12/2026",
        "Exceptions: none",
      ],
    },
  },
  {
    id: "40120",
    received: "Mon 16 Nov, 08:19",
    docs: {
      rc: rc({ load: "40120", carrier: "Harlan & Sons Trucking", mc: "9990251", pu: "11/11/2026 09:00, Memphis TN", del: "11/12/2026", appt: "08:00, Louisville KY", lane: "Memphis TN to Louisville KY", linehaul: 980, fuel: 150 }),
      inv: [
        "INVOICE 2026-114",
        "Harlan & Sons Trucking, MC 9990251",
        "Load: 40120",
        "Linehaul $980.00",
        "Fuel surcharge $150.00",
        "Total due $1,130.00",
      ],
      pod: [
        "BILL OF LADING / PROOF OF DELIVERY",
        "Load: 40120",
        "Consignee: Falls City Hardware, Louisville KY",
        "Pieces: 14 pallets",
        "Arrived: 07:48",
        "In: 08:00 Out: 09:05",
        "Received by:",
        "Date:",
        "Exceptions: none",
      ],
    },
  },
  {
    id: "40121",
    received: "Mon 16 Nov, 08:26",
    docs: {
      rc: rc({ load: "40121", carrier: "Mesa Ridge Logistics", mc: "9990318", pu: "11/11/2026 07:00, Los Angeles CA", del: "11/12/2026", appt: "13:00, El Paso TX", lane: "Los Angeles CA to El Paso TX", linehaul: 2250, fuel: 330 }),
      inv: [
        "INVOICE MRL-7781",
        "Mesa Ridge Logistics, MC 9990318",
        "Load: 40121",
        "Linehaul $2,400.00",
        "Fuel surcharge $330.00",
        "Total due $2,730.00",
      ],
      pod: [
        "BILL OF LADING / PROOF OF DELIVERY",
        "Load: 40121",
        "Consignee: Sun Valley Building Supply, El Paso TX",
        "Pieces: 24 pallets",
        "Arrived: 12:40",
        "In: 13:00 Out: 14:10",
        "Received by: M. Castillo",
        "Date: 11/12/2026",
        "Exceptions: none",
      ],
    },
  },
  {
    id: "40122",
    received: "Mon 16 Nov, 08:33",
    docs: {
      rc: rc({ load: "40122", carrier: "Lone Pine Carriers LLC", mc: "9990226", pu: "11/12/2026 10:00, Louisville KY", del: "11/13/2026", appt: "06:00, Charlotte NC", lane: "Louisville KY to Charlotte NC", linehaul: 1100, fuel: 170 }),
      inv: [
        "INVOICE 4471",
        "Lone Pine Carriers LLC, MC 9990262",
        "Load: 40122",
        "Linehaul $1,100.00",
        "Fuel surcharge $170.00",
        "Total due $1,270.00",
        "Remit to: new bank details attached",
      ],
      pod: [
        "BILL OF LADING / PROOF OF DELIVERY",
        "Load: 40122",
        "Consignee: Queen City Beverage, Charlotte NC",
        "Pieces: 22 pallets",
        "Arrived: 05:44",
        "In: 06:00 Out: 07:15",
        "Received by: T. Brooks",
        "Date: 11/13/2026",
        "Exceptions: none",
      ],
    },
  },
  {
    id: "40123",
    received: "Mon 16 Nov, 08:40",
    docs: {
      rc: rc({ load: "40123", carrier: "Kettle Creek Transport LLC", mc: "9990114", pu: "11/12/2026 06:00, Dallas TX", del: "11/12/2026", appt: "13:00, Shreveport LA", lane: "Dallas TX to Shreveport LA", linehaul: 720, fuel: 110 }),
      inv: [
        "INVOICE KCT-2240",
        "Kettle Creek Transport LLC, MC 9990114",
        "Load: 40123",
        "Linehaul $720.00",
        "Fuel surcharge $110.00",
        "Detention 1.25 hrs @ $50.00 $62.50",
        "Total due $892.50",
      ],
      pod: [
        "BILL OF LADING / PROOF OF DELIVERY",
        "Load: 40123",
        "Consignee: Red River Foods, Shreveport LA",
        "Pieces: 16 pallets",
        "Arrived: 12:51",
        "In: 13:00 Out: 16:15",
        "Received by: A. Fontenot",
        "Date: 11/12/2026",
        "Exceptions: none",
      ],
    },
  },
  {
    id: "40124",
    received: "Mon 16 Nov, 08:47",
    docs: {
      rc: rc({ load: "40124", carrier: "Two Rivers Freight LLC", mc: "9990203", pu: "11/12/2026 15:00, McAllen TX", del: "11/14/2026", appt: "04:00, Nashville TN", lane: "McAllen TX to Nashville TN", eq: "53' reefer", linehaul: 2480, fuel: 390 }),
      inv: [
        "INVOICE TRF-5541",
        "Two Rivers Freight LLC, MC 9990203",
        "Load: 40124",
        "Linehaul $2,480.00",
        "Fuel surcharge $390.00",
        "Lumper $165.00",
        "Total due $3,035.00",
      ],
      pod: [
        "BILL OF LADING / PROOF OF DELIVERY",
        "Load: 40124",
        "Consignee: Music City Fresh, Nashville TN",
        "Pieces: 20 pallets",
        "Arrived: 03:30",
        "In: 04:00 Out: 05:20",
        "Received by: S. Whitfield",
        "Date: 11/14/2026",
        "Exceptions: none",
      ],
      receipt: [
        "LUMPER RECEIPT 88213",
        "Music City Fresh unloading services",
        "Load: 40124",
        "Amount paid: $165.00",
        "Date: 11/14/2026",
      ],
    },
  },
];

// The receipt the carrier sends when the broker asks for it. "Add the receipt"
// in the page puts this in load 40119's packet.
export const lateReceipt40119 = [
  "LUMPER RECEIPT 77940",
  "Peachtree Produce Terminal unloading",
  "Load: 40119",
  "Amount paid: $185.00",
  "Date: 11/12/2026",
];
