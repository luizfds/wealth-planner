// Invented statements for the journeys (v3.203.1, item 234) — no real bank, person or amount.

// A bank CSV, the way most Australian banks export it.
export const STATEMENT_CSV = "Date,Description,Amount\n" +
  "20/10/2026,FERN CAFE SYDNEY,-12.50\n" +
  "21/10/2026,BANK ONE TRANSFER IN,500.00\n" +
  "22/10/2026,GREEN GROCER,-48.20\n";

// A one-page PDF statement, written by hand: a heading, then one line per transaction (date, what,
// amount, balance), in Helvetica — the plain text layer a bank's PDF has.
export function statementPdf(lines){
  lines = lines || [
    ["Bank One Everyday Account statement"],
    ["Date", "Description", "Debit", "Credit", "Balance"],
    ["01 Oct 2026", "Opening balance", "", "", "2,000.00"],
    ["03 Oct 2026", "FERN CAFE", "18.40", "", "1,981.60"],
    ["09 Oct 2026", "CITY WATER", "92.15", "", "1,889.45"],
    ["15 Oct 2026", "EMPLOYER A PAY", "", "1,250.00", "3,139.45"],
    ["20 Oct 2026", "GREEN GROCER", "61.30", "", "3,078.15"]
  ];
  const cols = [50, 140, 330, 410, 490];
  let y = 760, text = "BT /F1 10 Tf\n";
  lines.forEach(function(row){
    row.forEach(function(cell, i){ if(cell) text += "1 0 0 1 " + cols[i] + " " + y + " Tm (" + String(cell).replace(/[()\\]/g, "") + ") Tj\n"; });
    y -= 18;
  });
  text += "ET";
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + text.length + " >>\nstream\n" + text + "\nendstream"
  ];
  let pdf = "%PDF-1.4\n", offsets = [];
  objs.forEach(function(o, i){ offsets.push(pdf.length); pdf += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
  const xref = pdf.length;
  pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offsets.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
  return Buffer.from(pdf, "latin1");
}

// v3.208.0 (item 240): a property manager's monthly statement — Money Out / Money In columns, rent in, the agency's
// fee out, what reached the owner. Invented: no real agency, property or amount.
export function agentStatementPdf(){
  return statementPdf([
    ["Example Realty — owner statement"],
    ["31 Oct 2026"],
    ["Property: 1 Example St"],
    ["Details", "", "Money Out", "Money In"],
    ["Rent paid to 24/10/2026", "", "", "1,200.00"],
    ["Management Fee", "", "84.00", ""],
    ["You Received", "", "", "", "1,116.00"]
  ]);
}
