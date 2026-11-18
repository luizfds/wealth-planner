import { escapeAttr } from "../lib/html.js";

// Navigation only. File selection, parsing and confirmation remain owned by each tool.
export function importChoices(context){
  var c = context || {};
  return [
    // #411: the one reader that works out what a statement is — bank or loan, a property manager's or a payslip PDF — and
    // hands each to its own review. The two choices below go straight to the property and payslip tools.
    { key: "bank", group: "Statements", label: "Any statement file", description: "Bank or loan (CSV, PDF, OFX, QFX or QIF), a property manager's statement or a payslip PDF → Money → Transactions, which works out which it is and opens its review.", page: "expenses", sub: "spending", target: "#bankImportPickBtn" },
    { key: "property", group: "Statements", label: "Property manager statement", description: c.properties ? "PDF → the named investment property, or choose its property after reading." : "Add an investment property first, then bring in its statement PDF.", page: c.properties ? "expenses" : "properties", sub: c.properties ? "spending" : null, target: c.properties ? "#bankImportPickBtn" : "#addPropertyBtn" },
    { key: "payslip", group: "Statements", label: "Payslip", description: c.people ? "PDF → Tax → This year. Pick the person's payslip check. Review the figures before saving, with Undo." : "Add a person in Tax → People first, then read their payslip PDF.", page: "tax", sub: c.people ? "year" : "people", target: c.people ? ".tax-ytd summary" : "#addPersonBtn" },
    { key: "trades", group: "Investments", label: "Broker trades", description: "CSV, Excel or pasted CSV → Investments → Shares. Review buys, sells and matching holdings.", page: "assets", sub: "Shares", tool: "trades", target: "[data-tr-text]" },
    { key: "prices", group: "Investments", label: "Prices and Google Sheet", description: c.shares ? "Pasted Symbol/Price columns or a Google Sheet → existing share holdings. Choose the price source in Prices." : "Add a share holding first, then update its prices from a paste or Google Sheet.", page: "assets", sub: "Shares", tool: c.shares ? "prices" : null, target: c.shares ? "[data-ps-panel] > summary" : '[data-add="holding"]' },
    { key: "budget", group: "Spreadsheet rows", label: "Budget lines", description: "Template CSV → Money → Budget. Adds planned expenses after preview; use a bank statement for actual spending.", page: "expenses", sub: "budget", target: "#expenseImportBtn" },
    { key: "income", group: "Spreadsheet rows", label: "Income lines", description: "Template CSV → Money → Budget → Money in. Adds income plans after preview; use a payslip to check pay and tax.", page: "expenses", sub: "income", target: "#incomeImportBtn" },
    { key: "assets", group: "Spreadsheet rows", label: "Asset balances", description: "Template CSV → Investments. Adds asset rows after preview; use Broker trades for buys and sells.", page: "assets", sub: "summary", target: "#assetsImportBtn" },
    { key: "restore", group: "Replace this household", label: "Restore a backup", description: "Wealth Planner backup file → Settings → Preferences. Replaces household data after the existing confirmation. Export a backup first if you need to keep this household.", page: "settings", sub: "preferences", target: '[data-sk="file-open"]' }
  ];
}

export function importChooserHtml(context){
  var group = "";
  return '<h2 id="importChooserTitle">Import data</h2><p id="importChooserHelp">Choose what you want to bring in. The next screen opens its tool; no file is read here.</p>' +
    importChoices(context).map(function(choice){
      var heading = choice.group !== group ? '<h3 class="import-chooser-heading">' + escapeAttr(choice.group) + '</h3>' : '';
      group = choice.group;
      return heading + '<button type="button" class="import-choice" data-import-choice="' + escapeAttr(choice.key) + '"><span class="import-choice-label">' + escapeAttr(choice.label) + '</span><span class="import-choice-description">' + escapeAttr(choice.description) + '</span></button>';
    }).join("") + '<div class="app-dialog-actions"><button type="button" class="btn btn-ghost" data-import-close>Cancel</button></div>';
}
