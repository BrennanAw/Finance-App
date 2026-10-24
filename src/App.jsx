import { useState, useEffect, useRef, useMemo } from "react";
import { storage } from "./storage.js";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Legend, BarChart
} from "recharts";
import {
  Plus, Minus, Trash2, TrendingUp, TrendingDown, Wallet, ChevronDown,
  LayoutDashboard, List, PiggyBank, Repeat, Users, Zap, Power,
  CalendarDays, ChevronLeft, ChevronRight, Target, BarChart3, Sparkles,
  Landmark, Banknote, CreditCard, CircleDollarSign, HandCoins, Pencil, Check,
  Moon, Sun, Palette, ArrowRightLeft, Menu, X, SlidersHorizontal, Tag, Upload
} from "lucide-react";

/* ---------- design tokens ---------- */

const SHADOW = "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)";
const DEFAULT_THEME = { mode: "light", accent: "#749961", secondaryAccent: "#3B82F6" };
const ACCENT_PRESETS = ["#749961", "#3B82F6", "#8B5CF6", "#F43F5E", "#F59E0B", "#14B8A6", "#6366F1", "#EC4899"];

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
}
function shade(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}
function withAlpha(hex, alphaHex) {
  return hex + alphaHex;
}

function buildPalette(mode, accent, secondaryAccent) {
  const isDark = mode === "dark";
  const base = isDark
    ? { bg: "#0F1115", card: "#181B21", border: "#272B33", text: "#F3F4F6", muted: "#9199A8", mutedLight: "#5B6270" }
    : { bg: "#F4F5F7", card: "#FFFFFF", border: "#E5E7EB", text: "#111827", muted: "#6B7280", mutedLight: "#9CA3AF" };

  const tint = (hex) => isDark ? withAlpha(hex, "29") : shade(hex, 0.87);

  return {
    ...base,
    orange: accent,
    orangeDark: shade(accent, -0.18),
    orangeLight: tint(accent),
    green: "#16A34A", greenLight: tint("#16A34A"),
    rose: "#EF4444", roseLight: tint("#EF4444"),
    amber: "#F59E0B", amberLight: tint("#F59E0B"),
    blue: secondaryAccent, blueLight: tint(secondaryAccent),
    purple: "#8B5CF6", purpleLight: tint("#8B5CF6"),
  };
}

let COLORS = buildPalette(DEFAULT_THEME.mode, DEFAULT_THEME.accent, DEFAULT_THEME.secondaryAccent);

/* ---------- constants ---------- */

const CATS_EXPENSE = ["Food", "Groceries", "Transport", "Rent", "Bills", "Shopping", "Health", "Entertainment", "Other"];
const CATS_INCOME = ["Salary", "Freelance", "Gift", "Investment", "Other"];
const CAT_COLORS = {
  Food: "#FF7A3D", Groceries: "#FBBF24", Transport: "#3B82F6", Rent: "#8B5CF6",
  Bills: "#F43F5E", Shopping: "#EC4899", Health: "#14B8A6", Entertainment: "#6366F1", Other: "#94A3B8",
  Salary: "#16A34A", Freelance: "#06B6D4", Gift: "#F472B6", Investment: "#FACC15"
};
// Curated swatches offered in the category color picker (Settings).
const CATEGORY_COLOR_PRESETS = [
  "#FF7A3D", "#FBBF24", "#3B82F6", "#8B5CF6", "#F43F5E", "#EC4899", "#14B8A6", "#6366F1",
  "#94A3B8", "#16A34A", "#06B6D4", "#F472B6", "#FACC15", "#DC2626", "#22C55E", "#0EA5E9"
];
// User-chosen category color overrides, keyed by category name. Kept as a
// mutable module-level object (mirroring how COLORS holds the live theme)
// so every component that calls catColor() sees the latest picks without
// threading them through props. Synced from data.categoryColors on render.
let CATEGORY_COLOR_OVERRIDES = {};
const QUICK_ADD_DEFAULTS = [
  { id: "qa1", label: "Grab Ride", amount: 12, category: "Transport" },
  { id: "qa2", label: "Kopitiam", amount: 8, category: "Food" },
  { id: "qa3", label: "Coffee", amount: 6, category: "Food" },
  { id: "qa4", label: "Groceries", amount: 50, category: "Groceries" },
  { id: "qa5", label: "Petrol", amount: 40, category: "Transport" },
  { id: "qa6", label: "Lunch", amount: 15, category: "Food" },
  { id: "qa7", label: "Parking", amount: 3, category: "Transport" },
  { id: "qa8", label: "Streaming", amount: 45, category: "Entertainment" },
];
const STORAGE_KEY = "finance-app-data";
const PERIOD_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const BUDGET_PERIODS = ["daily", "weekly", "monthly"];
// Which budget periods a transaction is left out of. Older entries only have the
// excludeFromBudget flag (no period list), which has always meant "all of them".
function excludedPeriodsOf(e) {
  if (!e.excludeFromBudget) return [];
  return Array.isArray(e.excludedPeriods) && e.excludedPeriods.length ? e.excludedPeriods : BUDGET_PERIODS;
}
function isExcludedFrom(e, periodType) { return excludedPeriodsOf(e).includes(periodType); }
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACCOUNT_TYPES = [
  { id: "bank", label: "Bank", icon: Landmark, color: "#3B82F6" },
  { id: "ewallet", label: "E-Wallet", icon: Wallet, color: "#FF7A3D" },
  { id: "cash", label: "Cash", icon: Banknote, color: "#16A34A" },
  { id: "savings", label: "Savings", icon: PiggyBank, color: "#8B5CF6" },
  { id: "credit", label: "Credit Card", icon: CreditCard, color: "#F43F5E" },
  { id: "investment", label: "Investment", icon: TrendingUp, color: "#14B8A6" },
  { id: "loan", label: "Loan", icon: HandCoins, color: "#DC2626" },
  { id: "other", label: "Other", icon: CircleDollarSign, color: "#94A3B8" },
];

/* ---------- helpers ---------- */

const fmt = (n) => `RM ${Number(n || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);
const monthKey = (dateStr) => dateStr.slice(0, 7);
const thisMonthKey = () => todayISO().slice(0, 7);
const monthLabel = (mk) => new Date(mk + "-02").toLocaleDateString("en-MY", { month: "long", year: "numeric" });
const daysInMonth = (year, month1to12) => new Date(year, month1to12, 0).getDate();

// Word → category guesses for the quick-entry parser and CSV import. Keys are
// category names; a match anywhere (case-insensitive) in the free-text note
// picks that category, unless the text already names an existing category or
// quick add directly.
const CATEGORY_KEYWORDS = {
  Food: ["food", "lunch", "dinner", "breakfast", "brunch", "eat", "restaurant", "kopitiam", "meal", "snack", "cafe", "coffee", "makan", "mamak"],
  Groceries: ["grocery", "groceries", "mart", "supermarket", "market", "tesco", "giant", "lotus", "jaya grocer", "aeon"],
  Transport: ["grab", "taxi", "lrt", "mrt", "bus", "train", "petrol", "fuel", "parking", "transport", "ride", "toll", "touch n go", "gojek"],
  Rent: ["rent", "rental"],
  Bills: ["bill", "bills", "electricity", "water bill", "wifi", "phone bill", "internet", "utility", "utilities", "astro", "unifi"],
  Shopping: ["shop", "shopping", "clothes", "shoes", "mall", "shopee", "lazada", "amazon"],
  Health: ["doctor", "clinic", "pharmacy", "medicine", "health", "hospital", "dentist", "guardian", "watsons"],
  Entertainment: ["movie", "netflix", "spotify", "game", "cinema", "concert", "entertainment", "gsc", "tgv", "steam"],
  Salary: ["salary", "payslip", "payroll", "wages"],
  Freelance: ["freelance", "gig", "project", "client", "invoice"],
  Gift: ["gift", "present", "angpau", "ang pau", "duit raya"],
  Investment: ["dividend", "invest", "investment", "stock", "crypto", "unit trust"],
};

// Parses a shorthand line like "20 lunch", "grab 12", or "+500 salary" into a
// ready-to-log entry. Returns null if no amount could be found. Prefixing
// with "+", or the text matching an income-ish keyword, logs it as income.
// Formats free-typed digits as currency-style cents entry, the way a POS
// terminal does: typing "1250" yields "12.50" without needing to type a
// decimal point. Non-digit characters (including any "." the user types)
// are ignored; the last two digits typed are always the cents.
function formatCentsInput(raw) {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toFixed(2);
}

function parseQuickEntry(text, categories, quickAdds) {
  const raw = (text || "").trim();
  if (!raw) return null;
  const amountMatch = raw.match(/\d+(?:\.\d{1,2})?/);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[0]);
  if (!amount || amount <= 0) return null;

  let rest = (raw.slice(0, amountMatch.index) + " " + raw.slice(amountMatch.index + amountMatch[0].length))
    .replace(/^[+-]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  const isIncome = raw.trim().startsWith("+") || /\b(income|got paid|received|payout)\b/i.test(rest);
  const type = isIncome ? "income" : "expense";
  const catList = type === "income" ? categories.income : categories.expense;
  const lower = rest.toLowerCase();

  const quickMatch = rest && quickAdds.find((q) => q.label && lower.includes(q.label.toLowerCase()));
  let category = catList.find((c) => c !== "Other" && lower.includes(c.toLowerCase()));
  if (!category) {
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (catList.includes(cat) && keywords.some((k) => lower.includes(k))) { category = cat; break; }
    }
  }
  if (!category && quickMatch) category = quickMatch.category;
  if (!category) category = "Other";

  return { type, amount, category, note: rest || category, accountId: quickMatch ? quickMatch.accountId || null : null };
}

// ---- CSV bank-statement import ----
// Parses raw CSV text into rows of string arrays, honoring quoted fields
// (including embedded commas and escaped "" quotes).
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") pushField();
      else if (c === "\n") { if (field !== "" || row.length) pushRow(); }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field !== "" || row.length) pushRow();
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// Finds the column index whose header best matches one of the given
// keywords (exact match first, then substring match).
function guessColumnIndex(headers, keywords) {
  const lower = headers.map((h) => (h || "").toLowerCase().trim());
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h === kw);
    if (idx !== -1) return idx;
  }
  for (const kw of keywords) {
    const idx = lower.findIndex((h) => h.includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Parses common bank date formats (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY,
// DD-MM-YYYY, "12 Jan 2026") into an ISO yyyy-mm-dd string, or null.
function parseDate(raw) {
  const s = (raw || "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = (Number(y) < 70 ? "20" : "19") + y;
    let day = Number(a), month = Number(b);
    if (month > 12 && day <= 12) { [day, month] = [month, day]; }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return isoOf(d);
  return null;
}

// Bank statements often wrap each transaction's description across several
// lines and pad it with a generic, repeated transaction-type label (e.g.
// "SALE DEBIT", "IBK FUND TFR FR A/C", "DUITNOW QR") rather than putting the
// merchant/payee name front and center. These helpers dig the actual name
// out from that noise instead of importing the generic label as the note.
const STATEMENT_NOISE_LINES = [
  "sale debit", "sale credit", "pos debit", "pos credit", "pos purchase", "purchase",
  "debit advice", "credit advice", "cash withdrawal", "cash deposit", "cheque deposit",
  "atm withdrawal", "interbank giro", "ibg fund transfer", "duitnow transfer",
  "duitnow qr", "duitnow qr-", "online transfer", "instant transfer", "fpx payment",
  "standing instruction", "salary credit", "interest credit", "service charge", "bill payment",
];
const STATEMENT_NOISE_PREFIXES = ["ibk fund tfr", "duitnow qr", "fpx ", "ibg "];

function isStatementNoiseLine(line) {
  const norm = line.toLowerCase().replace(/[-*]+$/, "").trim();
  if (!norm) return true;
  if (STATEMENT_NOISE_LINES.includes(norm)) return true;
  if (STATEMENT_NOISE_PREFIXES.some((p) => norm.startsWith(p))) return true;
  return false;
}

// Picks the merchant/payee name out of a transaction's description lines.
// Many banks mark the card-acceptor or payee name with a trailing "*" —
// that line wins when present. Otherwise, the first line that isn't a
// recognized generic type label (see above) is used. Returns "" if every
// line looks like noise, so the caller can fall back to its own default.
function extractMerchantLine(candidateLines) {
  const lines = candidateLines.map((l) => l.trim()).filter(Boolean);
  const starred = lines.find((l) => /\*\s*$/.test(l));
  if (starred) return starred.replace(/\*\s*$/, "").trim();
  const content = lines.find((l) => !isStatementNoiseLine(l));
  return content ? content.trim() : "";
}

// Converts parsed CSV rows (first row = header) into ready-to-import entry
// drafts. Handles either a single signed "Amount" column or separate
// Debit/Credit columns. Returns [] if it can't find date/amount columns.
function parseCsvToEntries(rows, categories, quickAdds) {
  if (!rows.length) return [];
  const [header, ...body] = rows;
  const dateIdx = guessColumnIndex(header, ["date", "transaction date", "posting date", "value date"]);
  const descIdx = guessColumnIndex(header, ["description", "narrative", "details", "particulars", "remarks", "memo"]);
  const amountIdx = guessColumnIndex(header, ["amount", "value"]);
  const debitIdx = guessColumnIndex(header, ["debit", "withdrawal", "money out", "paid out"]);
  const creditIdx = guessColumnIndex(header, ["credit", "deposit", "money in", "paid in"]);
  if (dateIdx === -1 || (amountIdx === -1 && debitIdx === -1 && creditIdx === -1)) return [];

  return body.map((cols) => {
    const date = parseDate(cols[dateIdx]);
    // A description cell can be a single line ("MUJI - IOI MALL PUC") or,
    // when a statement is exported with its original multi-line layout
    // intact, several lines mixing a generic type label with the actual
    // merchant name — pull the merchant out rather than using it as-is.
    const rawDesc = descIdx !== -1 ? (cols[descIdx] || "").trim() : "";
    const descLines = rawDesc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const desc = descLines.length > 1 ? (extractMerchantLine(descLines) || descLines[0]) : rawDesc;
    let amount = 0, type = "expense";
    if (amountIdx !== -1) {
      const rawAmount = (cols[amountIdx] || "").trim();
      // Some statements sign the amount with a trailing "+"/"-" (e.g.
      // "72.60-") rather than (or in addition to) a leading one — check
      // both ends before falling back to plain magnitude.
      const trailingSign = /-\s*$/.test(rawAmount) ? "-" : /\+\s*$/.test(rawAmount) ? "+" : null;
      const leadingNegative = /^\s*-/.test(rawAmount);
      amount = parseFloat(rawAmount.replace(/[^0-9.]/g, "")) || 0;
      type = (trailingSign === "-" || leadingNegative) ? "expense" : trailingSign === "+" ? "income" : (amount < 0 ? "expense" : "income");
      amount = Math.abs(amount);
    } else {
      const debit = parseFloat((cols[debitIdx] || "").replace(/[^0-9.\-]/g, "")) || 0;
      const credit = parseFloat((cols[creditIdx] || "").replace(/[^0-9.\-]/g, "")) || 0;
      if (credit > 0) { amount = credit; type = "income"; }
      else { amount = debit; type = "expense"; }
    }
    if (!date || !amount) return null;

    const catList = type === "income" ? categories.income : categories.expense;
    const lower = desc.toLowerCase();
    const quickMatch = lower && quickAdds.find((q) => q.label && lower.includes(q.label.toLowerCase()));
    let category = catList.find((c) => c !== "Other" && lower.includes(c.toLowerCase()));
    if (!category) {
      for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (catList.includes(cat) && keywords.some((k) => lower.includes(k))) { category = cat; break; }
      }
    }
    if (!category && quickMatch) category = quickMatch.category;
    if (!category) category = "Other";

    return { date, type, amount, category, note: desc || category, include: true };
  }).filter(Boolean);
}

// ---- PDF bank-statement import ----
// Extracts text from a PDF, page by page, grouping text fragments into
// lines by their vertical position so words on the same row stay together
// (pdf.js reports text as many small positioned fragments, not lines).
async function extractPdfText(file) {
  const pdfjsLib = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const rows = new Map();
    content.items.forEach((item) => {
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push(item);
    });
    const sortedYs = [...rows.keys()].sort((a, b) => b - a);
    sortedYs.forEach((y) => {
      const rowItems = rows.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      lines.push(rowItems.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim());
    });
  }
  return lines.filter((l) => l);
}

// Parses lines of extracted bank-statement text into ready-to-import entry
// drafts. Best-effort: looks for a leading date on each line, then the
// first money-like number after it as the amount (a further number, such
// as a running balance, is ignored). A statement often wraps the rest of
// that transaction's detail — the actual merchant name, its location, a
// repeated type label — across the following lines rather than fitting it
// all on the dated line, so those are scanned too and the merchant/payee
// name (see extractMerchantLine) wins over a generic type label like "SALE
// DEBIT". Works well for plain-text statement layouts; less reliably for
// unusual column layouts, and not at all for scanned/image PDFs.
function parseStatementLines(lines, categories, quickAdds) {
  const dateAtStart = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\b/;
  const moneyToken = /-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(DR|CR)?\b/gi;

  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateAtStart);
    if (!dateMatch) continue;
    const date = parseDate(dateMatch[1]);
    if (!date) continue;

    const rest = line.slice(dateMatch[0].length).trim();
    const numbers = [...rest.matchAll(moneyToken)].filter((m) => m[0].replace(/[^0-9.]/g, "").length > 0);
    if (!numbers.length) continue;

    const first = numbers[0];
    const inlineDesc = rest.slice(0, first.index).replace(/[\s,.\-|]+$/, "").trim();
    const amountStr = first[0].replace(/,/g, "").trim();
    const isCr = /DR$/i.test(amountStr) ? false : /CR$/i.test(amountStr);
    const isDr = /DR$/i.test(amountStr);
    const explicitNegative = /^-/.test(amountStr);
    // Some statements sign the amount with a trailing "+"/"-" straight
    // after the number (e.g. "72.60-", "137.50+") instead of a leading one.
    const afterNumber = rest.slice(first.index + first[0].length);
    const trailingSignMatch = afterNumber.match(/^\s*([+-])/);
    const trailingSign = trailingSignMatch ? trailingSignMatch[1] : null;
    const amount = Math.abs(parseFloat(amountStr.replace(/[^0-9.\-]/g, "")) || 0);
    if (!amount) continue;

    // The actual merchant/payee name usually lives on the lines that follow
    // the dated line, up until the next transaction's date — not in the
    // generic type label caught above.
    const extraLines = [];
    for (let j = i + 1; j < lines.length && !dateAtStart.test(lines[j]); j++) extraLines.push(lines[j]);
    const merchant = extractMerchantLine([inlineDesc, ...extraLines]);
    const desc = merchant || inlineDesc;

    const lower = (desc + " " + inlineDesc + " " + line).toLowerCase();
    let type;
    if (explicitNegative || isDr || trailingSign === "-") type = "expense";
    else if (isCr || trailingSign === "+") type = "income";
    else type = /\b(credit|salary|deposit|refund|received|payout|incoming transfer)\b/.test(lower) ? "income" : "expense";

    const catList = type === "income" ? categories.income : categories.expense;
    const lowerDesc = desc.toLowerCase();
    const quickMatch = lowerDesc && quickAdds.find((q) => q.label && lowerDesc.includes(q.label.toLowerCase()));
    let category = catList.find((c) => c !== "Other" && lowerDesc.includes(c.toLowerCase()));
    if (!category) {
      for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (catList.includes(cat) && keywords.some((k) => lowerDesc.includes(k))) { category = cat; break; }
      }
    }
    if (!category && quickMatch) category = quickMatch.category;
    if (!category) category = "Other";

    results.push({ date, type, amount, category, note: desc || category, include: true });
  }
  return results;
}

const parseLocal = (dateStr) => new Date(dateStr + "T00:00:00");
const isoOf = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const getMonday = (d) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
};
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const addMonths = (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };

function periodRange(periodType, anchor) {
  if (periodType === "daily") {
    const iso = isoOf(anchor);
    return { start: iso, end: iso, label: anchor.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) };
  }
  if (periodType === "weekly") {
    const mon = getMonday(anchor);
    const sun = addDays(mon, 6);
    const sameMonth = mon.getMonth() === sun.getMonth();
    const label = sameMonth
      ? `${mon.toLocaleDateString("en-MY", { day: "numeric" })}–${sun.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}`
      : `${mon.toLocaleDateString("en-MY", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}`;
    return { start: isoOf(mon), end: isoOf(sun), label };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: isoOf(first), end: isoOf(last), label: anchor.toLocaleDateString("en-MY", { month: "long", year: "numeric" }) };
}
function shiftAnchor(periodType, anchor, dir) {
  if (periodType === "daily") return addDays(anchor, dir);
  if (periodType === "weekly") return addDays(anchor, dir * 7);
  return addMonths(anchor, dir);
}
// Renders a start/end ISO date pair as a compact human range, e.g.
// "1 Sep 2026" for a single day, "1 – 7 Sep 2026" within a month, or
// "28 Sep – 4 Oct 2026" spanning two months. Used to show budget periods'
// exact dates rather than just their period name.
function formatDateRange(startIso, endIso) {
  const s = parseLocal(startIso), e = parseLocal(endIso);
  if (startIso === endIso) return s.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  return sameMonth
    ? `${s.toLocaleDateString("en-MY", { day: "numeric" })} – ${e.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}`
    : `${s.toLocaleDateString("en-MY", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}`;
}
function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function relDateLabel(dateStr) {
  if (dateStr === todayISO()) return "Today";
  const y = addDays(new Date(), -1);
  if (dateStr === isoOf(y)) return "Yesterday";
  const opts = { day: "numeric", month: "short" };
  if (monthKey(dateStr) !== thisMonthKey()) opts.year = "numeric";
  return parseLocal(dateStr).toLocaleDateString("en-MY", opts);
}
function buildTrend(entries, granularity, anchor, count) {
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    let a;
    if (granularity === "daily") a = addDays(anchor, -i);
    else if (granularity === "weekly") a = addDays(anchor, -i * 7);
    else a = addMonths(anchor, -i);
    const r = periodRange(granularity, a);
    const label = granularity === "daily" ? a.toLocaleDateString("en-MY", { day: "numeric", month: "short" })
      : granularity === "weekly" ? getMonday(a).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
      : a.toLocaleDateString("en-MY", { month: "short" });
    const bucketEntries = entries.filter((e) => e.date >= r.start && e.date <= r.end);
    const income = bucketEntries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = bucketEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    buckets.push({ label, income, expense, net: income - expense });
  }
  return buckets;
}
function nextRecurringDate(r, from) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  if (r.frequency === "weekly") {
    const diff = (r.day - d.getDay() + 7) % 7;
    return addDays(d, diff);
  }
  const dim = daysInMonth(d.getFullYear(), d.getMonth() + 1);
  const runDay = Math.min(r.day, dim);
  if (d.getDate() <= runDay) return new Date(d.getFullYear(), d.getMonth(), runDay);
  const next = addMonths(new Date(d.getFullYear(), d.getMonth(), 1), 1);
  const dim2 = daysInMonth(next.getFullYear(), next.getMonth() + 1);
  return new Date(next.getFullYear(), next.getMonth(), Math.min(r.day, dim2));
}
function hashColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const palette = ["#3B82F6", "#16A34A", "#8B5CF6", "#F43F5E", "#14B8A6", "#FBBF24", "#EC4899", "#6366F1", "#DC2626", "#06B6D4"];
  return palette[hash % palette.length];
}
function catColor(name) {
  return CATEGORY_COLOR_OVERRIDES[name] || CAT_COLORS[name] || hashColor(name);
}

/* ---------- category groups (parents) ----------
   Each type (expense/income) can have "parent" categories that bundle related
   categories together. Transactions still store their own (sub-)category; the
   parent is derived through map[subCategory] = parentName. Parent names are
   kept distinct from category names so a budget keyed by a name is never
   ambiguous: a budget on a parent covers all of its sub-categories. */
const EMPTY_GROUPS = { expense: { parents: [], map: {} }, income: { parents: [], map: {} } };
let CATEGORY_GROUPS_LIVE = EMPTY_GROUPS;
const SUGGESTED_GROUPS = {
  expense: [
    { name: "Food & Drink", members: ["Food", "Groceries"] },
    { name: "Home & Bills", members: ["Rent", "Bills"] },
    { name: "Lifestyle", members: ["Shopping", "Entertainment"] },
  ],
  income: [
    { name: "Work Income", members: ["Salary", "Freelance"] },
  ],
};
function normalizeCategoryGroups(raw) {
  const out = { expense: { parents: [], map: {} }, income: { parents: [], map: {} } };
  ["expense", "income"].forEach((t) => {
    const g = raw && raw[t];
    if (!g) return;
    out[t].parents = Array.isArray(g.parents) ? [...g.parents] : [];
    out[t].map = g.map && typeof g.map === "object" ? { ...g.map } : {};
  });
  return out;
}
function parentOf(groups, type, name) {
  return (groups && groups[type] && groups[type].map[name]) || null;
}
function isParentName(groups, type, name) {
  return !!(groups && groups[type] && groups[type].parents.includes(name));
}
function childrenOf(groups, type, parent) {
  if (!groups || !groups[type]) return [];
  return Object.entries(groups[type].map).filter(([, p]) => p === parent).map(([c]) => c);
}
// Category names a budget/filter on `name` covers: a parent -> all its
// sub-categories, anything else -> just itself.
function categoryScope(groups, type, name) {
  return isParentName(groups, type, name) ? childrenOf(groups, type, name) : [name];
}
// Proposed groupings for categories that exist and aren't grouped yet.
function suggestGroups(categories, groups) {
  const out = [];
  ["expense", "income"].forEach((type) => {
    const existing = categories[type] || [];
    const g = (groups && groups[type]) || { parents: [], map: {} };
    SUGGESTED_GROUPS[type].forEach((s) => {
      const lower = s.name.toLowerCase();
      if (g.parents.some((p) => p.toLowerCase() === lower) || existing.some((x) => x.toLowerCase() === lower)) return;
      const members = s.members.filter((m) => existing.includes(m) && !g.map[m]);
      if (members.length >= 2) out.push({ type, name: s.name, members });
    });
  });
  return out;
}

function emptyData() {
  return {
    entries: [], budgets: { expense: {}, income: {} }, recurring: [], masterBudgets: { expense: {}, income: {} }, accounts: [], quickAdds: QUICK_ADD_DEFAULTS,
    categories: { expense: [...CATS_EXPENSE], income: [...CATS_INCOME] },
    categoryColors: {},
    categoryGroups: normalizeCategoryGroups(null),
    categoryGroupsPrompted: false,
    theme: { ...DEFAULT_THEME },
    profile: { name: "" }
  };
}
// Budgets (and master budgets) can apply to expense categories (a spending
// ceiling) or income categories (an earning goal). Older saved data stored a
// single flat map, assumed to be expense budgets, before income budgets
// existed — detect and upgrade that shape on load.
function normalizeBudgetGroup(raw) {
  const out = {};
  Object.entries(raw || {}).forEach(([cat, val]) => {
    out[cat] = typeof val === "number" ? { monthly: val } : val;
  });
  return out;
}
function normalizeBudgets(raw) {
  if (raw && (raw.expense || raw.income)) {
    return { expense: normalizeBudgetGroup(raw.expense), income: normalizeBudgetGroup(raw.income) };
  }
  return { expense: normalizeBudgetGroup(raw), income: {} };
}
function normalizeMasterBudgets(raw) {
  if (raw && (raw.expense || raw.income)) {
    return { expense: { ...(raw.expense || {}) }, income: { ...(raw.income || {}) } };
  }
  return { expense: { ...(raw || {}) }, income: {} };
}

/* ---------- root component ---------- */

export default function FinanceTracker() {
  const [data, setData] = useState(emptyData());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [preset, setPreset] = useState({ type: null, token: 0 });
  const [ledgerPreset, setLedgerPreset] = useState({ period: null, category: null, token: 0 });
  const [openGroup, setOpenGroup] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef({});

  const pushToast = (message, type = "success", Icon = Check) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, message, type, Icon, leaving: false }]);
    toastTimers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t));
      toastTimers.current[id] = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete toastTimers.current[id];
      }, 220);
    }, 3000);
  };
  const dismissToast = (id) => {
    if (toastTimers.current[id]) { clearTimeout(toastTimers.current[id]); delete toastTimers.current[id]; }
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 220);
  };
  useEffect(() => () => { Object.values(toastTimers.current).forEach(clearTimeout); }, []);

  // Start each tab at the top of the page rather than wherever the previous tab
  // happened to be scrolled to (e.g. after clicking "View all" from partway down the dashboard).
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [tab]);
  const generatedRef = useRef(false);
  const navRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get(STORAGE_KEY);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setData({
            entries: parsed.entries || [],
            budgets: normalizeBudgets(parsed.budgets),
            recurring: parsed.recurring || [],
            masterBudgets: normalizeMasterBudgets(parsed.masterBudgets),
            accounts: parsed.accounts || [],
            quickAdds: parsed.quickAdds || QUICK_ADD_DEFAULTS,
            categories: parsed.categories || { expense: [...CATS_EXPENSE], income: [...CATS_INCOME] },
            categoryColors: parsed.categoryColors || {},
            categoryGroups: normalizeCategoryGroups(parsed.categoryGroups),
            categoryGroupsPrompted: !!parsed.categoryGroupsPrompted,
            theme: { ...DEFAULT_THEME, ...(parsed.theme || {}) },
            profile: parsed.profile || { name: "" }
          });
        }
      } catch (e) { /* nothing saved yet */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    storage.set(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, loaded]);

  useEffect(() => {
    function onDocClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenGroup(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!loaded || generatedRef.current) return;
    generatedRef.current = true;
    setData((prev) => {
      if (!prev.recurring.length) return prev;
      const today = new Date();
      const cmk = thisMonthKey();
      const wk = isoOf(getMonday(today));
      const newEntries = [];
      const updatedRecurring = prev.recurring.map((r) => {
        if (!r.active) return r;
        if (r.frequency === "weekly") {
          if (r.lastRun === wk) return r;
          const occurrenceDate = addDays(getMonday(today), (r.day + 6) % 7);
          if (today >= occurrenceDate) {
            newEntries.push({
              id: uid(), createdAt: Date.now(), type: r.type, amount: r.amount,
              category: r.category, categoryLabel: r.categoryLabel || "", note: r.name, date: isoOf(occurrenceDate), recurring: true, accountId: r.accountId || null
            });
            return { ...r, lastRun: wk };
          }
          return r;
        }
        if (r.lastRun === cmk) return r;
        const dim = daysInMonth(today.getFullYear(), today.getMonth() + 1);
        const runDay = Math.min(r.day, dim);
        if (today.getDate() >= runDay) {
          const dateStr = `${cmk}-${String(runDay).padStart(2, "0")}`;
          newEntries.push({
            id: uid(), createdAt: Date.now(), type: r.type, amount: r.amount,
            category: r.category, categoryLabel: r.categoryLabel || "", note: r.name, date: dateStr, recurring: true, accountId: r.accountId || null
          });
          return { ...r, lastRun: cmk };
        }
        return r;
      });
      if (!newEntries.length) return prev;
      return { ...prev, entries: [...prev.entries, ...newEntries], recurring: updatedRecurring };
    });
  }, [loaded]);

  const addEntry = (entry) => {
    setData((prev) => ({ ...prev, entries: [...prev.entries, { id: uid(), createdAt: Date.now(), ...entry }] }));
    if (entry.type === "transfer") {
      const fromName = data.accounts.find((a) => a.id === entry.fromAccountId)?.name || "account";
      const toName = data.accounts.find((a) => a.id === entry.toAccountId)?.name || "account";
      pushToast(`Transferred ${fmt(entry.amount)} — ${fromName} → ${toName}`, "info", ArrowRightLeft);
      return;
    }
    const label = entry.categoryLabel || entry.note || entry.category;
    if (entry.type === "income") pushToast(`Income added — ${fmt(entry.amount)}${label ? " · " + label : ""}`, "success", TrendingUp);
    else pushToast(`Expense added — ${fmt(entry.amount)}${label ? " · " + label : ""}`, "info", TrendingDown);
  };
  const removeEntry = (id) => {
    setData((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
    pushToast("Transaction deleted", "danger", Trash2);
  };
  const updateEntry = (id, patch) => {
    setData((prev) => ({ ...prev, entries: prev.entries.map((e) => e.id === id ? { ...e, ...patch } : e) }));
    pushToast("Transaction updated", "info", Pencil);
  };
  const bulkAddEntries = (newEntries) => {
    if (!newEntries || !newEntries.length) return;
    setData((prev) => ({
      ...prev,
      entries: [...prev.entries, ...newEntries.map((entry) => ({ id: uid(), createdAt: Date.now(), ...entry }))],
    }));
    pushToast(`Imported ${newEntries.length} transaction${newEntries.length === 1 ? "" : "s"}`, "success", Upload);
  };

  const setDebtSettled = (entryId, debtId, settled) => {
    setData((prev) => ({
      ...prev,
      entries: prev.entries.map((e) => e.id === entryId
        ? { ...e, debts: (e.debts || []).map((d) => d.id === debtId ? { ...d, settled } : d) }
        : e)
    }));
    pushToast(settled ? "Marked as paid" : "Marked as unpaid", settled ? "success" : "info", settled ? Check : Users);
  };

  const logDebtAsIncome = (entryId, debtId, accountId) => {
    const entry = data.entries.find((e) => e.id === entryId);
    const debt = entry && (entry.debts || []).find((d) => d.id === debtId);
    if (!debt) return;
    addEntry({ type: "income", amount: debt.amount, category: "Other", note: `Repayment from ${debt.name}`, date: todayISO(), accountId: accountId || null });
    setDebtSettled(entryId, debtId, true);
  };

  const setBudget = (type, category, periodType, limit) => {
    setData((prev) => {
      const group = { ...(prev.budgets[type] || {}) };
      group[category] = { ...(group[category] || {}), [periodType]: limit };
      return { ...prev, budgets: { ...prev.budgets, [type]: group } };
    });
    pushToast(`${PERIOD_LABEL[periodType]} ${type === "income" ? "goal" : "budget"} set for ${category} — ${fmt(limit)}`, "success", Target);
  };
  const removeBudget = (type, category, periodType) => {
    setData((prev) => {
      const group = { ...(prev.budgets[type] || {}) };
      const catBudget = { ...(group[category] || {}) };
      delete catBudget[periodType];
      if (Object.keys(catBudget).length === 0) delete group[category]; else group[category] = catBudget;
      return { ...prev, budgets: { ...prev.budgets, [type]: group } };
    });
    pushToast(`${type === "income" ? "Goal" : "Budget"} removed for ${category}`, "danger", Trash2);
  };
  const setMasterBudget = (type, periodType, limit) => {
    setData((prev) => ({ ...prev, masterBudgets: { ...prev.masterBudgets, [type]: { ...(prev.masterBudgets[type] || {}), [periodType]: limit } } }));
    pushToast(`${PERIOD_LABEL[periodType]} master ${type === "income" ? "goal" : "budget"} set — ${fmt(limit)}`, "success", Target);
  };
  const removeMasterBudget = (type, periodType) => {
    setData((prev) => {
      const m = { ...(prev.masterBudgets[type] || {}) };
      delete m[periodType];
      return { ...prev, masterBudgets: { ...prev.masterBudgets, [type]: m } };
    });
    pushToast(`${PERIOD_LABEL[periodType]} master ${type === "income" ? "goal" : "budget"} removed`, "danger", Trash2);
  };

  const addRecurring = (item) => {
    setData((prev) => ({ ...prev, recurring: [...prev.recurring, { id: uid(), lastRun: null, frequency: "monthly", ...item }] }));
    pushToast(`Recurring ${item.type === "income" ? "income" : "expense"} added — ${item.name}`, "success", Repeat);
  };
  const updateRecurring = (id, patch) => {
    setData((prev) => ({ ...prev, recurring: prev.recurring.map((r) => r.id === id ? { ...r, ...patch } : r) }));
    pushToast(`Recurring transaction updated — ${patch.name || ""}`.trim(), "info", Pencil);
  };
  const toggleRecurring = (id) => {
    const item = data.recurring.find((r) => r.id === id);
    setData((prev) => ({ ...prev, recurring: prev.recurring.map((r) => r.id === id ? { ...r, active: !r.active } : r) }));
    if (item) pushToast(`${item.active ? "Paused" : "Resumed"} ${item.name}`, item.active ? "info" : "success", Power);
  };
  const removeRecurring = (id) => {
    const item = data.recurring.find((r) => r.id === id);
    setData((prev) => ({ ...prev, recurring: prev.recurring.filter((r) => r.id !== id) }));
    pushToast(`Recurring transaction removed${item ? " — " + item.name : ""}`, "danger", Trash2);
  };

  const runRecurringNow = (id) => {
    const r = data.recurring.find((x) => x.id === id);
    if (!r || !r.active) return;
    const periodKey = (r.frequency || "monthly") === "weekly" ? isoOf(getMonday(new Date())) : thisMonthKey();
    if (r.lastRun === periodKey) return;
    const entry = {
      id: uid(), createdAt: Date.now(), type: r.type, amount: r.amount,
      category: r.category, categoryLabel: r.categoryLabel || "", note: r.name,
      date: todayISO(), recurring: true, accountId: r.accountId || null
    };
    setData((prev) => ({
      ...prev,
      entries: [...prev.entries, entry],
      recurring: prev.recurring.map((x) => x.id === id ? { ...x, lastRun: periodKey } : x)
    }));
    pushToast(`${r.name} logged early — ${fmt(r.amount)}`, "success", Zap);
  };

  const goLedgerFiltered = (period, category, type) => { setLedgerPreset({ period: period || null, category: category || null, type: type || null, token: Date.now() }); setTab("ledger"); };

  // Records the gap between the app's balance and the real one as a dated
  // adjustment entry (rather than rewriting history). Adjustments move the
  // account balance but are kept out of income/expense reports and budgets.
  const reconcileAccount = (accountId, diff, note) => {
    const acc = data.accounts.find((a) => a.id === accountId);
    if (!acc || !diff) return;
    setData((prev) => ({
      ...prev,
      entries: [...prev.entries, {
        id: uid(), createdAt: Date.now(), type: diff > 0 ? "income" : "expense", amount: Math.abs(diff),
        category: "Adjustment", note: (note || "").trim() || "Balance adjustment", date: todayISO(),
        accountId, adjustment: true, excludeFromBudget: true,
      }],
    }));
    pushToast(`${acc.name} adjusted by ${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))}`, "success", Wallet);
  };

  const reportEntries = useMemo(() => data.entries.filter((e) => !e.adjustment), [data.entries]);

  const toggleEntryBudget = (id) => {
    const entry = data.entries.find((e) => e.id === id);
    if (!entry) return;
    setData((prev) => ({ ...prev, entries: prev.entries.map((e) => e.id === id ? { ...e, excludeFromBudget: !e.excludeFromBudget, excludedPeriods: undefined } : e) }));
    pushToast(entry.excludeFromBudget ? "Back in your budgets" : "Excluded from your budgets", entry.excludeFromBudget ? "success" : "info", Target);
  };

  const addAccount = (acc) => {
    setData((prev) => ({ ...prev, accounts: [...prev.accounts, { id: uid(), createdAt: Date.now(), ...acc }] }));
    pushToast(`Account added — ${acc.name}`, "success", Landmark);
  };
  const updateAccount = (id, patch) => {
    setData((prev) => ({ ...prev, accounts: prev.accounts.map((a) => a.id === id ? { ...a, ...patch } : a) }));
    pushToast(`Account updated${patch.name ? " — " + patch.name : ""}`, "info", Pencil);
  };
  const removeAccount = (id) => {
    const acc = data.accounts.find((a) => a.id === id);
    setData((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
      entries: prev.entries.map((e) => e.accountId === id ? { ...e, accountId: null } : e)
    }));
    pushToast(`Account removed${acc ? " — " + acc.name : ""}`, "danger", Trash2);
  };

  const addQuickAdd = (item) => {
    setData((prev) => ({ ...prev, quickAdds: [...prev.quickAdds, { id: uid(), ...item }] }));
    pushToast("Quick add created", "success", Zap);
  };
  const updateQuickAdd = (id, patch) => setData((prev) => ({ ...prev, quickAdds: prev.quickAdds.map((q) => q.id === id ? { ...q, ...patch } : q) }));
  const removeQuickAdd = (id) => {
    setData((prev) => ({ ...prev, quickAdds: prev.quickAdds.filter((q) => q.id !== id) }));
    pushToast("Quick add removed", "danger", Trash2);
  };

  const addCategory = (type, name) => {
    if (((data.categoryGroups[type] || {}).parents || []).some((p) => p.toLowerCase() === name.toLowerCase())) {
      pushToast(`"${name}" is already a group name`, "danger", Tag);
      return false;
    }
    const exists = (data.categories[type] || []).some((c) => c.toLowerCase() === name.toLowerCase());
    setData((prev) => {
      const list = prev.categories[type] || [];
      if (list.some((c) => c.toLowerCase() === name.toLowerCase())) return prev;
      return { ...prev, categories: { ...prev.categories, [type]: [...list, name] } };
    });
    if (!exists) pushToast(`Category "${name}" added`, "success", Check);
    return true;
  };

  /* ----- category groups (parents) ----- */
  const groupNameTaken = (type, name, ignore) => {
    const lower = name.toLowerCase();
    if (ignore && ignore.toLowerCase() === lower) return false;
    return (data.categories[type] || []).some((x) => x.toLowerCase() === lower)
      || data.categoryGroups[type].parents.some((p) => p.toLowerCase() === lower);
  };
  const addParent = (type, name) => {
    const n = (name || "").trim();
    if (!n) return false;
    if (groupNameTaken(type, n)) { pushToast(`"${n}" is already used by a category or group`, "danger", Tag); return false; }
    setData((prev) => ({ ...prev, categoryGroups: { ...prev.categoryGroups, [type]: { ...prev.categoryGroups[type], parents: [...prev.categoryGroups[type].parents, n] } } }));
    pushToast(`Group "${n}" created`, "success", Tag);
    return true;
  };
  const renameParent = (type, oldName, newName) => {
    const n = (newName || "").trim();
    if (!n || n === oldName) return;
    if (groupNameTaken(type, n, oldName)) { pushToast(`"${n}" is already used by a category or group`, "danger", Tag); return; }
    setData((prev) => {
      const g = prev.categoryGroups[type];
      const map = {};
      Object.entries(g.map).forEach(([ch, p]) => { map[ch] = p === oldName ? n : p; });
      const parents = g.parents.map((p) => p === oldName ? n : p);
      let budgets = prev.budgets;
      if (budgets[type] && budgets[type][oldName]) {
        const grp = { ...budgets[type] };
        grp[n] = { ...(grp[n] || {}), ...grp[oldName] };
        delete grp[oldName];
        budgets = { ...budgets, [type]: grp };
      }
      let categoryColors = prev.categoryColors || {};
      if (categoryColors[oldName] != null) {
        categoryColors = { ...categoryColors, [n]: categoryColors[oldName] };
        delete categoryColors[oldName];
      }
      return { ...prev, categoryGroups: { ...prev.categoryGroups, [type]: { parents, map } }, budgets, categoryColors };
    });
    pushToast(`Renamed group "${oldName}" to "${n}"`, "success", Pencil);
  };
  const deleteParent = (type, name) => {
    setData((prev) => {
      const g = prev.categoryGroups[type];
      const map = {};
      Object.entries(g.map).forEach(([ch, p]) => { if (p !== name) map[ch] = p; });
      let budgets = prev.budgets;
      if (budgets[type] && budgets[type][name]) {
        const grp = { ...budgets[type] };
        delete grp[name];
        budgets = { ...budgets, [type]: grp };
      }
      const categoryColors = { ...(prev.categoryColors || {}) };
      delete categoryColors[name];
      return { ...prev, categoryGroups: { ...prev.categoryGroups, [type]: { parents: g.parents.filter((p) => p !== name), map } }, budgets, categoryColors };
    });
    pushToast(`Group "${name}" removed — its categories are ungrouped`, "danger", Trash2);
  };
  const setCategoryParent = (type, category, parent) => {
    setData((prev) => {
      const g = prev.categoryGroups[type];
      const map = { ...g.map };
      if (parent) map[category] = parent; else delete map[category];
      return { ...prev, categoryGroups: { ...prev.categoryGroups, [type]: { ...g, map } } };
    });
  };
  const applyGroupSuggestions = (suggestions) => {
    setData((prev) => {
      const next = { expense: { parents: [...prev.categoryGroups.expense.parents], map: { ...prev.categoryGroups.expense.map } }, income: { parents: [...prev.categoryGroups.income.parents], map: { ...prev.categoryGroups.income.map } } };
      suggestions.forEach((s) => {
        if (!next[s.type].parents.includes(s.name)) next[s.type].parents.push(s.name);
        s.members.forEach((m) => { next[s.type].map[m] = s.name; });
      });
      return { ...prev, categoryGroups: next, categoryGroupsPrompted: true };
    });
    pushToast("Category groups applied", "success", Tag);
  };
  const dismissGroupSuggestions = () => setData((prev) => ({ ...prev, categoryGroupsPrompted: true }));

  const renameCategory = (type, oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    if (data.categoryGroups[type].parents.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      pushToast(`"${trimmed}" is already a group name`, "danger", Tag);
      return;
    }
    setData((prev) => {
      const list = [...new Set(prev.categories[type].map((c) => c === oldName ? trimmed : c))];
      const entries = prev.entries.map((e) => e.type === type && e.category === oldName ? { ...e, category: trimmed } : e);
      const recurring = prev.recurring.map((r) => r.type === type && r.category === oldName ? { ...r, category: trimmed } : r);
      const quickAdds = type === "expense" ? prev.quickAdds.map((q) => q.category === oldName ? { ...q, category: trimmed } : q) : prev.quickAdds;
      let budgets = prev.budgets;
      if (prev.budgets[type] && prev.budgets[type][oldName]) {
        const group = { ...prev.budgets[type] };
        const val = group[oldName];
        delete group[oldName];
        group[trimmed] = { ...(group[trimmed] || {}), ...val };
        budgets = { ...prev.budgets, [type]: group };
      }
      let categoryColors = prev.categoryColors;
      if (categoryColors && categoryColors[oldName] != null) {
        categoryColors = { ...categoryColors };
        categoryColors[trimmed] = categoryColors[oldName];
        delete categoryColors[oldName];
      }
      let categoryGroups = prev.categoryGroups;
      const gm = categoryGroups[type].map;
      if (gm[oldName]) {
        const map = { ...gm };
        if (!(trimmed in map)) map[trimmed] = map[oldName];
        delete map[oldName];
        categoryGroups = { ...categoryGroups, [type]: { ...categoryGroups[type], map } };
      }
      return { ...prev, categories: { ...prev.categories, [type]: list }, entries, recurring, quickAdds, budgets, categoryColors, categoryGroups };
    });
    pushToast(`Renamed "${oldName}" to "${trimmed}"`, "success", Pencil);
  };

  const deleteCategory = (type, name) => {
    if ((data.categories[type] || []).length <= 1) {
      pushToast("You need at least one category", "danger", Trash2);
      return;
    }
    setData((prev) => {
      const categoryColors = { ...(prev.categoryColors || {}) };
      delete categoryColors[name];
      let categoryGroups = prev.categoryGroups;
      if (categoryGroups[type].map[name]) {
        const map = { ...categoryGroups[type].map };
        delete map[name];
        categoryGroups = { ...categoryGroups, [type]: { ...categoryGroups[type], map } };
      }
      return { ...prev, categories: { ...prev.categories, [type]: prev.categories[type].filter((c) => c !== name) }, categoryColors, categoryGroups };
    });
    pushToast(`Category "${name}" removed`, "danger", Trash2);
  };

  const setCategoryColor = (name, hex) => {
    setData((prev) => ({ ...prev, categoryColors: { ...(prev.categoryColors || {}), [name]: hex } }));
  };

  const resetCategoryColor = (name) => {
    setData((prev) => {
      const categoryColors = { ...(prev.categoryColors || {}) };
      delete categoryColors[name];
      return { ...prev, categoryColors };
    });
  };

  const goAdd = (type) => { setPreset({ type, token: Date.now() }); setTab("add"); };

  // Handle PWA home-screen shortcuts (long-press the app icon) and any other
  // deep link that arrives as a URL param — runs once the account's data has
  // loaded, since quick-add shortcuts need to look up quickAdds by label.
  useEffect(() => {
    if (!loaded) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    const quickaddLabel = params.get("quickadd");
    if (!action && !quickaddLabel) return;

    if (action === "addExpense") goAdd("expense");
    else if (action === "addIncome") goAdd("income");
    else if (quickaddLabel) {
      const q = data.quickAdds.find((item) => item.label.toLowerCase() === quickaddLabel.toLowerCase());
      if (q) {
        addEntry({ type: "expense", amount: q.amount, category: q.category, note: q.label, date: todayISO(), debts: null, debtsTotal: null, accountId: q.accountId || null });
      } else {
        pushToast(`No quick add named "${quickaddLabel}" — add one in Quick Add first`, "danger", Zap);
        setTab("add");
      }
    }
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const setTheme = (patch) => {
    setData((prev) => ({ ...prev, theme: { ...prev.theme, ...patch } }));
    if (patch.mode) pushToast(`${patch.mode === "dark" ? "Dark" : "Light"} mode enabled`, "success", patch.mode === "dark" ? Moon : Sun);
  };

  const setProfile = (patch) => setData((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));

  const resetAllData = () => {
    setData(emptyData());
    pushToast("All account data has been reset", "danger", Trash2);
  };

  // Recompute the shared color palette synchronously during render so every
  // child (which reads the module-level COLORS object) sees the new theme
  // the moment it renders, without needing to thread it through props.
  useMemo(() => {
    Object.assign(COLORS, buildPalette(data.theme.mode, data.theme.accent, data.theme.secondaryAccent));
  }, [data.theme.mode, data.theme.accent, data.theme.secondaryAccent]);

  // Same trick for category colors: keep the module-level override map in
  // sync with the account's saved choices before anything renders.
  useMemo(() => {
    CATEGORY_COLOR_OVERRIDES = data.categoryColors || {};
  }, [data.categoryColors]);

  // And the category groups, so pickers and rows can show "Parent › Category".
  useMemo(() => {
    CATEGORY_GROUPS_LIVE = data.categoryGroups || EMPTY_GROUPS;
  }, [data.categoryGroups]);

  const groupSuggestions = useMemo(
    () => (data.categoryGroupsPrompted ? [] : suggestGroups(data.categories, data.categoryGroups)),
    [data.categoryGroupsPrompted, data.categories, data.categoryGroups]
  );

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "accounts", label: "Accounts", icon: Landmark },
    { group: "transactions", label: "Transactions", icon: List, children: [
      { id: "add", label: "Add", icon: Plus },
      { id: "ledger", label: "Ledger", icon: List },
      { id: "debts", label: "Debts", icon: Users },
    ] },
    { group: "analysis", label: "Analysis", icon: BarChart3, children: [
      { id: "periods", label: "Periods", icon: CalendarDays },
      { id: "insights", label: "Insights", icon: BarChart3 },
    ] },
    { group: "planning", label: "Planning", icon: PiggyBank, children: [
      { id: "budgets", label: "Budgets", icon: PiggyBank },
      { id: "recurring", label: "Recurring", icon: Repeat },
    ] },
    { id: "settings", label: "Settings", icon: Palette },
  ];

  const navBtnBase = (active) => ({
    display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
    padding: "9px 15px", borderRadius: 999, border: "none",
    background: active ? COLORS.orange : "transparent",
    color: active ? "#fff" : COLORS.muted,
    fontSize: 13, fontWeight: 700, cursor: "pointer"
  });

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: COLORS.bg, color: COLORS.text, minHeight: "100vh", padding: "22px 16px 60px", boxSizing: "border-box", transition: "background-color .3s ease, color .3s ease" }}>
      <GlobalStyle />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} NAV={NAV} tab={tab} setTab={setTab} profileName={data.profile.name} />
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu" style={{
            background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 10, padding: 9, cursor: "pointer", color: COLORS.text, boxShadow: SHADOW
          }}>
            <Menu size={18} />
          </button>
          <div>
            {data.profile.name ? (
              <>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", color: COLORS.muted, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>{greetingWord()}</div>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{data.profile.name} 👋</h1>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", color: COLORS.muted, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Finance</div>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Personal Finance Tracker</h1>
              </>
            )}
          </div>
        </div>

        <nav ref={navRef} className="nav-top-bar" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
          {NAV.map((item) => item.children ? (
            <div key={item.group} style={{ position: "relative" }}>
              <button onClick={() => setOpenGroup(openGroup === item.group ? null : item.group)}
                style={navBtnBase(item.children.some((c) => c.id === tab))}>
                <item.icon size={14} /> {item.label}
                <ChevronDown size={13} style={{ transform: openGroup === item.group ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </button>
              {openGroup === item.group && (
                <div className="nav-dropdown" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: COLORS.card, borderRadius: 14, boxShadow: SHADOW, padding: 6, minWidth: 180, zIndex: 100 }}>
                  {item.children.map((c) => (
                    <button key={c.id} onClick={() => { setTab(c.id); setOpenGroup(null); }} style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 9, border: "none",
                      background: tab === c.id ? COLORS.orangeLight : "transparent", color: tab === c.id ? COLORS.orangeDark : COLORS.text,
                      fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 2
                    }}>
                      <c.icon size={14} /> {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button key={item.id} onClick={() => { setTab(item.id); setOpenGroup(null); }} style={navBtnBase(tab === item.id)}>
              <item.icon size={14} /> {item.label}
            </button>
          ))}
        </nav>


        <div key={tab} className="tab-panel">
          {tab === "dashboard" && (
            <Dashboard
              entries={data.entries}
              groups={data.categoryGroups}
              groupSuggestions={groupSuggestions}
              onApplyGroups={applyGroupSuggestions}
              onDismissGroups={dismissGroupSuggestions}
              budgets={data.budgets}
              masterBudgets={data.masterBudgets}
              accounts={data.accounts}
              recurring={data.recurring}
              onQuickAction={goAdd}
              onGoInsights={() => setTab("insights")}
              onGoDebts={() => setTab("debts")}
              onGoLedger={() => goLedgerFiltered(null, null)}
              onGoLedgerFiltered={goLedgerFiltered}
              onGoBudgets={() => setTab("budgets")}
              onGoRecurring={() => setTab("recurring")}
            />
          )}
          {tab === "accounts" && (
            <Accounts
              accounts={data.accounts}
              entries={data.entries}
              onAdd={addAccount}
              onUpdate={updateAccount}
              onRemove={removeAccount}
              onUpdateEntry={updateEntry}
              onRemoveEntry={removeEntry}
              onReconcile={reconcileAccount}
              categories={data.categories}
              onAddCategory={addCategory}
            />
          )}
          {tab === "debts" && <Debts entries={data.entries} accounts={data.accounts} onSetDebtSettled={setDebtSettled} onLogAsIncome={logDebtAsIncome} />}
          {tab === "add" && (
            <AddTransaction
              onAdd={addEntry}
              preset={preset}
              accounts={data.accounts}
              quickAdds={data.quickAdds}
              onAddQuickAdd={addQuickAdd}
              onUpdateQuickAdd={updateQuickAdd}
              onRemoveQuickAdd={removeQuickAdd}
              categories={data.categories}
              onAddCategory={addCategory}
            />
          )}
          {tab === "ledger" && <Ledger entries={data.entries} onRemove={removeEntry} onUpdate={updateEntry} onToggleBudget={toggleEntryBudget} onBulkAdd={bulkAddEntries} preset={ledgerPreset} catGroups={data.categoryGroups} categories={data.categories} accounts={data.accounts} quickAdds={data.quickAdds} onAddCategory={addCategory} />}
          {tab === "periods" && <Periods entries={reportEntries} accounts={data.accounts} />}
          {tab === "insights" && <Insights entries={reportEntries} accounts={data.accounts} groups={data.categoryGroups} />}
          {tab === "budgets" && (
            <Budgets
              entries={data.entries}
              groups={data.categoryGroups}
              budgets={data.budgets}
              onSetBudget={setBudget}
              onRemoveBudget={removeBudget}
              masterBudgets={data.masterBudgets}
              onSetMasterBudget={setMasterBudget}
              onRemoveMasterBudget={removeMasterBudget}
              categories={data.categories}
              onAddCategory={addCategory}
            />
          )}
          {tab === "recurring" && (
            <Recurring
              recurring={data.recurring}
              onAdd={addRecurring}
              onUpdate={updateRecurring}
              onToggle={toggleRecurring}
              onRemove={removeRecurring}
              onRunNow={runRecurringNow}
              categories={data.categories}
              onAddCategory={addCategory}
              accounts={data.accounts}
            />
          )}
          {tab === "settings" && (
            <Settings
              theme={data.theme}
              onSetTheme={setTheme}
              profile={data.profile}
              onSetProfile={setProfile}
              categories={data.categories}
              entries={data.entries}
              onRenameCategory={renameCategory}
              onDeleteCategory={deleteCategory}
              onAddCategory={addCategory}
              onSetCategoryColor={setCategoryColor}
              onResetCategoryColor={resetCategoryColor}
              groupApi={{
                groups: data.categoryGroups, suggestions: groupSuggestions,
                onAddParent: addParent, onRenameParent: renameParent, onDeleteParent: deleteParent,
                onSetParent: setCategoryParent, onApply: applyGroupSuggestions, onDismiss: dismissGroupSuggestions,
              }}
              onResetAll={resetAllData}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- dashboard ---------- */

function GroupSuggestionCard({ suggestions, onApply, onDismiss }) {
  if (!suggestions || !suggestions.length) return null;
  return (
    <SectionCard title="Group your categories?" icon={<Tag size={13} />}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>
        Parent categories bundle related ones together, so budgets and Insights can total them. Here's a suggested setup — you can change any of it later in Settings.
      </div>
      {suggestions.map((s) => (
        <div key={s.type + s.name} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
            {s.name} <span style={{ fontWeight: 600, color: COLORS.mutedLight, fontSize: 11 }}>· {s.type}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {s.members.map((m) => (
              <span key={m} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: withAlpha(catColor(m), "22"), color: catColor(m), fontSize: 11.5, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: catColor(m) }} />{m}
              </span>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => onApply(suggestions)} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Apply groups</button>
        <button onClick={onDismiss} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 10, padding: "8px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer", color: COLORS.muted }}>Not now</button>
      </div>
    </SectionCard>
  );
}

function Dashboard({ entries, groups, groupSuggestions, onApplyGroups, onDismissGroups, budgets, masterBudgets, accounts, recurring, onQuickAction, onGoInsights, onGoDebts, onGoLedger, onGoLedgerFiltered, onGoBudgets, onGoRecurring }) {
  const [statScope, setStatScope] = useState("month");
  const cmk = thisMonthKey();

  const totals = useMemo(() => {
    const accountFloor = accounts.reduce((s, a) => s + a.initialBalance, 0);
    const balance = accountFloor + entries.reduce((s, e) => e.type === "transfer" ? s : s + (e.type === "income" ? e.amount : -e.amount), 0);
    const range = periodRange(statScope === "week" ? "weekly" : "monthly", new Date());
    const scoped = entries.filter((e) => e.date >= range.start && e.date <= range.end);
    const income = scoped.filter((e) => e.type === "income" && !e.adjustment).reduce((s, e) => s + e.amount, 0);
    const expense = scoped.filter((e) => e.type === "expense" && !e.adjustment).reduce((s, e) => s + e.amount, 0);
    return { balance, income, expense, net: income - expense };
  }, [entries, accounts, statScope]);

  const owedToYou = useMemo(() => {
    let total = 0, count = 0;
    const byPerson = {};
    entries.forEach((e) => (e.debts || []).forEach((d) => {
      if (d.settled) return;
      total += d.amount; count += 1;
      const key = d.name.trim().toLowerCase();
      byPerson[key] = (byPerson[key] || { name: d.name, total: 0 });
      byPerson[key].total += d.amount;
    }));
    const top = Object.values(byPerson).sort((a, b) => b.total - a.total).slice(0, 3);
    return { total, count, top };
  }, [entries]);

  const budgetUsage = useMemo(() => {
    const withMonthly = Object.entries(budgets.expense || {}).filter(([, p]) => p.monthly != null);
    if (!withMonthly.length) return null;
    // A sub-category budget under a budgeted parent already sits inside the parent's limit.
    const counted = withMonthly.filter(([c]) => {
      const par = parentOf(groups, "expense", c);
      return !(par && withMonthly.some(([x]) => x === par));
    });
    const totalLimit = counted.reduce((s, [, p]) => s + p.monthly, 0);
    const cats = new Set();
    counted.forEach(([c]) => categoryScope(groups, "expense", c).forEach((x) => cats.add(x)));
    const spent = entries.filter((e) => e.type === "expense" && !isExcludedFrom(e, "monthly") && monthKey(e.date) === cmk && cats.has(e.category)).reduce((s, e) => s + e.amount, 0);
    return { pct: totalLimit > 0 ? Math.round((spent / totalLimit) * 100) : 0, spent, totalLimit };
  }, [entries, budgets, cmk, groups]);

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return recurring
      .filter((r) => r.active)
      .map((r) => {
        const next = nextRecurringDate(r, today);
        const days = Math.round((next - today) / 86400000);
        return { ...r, days };
      })
      .sort((a, b) => a.days - b.days)
      .slice(0, 3);
  }, [recurring]);

  const budgetWatch = useMemo(() => {
    const items = [];
    const now = new Date();
    const ledgerPeriodFor = { daily: "day", weekly: "week", monthly: "month" };
    ["expense", "income"].forEach((type) => {
      Object.entries(budgets[type] || {}).forEach(([category, periods]) => {
        Object.entries(periods).forEach(([pt, lim]) => {
          const r = periodRange(pt, now);
          const spent = entries.filter((e) => e.type === type && !isExcludedFrom(e, pt) && categoryScope(groups, type, category).includes(e.category) && e.date >= r.start && e.date <= r.end).reduce((s, e) => s + e.amount, 0);
          const pct = lim > 0 ? (spent / lim) * 100 : 0;
          items.push({ label: `${category}${isParentName(groups, type, category) ? " (group)" : ""} · ${PERIOD_LABEL[pt]}`, pct, spent, lim, ledgerPeriod: ledgerPeriodFor[pt], category, type, isGoal: type === "income" });
        });
      });
      ["daily", "weekly", "monthly"].forEach((pt) => {
        const lim = (masterBudgets[type] || {})[pt];
        if (lim == null) return;
        const r = periodRange(pt, now);
        const spent = entries.filter((e) => e.type === type && !isExcludedFrom(e, pt) && e.date >= r.start && e.date <= r.end).reduce((s, e) => s + e.amount, 0);
        const pct = lim > 0 ? (spent / lim) * 100 : 0;
        items.push({ label: type === "income" ? `Master Income · ${PERIOD_LABEL[pt]}` : `Master · ${PERIOD_LABEL[pt]}`, pct, spent, lim, ledgerPeriod: ledgerPeriodFor[pt], category: null, type, isGoal: type === "income" });
      });
    });
    // Every budget (and income goal) you've set shows up here, sorted by how close
    // it is to its limit — the ones actually worth watching naturally float to the top.
    return items.sort((a, b) => b.pct - a.pct);
  }, [entries, budgets, masterBudgets, groups]);

  const recent = useMemo(() => (
    [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5)
  ), [entries]);

  return (
    <div>
      <HeroCard balance={totals.balance} net={totals.net} />

      <div style={{ display: "flex", justifyContent: "space-around", margin: "18px 0 20px" }}>
        <QuickAction icon={<Minus size={18} />} color={COLORS.rose} label="Add Expense" onClick={() => onQuickAction("expense")} />
        <QuickAction icon={<Plus size={18} />} color={COLORS.green} label="Add Income" onClick={() => onQuickAction("income")} />
        <QuickAction icon={<Users size={18} />} color={COLORS.blue} label="Debts" onClick={onGoDebts} />
        <QuickAction icon={<Sparkles size={18} />} color={COLORS.orange} label="Insights" onClick={onGoInsights} />
      </div>

      {groupSuggestions && groupSuggestions.length > 0 && (
        <>
          <GroupSuggestionCard suggestions={groupSuggestions} onApply={onApplyGroups} onDismiss={onDismissGroups} />
          <div style={{ height: 16 }} />
        </>
      )}

      {owedToYou.count > 0 && (
        <>
          <SectionCard title="Owed to You" icon={<Users size={13} />}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: COLORS.green }}>{fmt(owedToYou.total)}</div>
              <button onClick={onGoDebts} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                View all →
              </button>
            </div>
            {owedToYou.top.map((p, i) => (
              <div key={p.name + i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
                <span style={{ color: COLORS.muted, fontWeight: 600 }}>{p.name}</span>
                <span className="mono" style={{ fontWeight: 700 }}>{fmt(p.total)}</span>
              </div>
            ))}
          </SectionCard>
          <div style={{ height: 16 }} />
        </>
      )}

      <SectionCard title={statScope === "week" ? "This Week" : "This Month"} right={
        <div style={{ display: "flex", gap: 6 }}>
          {[["week", "Week"], ["month", "Month"]].map(([id, label]) => (
            <button key={id} onClick={() => setStatScope(id)} style={{
              padding: "6px 12px", borderRadius: 999, border: "1px solid " + (statScope === id ? COLORS.orange : COLORS.border),
              background: statScope === id ? COLORS.orangeLight : COLORS.card, color: statScope === id ? COLORS.orangeDark : COLORS.muted,
              fontSize: 11.5, fontWeight: 700, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
      }>
        <StatRow icon={<TrendingUp size={16} />} color={COLORS.green} label="Income" value={fmt(totals.income)} />
        <StatRow icon={<TrendingDown size={16} />} color={COLORS.rose} label="Expenses" value={fmt(totals.expense)} />
        <StatRow icon={<Wallet size={16} />} color={COLORS.orange} label={totals.net >= 0 ? "Saved" : "Overspent"} value={fmt(Math.abs(totals.net))} />
        {budgetUsage && (
          <StatRow icon={<Target size={16} />} color={COLORS.blue} label="Monthly Budget Used" value={`${budgetUsage.pct}%`} />
        )}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Budget Watch" right={onGoBudgets && (
        <button onClick={onGoBudgets} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
          View all →
        </button>
      )}>
        {budgetWatch.length === 0 ? (
          <EmptyNote>No budgets set yet — set one in the Budgets tab.</EmptyNote>
        ) : budgetWatch.map((b, i) => {
          const barColor = b.isGoal
            ? (b.pct >= 100 ? COLORS.green : b.pct >= 70 ? COLORS.amber : COLORS.blue)
            : (b.pct >= 100 ? COLORS.rose : b.pct >= 70 ? COLORS.amber : COLORS.green);
          const remaining = b.lim - b.spent;
          return (
          <div key={i} onClick={() => onGoLedgerFiltered && onGoLedgerFiltered(b.ledgerPeriod, b.category, b.isGoal ? b.type : undefined)} style={{ marginBottom: i === budgetWatch.length - 1 ? 0 : 10, cursor: onGoLedgerFiltered ? "pointer" : "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{b.label}</span>
              <span className="mono" style={{ color: !b.isGoal && b.pct >= 100 ? COLORS.rose : COLORS.muted }}>{fmt(b.spent)} / {fmt(b.lim)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 4, background: COLORS.bg, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, b.pct)}%`, background: barColor, borderRadius: 4 }} />
            </div>
            <div className="mono" style={{ fontSize: 10.5, marginTop: 3, fontWeight: 600, color: b.isGoal ? (remaining <= 0 ? COLORS.green : COLORS.mutedLight) : (remaining < 0 ? COLORS.rose : COLORS.mutedLight) }}>
              {b.isGoal
                ? (remaining <= 0 ? `Goal reached · +${fmt(-remaining)} over` : `${fmt(remaining)} to go`)
                : (remaining < 0 ? `Over by ${fmt(-remaining)}` : `${fmt(remaining)} left`)}
            </div>
          </div>
          );
        })}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Upcoming Recurring" right={onGoRecurring && (
        <button onClick={onGoRecurring} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
          View all →
        </button>
      )}>
        {upcoming.length === 0 && <EmptyNote>No active recurring transactions.</EmptyNote>}
        {upcoming.map((r, i) => (
          <div key={r.id} onClick={onGoRecurring} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderBottom: i === upcoming.length - 1 ? "none" : "1px solid " + COLORS.border,
            cursor: onGoRecurring ? "pointer" : "default"
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: catColor(r.category) }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
              <div style={{ fontSize: 11, color: COLORS.muted }}>{r.days === 0 ? "Due today" : r.days === 1 ? "Due tomorrow" : `In ${r.days} days`}</div>
            </div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: r.type === "income" ? COLORS.green : COLORS.text }}>
              {r.type === "income" ? "+" : "−"}{fmt(r.amount)}
            </div>
          </div>
        ))}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Recent Transactions" right={onGoLedger && (
        <button onClick={onGoLedger} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
          View all →
        </button>
      )}>
        {recent.length === 0 && <EmptyNote>No transactions yet — add your first one above.</EmptyNote>}
        {recent.map((e, i) => <TxRow key={e.id} e={e} last={i === recent.length - 1} accounts={accounts} />)}
      </SectionCard>
    </div>
  );
}

function useCountUp(target, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) { firstRef.current = false; prevRef.current = target; setDisplay(target); return; }
    const start = prevRef.current;
    const end = target;
    if (start === end) return;
    const startTime = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start + (end - start) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else { prevRef.current = end; setDisplay(end); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

const HERO_WAVE_PATH = (() => {
  let d = "M0,30 ";
  for (let i = 0; i < 8; i++) {
    const o = i * 200;
    d += `C${50 + o},10 ${50 + o},50 ${100 + o},30 C${150 + o},10 ${150 + o},50 ${200 + o},30 `;
  }
  d += "L1600,60 L0,60 Z";
  return d;
})();

function HeroCard({ balance, net }) {
  const positive = net >= 0;
  const animatedBalance = useCountUp(balance, 700);
  return (
    <div style={{
      background: `linear-gradient(135deg, ${COLORS.orange}, ${COLORS.orangeDark})`,
      borderRadius: 24, padding: "22px 22px 30px", color: "#fff", position: "relative", overflow: "hidden"
    }}>
      <div style={{ fontSize: 12.5, opacity: 0.9, fontWeight: 600 }}>Total Balance</div>
      <div className="mono" style={{ fontSize: 34, fontWeight: 800, margin: "6px 0 12px" }}>{fmt(animatedBalance)}</div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700,
        background: "rgba(255,255,255,0.2)", padding: "5px 11px", borderRadius: 999
      }}>
        {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {positive ? "+" : "−"}{fmt(Math.abs(net))} this month
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 46, overflow: "hidden", opacity: 0.22 }}>
        <svg viewBox="0 0 1600 60" preserveAspectRatio="none" className="hero-wave" style={{ width: "200%", height: "100%", display: "block" }}>
          <path d={HERO_WAVE_PATH} fill="#ffffff" />
        </svg>
      </div>
    </div>
  );
}

function QuickAction({ icon, color, label, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer" }}>
      <span style={{ width: 52, height: 52, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: SHADOW }}>{icon}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.text }}>{label}</span>
    </button>
  );
}

/* ---------- accounts ---------- */

function AccountDetail({ account, entries, accounts, balance, onBack, onUpdateEntry, onRemoveEntry, onReconcile, categories, onAddCategory }) {
  const [editingId, setEditingId] = useState(null);

  const related = useMemo(() => (
    entries
      .filter((e) => e.type === "transfer" ? (e.fromAccountId === account.id || e.toAccountId === account.id) : e.accountId === account.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  ), [entries, account.id]);

  const groups = useMemo(() => {
    const map = new Map();
    related.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    });
    return [...map.entries()];
  }, [related]);

  const totals = useMemo(() => {
    let inFlow = 0, outFlow = 0;
    related.forEach((e) => {
      if (e.type === "transfer") {
        if (e.toAccountId === account.id) inFlow += e.amount; else outFlow += e.amount;
      } else if (e.type === "income") inFlow += e.amount; else outFlow += e.amount;
    });
    return { inFlow, outFlow };
  }, [related, account.id]);

  const typeInfo = ACCOUNT_TYPES.find((t) => t.id === account.type) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
  const Icon = typeInfo.icon;

  return (
    <div>
      <button onClick={onBack} style={{
        display: "flex", alignItems: "center", gap: 6, background: "none", border: "none",
        color: COLORS.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 14
      }}>
        <ChevronLeft size={15} /> All Accounts
      </button>

      <SectionCard>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ width: 44, height: 44, minWidth: 44, borderRadius: "50%", background: typeInfo.color + "22", color: typeInfo.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={20} />
          </span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{account.name}</div>
            <div style={{ fontSize: 12, color: COLORS.muted }}>{account.customType || typeInfo.label}</div>
          </div>
        </div>
        <div className="mono" style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>{fmt(balance)}</div>
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, color: COLORS.mutedLight, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>In</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: COLORS.green }}>{fmt(totals.inFlow)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: COLORS.mutedLight, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Out</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{fmt(totals.outFlow)}</div>
          </div>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <ReconcilePanel account={account} balance={balance} related={related} onReconcile={onReconcile} />

      <div style={{ height: 16 }} />

      <SectionCard title={`Transactions (${related.length})`}>
        {related.length === 0 && <EmptyNote>No transactions for this account yet.</EmptyNote>}
        {groups.map(([date, items], gi) => (
          <div key={date} style={{ marginBottom: gi === groups.length - 1 ? 0 : 6 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.muted, padding: "10px 2px 4px" }}>{relDateLabel(date)}</div>
            {items.map((e, i) => editingId === e.id ? (
              <EditEntryForm key={e.id} entry={e} categories={categories} accounts={accounts} onAddCategory={onAddCategory}
                onSave={(patch) => { onUpdateEntry(e.id, patch); setEditingId(null); }}
                onCancel={() => setEditingId(null)} />
            ) : (
              <TxRow key={e.id} e={e} last={i === items.length - 1} onRemove={onRemoveEntry} onEdit={() => setEditingId(e.id)} hideDate accounts={accounts} />
            ))}
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

function ReconcilePanel({ account, balance, related, onReconcile }) {
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState("");
  const [note, setNote] = useState("");

  const actualNum = parseFloat(actual);
  const hasActual = actual !== "" && !isNaN(actualNum);
  const diff = hasActual ? Math.round((actualNum - balance) * 100) / 100 : 0;

  // Entries that look like the same purchase logged twice (same day, amount, note).
  const dupKeys = useMemo(() => {
    const seen = {}, dups = new Set();
    related.forEach((e) => {
      if (e.type === "transfer" || e.adjustment) return;
      const k = [e.date, e.type, e.amount, (e.note || "").trim().toLowerCase()].join("|");
      if (seen[k]) dups.add(k); else seen[k] = true;
    });
    return dups;
  }, [related]);
  const dupKeyOf = (e) => [e.date, e.type, e.amount, (e.note || "").trim().toLowerCase()].join("|");

  const recent = related.filter((e) => !e.adjustment).slice(0, 8);

  const close = () => { setOpen(false); setActual(""); setNote(""); };
  const apply = () => {
    if (!hasActual || diff === 0) return;
    onReconcile(account.id, diff, note);
    close();
  };

  return (
    <SectionCard title="Reconcile Balance" right={!open && (
      <button onClick={() => setOpen(true)} style={{ background: COLORS.orangeLight, color: COLORS.orangeDark, border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
        Balance doesn't match?
      </button>
    )}>
      {!open ? (
        <div style={{ fontSize: 12, color: COLORS.muted }}>
          If this doesn't match what your bank or wallet shows, compare them here and fix the gap without losing any history.
        </div>
      ) : (
        <div>
          <FieldLabel>Actual balance right now (RM)</FieldLabel>
          <input type="number" step="0.01" placeholder="0.00" value={actual} onChange={(e) => setActual(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }} className="mono" />

          {hasActual && (
            <div style={{ background: COLORS.bg, border: "1px solid " + COLORS.border, borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                <span style={{ color: COLORS.muted }}>App shows</span><span className="mono" style={{ fontWeight: 700 }}>{fmt(balance)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                <span style={{ color: COLORS.muted }}>Actual</span><span className="mono" style={{ fontWeight: 700 }}>{fmt(actualNum)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800, color: diff === 0 ? COLORS.green : COLORS.rose }}>
                <span>Difference</span>
                <span className="mono">{diff === 0 ? "Matches" : (diff > 0 ? "+" : "−") + fmt(Math.abs(diff))}</span>
              </div>
            </div>
          )}

          {hasActual && diff !== 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Check these first</div>
              <div style={{ fontSize: 11.5, color: COLORS.muted, marginBottom: 8 }}>
                Most gaps come from a cash or card purchase you forgot to log, the same transaction entered twice (e.g. imported and added by hand), or something logged against the wrong account. Your latest entries here:
              </div>
              <div style={{ background: COLORS.bg, borderRadius: 10, padding: recent.length ? "4px 10px" : "8px 10px", marginBottom: 12 }}>
                {recent.length === 0 ? (
                  <div style={{ fontSize: 11, color: COLORS.mutedLight }}>No transactions on this account yet.</div>
                ) : recent.map((e, i) => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, padding: "5px 0", borderBottom: i < recent.length - 1 ? "1px solid " + COLORS.border : "none" }}>
                    <span style={{ color: COLORS.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {relDateLabel(e.date)} · {e.note || e.category}
                      {e.type !== "transfer" && dupKeys.has(dupKeyOf(e)) && <span style={{ color: COLORS.amber, fontWeight: 700 }}> · possible duplicate</span>}
                    </span>
                    <span className="mono" style={{ flexShrink: 0, marginLeft: 8, color: e.type === "income" || (e.type === "transfer" && e.toAccountId === account.id) ? COLORS.green : COLORS.text }}>
                      {e.type === "income" || (e.type === "transfer" && e.toAccountId === account.id) ? "+" : "−"}{fmt(e.amount)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: COLORS.mutedLight, marginBottom: 12 }}>
                Fix or delete entries in the Transactions list below, then reconcile again. If everything is right and the gap is real, adjust it:
              </div>
              <input type="text" placeholder="Note (optional), e.g. Missing cash spend" value={note} onChange={(e) => setNote(e.target.value)}
                style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
              <div style={{ fontSize: 11, color: COLORS.mutedLight, marginBottom: 10 }}>
                This logs a dated "Balance adjustment" of {diff > 0 ? "+" : "−"}{fmt(Math.abs(diff))}. It changes this account's balance only — it won't count in your income, expenses, reports or budgets.
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            {hasActual && diff !== 0 && (
              <button onClick={apply} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                Adjust by {diff > 0 ? "+" : "−"}{fmt(Math.abs(diff))}
              </button>
            )}
            <button onClick={close} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: COLORS.muted }}>
              {hasActual && diff === 0 ? "Done" : "Cancel"}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function Accounts({ accounts, entries, onAdd, onUpdate, onRemove, onUpdateEntry, onRemoveEntry, onReconcile, categories, onAddCategory }) {
  const [form, setForm] = useState({ name: "", type: "bank", customType: "", initialBalance: "" });
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const balanceFor = (accountId) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return 0;
    let net = 0;
    entries.forEach((e) => {
      if (e.type === "transfer") {
        if (e.fromAccountId === accountId) net -= e.amount;
        if (e.toAccountId === accountId) net += e.amount;
      } else if (e.accountId === accountId) {
        net += e.type === "income" ? e.amount : -e.amount;
      }
    });
    return acc.initialBalance + net;
  };

  useEffect(() => {
    if (selectedId && !accounts.find((a) => a.id === selectedId)) setSelectedId(null);
  }, [selectedId, accounts]);

  const unassignedNet = useMemo(() => (
    entries.filter((e) => e.type !== "transfer" && !e.accountId).reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0)
  ), [entries]);

  const totalAcrossAccounts = accounts.reduce((s, a) => s + balanceFor(a.id), 0) + unassignedNet;

  const submit = () => {
    if (!form.name.trim()) { setError("Give the account a name."); return; }
    setError("");
    onAdd({
      name: form.name.trim(), type: form.type,
      customType: form.type === "other" ? form.customType.trim() : "",
      initialBalance: parseFloat(form.initialBalance) || 0
    });
    setForm({ name: "", type: form.type, customType: "", initialBalance: "" });
  };

  const selectedAccount = selectedId ? accounts.find((a) => a.id === selectedId) : null;
  if (selectedAccount) {
    return (
      <AccountDetail
        account={selectedAccount}
        entries={entries}
        accounts={accounts}
        balance={balanceFor(selectedId)}
        onBack={() => setSelectedId(null)}
        onUpdateEntry={onUpdateEntry}
        onRemoveEntry={onRemoveEntry}
        onReconcile={onReconcile}
        categories={categories}
        onAddCategory={onAddCategory}
      />
    );
  }

  return (
    <div>
      <SectionCard title="Total Across Accounts">
        <div className="mono" style={{ fontSize: 28, fontWeight: 800 }}>{fmt(totalAcrossAccounts)}</div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
          {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          {unassignedNet !== 0 ? ` · ${fmt(unassignedNet)} from unassigned transactions` : ""}
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Add an Account">
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
          Set up your bank, e-wallet, or cash on hand with a starting balance — new transactions can then be tagged to it.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <FieldLabel>Account Name</FieldLabel>
            <input type="text" placeholder="e.g. Maybank Savings" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} />
          </div>
          <div>
            <FieldLabel>Type</FieldLabel>
            <AccountTypeSelect value={form.type} onChange={(id) => setForm((f) => ({ ...f, type: id }))} />
          </div>
          <div>
            <FieldLabel>Initial Balance (RM)</FieldLabel>
            <input type="number" step="0.01" placeholder="0.00" value={form.initialBalance}
              onChange={(e) => setForm((f) => ({ ...f, initialBalance: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} className="mono" />
          </div>
          <button onClick={submit} style={{
            background: COLORS.orange, color: "#fff", border: "none", borderRadius: 10,
            padding: "9px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", height: 39
          }}>Add</button>
        </div>
        {form.type === "other" && (
          <input type="text" placeholder="Custom type label (optional), e.g. Crypto Wallet" value={form.customType}
            onChange={(e) => setForm((f) => ({ ...f, customType: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", marginTop: 10 }} />
        )}
        {error && <div style={{ color: COLORS.rose, fontSize: 12.5, marginTop: 10, fontWeight: 600 }}>{error}</div>}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Your Accounts">
        {accounts.length === 0 && <EmptyNote>No accounts yet. Add your bank, e-wallet, or cash on hand above to start tracking real balances.</EmptyNote>}
        {accounts.map((a, i) => (
          <AccountRow key={a.id} account={a} balance={balanceFor(a.id)} onUpdate={onUpdate} onRemove={onRemove} onView={setSelectedId} isLast={i === accounts.length - 1} />
        ))}
      </SectionCard>
    </div>
  );
}

function AccountRow({ account, balance, onUpdate, onRemove, onView, isLast }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [type, setType] = useState(account.type);
  const [customType, setCustomType] = useState(account.customType || "");

  useEffect(() => {
    setName(account.name); setType(account.type); setCustomType(account.customType || "");
  }, [account]);

  const typeInfo = ACCOUNT_TYPES.find((t) => t.id === type) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
  const Icon = typeInfo.icon;
  const delta = balance - account.initialBalance;

  const save = () => {
    if (!name.trim()) return;
    onUpdate(account.id, { name: name.trim(), type, customType: type === "other" ? customType.trim() : "" });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ padding: "12px 2px", borderBottom: isLast ? "none" : "1px solid " + COLORS.border }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8, marginBottom: 8 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: 13 }} />
          <AccountTypeSelect value={type} onChange={setType} compact />
        </div>
        {type === "other" && (
          <input placeholder="Custom type label (optional)" value={customType} onChange={(e) => setCustomType(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, fontSize: 13 }} />
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={save} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Check size={12} /> Save
          </button>
          <button onClick={() => setEditing(false)} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: COLORS.muted }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 2px", borderBottom: isLast ? "none" : "1px solid " + COLORS.border }}>
      <div onClick={() => onView(account.id)} style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, cursor: "pointer" }}>
        <span style={{ width: 38, height: 38, minWidth: 38, borderRadius: "50%", background: typeInfo.color + "22", color: typeInfo.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.name}</div>
          <div style={{ fontSize: 11, color: COLORS.muted }}>{account.customType || typeInfo.label} · Started at {fmt(account.initialBalance)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 14, fontWeight: 800 }}>{fmt(balance)}</div>
          {delta !== 0 && (
            <div style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? COLORS.green : COLORS.rose }}>
              {delta >= 0 ? "+" : "−"}{fmt(Math.abs(delta))}
            </div>
          )}
        </div>
        <ChevronRight size={16} style={{ color: COLORS.mutedLight, minWidth: 16 }} />
      </div>
      <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}>
        <Pencil size={14} />
      </button>
      <button onClick={() => onRemove(account.id)} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/* ---------- add transaction ---------- */

/* ---------- debts (money owed to you) ---------- */

function DebtRow({ d, accounts, last, onSetDebtSettled, onLogAsIncome }) {
  const [picking, setPicking] = useState(false);
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");

  const handleLogClick = () => {
    if (accounts.length === 0) { onLogAsIncome(d.entryId, d.id, null); return; }
    setPicking((v) => !v);
  };

  const confirm = () => {
    onLogAsIncome(d.entryId, d.id, accountId || null);
    setPicking(false);
  };

  return (
    <div style={{ borderBottom: last ? "none" : "1px solid " + COLORS.border, opacity: d.settled ? 0.55 : 1, padding: "11px 2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.entryNote} · {relDateLabel(d.entryDate)}</div>
        </div>
        <span className="mono" style={{ fontSize: 13.5, fontWeight: 700, textDecoration: d.settled ? "line-through" : "none", whiteSpace: "nowrap" }}>{fmt(d.amount)}</span>
        {!d.settled ? (
          <>
            <button onClick={handleLogClick} title="Log repayment as income" style={{ background: picking ? COLORS.greenLight : COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, color: COLORS.green, cursor: "pointer", padding: "5px 7px", display: "flex" }}>
              <TrendingUp size={13} />
            </button>
            <button onClick={() => onSetDebtSettled(d.entryId, d.id, true)} title="Mark as paid" style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, color: COLORS.muted, cursor: "pointer", padding: "5px 7px", display: "flex" }}>
              <Check size={13} />
            </button>
          </>
        ) : (
          <button onClick={() => onSetDebtSettled(d.entryId, d.id, false)} title="Mark as unpaid" style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, color: COLORS.mutedLight, cursor: "pointer", padding: "5px 7px", display: "flex" }}>
            <Power size={13} />
          </button>
        )}
      </div>
      {picking && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, background: COLORS.bg, border: "1px solid " + COLORS.border, borderRadius: 10, padding: 10 }}>
          <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, whiteSpace: "nowrap" }}>Deposit into</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} allowUnassigned compact />
          </div>
          <button onClick={confirm} style={{ background: COLORS.green, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            Confirm
          </button>
          <button onClick={() => setPicking(false)} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: COLORS.muted }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function Debts({ entries, accounts, onSetDebtSettled, onLogAsIncome }) {
  const [filter, setFilter] = useState("outstanding");

  const allDebts = useMemo(() => {
    const list = [];
    entries.forEach((e) => {
      (e.debts || []).forEach((d) => {
        list.push({ ...d, entryId: e.id, entryNote: e.note || e.category, entryDate: e.date });
      });
    });
    return list.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  }, [entries]);

  const outstanding = allDebts.filter((d) => !d.settled);
  const settled = allDebts.filter((d) => d.settled);
  const totalOwed = outstanding.reduce((s, d) => s + d.amount, 0);
  const totalSettled = settled.reduce((s, d) => s + d.amount, 0);

  const byPerson = useMemo(() => {
    const map = {};
    outstanding.forEach((d) => {
      const key = d.name.trim().toLowerCase();
      if (!map[key]) map[key] = { name: d.name, total: 0, count: 0 };
      map[key].total += d.amount;
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [outstanding]);

  const filtered = filter === "all" ? allDebts : filter === "outstanding" ? outstanding : settled;

  return (
    <div>
      <SectionCard title="Owed to You">
        <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: COLORS.green }}>{fmt(totalOwed)}</div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
          {outstanding.length} outstanding IOU{outstanding.length !== 1 ? "s" : ""}
          {totalSettled > 0 ? ` · ${fmt(totalSettled)} already settled` : ""}
        </div>
      </SectionCard>

      {byPerson.length > 0 && (
        <>
          <div style={{ height: 16 }} />
          <SectionCard title="By Person">
            {byPerson.map((p, i) => (
              <div key={p.name + i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 2px", borderBottom: i === byPerson.length - 1 ? "none" : "1px solid " + COLORS.border }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.orangeLight, color: COLORS.orangeDark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>{p.count} unpaid IOU{p.count !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 14, fontWeight: 800 }}>{fmt(p.total)}</span>
              </div>
            ))}
          </SectionCard>
        </>
      )}

      <div style={{ height: 16 }} />

      <SectionCard title="All IOUs" right={
        <div style={{ display: "flex", gap: 6 }}>
          {[["outstanding", "Outstanding"], ["settled", "Settled"], ["all", "All"]].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} style={{
              padding: "6px 11px", borderRadius: 999, border: "1px solid " + (filter === id ? COLORS.orange : COLORS.border),
              background: filter === id ? COLORS.orangeLight : COLORS.card, color: filter === id ? COLORS.orangeDark : COLORS.muted,
              fontSize: 11.5, fontWeight: 700, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
      }>
        {filtered.length === 0 && <EmptyNote>Nothing here yet. Tick "Other people owe me for this" when adding an expense to start tracking IOUs.</EmptyNote>}
        {filtered.map((d, i) => (
          <DebtRow key={d.id} d={d} accounts={accounts} last={i === filtered.length - 1} onSetDebtSettled={onSetDebtSettled} onLogAsIncome={onLogAsIncome} />
        ))}
      </SectionCard>
    </div>
  );
}

function AddTransaction({ onAdd, preset, accounts, quickAdds, onAddQuickAdd, onUpdateQuickAdd, onRemoveQuickAdd, categories, onAddCategory }) {
  const [form, setForm] = useState({ type: "expense", amount: "", category: categories.expense[0], note: "", date: todayISO(), accountId: "" });
  const [shared, setShared] = useState(false);
  const [sharedTotal, setSharedTotal] = useState("");
  const [debtors, setDebtors] = useState([]);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [excludeFromBudget, setExcludeFromBudget] = useState(false);
  const [excludedPeriods, setExcludedPeriods] = useState(BUDGET_PERIODS);
  const [error, setError] = useState("");
  const [editingQuickAdds, setEditingQuickAdds] = useState(false);
  const [quickEntryText, setQuickEntryText] = useState("");

  useEffect(() => {
    if (accounts.length > 0) {
      setForm((f) => f.accountId ? f : { ...f, accountId: accounts[0].id });
      setTransferFrom((v) => v || accounts[0].id);
      setTransferTo((v) => v || (accounts[1] ? accounts[1].id : ""));
    }
  }, [accounts]);

  const switchType = (type) => setForm((f) => ({ ...f, type, category: type === "expense" ? categories.expense[0] : type === "income" ? categories.income[0] : f.category }));

  useEffect(() => {
    if (preset && preset.type) switchType(preset.type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset && preset.token]);

  const addDebtorRow = () => setDebtors((prev) => [...prev, { id: uid(), name: "", amount: "" }]);
  const updateDebtorRow = (id, patch) => setDebtors((prev) => prev.map((d) => d.id === id ? { ...d, ...patch } : d));
  const removeDebtorRow = (id) => setDebtors((prev) => prev.filter((d) => d.id !== id));

  const splitEvenly = () => {
    const total = parseFloat(sharedTotal) || 0;
    if (!debtors.length || total <= 0) return;
    // Split between everyone including you: each person owing gets an equal share,
    // and any leftover cent from rounding stays in your share (total - what's owed).
    const each = Math.floor((total / (debtors.length + 1)) * 100) / 100;
    setDebtors((prev) => prev.map((d) => ({ ...d, amount: each.toFixed(2) })));
  };

  const debtorsSum = debtors.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
  const totalNum = parseFloat(sharedTotal) || 0;
  const yourShare = shared ? Math.max(0, totalNum - debtorsSum) : null;
  const overAllocated = shared && debtorsSum > totalNum + 0.001;

  const submit = () => {
    let amount = parseFloat(form.amount);
    let note = form.note.trim();
    let debtsPayload = null;
    let debtsTotal = null;

    if (form.type === "transfer") {
      amount = parseFloat(form.amount);
      if (!amount || amount <= 0) { setError("Enter an amount greater than zero."); return; }
      if (!transferFrom || !transferTo) { setError("Choose both a from and to account."); return; }
      if (transferFrom === transferTo) { setError("Pick two different accounts."); return; }
      if (!form.date) { setError("Pick a date."); return; }
      setError("");
      onAdd({ type: "transfer", amount, fromAccountId: transferFrom, toAccountId: transferTo, note, date: form.date });
      setForm((f) => ({ ...f, amount: "", note: "" }));
      return;
    }

    if (shared) {
      const total = parseFloat(sharedTotal);
      if (!total || total <= 0) { setError("Enter the total cost."); return; }
      if (debtors.length === 0) { setError("Add at least one person who owes you."); return; }
      if (debtors.some((d) => !parseFloat(d.amount) || parseFloat(d.amount) <= 0)) { setError("Enter an amount owed for each person."); return; }
      if (debtorsSum > total + 0.001) { setError("The amounts owed add up to more than the total cost."); return; }
      amount = total - debtorsSum;
      debtsPayload = debtors.map((d) => ({ id: uid(), name: d.name.trim() || "Someone", amount: parseFloat(d.amount), settled: false }));
      debtsTotal = total;
    }
    if (!amount || amount <= 0) { setError("Enter an amount greater than zero."); return; }
    if (!form.date) { setError("Pick a date."); return; }
    setError("");
    onAdd({ type: form.type, amount, category: form.category, note, date: form.date, debts: debtsPayload, debtsTotal, accountId: form.accountId || null, excludeFromBudget: form.type !== "transfer" ? excludeFromBudget : false, excludedPeriods: form.type !== "transfer" && excludeFromBudget && excludedPeriods.length < BUDGET_PERIODS.length ? excludedPeriods : undefined });
    setForm((f) => ({ ...f, amount: "", note: "" }));
    setShared(false); setSharedTotal(""); setDebtors([]); setExcludeFromBudget(false); setExcludedPeriods(BUDGET_PERIODS);
  };

  const quickAdd = (q) => onAdd({ type: "expense", amount: q.amount, category: q.category, note: q.label, date: form.date || todayISO(), debts: null, debtsTotal: null, accountId: q.accountId || null });

  const submitQuickEntry = () => {
    const parsed = parseQuickEntry(quickEntryText, categories, quickAdds);
    if (!parsed) return;
    onAdd({
      type: parsed.type, amount: parsed.amount, category: parsed.category, note: parsed.note,
      date: form.date || todayISO(), debts: null, debtsTotal: null,
      accountId: parsed.accountId || form.accountId || null,
      excludeFromBudget: false,
    });
    setQuickEntryText("");
  };

  const quickEntryPreview = quickEntryText.trim() ? parseQuickEntry(quickEntryText, categories, quickAdds) : null;

  return (
    <div>
      <SectionCard title="Quick Entry" icon={<Sparkles size={13} />}>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
          Type an amount and a word or two, then hit Enter — e.g. "20 lunch", "grab 12", or "+500 salary" for income.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="e.g. 20 lunch"
            value={quickEntryText}
            onChange={(e) => setQuickEntryText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && quickEntryPreview) submitQuickEntry(); }}
            style={{ flex: 1, minWidth: 0 }}
          />
          <button onClick={submitQuickEntry} disabled={!quickEntryPreview} style={{
            display: "flex", alignItems: "center", gap: 6, background: quickEntryPreview ? COLORS.orange : COLORS.border,
            color: "#fff", border: "none", borderRadius: 10, padding: "0 16px", fontWeight: 700, fontSize: 13.5,
            cursor: quickEntryPreview ? "pointer" : "not-allowed"
          }}>
            <Plus size={16} /> Add
          </button>
        </div>
        {quickEntryPreview && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: catColor(quickEntryPreview.category) }} />
            <span style={{ color: COLORS.muted }}>
              Will log as <strong style={{ color: COLORS.text }}>{quickEntryPreview.type === "income" ? "income" : "expense"}</strong> ·{" "}
              <strong style={{ color: COLORS.text }}>{fmt(quickEntryPreview.amount)}</strong> ·{" "}
              <strong style={{ color: COLORS.text }}>{quickEntryPreview.category}</strong>
              {quickEntryPreview.note && quickEntryPreview.note !== quickEntryPreview.category ? ` · "${quickEntryPreview.note}"` : ""}
            </span>
          </div>
        )}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Quick Add" icon={<Zap size={13} />} right={
        <button onClick={() => setEditingQuickAdds((v) => !v)} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {editingQuickAdds ? "Done" : "Edit"}
        </button>
      }>
        {editingQuickAdds ? (
          <QuickAddEditor quickAdds={quickAdds} onUpdate={onUpdateQuickAdd} onRemove={onRemoveQuickAdd} onAdd={onAddQuickAdd} categories={categories} accounts={accounts} onAddCategory={onAddCategory} />
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {quickAdds.length === 0 && <EmptyNote>No quick adds yet — tap Edit to add one.</EmptyNote>}
            {quickAdds.map((q) => (
              <button key={q.id} onClick={() => quickAdd(q)} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 13px", borderRadius: 999, border: "1px solid " + COLORS.border, background: COLORS.bg,
                color: COLORS.text, cursor: "pointer"
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: catColor(q.category) }} />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{q.label}</span>
                <span className="mono" style={{ fontSize: 11.5, color: COLORS.muted }}>{fmt(q.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="New Transaction">
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {["expense", "income", "transfer"].map((t) => (
            <button key={t} onClick={() => switchType(t)} style={{
              flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid " + (form.type === t ? COLORS.orange : COLORS.border),
              background: form.type === t ? COLORS.orangeLight : COLORS.card,
              color: form.type === t ? COLORS.orangeDark : COLORS.muted,
              fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "capitalize"
            }}>{t}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <FieldLabel>Amount (RM){shared ? " — your share, auto-calculated" : ""}</FieldLabel>
            <input type="text" inputMode="decimal" placeholder="0.00" value={shared ? (yourShare !== null ? yourShare.toFixed(2) : "") : form.amount}
              disabled={shared}
              onChange={(e) => setForm((f) => ({ ...f, amount: formatCentsInput(e.target.value) }))}
              onFocus={(e) => e.target.select()}
              style={{ width: "100%", boxSizing: "border-box", opacity: shared ? 0.6 : 1 }} className="mono" />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} />
          </div>

          {form.type !== "transfer" && (
            <div>
              <FieldLabel>Category</FieldLabel>
              <CategorySelect value={form.category} onChange={(c) => setForm((f) => ({ ...f, category: c }))}
                options={form.type === "expense" ? categories.expense : categories.income} type={form.type} onAddCategory={onAddCategory} />
            </div>
          )}
          <div>
            <FieldLabel>Note (optional)</FieldLabel>
            <input type="text" placeholder="e.g. Lunch with team" value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} />
          </div>

          {form.type === "transfer" ? (
            accounts.length >= 2 ? (
              <>
                <div>
                  <FieldLabel>From Account</FieldLabel>
                  <AccountSelect value={transferFrom} onChange={setTransferFrom} accounts={accounts} />
                </div>
                <div>
                  <FieldLabel>To Account</FieldLabel>
                  <AccountSelect value={transferTo} onChange={setTransferTo} accounts={accounts} />
                </div>
              </>
            ) : (
              <div style={{ gridColumn: "1 / -1", fontSize: 12.5, color: COLORS.mutedLight }}>
                You need at least 2 accounts set up to transfer between them — add one in the Accounts tab.
              </div>
            )
          ) : accounts.length > 0 && (
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Account</FieldLabel>
              <AccountSelect value={form.accountId} onChange={(id) => setForm((f) => ({ ...f, accountId: id }))} accounts={accounts} allowUnassigned />
            </div>
          )}
        </div>

        {form.type === "expense" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.muted, cursor: "pointer", fontWeight: 600 }}>
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} style={{ width: 15, height: 15, padding: 0 }} />
              <Users size={14} /> Other people owe me for this
            </label>
            {shared && (
              <div style={{ marginTop: 10, background: COLORS.bg, border: "1px solid " + COLORS.border, borderRadius: 12, padding: 12 }}>
                <FieldLabel>Total Cost (RM)</FieldLabel>
                <input type="number" min="0" step="0.01" placeholder="0.00" value={sharedTotal} onChange={(e) => setSharedTotal(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box", marginBottom: 12 }} className="mono" />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <FieldLabel>Who owes you</FieldLabel>
                  {debtors.length > 0 && (
                    <button onClick={splitEvenly} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 11.5, fontWeight: 700, cursor: "pointer", marginBottom: 5 }}>
                      Split evenly
                    </button>
                  )}
                </div>

                {debtors.map((d) => (
                  <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                    <input type="text" placeholder="Name" value={d.name} onChange={(e) => updateDebtorRow(d.id, { name: e.target.value })} style={{ fontSize: 13 }} />
                    <input type="number" min="0" step="0.01" placeholder="0.00" value={d.amount} onChange={(e) => updateDebtorRow(d.id, { amount: e.target.value })} style={{ fontSize: 13 }} className="mono" />
                    <button onClick={() => removeDebtorRow(d.id)} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <button onClick={addDebtorRow} style={{
                  background: COLORS.orangeLight, color: COLORS.orangeDark, border: "none", borderRadius: 8,
                  padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", marginBottom: debtors.length ? 12 : 0
                }}>+ Add Person</button>

                {debtors.length > 0 && (
                  <div className="mono" style={{ fontSize: 12.5, color: overAllocated ? COLORS.rose : COLORS.muted, fontWeight: overAllocated ? 700 : 400 }}>
                    Your share <span style={{ color: overAllocated ? COLORS.rose : COLORS.text, fontWeight: 700 }}>{fmt(yourShare)}</span>
                    {" · "}Owed to you <span style={{ color: COLORS.green, fontWeight: 700 }}>{fmt(debtorsSum)}</span>
                    {overAllocated && " — exceeds total cost"}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {form.type !== "transfer" && (
          <div style={{ marginBottom: 12 }}>
            <BudgetExcludePicker checked={excludeFromBudget} periods={excludedPeriods}
              onChange={(chk, per) => { setExcludeFromBudget(chk); setExcludedPeriods(per); }}
              label={`Don't count this toward my ${form.type === "income" ? "goals" : "budgets"}`} />
          </div>
        )}

        {error && <div style={{ color: COLORS.rose, fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>{error}</div>}
        <button onClick={submit} style={{
          display: "flex", alignItems: "center", gap: 6, background: COLORS.orange, color: "#fff",
          border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer"
        }}>
          <Plus size={16} /> Add Entry
        </button>
      </SectionCard>
    </div>
  );
}

function QuickAddEditor({ quickAdds, onUpdate, onRemove, onAdd, categories, accounts, onAddCategory }) {
  return (
    <div>
      {quickAdds.map((q) => {
        const accent = catColor(q.category);
        return (
        <div key={q.id} style={{ marginBottom: 10, padding: 12, borderRadius: 12, border: "1px solid " + COLORS.border, borderLeft: `4px solid ${accent}`, background: COLORS.bg }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 10, height: 10, minWidth: 10, borderRadius: "50%", background: accent, marginBottom: 11 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <FieldLabel>Label</FieldLabel>
              <input value={q.label} onChange={(e) => onUpdate(q.id, { label: e.target.value })} style={{ width: "100%", boxSizing: "border-box", fontSize: 13 }} placeholder="Label" />
            </div>
            <button onClick={() => onRemove(q.id)} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex", padding: "9px 0" }}>
              <Trash2 size={15} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: accounts.length > 0 ? "0.8fr 1.2fr 1fr" : "0.8fr 1.2fr", gap: 8 }}>
            <div>
              <FieldLabel>Amount (RM)</FieldLabel>
              <input type="number" min="0" step="0.01" value={q.amount} onChange={(e) => onUpdate(q.id, { amount: parseFloat(e.target.value) || 0 })} style={{ width: "100%", boxSizing: "border-box", fontSize: 12.5 }} className="mono" />
            </div>
            <div>
              <FieldLabel>Category</FieldLabel>
              <CategorySelect value={q.category} onChange={(c) => onUpdate(q.id, { category: c })} options={categories.expense} type="expense" onAddCategory={onAddCategory} />
            </div>
            {accounts.length > 0 && (
              <div>
                <FieldLabel>Account</FieldLabel>
                <AccountSelect value={q.accountId || ""} onChange={(id) => onUpdate(q.id, { accountId: id || null })} accounts={accounts} allowUnassigned compact />
              </div>
            )}
          </div>
        </div>
        );
      })}
      <button onClick={() => onAdd({ label: "New Quick Add", amount: 0, category: categories.expense[0], accountId: null })} style={{
        background: COLORS.orangeLight, color: COLORS.orangeDark, border: "none", borderRadius: 8,
        padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer"
      }}>+ Add Quick Add</button>
    </div>
  );
}

/* ---------- ledger ---------- */

function CsvImporter({ categories, accounts, quickAdds, onImport, onClose }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setParseError("");
    setRows([]);
    setDateFrom("");
    setDateTo("");
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (isPdf) {
      setParsing(true);
      extractPdfText(file)
        .then((lines) => setRows(parseStatementLines(lines, categories, quickAdds)))
        .catch(() => setParseError("Couldn't read this PDF — it may be a scanned or image-based statement, which we can't extract text from yet."))
        .finally(() => setParsing(false));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target.result || "");
      setRows(parseCsvToEntries(parseCSV(text), categories, quickAdds));
    };
    reader.readAsText(file);
  };

  const toggleRow = (i) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, include: !r.include } : r));
  const updateRow = (i, patch) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const flipType = (i, r) => {
    const newType = r.type === "income" ? "expense" : "income";
    const catList = newType === "income" ? categories.income : categories.expense;
    updateRow(i, { type: newType, category: catList.includes(r.category) ? r.category : (catList[0] || "Other") });
  };

  const inRange = (date) => (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
  const visibleRows = rows.map((r, idx) => ({ ...r, _idx: idx })).filter((r) => inRange(r.date));
  const includedCount = visibleRows.filter((r) => r.include).length;
  const catsFor = (type) => type === "income" ? categories.income : categories.expense;
  const hasRange = !!(dateFrom || dateTo);

  const selectAllInRange = (include) => setRows((rs) => rs.map((r) => inRange(r.date) ? { ...r, include } : r));

  const doImport = () => {
    const toImport = rows.filter((r) => r.include && inRange(r.date)).map((r) => ({
      type: r.type, amount: r.amount, category: r.category, note: r.note,
      date: r.date, debts: null, debtsTotal: null, accountId: accountId || null, excludeFromBudget: false,
    }));
    if (!toImport.length) return;
    onImport(toImport);
    onClose();
  };

  return (
    <div className="nav-dropdown" style={{ background: COLORS.bg, border: "1px solid " + COLORS.border, borderRadius: 14, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>Import Transactions</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted, display: "flex" }}><X size={15} /></button>
      </div>
      {parsing ? (
        <div style={{ padding: "24px 0", textAlign: "center", fontSize: 12.5, color: COLORS.muted }}>Reading {fileName}…</div>
      ) : !fileName ? (
        <div>
          <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 0, marginBottom: 10 }}>
            Upload a CSV or PDF statement exported from your bank. We'll try to detect the date, amount, and description automatically, and guess a category for each row.
          </p>
          <input type="file" accept=".csv,.pdf,text/csv,application/pdf" onChange={(e) => handleFile(e.target.files[0])} style={{ fontSize: 12.5 }} />
        </div>
      ) : rows.length === 0 ? (
        <div>
          <EmptyNote>{parseError || `Couldn't find recognizable transactions in "${fileName}". Try exporting a plain CSV with Date, Description, and Amount columns, or a text-based (not scanned) PDF statement.`}</EmptyNote>
          <div style={{ marginTop: 10 }}>
            <input type="file" accept=".csv,.pdf,text/csv,application/pdf" onChange={(e) => handleFile(e.target.files[0])} style={{ fontSize: 12.5 }} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              {fileName} · {hasRange ? `${visibleRows.length} of ${rows.length} rows in range` : `${rows.length} row${rows.length === 1 ? "" : "s"} found`}, {includedCount} selected
            </div>
            <div style={{ minWidth: 160 }}>
              <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} allowUnassigned compact />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <FieldLabel>From</FieldLabel>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid " + COLORS.border, fontSize: 12, background: COLORS.card, color: COLORS.text }} />
            </div>
            <div>
              <FieldLabel>To</FieldLabel>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid " + COLORS.border, fontSize: 12, background: COLORS.card, color: COLORS.text }} />
            </div>
            {hasRange && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "6px 0" }}>
                Clear range
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={() => selectAllInRange(true)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "6px 0" }}>
              Select all{hasRange ? " in range" : ""}
            </button>
            <button onClick={() => selectAllInRange(false)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "6px 0" }}>
              Select none
            </button>
          </div>
          {visibleRows.length === 0 ? (
            <EmptyNote>No transactions fall in that date range.</EmptyNote>
          ) : (
            <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid " + COLORS.border, borderRadius: 10 }}>
              {visibleRows.map((r, pos) => (
                <div key={r._idx} style={{
                  display: "grid", gridTemplateColumns: "18px 82px 64px 1fr 108px", gap: 8, alignItems: "center",
                  padding: "8px 10px", borderBottom: pos < visibleRows.length - 1 ? "1px solid " + COLORS.border : "none",
                  opacity: r.include ? 1 : 0.45
                }}>
                  <input type="checkbox" checked={r.include} onChange={() => toggleRow(r._idx)} />
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{r.date}</div>
                  <button onClick={() => flipType(r._idx, r)} style={{
                    padding: "3px 6px", borderRadius: 999, border: "none", fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                    background: r.type === "income" ? COLORS.greenLight : COLORS.roseLight,
                    color: r.type === "income" ? COLORS.green : COLORS.rose
                  }}>{r.type === "income" ? "+" : "-"}{fmt(r.amount)}</button>
                  <input value={r.note} onChange={(e) => updateRow(r._idx, { note: e.target.value })}
                    style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid " + COLORS.border, fontSize: 12, background: COLORS.card, color: COLORS.text }} />
                  <select value={r.category} onChange={(e) => updateRow(r._idx, { category: e.target.value })}
                    style={{ padding: "5px 6px", borderRadius: 8, border: "1px solid " + COLORS.border, fontSize: 11.5, background: COLORS.card, color: COLORS.text }}>
                    {catsFor(r.type).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => { setRows([]); setFileName(""); }} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid " + COLORS.border, background: COLORS.card, color: COLORS.muted, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Choose different file</button>
            <button onClick={doImport} disabled={!includedCount} style={{
              flex: 1, padding: "9px 14px", borderRadius: 10, border: "none",
              background: includedCount ? COLORS.orange : COLORS.border, color: "#fff", fontWeight: 700, fontSize: 12.5,
              cursor: includedCount ? "pointer" : "not-allowed"
            }}>Import {includedCount} Transaction{includedCount === 1 ? "" : "s"}</button>
          </div>
        </>
      )}
    </div>
  );
}

function Ledger({ entries, catGroups, onRemove, onUpdate, onToggleBudget, onBulkAdd, preset, categories, accounts, quickAdds, onAddCategory }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [periodType, setPeriodType] = useState("all");
  const [anchor, setAnchor] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [acctFilter, setAcctFilter] = useState("all");
  const [showAdjustments, setShowAdjustments] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!preset || !preset.token) return;
    setPeriodType(preset.period || "all");
    setAnchor(new Date());
    setCatFilter(preset.category || "all");
    setTypeFilter(preset.type || "all");
    setAcctFilter("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset && preset.token]);

  useEffect(() => { setPage(1); }, [periodType, typeFilter, catFilter, acctFilter, anchor, showAdjustments]);

  const rangeKey = periodType === "day" ? "daily" : periodType === "week" ? "weekly" : "monthly";
  const range = periodType !== "all" ? periodRange(rangeKey, anchor) : null;

  const allCats = [...new Set([...categories.expense, ...categories.income])];
  const allParents = [...new Set([...((catGroups && catGroups.expense.parents) || []), ...((catGroups && catGroups.income.parents) || [])])];

  const activeFilterCount = (periodType !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (catFilter !== "all" ? 1 : 0) + (acctFilter !== "all" ? 1 : 0) + (!showAdjustments ? 1 : 0);

  const clearFilters = () => { setPeriodType("all"); setAnchor(new Date()); setTypeFilter("all"); setCatFilter("all"); setAcctFilter("all"); setShowAdjustments(true); };

  const matchesAccount = (e) => {
    if (acctFilter === "all") return true;
    if (acctFilter === "unassigned") return e.type !== "transfer" && !e.accountId;
    if (e.type === "transfer") return e.fromAccountId === acctFilter || e.toAccountId === acctFilter;
    return e.accountId === acctFilter;
  };

  const filtered = useMemo(() => (
    [...entries]
      .filter((e) => periodType === "all" || (e.date >= range.start && e.date <= range.end))
      .filter((e) => typeFilter === "all" || e.type === typeFilter)
      .filter((e) => catFilter === "all" || e.category === catFilter || parentOf(catGroups, e.type, e.category) === catFilter)
      .filter(matchesAccount)
      .filter((e) => showAdjustments || !e.adjustment)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  ), [entries, periodType, range, typeFilter, catFilter, acctFilter, showAdjustments, catGroups]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const pageItems = useMemo(() => (
    filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE)
  ), [filtered, clampedPage]);

  const groups = useMemo(() => {
    const map = new Map();
    pageItems.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    });
    return [...map.entries()];
  }, [pageItems]);

  const isCurrentPeriod = periodType === "all" ? true
    : periodType === "day" ? isoOf(anchor) === todayISO()
    : periodType === "week" ? isoOf(getMonday(anchor)) === isoOf(getMonday(new Date()))
    : anchor.getFullYear() === new Date().getFullYear() && anchor.getMonth() === new Date().getMonth();

  return (
    <SectionCard title="Transaction Ledger" right={
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setImportOpen((v) => !v); setFiltersOpen(false); }} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999,
          border: "1px solid " + COLORS.border, background: COLORS.card, color: COLORS.muted,
          fontSize: 12.5, fontWeight: 700, cursor: "pointer"
        }}>
          <Upload size={13} /> Import
        </button>
        <button onClick={() => { setFiltersOpen((v) => !v); setImportOpen(false); }} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999,
          border: "1px solid " + (activeFilterCount > 0 ? COLORS.orange : COLORS.border),
          background: activeFilterCount > 0 ? COLORS.orangeLight : COLORS.card,
          color: activeFilterCount > 0 ? COLORS.orangeDark : COLORS.muted, fontSize: 12.5, fontWeight: 700, cursor: "pointer"
        }}>
          <SlidersHorizontal size={13} /> Filters
          {activeFilterCount > 0 && (
            <span style={{ background: COLORS.orange, color: "#fff", borderRadius: 999, minWidth: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
              {activeFilterCount}
            </span>
          )}
          <ChevronDown size={13} style={{ transform: filtersOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>
      </div>
    }>
      {importOpen && (
        <CsvImporter
          categories={categories}
          accounts={accounts}
          quickAdds={quickAdds}
          onImport={onBulkAdd}
          onClose={() => setImportOpen(false)}
        />
      )}
      {filtersOpen && (
        <div className="nav-dropdown" style={{ background: COLORS.bg, border: "1px solid " + COLORS.border, borderRadius: 14, padding: 14, marginBottom: 14 }}>
          <FieldLabel>Period</FieldLabel>
          <div style={{ display: "flex", gap: 6, marginBottom: periodType === "all" ? 12 : 10 }}>
            {[["all", "All Time"], ["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([id, label]) => (
              <button key={id} onClick={() => { setPeriodType(id); setAnchor(new Date()); }} style={{
                flex: 1, padding: "8px 6px", borderRadius: 9, border: "1px solid " + (periodType === id ? COLORS.orange : COLORS.border),
                background: periodType === id ? COLORS.orangeLight : COLORS.card, color: periodType === id ? COLORS.orangeDark : COLORS.muted,
                fontWeight: 700, fontSize: 12, cursor: "pointer"
              }}>{label}</button>
            ))}
          </div>
          {periodType !== "all" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <button onClick={() => setAnchor((a) => shiftAnchor(rangeKey, a, -1))} style={navBtnStyle} aria-label="Previous"><ChevronLeft size={15} /></button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{range.label}</div>
                {!isCurrentPeriod && <button onClick={() => setAnchor(new Date())} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 10.5, cursor: "pointer", padding: 0, marginTop: 1, fontWeight: 700 }}>Jump to current</button>}
              </div>
              <button onClick={() => setAnchor((a) => shiftAnchor(rangeKey, a, 1))} style={navBtnStyle} aria-label="Next"><ChevronRight size={15} /></button>
            </div>
          )}

          <FieldLabel>Type</FieldLabel>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[["all", "All"], ["income", "Income"], ["expense", "Expense"], ["transfer", "Transfer"]].map(([id, label]) => (
              <button key={id} onClick={() => setTypeFilter(id)} style={{
                flex: 1, padding: "8px 6px", borderRadius: 9, border: "1px solid " + (typeFilter === id ? COLORS.blue : COLORS.border),
                background: typeFilter === id ? COLORS.blueLight : COLORS.card, color: typeFilter === id ? COLORS.blue : COLORS.muted,
                fontWeight: 700, fontSize: 12, cursor: "pointer"
              }}>{label}</button>
            ))}
          </div>

          <FieldLabel>Category</FieldLabel>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: 12 }}>
            <option value="all">All categories</option>
            {allParents.length > 0 && (
              <optgroup label="Groups (all categories inside)">
                {allParents.map((p) => <option key={"g:" + p} value={p}>{p} (all)</option>)}
              </optgroup>
            )}
            <optgroup label="Categories">
              {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          </select>

          {accounts.length > 0 && (
            <>
              <FieldLabel>Account</FieldLabel>
              <select value={acctFilter} onChange={(e) => setAcctFilter(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: activeFilterCount > 0 ? 12 : 0 }}>
                <option value="all">All accounts</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                <option value="unassigned">Unassigned</option>
              </select>
            </>
          )}

          {entries.some((e) => e.adjustment) && (
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: COLORS.muted, cursor: "pointer", fontWeight: 600, margin: "12px 0" }}>
              <input type="checkbox" checked={showAdjustments} onChange={(e) => setShowAdjustments(e.target.checked)} style={{ width: 14, height: 14, padding: 0 }} />
              Show balance adjustments
            </label>
          )}

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ background: "none", border: "none", color: COLORS.rose, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 && <EmptyNote>No entries match this filter.</EmptyNote>}
      {groups.map(([date, items], gi) => (
        <div key={date} style={{ marginBottom: gi === groups.length - 1 ? 0 : 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.muted, padding: "10px 2px 4px" }}>{relDateLabel(date)}</div>
          {items.map((e, i) => editingId === e.id ? (
            <EditEntryForm key={e.id} entry={e} categories={categories} accounts={accounts} onAddCategory={onAddCategory}
              onSave={(patch) => { onUpdate(e.id, patch); setEditingId(null); }}
              onCancel={() => setEditingId(null)} />
          ) : (
            <TxRow key={e.id} e={e} last={i === items.length - 1} onRemove={onRemove} onEdit={() => setEditingId(e.id)} onToggleBudget={onToggleBudget} hideDate accounts={accounts} />
          ))}
        </div>
      ))}

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 14, paddingTop: 14, borderTop: "1px solid " + COLORS.border }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage === 1} style={{
            ...navBtnStyle, opacity: clampedPage === 1 ? 0.4 : 1, cursor: clampedPage === 1 ? "not-allowed" : "pointer"
          }} aria-label="Previous page"><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted }}>Page {clampedPage} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={clampedPage === totalPages} style={{
            ...navBtnStyle, opacity: clampedPage === totalPages ? 0.4 : 1, cursor: clampedPage === totalPages ? "not-allowed" : "pointer"
          }} aria-label="Next page"><ChevronRight size={15} /></button>
        </div>
      )}
    </SectionCard>
  );
}

/* ---------- periods (daily / weekly / monthly profit-or-loss) ---------- */

function Periods({ entries, accounts }) {
  const [periodType, setPeriodType] = useState("daily");
  const [anchor, setAnchor] = useState(new Date());

  const range = useMemo(() => periodRange(periodType, anchor), [periodType, anchor]);

  const inRange = useMemo(() => (
    entries.filter((e) => e.date >= range.start && e.date <= range.end)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  ), [entries, range]);

  const totals = useMemo(() => {
    const income = inRange.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = inRange.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense };
  }, [inRange]);

  const isProfit = totals.net >= 0;
  const isToday = range.start === todayISO() && range.end === todayISO() && periodType === "daily";
  const isCurrentPeriod = periodType === "daily" ? isToday
    : periodType === "weekly" ? isoOf(getMonday(new Date())) === range.start
    : new Date().getFullYear() === anchor.getFullYear() && new Date().getMonth() === anchor.getMonth();

  return (
    <div>
      <SectionCard title="View By">
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {[["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]].map(([id, label]) => (
            <button key={id} onClick={() => { setPeriodType(id); setAnchor(new Date()); }} style={{
              flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid " + (periodType === id ? COLORS.orange : COLORS.border),
              background: periodType === id ? COLORS.orangeLight : COLORS.card, color: periodType === id ? COLORS.orangeDark : COLORS.muted,
              fontWeight: 700, fontSize: 13, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <button onClick={() => setAnchor((a) => shiftAnchor(periodType, a, -1))} style={navBtnStyle} aria-label="Previous period"><ChevronLeft size={16} /></button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{range.label}</div>
            {!isCurrentPeriod && (
              <button onClick={() => setAnchor(new Date())} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 11, cursor: "pointer", padding: 0, marginTop: 2, fontWeight: 700 }}>Jump to current</button>
            )}
          </div>
          <button onClick={() => setAnchor((a) => shiftAnchor(periodType, a, 1))} style={navBtnStyle} aria-label="Next period"><ChevronRight size={16} /></button>
        </div>

        <div style={{
          textAlign: "center", padding: "20px 12px", borderRadius: 16, marginBottom: 4,
          background: isProfit ? COLORS.greenLight : COLORS.roseLight
        }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: COLORS.muted, marginBottom: 6, fontWeight: 700 }}>
            {isProfit ? "Profit" : "Loss"} this {periodType === "daily" ? "day" : periodType === "weekly" ? "week" : "month"}
          </div>
          <div className="mono" style={{ fontSize: 30, fontWeight: 800, color: isProfit ? COLORS.green : COLORS.rose }}>
            {isProfit ? "+" : "−"}{fmt(Math.abs(totals.net))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <SummaryCard icon={<TrendingUp size={16} />} label="Income" value={fmt(totals.income)} color={COLORS.green} />
          <SummaryCard icon={<TrendingDown size={16} />} label="Expense" value={fmt(totals.expense)} color={COLORS.rose} />
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title={`Transactions (${inRange.length})`}>
        {inRange.length === 0 && <EmptyNote>No transactions in this period.</EmptyNote>}
        {inRange.map((e, i) => <TxRow key={e.id} e={e} last={i === inRange.length - 1} accounts={accounts} />)}
      </SectionCard>
    </div>
  );
}

const navBtnStyle = {
  background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 10, color: COLORS.text,
  cursor: "pointer", padding: "8px 10px", display: "flex", alignItems: "center", boxShadow: SHADOW
};

/* ---------- insights ---------- */

const ACCOUNT_PALETTE = ["#3B82F6", "#16A34A", "#8B5CF6", "#F43F5E", "#14B8A6", "#FBBF24", "#EC4899", "#6366F1", "#DC2626", "#06B6D4"];

function Insights({ entries, accounts, groups }) {
  const [periodType, setPeriodType] = useState("all");
  const [anchor, setAnchor] = useState(new Date());
  const [breakdownType, setBreakdownType] = useState("expense");
  const [groupBy, setGroupBy] = useState("category");
  const [chartView, setChartView] = useState("flow");
  const [catView, setCatView] = useState("group");
  const [drillOpen, setDrillOpen] = useState({});

  const rangeKey = periodType === "day" ? "daily" : periodType === "week" ? "weekly" : "monthly";
  const range = periodType !== "all" ? periodRange(rangeKey, anchor) : null;

  const accountColorMap = useMemo(() => {
    const map = {};
    accounts.forEach((a, i) => { map[a.name] = ACCOUNT_PALETTE[i % ACCOUNT_PALETTE.length]; });
    map["Unassigned"] = COLORS.mutedLight;
    return map;
  }, [accounts]);
  const accountNameFor = (accountId) => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc ? acc.name : "Unassigned";
  };
  const colorFor = (name) => (groupBy === "account" ? (accountColorMap[name] || hashColor(name)) : catColor(name));

  const scopedAll = useMemo(() => (
    entries.filter((e) => periodType === "all" || (e.date >= range.start && e.date <= range.end))
  ), [entries, periodType, range]);
  const scopedExpenses = useMemo(() => scopedAll.filter((e) => e.type === "expense"), [scopedAll]);
  const scopedByType = useMemo(() => scopedAll.filter((e) => e.type === breakdownType), [scopedAll, breakdownType]);

  const pieData = useMemo(() => {
    const map = {};
    scopedByType.forEach((e) => {
      const key = groupBy === "account" ? accountNameFor(e.accountId)
        : (catView === "group" ? (parentOf(groups, e.type, e.category) || e.category) : e.category);
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedByType, groupBy, accounts, catView, groups]);
  const hasGroups = !!(groups && groups[breakdownType] && groups[breakdownType].parents.length > 0);
  const childBreakdown = (parent) => {
    const m = {};
    scopedByType.forEach((e) => { if (parentOf(groups, breakdownType, e.category) === parent) m[e.category] = (m[e.category] || 0) + e.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };
  const breakdownTotal = pieData.reduce((s, d) => s + d.value, 0);

  const expenseTotal = useMemo(() => scopedExpenses.reduce((s, e) => s + e.amount, 0), [scopedExpenses]);
  const incomeTotal = useMemo(() => scopedAll.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0), [scopedAll]);

  const trend = useMemo(() => {
    if (periodType === "day") return buildTrend(entries, "daily", anchor, 14);
    if (periodType === "week") return buildTrend(entries, "weekly", anchor, 8);
    if (periodType === "month") return buildTrend(entries, "monthly", anchor, 6);
    return buildTrend(entries, "monthly", new Date(), 12);
  }, [entries, periodType, anchor]);

  const trendSpan = periodType === "day" ? "14-Day" : periodType === "week" ? "8-Week" : periodType === "month" ? "6-Month" : "12-Month";
  const trendTitle = `${trendSpan} ${chartView === "income" ? "Income" : chartView === "expense" ? "Expense" : "Cash Flow"}`;

  const daysInScope = useMemo(() => {
    if (periodType === "day") return 1;
    if (periodType === "week") return 7;
    if (periodType === "month") {
      const isCurrent = anchor.getFullYear() === new Date().getFullYear() && anchor.getMonth() === new Date().getMonth();
      return isCurrent ? Math.max(1, new Date().getDate()) : daysInMonth(anchor.getFullYear(), anchor.getMonth() + 1);
    }
    if (!scopedAll.length) return 1;
    const dates = scopedAll.map((e) => parseLocal(e.date).getTime());
    return Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1);
  }, [periodType, anchor, scopedAll]);

  const avgPerDay = breakdownTotal / daysInScope;
  const biggestItem = useMemo(() => [...scopedByType].sort((a, b) => b.amount - a.amount)[0] || null, [scopedByType]);

  const weekdayData = useMemo(() => {
    const sums = Array(7).fill(0);
    scopedExpenses.forEach((e) => { sums[parseLocal(e.date).getDay()] += e.amount; });
    return WEEKDAY_LABELS.map((label, i) => ({ label: label.slice(0, 3), value: sums[i] }));
  }, [scopedExpenses]);

  const prevRange = useMemo(() => (
    periodType === "all" ? null : periodRange(rangeKey, shiftAnchor(rangeKey, anchor, -1))
  ), [periodType, rangeKey, anchor]);

  const prevTotals = useMemo(() => {
    if (!prevRange) return null;
    const scoped = entries.filter((e) => e.date >= prevRange.start && e.date <= prevRange.end);
    const income = scoped.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = scoped.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense };
  }, [entries, prevRange]);

  const isCurrentPeriod = periodType === "all" ? true
    : periodType === "day" ? isoOf(anchor) === todayISO()
    : periodType === "week" ? isoOf(getMonday(anchor)) === isoOf(getMonday(new Date()))
    : anchor.getFullYear() === new Date().getFullYear() && anchor.getMonth() === new Date().getMonth();

  return (
    <div>
      <SectionCard title="View By">
        <div style={{ display: "flex", gap: 6, marginBottom: periodType === "all" ? 0 : 16 }}>
          {[["day", "Day"], ["week", "Week"], ["month", "Month"], ["all", "All Time"]].map(([id, label]) => (
            <button key={id} onClick={() => { setPeriodType(id); setAnchor(new Date()); }} style={{
              flex: 1, padding: "9px 8px", borderRadius: 10, border: "1px solid " + (periodType === id ? COLORS.orange : COLORS.border),
              background: periodType === id ? COLORS.orangeLight : COLORS.card, color: periodType === id ? COLORS.orangeDark : COLORS.muted,
              fontWeight: 700, fontSize: 12.5, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
        {periodType !== "all" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={() => setAnchor((a) => shiftAnchor(rangeKey, a, -1))} style={navBtnStyle} aria-label="Previous"><ChevronLeft size={16} /></button>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>{range.label}</div>
              {!isCurrentPeriod && (
                <button onClick={() => setAnchor(new Date())} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 11, cursor: "pointer", padding: 0, marginTop: 2, fontWeight: 700 }}>Jump to current</button>
              )}
            </div>
            <button onClick={() => setAnchor((a) => shiftAnchor(rangeKey, a, 1))} style={navBtnStyle} aria-label="Next"><ChevronRight size={16} /></button>
          </div>
        )}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title={trendTitle} right={
        <div style={{ display: "flex", gap: 6 }}>
          {[["flow", "Cash Flow"], ["income", "Income"], ["expense", "Expense"]].map(([id, label]) => (
            <button key={id} onClick={() => setChartView(id)} style={{
              padding: "6px 11px", borderRadius: 999, border: "1px solid " + (chartView === id ? COLORS.orange : COLORS.border),
              background: chartView === id ? COLORS.orangeLight : COLORS.card, color: chartView === id ? COLORS.orangeDark : COLORS.muted,
              fontSize: 11.5, fontWeight: 700, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
      }>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={trend} margin={{ top: 6, right: 10, bottom: 0, left: -14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
            <XAxis dataKey="label" stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} width={44} />
            <Tooltip contentStyle={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 10, fontSize: 12 }} formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {chartView !== "expense" && <Bar dataKey="income" name="Income" fill={COLORS.green} radius={[5, 5, 0, 0]} barSize={14} />}
            {chartView !== "income" && <Bar dataKey="expense" name="Expense" fill={COLORS.rose} radius={[5, 5, 0, 0]} barSize={14} />}
            {chartView === "flow" && <Line type="monotone" dataKey="net" name="Net" stroke={COLORS.orangeDark} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.orangeDark }} />}
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>

      {prevTotals && (
        <>
          <div style={{ height: 16 }} />
          <SectionCard title="Compared to Previous Period">
            <CompareRow label="Income" current={incomeTotal} previous={prevTotals.income} higherIsBetter />
            <CompareRow label="Expenses" current={expenseTotal} previous={prevTotals.expense} higherIsBetter={false} />
            <CompareRow label="Net" current={incomeTotal - expenseTotal} previous={prevTotals.net} higherIsBetter />
          </SectionCard>
        </>
      )}

      <div style={{ height: 16 }} />

      <SectionCard title={`${breakdownType === "expense" ? "Expense" : "Income"} Breakdown by ${groupBy === "account" ? "Account" : "Category"}`} right={
        <div style={{ display: "flex", gap: 6 }}>
          {[["expense", "Expense"], ["income", "Income"]].map(([id, label]) => (
            <button key={id} onClick={() => setBreakdownType(id)} style={{
              padding: "6px 12px", borderRadius: 999, border: "1px solid " + (breakdownType === id ? COLORS.orange : COLORS.border),
              background: breakdownType === id ? COLORS.orangeLight : COLORS.card, color: breakdownType === id ? COLORS.orangeDark : COLORS.muted,
              fontSize: 11.5, fontWeight: 700, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
      }>
        {accounts.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[["category", "By Category"], ["account", "By Account"]].map(([id, label]) => (
              <button key={id} onClick={() => setGroupBy(id)} style={{
                flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid " + (groupBy === id ? COLORS.blue : COLORS.border),
                background: groupBy === id ? COLORS.blueLight : COLORS.card, color: groupBy === id ? COLORS.blue : COLORS.muted,
                fontSize: 12.5, fontWeight: 700, cursor: "pointer"
              }}>{label}</button>
            ))}
          </div>
        )}
        {groupBy === "category" && hasGroups && (
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[["group", "Grouped"], ["sub", "Sub-categories"]].map(([id, label]) => (
              <button key={id} onClick={() => setCatView(id)} style={{
                padding: "6px 12px", borderRadius: 999, border: "1px solid " + (catView === id ? COLORS.orange : COLORS.border),
                background: catView === id ? COLORS.orangeLight : COLORS.card, color: catView === id ? COLORS.orangeDark : COLORS.muted,
                fontSize: 11.5, fontWeight: 700, cursor: "pointer"
              }}>{label}</button>
            ))}
            {catView === "group" && <span style={{ fontSize: 11, color: COLORS.mutedLight, alignSelf: "center" }}>Tap a group to see what's inside</span>}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
          <SummaryCard icon={<Wallet size={16} />} label={breakdownType === "expense" ? "Avg Daily Spend" : "Avg Daily Income"} value={fmt(avgPerDay)} color={COLORS.orange} />
          <SummaryCard icon={breakdownType === "expense" ? <TrendingUp size={16} /> : <TrendingDown size={16} />} label={breakdownType === "expense" ? "Income" : "Expenses"} value={fmt(breakdownType === "expense" ? incomeTotal : expenseTotal)} color={breakdownType === "expense" ? COLORS.green : COLORS.rose} />
          <SummaryCard icon={<Target size={16} />} label={groupBy === "account" ? "Top Account" : (breakdownType === "expense" ? "Top Expense Category" : "Top Income Source")} value={pieData[0] ? pieData[0].name : "—"} color={COLORS.blue} sub={pieData[0] ? fmt(pieData[0].value) : null} />
          <SummaryCard icon={<TrendingDown size={16} />} label={breakdownType === "expense" ? "Biggest Expense" : "Biggest Income"} value={biggestItem ? fmt(biggestItem.amount) : "—"} color={COLORS.rose} sub={biggestItem ? (biggestItem.note || biggestItem.category) : null} />
        </div>

        {pieData.length === 0 ? (
          <EmptyNote>No {breakdownType === "expense" ? "expenses" : "income"} recorded in this period.</EmptyNote>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 22, alignItems: "center" }}>
            <div style={{ position: "relative", width: 170, height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={colorFor(d.name)} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 10, fontSize: 12 }} formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 800 }}>{fmt(breakdownTotal)}</div>
                <div style={{ fontSize: 10.5, color: COLORS.muted, fontWeight: 600 }}>Total</div>
              </div>
            </div>
            <div>
              {pieData.slice(0, 6).map((d) => {
                const pct = breakdownTotal > 0 ? (d.value / breakdownTotal) * 100 : 0;
                const drillable = groupBy === "category" && catView === "group" && isParentName(groups, breakdownType, d.name);
                const isOpen = drillable && !!drillOpen[d.name];
                return (
                  <div key={d.name} style={{ marginBottom: 10 }}>
                    <div onClick={drillable ? () => setDrillOpen((o) => ({ ...o, [d.name]: !o[d.name] })) : undefined}
                      style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, cursor: drillable ? "pointer" : "default" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                        {drillable && <ChevronDown size={12} style={{ color: COLORS.muted, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />}
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: colorFor(d.name) }} />{d.name}
                      </span>
                      <span className="mono" style={{ color: COLORS.muted }}>{fmt(d.value)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: COLORS.bg, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: colorFor(d.name), borderRadius: 4 }} />
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 6, background: COLORS.bg, borderRadius: 10, padding: "4px 10px" }}>
                        {childBreakdown(d.name).map((ch, i, arr) => (
                          <div key={ch.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, padding: "5px 0", borderBottom: i < arr.length - 1 ? "1px solid " + COLORS.border : "none" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.muted }}>
                              <span style={{ width: 6, height: 6, borderRadius: 2, background: catColor(ch.name) }} />{ch.name}
                            </span>
                            <span className="mono">{fmt(ch.value)} · {d.value > 0 ? ((ch.value / d.value) * 100).toFixed(0) : 0}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {periodType !== "day" && weekdayData.some((d) => d.value > 0) && (
        <>
          <div style={{ height: 16 }} />
          <SectionCard title="Spending by Day of Week">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weekdayData} margin={{ top: 6, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                <XAxis dataKey="label" stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 10, fontSize: 12 }} formatter={(v) => fmt(v)} />
                <Bar dataKey="value" fill={COLORS.orange} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function CompareRow({ label, current, previous, higherIsBetter }) {
  const diff = current - previous;
  const pct = previous !== 0 ? (diff / Math.abs(previous)) * 100 : (current !== 0 ? 100 : 0);
  const isUp = diff > 0;
  const good = higherIsBetter ? isUp : !isUp;
  const color = diff === 0 ? COLORS.muted : good ? COLORS.green : COLORS.rose;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 2px" }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <div className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{fmt(current)}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color, display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
          {diff === 0 ? "No change" : (
            <>
              {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(pct).toFixed(0)}% vs {fmt(previous)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- budgets ---------- */

function Budgets({ entries, groups, budgets, onSetBudget, onRemoveBudget, masterBudgets, onSetMasterBudget, onRemoveMasterBudget, categories, onAddCategory }) {
  const [budgetType, setBudgetType] = useState("expense");
  const [cat, setCat] = useState(categories.expense[0]);
  const [period, setPeriod] = useState("monthly");
  const [limit, setLimit] = useState("");
  const [expanded, setExpanded] = useState({});
  const toggleExpanded = (key) => setExpanded((e) => ({ ...e, [key]: !e[key] }));

  const isIncome = budgetType === "income";

  const switchType = (type) => {
    setBudgetType(type);
    setCat((categories[type] || [])[0] || "");
  };

  // Returns the exact date range plus the matching, sorted transactions for
  // a category's budget period — powers both the progress total and the
  // expandable "Show transactions" breakdown.
  const categoryPeriodInfo = (category, periodType) => {
    const range = periodRange(periodType, new Date());
    const scope = categoryScope(groups, budgetType, category);
    const transactions = entries
      .filter((e) => e.type === budgetType && !isExcludedFrom(e, periodType) && scope.includes(e.category) && e.date >= range.start && e.date <= range.end)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    return { range, transactions, spent: transactions.reduce((s, e) => s + e.amount, 0) };
  };

  const masterPeriodInfo = useMemo(() => {
    const now = new Date();
    const build = (pt) => {
      const range = periodRange(pt, now);
      const transactions = entries
        .filter((e) => e.type === budgetType && !isExcludedFrom(e, pt) && e.date >= range.start && e.date <= range.end)
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
      return { range, transactions, spent: transactions.reduce((s, e) => s + e.amount, 0) };
    };
    return { daily: build("daily"), weekly: build("weekly"), monthly: build("monthly") };
  }, [entries, budgetType]);
  const masterSpent = { daily: masterPeriodInfo.daily.spent, weekly: masterPeriodInfo.weekly.spent, monthly: masterPeriodInfo.monthly.spent };

  const submitBudget = () => {
    const val = parseFloat(limit);
    if (!val || val <= 0) return;
    onSetBudget(budgetType, cat, period, val);
    setLimit("");
  };

  const groupBudgets = (budgets && budgets[budgetType]) || {};
  const groupMaster = (masterBudgets && masterBudgets[budgetType]) || {};
  const categoryBudgetEntries = Object.entries(groupBudgets).filter(([, periods]) => Object.keys(periods).length > 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["expense", "Expense Budgets"], ["income", "Income Goals"]].map(([id, label]) => (
          <button key={id} onClick={() => switchType(id)} style={{
            flex: 1, padding: "10px 12px", borderRadius: 12, border: "1px solid " + (budgetType === id ? COLORS.orange : COLORS.border),
            background: budgetType === id ? COLORS.orangeLight : COLORS.card, color: budgetType === id ? COLORS.orangeDark : COLORS.muted,
            fontWeight: 700, fontSize: 13, cursor: "pointer"
          }}>{label}</button>
        ))}
      </div>

      <SectionCard title={isIncome ? "Master Income Goal" : "Master Budget"} icon={<Target size={13} />}>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
          {isIncome
            ? "An overall earnings target across all income categories combined — sits above the per-category goals below."
            : "An overall spending ceiling across all categories combined — sits above the per-category budgets below."}
        </div>
        {["daily", "weekly", "monthly"].map((pt) => (
          <MasterBudgetRow
            key={pt}
            label={PERIOD_LABEL[pt]}
            limit={groupMaster[pt]}
            spent={masterSpent[pt]}
            isGoal={isIncome}
            onSet={(val) => onSetMasterBudget(budgetType, pt, val)}
            onRemove={() => onRemoveMasterBudget(budgetType, pt)}
            rangeLabel={formatDateRange(masterPeriodInfo[pt].range.start, masterPeriodInfo[pt].range.end)}
            transactions={masterPeriodInfo[pt].transactions}
          />
        ))}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title={isIncome ? "Set an Income Goal" : "Set a Category Budget"}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <FieldLabel>Category</FieldLabel>
            <CategorySelect value={cat} onChange={setCat} options={categories[budgetType]} type={budgetType} onAddCategory={onAddCategory} allowGroups />
          </div>
          <div>
            <FieldLabel>Period</FieldLabel>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <FieldLabel>{isIncome ? "Target (RM)" : "Limit (RM)"}</FieldLabel>
            <input type="number" min="0" step="1" placeholder="0.00" value={limit} onChange={(e) => setLimit(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} className="mono" />
          </div>
          <button onClick={submitBudget} style={{
            background: COLORS.orange, color: "#fff", border: "none", borderRadius: 10,
            padding: "9px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", height: 39
          }}>Set</button>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title={isIncome ? "Income Goals" : "Category Budgets"}>
        {categoryBudgetEntries.length === 0 && <EmptyNote>{isIncome ? "No income goals set yet. Add one above." : "No category budgets set yet. Add one above."}</EmptyNote>}
        {categoryBudgetEntries.map(([category, periods], idx) => (
          <div key={category} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: idx === categoryBudgetEntries.length - 1 ? "none" : "1px solid " + COLORS.border }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: catColor(category) }} />
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{category}</span>
              {isParentName(groups, budgetType, category) && (
                <span style={{ fontSize: 10.5, color: COLORS.mutedLight, fontWeight: 600 }}>Group · {childrenOf(groups, budgetType, category).join(", ") || "no categories yet"}</span>
              )}
              {parentOf(groups, budgetType, category) && (
                <span style={{ fontSize: 10.5, color: COLORS.mutedLight, fontWeight: 600 }}>in {parentOf(groups, budgetType, category)}</span>
              )}
            </div>
            {["daily", "weekly", "monthly"].filter((pt) => periods[pt] != null).map((pt) => {
              const lim = periods[pt];
              const { range, transactions, spent } = categoryPeriodInfo(category, pt);
              const pct = Math.min(100, (spent / lim) * 100);
              const over = spent > lim;
              const color = isIncome
                ? (spent >= lim ? COLORS.green : pct >= 70 ? COLORS.amber : COLORS.blue)
                : (over ? COLORS.rose : pct >= 70 ? COLORS.amber : COLORS.green);
              const key = `${budgetType}::${category}::${pt}`;
              const isOpen = !!expanded[key];
              return (
                <div key={pt} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                    <span style={{ color: COLORS.muted, fontWeight: 600 }}>{PERIOD_LABEL[pt]}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="mono" style={{ color: !isIncome && over ? COLORS.rose : COLORS.muted }}>{fmt(spent)} / {fmt(lim)}</span>
                      <button onClick={() => onRemoveBudget(budgetType, category, pt)} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}><Trash2 size={12} /></button>
                    </span>
                  </div>
                  <div style={{ fontSize: 10.5, color: COLORS.mutedLight, marginBottom: 4 }}>{formatDateRange(range.start, range.end)}</div>
                  <div style={{ height: 6, borderRadius: 4, background: COLORS.bg, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
                  </div>
                  {isIncome
                    ? (spent >= lim
                        ? <div style={{ fontSize: 10.5, color: COLORS.green, marginTop: 3, fontWeight: 600 }}>Goal reached · +{fmt(spent - lim)} over</div>
                        : <div style={{ fontSize: 10.5, color: COLORS.mutedLight, marginTop: 3, fontWeight: 600 }}>{fmt(lim - spent)} to go</div>)
                    : (over && <div style={{ fontSize: 10.5, color: COLORS.rose, marginTop: 3, fontWeight: 600 }}>Over by {fmt(spent - lim)}</div>)}
                  <button onClick={() => toggleExpanded(key)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: "6px 0 0", display: "flex", alignItems: "center", gap: 3 }}>
                    {isOpen ? "Hide" : "Show"} transactions ({transactions.length})
                    <ChevronDown size={11} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 6, background: COLORS.bg, borderRadius: 10, padding: transactions.length ? "4px 10px" : "8px 10px" }}>
                      {transactions.length === 0 ? (
                        <div style={{ fontSize: 11, color: COLORS.mutedLight, padding: "4px 0" }}>No transactions in this period yet.</div>
                      ) : transactions.map((e, i) => (
                        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, padding: "5px 0", borderBottom: i < transactions.length - 1 ? "1px solid " + COLORS.border : "none" }}>
                          <span style={{ color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{relDateLabel(e.date)}{e.note ? " · " + e.note : ""}</span>
                          <span className="mono" style={{ flexShrink: 0, marginLeft: 8 }}>{fmt(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

function MasterBudgetRow({ label, limit, spent, onSet, onRemove, rangeLabel, transactions, isGoal }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(limit || "");
  const [showTx, setShowTx] = useState(false);

  useEffect(() => { setVal(limit || ""); }, [limit]);

  const save = () => {
    const n = parseFloat(val);
    if (!n || n <= 0) return;
    onSet(n);
    setEditing(false);
  };

  const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
  const over = limit && spent > limit;
  const color = isGoal
    ? (limit && spent >= limit ? COLORS.green : pct >= 70 ? COLORS.amber : COLORS.blue)
    : (over ? COLORS.rose : pct >= 70 ? COLORS.amber : COLORS.green);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        {!editing && limit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 12, color: !isGoal && over ? COLORS.rose : COLORS.muted }}>{fmt(spent)} / {fmt(limit)}</span>
            <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Edit</button>
            <button onClick={onRemove} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}><Trash2 size={12} /></button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="number" min="0" step="1" placeholder={isGoal ? "RM target" : "RM limit"} value={val} onChange={(e) => setVal(e.target.value)}
              style={{ width: 100, padding: "5px 8px", fontSize: 12.5 }} className="mono" />
            <button onClick={save} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Save</button>
          </div>
        )}
      </div>
      {rangeLabel && <div style={{ fontSize: 10.5, color: COLORS.mutedLight, marginBottom: 6 }}>{rangeLabel}</div>}
      {limit ? (
        <>
          <div style={{ height: 7, borderRadius: 4, background: COLORS.bg, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
          </div>
          {isGoal
            ? (spent >= limit
                ? <div style={{ fontSize: 11, color: COLORS.green, marginTop: 3, fontWeight: 600 }}>Goal reached · +{fmt(spent - limit)} over</div>
                : <div style={{ fontSize: 11, color: COLORS.mutedLight, marginTop: 3, fontWeight: 600 }}>{fmt(limit - spent)} to go</div>)
            : (over && <div style={{ fontSize: 11, color: COLORS.rose, marginTop: 3, fontWeight: 600 }}>Over by {fmt(spent - limit)}</div>)}
          <button onClick={() => setShowTx((v) => !v)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: "6px 0 0", display: "flex", alignItems: "center", gap: 3 }}>
            {showTx ? "Hide" : "Show"} transactions ({transactions.length})
            <ChevronDown size={11} style={{ transform: showTx ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
          </button>
          {showTx && (
            <div style={{ marginTop: 6, background: COLORS.bg, borderRadius: 10, padding: transactions.length ? "4px 10px" : "8px 10px" }}>
              {transactions.length === 0 ? (
                <div style={{ fontSize: 11, color: COLORS.mutedLight, padding: "4px 0" }}>No transactions in this period yet.</div>
              ) : transactions.map((e, i) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, padding: "5px 0", borderBottom: i < transactions.length - 1 ? "1px solid " + COLORS.border : "none" }}>
                  <span style={{ color: COLORS.muted, display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: catColor(e.category), flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{relDateLabel(e.date)} · {e.category}{e.note ? " · " + e.note : ""}</span>
                  </span>
                  <span className="mono" style={{ flexShrink: 0, marginLeft: 8 }}>{fmt(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11.5, color: COLORS.mutedLight }}>No {label.toLowerCase()} {isGoal ? "goal" : "ceiling"} set.</div>
      )}
    </div>
  );
}

/* ---------- recurring ---------- */

function Recurring({ recurring, onAdd, onUpdate, onToggle, onRemove, onRunNow, categories, onAddCategory, accounts }) {
  const [form, setForm] = useState({ name: "", amount: "", type: "expense", category: categories.expense[0], categoryLabel: "", frequency: "monthly", day: 1, accountId: "" });
  const [error, setError] = useState("");

  const switchType = (type) => setForm((f) => ({ ...f, type, category: type === "expense" ? categories.expense[0] : categories.income[0], categoryLabel: "" }));
  const switchFrequency = (frequency) => setForm((f) => ({ ...f, frequency, day: 1 }));

  const submit = () => {
    const amount = parseFloat(form.amount);
    if (!form.name.trim()) { setError("Give it a name, e.g. Netflix."); return; }
    if (!amount || amount <= 0) { setError("Enter an amount greater than zero."); return; }
    if (form.frequency === "monthly" && (!form.day || form.day < 1 || form.day > 31)) { setError("Day must be between 1 and 31."); return; }
    setError("");
    onAdd({
      name: form.name.trim(), amount, type: form.type, category: form.category,
      categoryLabel: form.category === "Other" ? form.categoryLabel.trim() : "",
      frequency: form.frequency, day: parseInt(form.day), active: true, accountId: form.accountId || null
    });
    setForm((f) => ({ ...f, name: "", amount: "", categoryLabel: "" }));
  };

  return (
    <div>
      <SectionCard title="New Recurring Transaction">
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["expense", "income"].map((t) => (
            <button key={t} onClick={() => switchType(t)} style={{
              flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid " + (form.type === t ? COLORS.orange : COLORS.border),
              background: form.type === t ? COLORS.orangeLight : COLORS.card, color: form.type === t ? COLORS.orangeDark : COLORS.muted,
              fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "capitalize"
            }}>{t}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[["monthly", "Monthly"], ["weekly", "Weekly"]].map(([id, label]) => (
            <button key={id} onClick={() => switchFrequency(id)} style={{
              flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid " + (form.frequency === id ? COLORS.blue : COLORS.border),
              background: form.frequency === id ? COLORS.blueLight : COLORS.card, color: form.frequency === id ? COLORS.blue : COLORS.muted,
              fontWeight: 700, fontSize: 13, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <FieldLabel>Name</FieldLabel>
            <input type="text" placeholder="e.g. Netflix" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} />
          </div>
          <div>
            <FieldLabel>Amount (RM)</FieldLabel>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} className="mono" />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <CategorySelect value={form.category} onChange={(c) => setForm((f) => ({ ...f, category: c, categoryLabel: "" }))}
              options={form.type === "expense" ? categories.expense : categories.income} type={form.type} onAddCategory={onAddCategory} />
          </div>
          <div>
            <FieldLabel>{form.frequency === "weekly" ? "Day of Week" : "Day of Month"}</FieldLabel>
            {form.frequency === "weekly" ? (
              <select value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: parseInt(e.target.value) }))} style={{ width: "100%", boxSizing: "border-box" }}>
                {WEEKDAY_LABELS.map((label, idx) => <option key={idx} value={idx}>{label}</option>)}
              </select>
            ) : (
              <input type="number" min="1" max="31" value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} className="mono" />
            )}
          </div>
        </div>
        {form.category === "Other" && (
          <input type="text" placeholder="Describe this category (optional), e.g. Gym Membership" value={form.categoryLabel}
            onChange={(e) => setForm((f) => ({ ...f, categoryLabel: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
        )}
        {accounts.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>Account</FieldLabel>
            <AccountSelect value={form.accountId} onChange={(id) => setForm((f) => ({ ...f, accountId: id }))} accounts={accounts} allowUnassigned />
          </div>
        )}
        {error && <div style={{ color: COLORS.rose, fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>{error}</div>}
        <button onClick={submit} style={{
          display: "flex", alignItems: "center", gap: 6, background: COLORS.orange, color: "#fff",
          border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer"
        }}>
          <Plus size={16} /> Add Recurring
        </button>
        <div style={{ fontSize: 11.5, color: COLORS.mutedLight, marginTop: 10 }}>
          Runs automatically once the app is opened on or after its due day — this needs the app to be opened, since it can't run in the background. Need it sooner? Use the lightning bolt on any item below to log it today instead.
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Active Recurring Items">
        {recurring.length === 0 && <EmptyNote>No recurring transactions set up yet.</EmptyNote>}
        {recurring.map((r, i) => (
          <RecurringRow key={r.id} r={r} onUpdate={onUpdate} onToggle={onToggle} onRemove={onRemove} onRunNow={onRunNow} isLast={i === recurring.length - 1} categories={categories} onAddCategory={onAddCategory} accounts={accounts} />
        ))}
      </SectionCard>
    </div>
  );
}

function RecurringRow({ r, onUpdate, onToggle, onRemove, onRunNow, isLast, categories, onAddCategory, accounts }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: r.name, amount: r.amount, type: r.type, category: r.category, categoryLabel: r.categoryLabel || "", frequency: r.frequency || "monthly", day: r.day, accountId: r.accountId || "" });

  useEffect(() => {
    setForm({ name: r.name, amount: r.amount, type: r.type, category: r.category, categoryLabel: r.categoryLabel || "", frequency: r.frequency || "monthly", day: r.day, accountId: r.accountId || "" });
  }, [r]);

  const switchType = (type) => setForm((f) => ({ ...f, type, category: type === "expense" ? categories.expense[0] : categories.income[0], categoryLabel: "" }));

  const save = () => {
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || !amount || amount <= 0) return;
    onUpdate(r.id, {
      name: form.name.trim(), amount, type: form.type, category: form.category,
      categoryLabel: form.category === "Other" ? form.categoryLabel.trim() : "",
      frequency: form.frequency, day: parseInt(form.day), accountId: form.accountId || null
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ padding: "12px 2px", borderBottom: isLast ? "none" : "1px solid " + COLORS.border }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {["expense", "income"].map((t) => (
            <button key={t} onClick={() => switchType(t)} style={{
              flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid " + (form.type === t ? COLORS.orange : COLORS.border),
              background: form.type === t ? COLORS.orangeLight : COLORS.card, color: form.type === t ? COLORS.orangeDark : COLORS.muted,
              fontSize: 12, fontWeight: 700, cursor: "pointer", textTransform: "capitalize"
            }}>{t}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ fontSize: 13 }} />
          <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={{ fontSize: 13 }} className="mono" />
          <CategorySelect value={form.category} onChange={(c) => setForm((f) => ({ ...f, category: c, categoryLabel: "" }))}
            options={form.type === "expense" ? categories.expense : categories.income} type={form.type} onAddCategory={onAddCategory} compact />
          <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value, day: 1 }))} style={{ fontSize: 13 }}>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
          {form.frequency === "weekly" ? (
            <select value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: parseInt(e.target.value) }))} style={{ fontSize: 13, gridColumn: "1 / -1" }}>
              {WEEKDAY_LABELS.map((label, idx) => <option key={idx} value={idx}>{label}</option>)}
            </select>
          ) : (
            <input type="number" min="1" max="31" value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} style={{ fontSize: 13, gridColumn: "1 / -1" }} className="mono" />
          )}
        </div>
        {form.category === "Other" && (
          <input type="text" placeholder="Describe this category (optional)" value={form.categoryLabel}
            onChange={(e) => setForm((f) => ({ ...f, categoryLabel: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, fontSize: 13 }} />
        )}
        {accounts.length > 0 && (
          <AccountSelect value={form.accountId} onChange={(id) => setForm((f) => ({ ...f, accountId: id }))} accounts={accounts} allowUnassigned compact />
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={save} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
          <button onClick={() => setEditing(false)} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: COLORS.muted }}>Cancel</button>
        </div>
      </div>
    );
  }

  const freq = r.frequency || "monthly";
  const freqLabel = freq === "weekly" ? `Every ${WEEKDAY_LABELS[r.day]}` : `Day ${r.day} of month`;
  const categoryDisplay = r.categoryLabel || r.category;
  const linkedAccount = r.accountId ? accounts.find((a) => a.id === r.accountId) : null;
  const periodKey = freq === "weekly" ? isoOf(getMonday(new Date())) : thisMonthKey();
  const alreadyRun = r.lastRun === periodKey;
  const runDisabled = !r.active || alreadyRun;
  const runTitle = !r.active ? "Resume it first to log early" : alreadyRun ? "Already logged this period" : "Log it today, ahead of its due date";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr auto auto auto auto auto", alignItems: "center", gap: 8,
      padding: "11px 4px", borderBottom: isLast ? "none" : "1px solid " + COLORS.border, opacity: r.active ? 1 : 0.45
    }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1, flexWrap: "wrap" }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: catColor(r.category) }} />
          <span style={{ fontSize: 11, color: COLORS.muted }}>{categoryDisplay} · {freqLabel}{linkedAccount ? ` · ${linkedAccount.name}` : ""}</span>
        </div>
      </div>
      <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: r.type === "income" ? COLORS.green : COLORS.text }}>
        {r.type === "income" ? "+" : "−"}{fmt(r.amount)}
      </div>
      <button onClick={() => !runDisabled && onRunNow(r.id)} disabled={runDisabled} title={runTitle} style={{
        background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8,
        color: runDisabled ? COLORS.mutedLight : COLORS.blue, opacity: runDisabled ? 0.5 : 1,
        cursor: runDisabled ? "not-allowed" : "pointer", padding: "5px 7px", display: "flex"
      }}><Zap size={13} /></button>
      <button onClick={() => setEditing(true)} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, color: COLORS.muted, cursor: "pointer", padding: "5px 7px", display: "flex" }}>
        <Pencil size={13} />
      </button>
      <button onClick={() => onToggle(r.id)} title={r.active ? "Pause" : "Resume"} style={{
        background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, color: r.active ? COLORS.green : COLORS.mutedLight,
        cursor: "pointer", padding: "5px 7px", display: "flex"
      }}><Power size={13} /></button>
      <button onClick={() => onRemove(r.id)} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/* ---------- mobile sidebar ---------- */

function Sidebar({ open, onClose, NAV, tab, setTab, profileName }) {
  const itemStyle = (active) => ({
    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
    padding: "10px 12px", borderRadius: 10, border: "none", marginBottom: 2,
    background: active ? COLORS.orangeLight : "transparent", color: active ? COLORS.orangeDark : COLORS.text,
    fontSize: 13.5, fontWeight: 600, cursor: "pointer"
  });

  const go = (id) => { setTab(id); onClose(); };

  return (
    <>
      <div className={"sidebar-backdrop" + (open ? " open" : "")} onClick={onClose} />
      <div className={"sidebar-drawer" + (open ? " open" : "")}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px", borderBottom: "1px solid " + COLORS.border }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: "0.1em", color: COLORS.muted, textTransform: "uppercase", fontWeight: 700 }}>Menu</div>
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>{profileName || "Finance Tracker"}</div>
          </div>
          <button onClick={onClose} aria-label="Close menu" style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", display: "flex", padding: 4 }}>
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: "10px 10px 20px", overflowY: "auto", flex: 1 }}>
          {NAV.map((item) => item.children ? (
            <div key={item.group} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.mutedLight, textTransform: "uppercase", letterSpacing: "0.06em", padding: "10px 12px 4px" }}>{item.label}</div>
              {item.children.map((c) => (
                <button key={c.id} onClick={() => go(c.id)} style={itemStyle(tab === c.id)}>
                  <c.icon size={16} /> {c.label}
                </button>
              ))}
            </div>
          ) : (
            <button key={item.id} onClick={() => go(item.id)} style={itemStyle(tab === item.id)}>
              <item.icon size={16} /> {item.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- settings ---------- */

function CategoryManager({ categories, entries, onRename, onDelete, onAddCategory, onSetColor, onResetColor, groupApi }) {
  const [typeTab, setTypeTab] = useState("expense");
  const [editingName, setEditingName] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupEditValue, setGroupEditValue] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [colorEditing, setColorEditing] = useState(null);

  const usageCount = (name) => entries.filter((e) => e.type === typeTab && e.category === name).length;
  const g = groupApi ? groupApi.groups[typeTab] : { parents: [], map: {} };

  const startEdit = (name) => { setColorEditing(null); setEditingGroup(null); setEditingName(name); setEditValue(name); };
  const toggleColorEditing = (name) => { setEditingName(null); setEditingGroup(null); setColorEditing((v) => v === name ? null : name); };
  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== editingName) onRename(typeTab, editingName, trimmed);
    setEditingName(null);
  };
  const startGroupEdit = (name) => { setColorEditing(null); setEditingName(null); setEditingGroup(name); setGroupEditValue(name); };
  const commitGroupEdit = () => {
    const trimmed = groupEditValue.trim();
    if (trimmed && trimmed !== editingGroup) groupApi.onRenameParent(typeTab, editingGroup, trimmed);
    setEditingGroup(null);
  };

  const addNew = () => {
    if (!newName.trim()) return;
    if (onAddCategory(typeTab, newName.trim()) !== false) setNewName("");
  };
  const addGroup = () => {
    if (!newGroup.trim()) return;
    if (groupApi.onAddParent(typeTab, newGroup)) setNewGroup("");
  };

  const list = categories[typeTab];
  const grouped = g.parents.map((p) => ({ parent: p, items: list.filter((c) => g.map[c] === p) }));
  const ungrouped = list.filter((c) => !g.map[c] || !g.parents.includes(g.map[c]));
  const iconBtn = { background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" };
  const typeSuggestions = groupApi ? groupApi.suggestions.filter((s) => s.type === typeTab) : [];

  const renderRow = (c, isLast, indented) => (
    <div key={c} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "9px 2px", paddingLeft: indented ? 22 : 2, borderBottom: isLast && colorEditing !== c ? "none" : "1px solid " + COLORS.border }}>
      {editingName === c ? (
        <>
          <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingName(null); }}
            style={{ flex: 1, minWidth: 0, fontSize: 13.5 }} />
          <button onClick={commitEdit} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
            <Check size={12} />
          </button>
          <button onClick={() => setEditingName(null)} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", color: COLORS.muted }}>
            ✕
          </button>
        </>
      ) : (
        <>
          <button onClick={() => toggleColorEditing(c)} aria-label={`Change color for ${c}`} style={{
            width: 16, height: 16, borderRadius: 5, background: catColor(c), minWidth: 16, border: "none", padding: 0, cursor: "pointer",
            boxShadow: colorEditing === c ? `0 0 0 2px ${COLORS.card}, 0 0 0 4px ${catColor(c)}` : "none"
          }} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
          <span style={{ fontSize: 11, color: COLORS.mutedLight, whiteSpace: "nowrap" }}>{usageCount(c)} used</span>
          {groupApi && g.parents.length > 0 && (
            <select value={g.map[c] || ""} onChange={(e) => groupApi.onSetParent(typeTab, c, e.target.value || null)}
              aria-label={`Group for ${c}`} style={{ fontSize: 11.5, padding: "4px 6px", maxWidth: 120 }}>
              <option value="">No group</option>
              {g.parents.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          <button onClick={() => startEdit(c)} style={iconBtn}><Pencil size={13} /></button>
          <button onClick={() => onDelete(typeTab, c)} style={iconBtn}><Trash2 size={13} /></button>
        </>
      )}
      {colorEditing === c && (
        <div style={{ flexBasis: "100%", width: "100%", padding: "10px 10px 12px", marginTop: 2, borderRadius: 12, background: COLORS.bg }}>
          <CategoryColorPicker value={catColor(c)} onChange={(hex) => onSetColor(c, hex)} onReset={() => onResetColor(c)} />
        </div>
      )}
    </div>
  );

  const renderGroupHeader = (p, count) => (
    <div key={"group:" + p} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "10px 2px 6px", marginTop: 6 }}>
      {editingGroup === p ? (
        <>
          <input autoFocus value={groupEditValue} onChange={(e) => setGroupEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitGroupEdit(); if (e.key === "Escape") setEditingGroup(null); }}
            style={{ flex: 1, minWidth: 0, fontSize: 13.5 }} />
          <button onClick={commitGroupEdit} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}><Check size={12} /></button>
          <button onClick={() => setEditingGroup(null)} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", color: COLORS.muted }}>✕</button>
        </>
      ) : (
        <>
          <button onClick={() => toggleColorEditing(p)} aria-label={`Change color for ${p}`} style={{
            width: 16, height: 16, borderRadius: 5, background: catColor(p), minWidth: 16, border: "none", padding: 0, cursor: "pointer",
            boxShadow: colorEditing === p ? `0 0 0 2px ${COLORS.card}, 0 0 0 4px ${catColor(p)}` : "none"
          }} />
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p}</span>
          <span style={{ fontSize: 11, color: COLORS.mutedLight, whiteSpace: "nowrap" }}>{count} categor{count === 1 ? "y" : "ies"}</span>
          <button onClick={() => startGroupEdit(p)} style={iconBtn}><Pencil size={13} /></button>
          <button onClick={() => groupApi.onDeleteParent(typeTab, p)} style={iconBtn} title="Remove group (categories stay)"><Trash2 size={13} /></button>
        </>
      )}
      {colorEditing === p && (
        <div style={{ flexBasis: "100%", width: "100%", padding: "10px 10px 12px", marginTop: 2, borderRadius: 12, background: COLORS.bg }}>
          <CategoryColorPicker value={catColor(p)} onChange={(hex) => onSetColor(p, hex)} onReset={() => onResetColor(p)} />
        </div>
      )}
    </div>
  );

  return (
    <SectionCard title="Categories" icon={<Tag size={13} />}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
        Rename or remove categories, and bundle related ones under a group (e.g. Food and Groceries under "Food & Drink"). Budgets and Insights can then total a whole group. Renaming updates every transaction, budget, and recurring item that uses it — deleting just stops offering it for new entries, past transactions keep their label.
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["expense", "Expense"], ["income", "Income"]].map(([id, label]) => (
          <button key={id} onClick={() => { setTypeTab(id); setEditingName(null); setEditingGroup(null); setColorEditing(null); }} style={{
            flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid " + (typeTab === id ? COLORS.orange : COLORS.border),
            background: typeTab === id ? COLORS.orangeLight : COLORS.card, color: typeTab === id ? COLORS.orangeDark : COLORS.muted,
            fontWeight: 700, fontSize: 12.5, cursor: "pointer"
          }}>{label}</button>
        ))}
      </div>

      {groupApi && typeSuggestions.length > 0 && (
        <div style={{ background: COLORS.bg, border: "1px solid " + COLORS.border, borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>Suggested groups</div>
          {typeSuggestions.map((s) => (
            <div key={s.name} style={{ fontSize: 12, color: COLORS.muted, marginBottom: 3 }}>
              <strong style={{ color: COLORS.text }}>{s.name}</strong> — {s.members.join(", ")}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => groupApi.onApply(groupApi.suggestions)} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Apply suggestions</button>
            <button onClick={groupApi.onDismiss} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: COLORS.muted }}>Not now</button>
          </div>
        </div>
      )}

      {grouped.map((sec) => (
        <div key={sec.parent}>
          {renderGroupHeader(sec.parent, sec.items.length)}
          {sec.items.length === 0 && <div style={{ fontSize: 11.5, color: COLORS.mutedLight, padding: "2px 2px 8px 22px" }}>Empty — assign categories to it with their "Group" menu.</div>}
          {sec.items.map((c, i) => renderRow(c, false, true))}
        </div>
      ))}

      {g.parents.length > 0 && ungrouped.length > 0 && (
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.mutedLight, padding: "14px 2px 2px" }}>Ungrouped</div>
      )}
      {ungrouped.map((c, i) => renderRow(c, i === ungrouped.length - 1, false))}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input type="text" placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addNew()} style={{ flex: 1, minWidth: 0 }} />
        <button onClick={addNew} style={{ background: COLORS.orangeLight, color: COLORS.orangeDark, border: "none", borderRadius: 10, padding: "0 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Add
        </button>
      </div>

      {groupApi && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input type="text" placeholder="New group name (e.g. Food & Drink)" value={newGroup} onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGroup()} style={{ flex: 1, minWidth: 0 }} />
          <button onClick={addGroup} style={{ background: COLORS.card, color: COLORS.muted, border: "1px solid " + COLORS.border, borderRadius: 10, padding: "0 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            + Group
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// Compact color picker used inline under a category row in Settings: a
// curated preset palette, a custom color wheel for anything else, a hex
// text field, and a reset link back to the category's default color.
function CategoryColorPicker({ value, onChange, onReset }) {
  const [customColor, setCustomColor] = useState(value);
  useEffect(() => { setCustomColor(value); }, [value]);

  const apply = (hex) => { setCustomColor(hex); onChange(hex); };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {CATEGORY_COLOR_PRESETS.map((hex) => (
          <button key={hex} onClick={() => apply(hex)} aria-label={hex} style={{
            width: 24, height: 24, borderRadius: "50%", background: hex, border: value.toLowerCase() === hex.toLowerCase() ? `2px solid ${COLORS.text}` : "2px solid transparent",
            cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
          }}>
            {value.toLowerCase() === hex.toLowerCase() && <Check size={11} color="#fff" />}
          </button>
        ))}
        <label style={{
          width: 24, height: 24, borderRadius: "50%", cursor: "pointer", position: "relative", overflow: "hidden",
          border: "2px solid " + COLORS.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          background: `conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)`
        }}>
          <input type="color" value={customColor} onChange={(e) => apply(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input type="text" value={customColor} onChange={(e) => setCustomColor(e.target.value)}
          onBlur={() => /^#[0-9A-Fa-f]{6}$/.test(customColor) && apply(customColor)}
          onKeyDown={(e) => e.key === "Enter" && /^#[0-9A-Fa-f]{6}$/.test(customColor) && apply(customColor)}
          placeholder="#10B981" style={{ width: 100, fontSize: 12, padding: "6px 8px" }} className="mono" />
        {onReset && <button onClick={onReset} style={{ background: "none", border: "none", color: COLORS.orange, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Reset to default</button>}
      </div>
    </div>
  );
}

function AccentColorPicker({ value, onChange }) {
  const [customColor, setCustomColor] = useState(value);
  useEffect(() => { setCustomColor(value); }, [value]);

  const apply = (hex) => { setCustomColor(hex); onChange(hex); };

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        {ACCENT_PRESETS.map((hex) => (
          <button key={hex} onClick={() => apply(hex)} aria-label={hex} style={{
            width: 36, height: 36, borderRadius: "50%", background: hex, border: value.toLowerCase() === hex.toLowerCase() ? `2px solid ${COLORS.text}` : "2px solid transparent",
            boxShadow: SHADOW, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            {value.toLowerCase() === hex.toLowerCase() && <Check size={15} color="#fff" />}
          </button>
        ))}
        <label style={{
          width: 36, height: 36, borderRadius: "50%", cursor: "pointer", position: "relative", overflow: "hidden",
          border: "2px solid " + COLORS.border, boxShadow: SHADOW, display: "flex", alignItems: "center", justifyContent: "center",
          background: `conic-gradient(from 0deg, red, yellow, lime, cyan, blue, magenta, red)`
        }}>
          <input type="color" value={customColor} onChange={(e) => apply(e.target.value)}
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", border: "none", padding: 0 }} />
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="text" value={customColor} onChange={(e) => setCustomColor(e.target.value)}
          onBlur={() => /^#[0-9A-Fa-f]{6}$/.test(customColor) && apply(customColor)}
          onKeyDown={(e) => e.key === "Enter" && /^#[0-9A-Fa-f]{6}$/.test(customColor) && apply(customColor)}
          placeholder="#10B981" style={{ width: 120 }} className="mono" />
        <span style={{ fontSize: 11.5, color: COLORS.mutedLight }}>Type or paste any hex color</span>
      </div>
    </>
  );
}

function Settings({ theme, onSetTheme, profile, onSetProfile, categories, entries, onRenameCategory, onDeleteCategory, onAddCategory, onSetCategoryColor, onResetCategoryColor, groupApi, onResetAll }) {
  const [name, setName] = useState(profile.name);

  useEffect(() => { setName(profile.name); }, [profile.name]);

  const saveName = () => onSetProfile({ name: name.trim() });

  const reset = () => onSetTheme({ mode: "light", accent: DEFAULT_THEME.accent, secondaryAccent: DEFAULT_THEME.secondaryAccent });

  return (
    <div>
      <SectionCard title="Profile" icon={<Users size={13} />}>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
          Set your name to personalize the greeting at the top of the app.
        </div>
        <FieldLabel>Your Name</FieldLabel>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" placeholder="e.g. Brennan" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()} style={{ flex: 1, minWidth: 0 }} />
          <button onClick={saveName} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 10, padding: "0 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
            Save
          </button>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Appearance" icon={<Palette size={13} />}>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
          Switch between light and dark, and pick any accent colors you like — it updates buttons, highlights, and charts throughout the app.
        </div>

        <FieldLabel>Mode</FieldLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button onClick={() => onSetTheme({ mode: "light" })} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 12px", borderRadius: 14, border: "2px solid " + (theme.mode === "light" ? COLORS.orange : COLORS.border),
            background: theme.mode === "light" ? COLORS.orangeLight : COLORS.card,
            color: theme.mode === "light" ? COLORS.orangeDark : COLORS.muted, fontWeight: 700, fontSize: 13.5, cursor: "pointer"
          }}>
            <Sun size={16} /> Light
          </button>
          <button onClick={() => onSetTheme({ mode: "dark" })} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "14px 12px", borderRadius: 14, border: "2px solid " + (theme.mode === "dark" ? COLORS.orange : COLORS.border),
            background: theme.mode === "dark" ? COLORS.orangeLight : COLORS.card,
            color: theme.mode === "dark" ? COLORS.orangeDark : COLORS.muted, fontWeight: 700, fontSize: 13.5, cursor: "pointer"
          }}>
            <Moon size={16} /> Dark
          </button>
        </div>

        <FieldLabel>Primary Accent Color</FieldLabel>
        <div style={{ fontSize: 11.5, color: COLORS.mutedLight, marginBottom: 10 }}>
          Used for main buttons, active tabs, and the balance card.
        </div>
        <div style={{ marginBottom: 20 }}>
          <AccentColorPicker value={theme.accent} onChange={(hex) => onSetTheme({ accent: hex })} />
        </div>

        <FieldLabel>Secondary Accent Color</FieldLabel>
        <div style={{ fontSize: 11.5, color: COLORS.mutedLight, marginBottom: 10 }}>
          Used for the "other" option in double selections, like the Type filter in your ledger or the frequency toggle for recurring transactions.
        </div>
        <div style={{ marginBottom: 16 }}>
          <AccentColorPicker value={theme.secondaryAccent} onChange={(hex) => onSetTheme({ secondaryAccent: hex })} />
        </div>

        <button onClick={reset} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
          Reset to default
        </button>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Preview">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div style={{ padding: "10px 18px", borderRadius: 12, background: COLORS.orange, color: "#fff", fontWeight: 700, fontSize: 13.5 }}>Primary Button</div>
          <div style={{ padding: "10px 16px", borderRadius: 999, background: COLORS.orangeLight, color: COLORS.orangeDark, fontWeight: 700, fontSize: 12.5 }}>Active Pill</div>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${COLORS.orange}, ${COLORS.orangeDark})` }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ padding: "10px 16px", borderRadius: 999, background: COLORS.blueLight, color: COLORS.blue, fontWeight: 700, fontSize: 12.5, border: "1px solid " + COLORS.blue }}>Secondary Pill</div>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: COLORS.blue }} />
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <CategoryManager categories={categories} entries={entries} onRename={onRenameCategory} onDelete={onDeleteCategory} onAddCategory={onAddCategory} onSetColor={onSetCategoryColor} onResetColor={onResetCategoryColor} groupApi={groupApi} />

      <div style={{ height: 16 }} />

      <DangerZone onResetAll={onResetAll} />
    </div>
  );
}

function DangerZone({ onResetAll }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText.trim().toUpperCase() === "RESET";

  const cancel = () => { setConfirming(false); setConfirmText(""); };
  const doReset = () => {
    if (!canConfirm) return;
    onResetAll();
    cancel();
  };

  return (
    <SectionCard title="Danger Zone" icon={<Trash2 size={13} />}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
        Permanently erase every transaction, account, budget, recurring item, quick add, and category customization on your account. Your sign-in stays active, but this cannot be undone.
      </div>

      {!confirming ? (
        <button onClick={() => setConfirming(true)} style={{
          background: COLORS.roseLight, color: COLORS.rose, border: "1px solid " + COLORS.rose,
          borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer"
        }}>
          Reset Account Data
        </button>
      ) : (
        <div style={{ border: "1px solid " + COLORS.rose, borderRadius: 12, padding: 14, background: COLORS.roseLight }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.rose, marginBottom: 8 }}>
            This deletes everything and can't be undone.
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
            Type <strong>RESET</strong> below to confirm.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="text" autoFocus value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doReset(); if (e.key === "Escape") cancel(); }}
              placeholder="RESET" style={{ flex: 1, minWidth: 120 }} />
            <button onClick={doReset} disabled={!canConfirm} style={{
              background: canConfirm ? COLORS.rose : COLORS.border, color: "#fff", border: "none",
              borderRadius: 10, padding: "0 16px", fontWeight: 700, fontSize: 13, cursor: canConfirm ? "pointer" : "not-allowed"
            }}>
              Confirm Reset
            </button>
            <button onClick={cancel} style={{
              background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 10, padding: "0 16px",
              fontWeight: 700, fontSize: 13, cursor: "pointer", color: COLORS.muted
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* ---------- shared small components ---------- */

function debtBadgeText(e) {
  if (e.debts && e.debts.length) {
    const unsettled = e.debts.filter((d) => !d.settled);
    if (!unsettled.length) return null;
    const total = unsettled.reduce((s, d) => s + d.amount, 0);
    return `${unsettled.length} ${unsettled.length === 1 ? "person" : "people"} owe you ${fmt(total)}`;
  }
  if (e.split) return `Split · owed ${fmt(e.split.owed)}`;
  return null;
}

function BudgetExcludePicker({ checked, periods, onChange, label, small }) {
  const toggle = (pt) => {
    const next = periods.includes(pt) ? periods.filter((p) => p !== pt) : [...periods, pt];
    // Unticking the last period is the same as not excluding at all.
    if (next.length === 0) onChange(false, BUDGET_PERIODS);
    else onChange(true, BUDGET_PERIODS.filter((p) => next.includes(p)));
  };
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: small ? 7 : 8, fontSize: small ? 12 : 13, color: COLORS.muted, cursor: "pointer", fontWeight: 600 }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked, BUDGET_PERIODS)} style={{ width: small ? 14 : 15, height: small ? 14 : 15, padding: 0 }} />
        {!small && <Target size={14} />} {label}
      </label>
      {checked && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: COLORS.mutedLight, fontWeight: 600 }}>Left out of:</span>
          {BUDGET_PERIODS.map((pt) => {
            const on = periods.includes(pt);
            return (
              <button key={pt} type="button" onClick={() => toggle(pt)} style={{
                padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                border: "1px solid " + (on ? COLORS.orange : COLORS.border),
                background: on ? COLORS.orangeLight : COLORS.card, color: on ? COLORS.orangeDark : COLORS.muted
              }}>{PERIOD_LABEL[pt]}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditEntryForm({ entry, categories, accounts, onSave, onCancel, onAddCategory }) {
  const isTransfer = entry.type === "transfer";
  const [amount, setAmount] = useState(entry.amount);
  const [date, setDate] = useState(entry.date);
  const [note, setNote] = useState(entry.note || "");
  const [category, setCategory] = useState(entry.category || "");
  const [accountId, setAccountId] = useState(entry.accountId || "");
  const [fromAccountId, setFromAccountId] = useState(entry.fromAccountId || "");
  const [toAccountId, setToAccountId] = useState(entry.toAccountId || "");
  const [excludeFromBudget, setExcludeFromBudget] = useState(!!entry.excludeFromBudget);
  const [excludedPeriods, setExcludedPeriods] = useState(entry.excludeFromBudget ? excludedPeriodsOf(entry) : BUDGET_PERIODS);
  const [error, setError] = useState("");

  const save = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Enter an amount greater than zero."); return; }
    if (!date) { setError("Pick a date."); return; }
    if (isTransfer) {
      if (!fromAccountId || !toAccountId) { setError("Choose both a from and to account."); return; }
      if (fromAccountId === toAccountId) { setError("Pick two different accounts."); return; }
      onSave({ amount: amt, date, note: note.trim(), fromAccountId, toAccountId });
    } else {
      onSave({ amount: amt, date, note: note.trim(), category, accountId: accountId || null, excludeFromBudget: !isTransfer ? excludeFromBudget : false, excludedPeriods: !isTransfer && excludeFromBudget && excludedPeriods.length < BUDGET_PERIODS.length ? excludedPeriods : undefined });
    }
  };

  return (
    <div style={{ padding: "12px 8px", marginBottom: 6, background: COLORS.bg, border: "1px solid " + COLORS.border, borderRadius: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ fontSize: 13 }} className="mono" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ fontSize: 13 }} />
        {isTransfer ? (
          <>
            <AccountSelect value={fromAccountId} onChange={setFromAccountId} accounts={accounts} compact />
            <AccountSelect value={toAccountId} onChange={setToAccountId} accounts={accounts} compact />
          </>
        ) : (
          <>
            <CategorySelect value={category} onChange={setCategory}
              options={entry.type === "expense" ? categories.expense : categories.income} type={entry.type} onAddCategory={onAddCategory} />
            <AccountSelect value={accountId} onChange={setAccountId} accounts={accounts} allowUnassigned compact />
          </>
        )}
        <input type="text" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} style={{ fontSize: 13, gridColumn: "1 / -1" }} />
      </div>
      {!isTransfer && !entry.adjustment && (
        <div style={{ marginBottom: 8 }}>
          <BudgetExcludePicker small checked={excludeFromBudget} periods={excludedPeriods}
            onChange={(chk, per) => { setExcludeFromBudget(chk); setExcludedPeriods(per); }}
            label={`Don't count toward my ${entry.type === "income" ? "goals" : "budgets"}`} />
        </div>
      )}
      {entry.debts && entry.debts.length > 0 && (
        <div style={{ fontSize: 11, color: COLORS.mutedLight, marginBottom: 8 }}>
          This transaction has shared-cost details attached — those aren't editable here, only the base fields above.
        </div>
      )}
      {error && <div style={{ color: COLORS.rose, fontSize: 12, marginBottom: 8, fontWeight: 600 }}>{error}</div>}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={save} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
        <button onClick={onCancel} style={{ background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: COLORS.muted }}>Cancel</button>
      </div>
    </div>
  );
}

function TxRow({ e, last, onRemove, onEdit, onToggleBudget, hideDate, accounts }) {
  const showBudgetToggle = onToggleBudget && e.type !== "transfer" && !e.adjustment;
  const cols = [hideDate ? null : "56px", "1fr", "auto", showBudgetToggle ? "26px" : null, onEdit ? "26px" : null, onRemove ? "26px" : null].filter(Boolean).join(" ");
  const badge = debtBadgeText(e);
  const isTransfer = e.type === "transfer";

  let title, subtitle;
  if (isTransfer) {
    const fromName = accounts?.find((a) => a.id === e.fromAccountId)?.name || "Account";
    const toName = accounts?.find((a) => a.id === e.toAccountId)?.name || "Account";
    title = e.note || "Transfer";
    subtitle = `${fromName} → ${toName}`;
  } else {
    title = e.note || e.category;
    const par = parentOf(CATEGORY_GROUPS_LIVE, e.type, e.category);
    subtitle = e.categoryLabel || (par ? `${par} › ${e.category}` : e.category);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", gap: 10, padding: "10px 2px", borderBottom: last ? "none" : "1px solid " + COLORS.border }}>
      {!hideDate && <div className="mono" style={{ fontSize: 11, color: COLORS.muted }}>{e.date.slice(5)}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{
          width: 32, height: 32, minWidth: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: isTransfer ? COLORS.blueLight : catColor(e.category) + "22",
          color: isTransfer ? COLORS.blue : catColor(e.category)
        }}>
          {isTransfer ? <ArrowRightLeft size={14} /> : e.type === "income" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>
            {badge && <Badge>{badge}</Badge>}
            {e.recurring && <Badge>Recurring</Badge>}
            {e.adjustment && <Badge>Adjustment</Badge>}
            {e.excludeFromBudget && !e.adjustment && <Badge>{excludedPeriodsOf(e).length === BUDGET_PERIODS.length ? "No budget" : "No " + excludedPeriodsOf(e).join("/") + " budget"}</Badge>}
          </div>
        </div>
      </div>
      <div className="mono" style={{ fontSize: 13.5, fontWeight: 700, color: isTransfer ? COLORS.blue : e.type === "income" ? COLORS.green : COLORS.text, textAlign: "right", whiteSpace: "nowrap" }}>
        {isTransfer ? "⇄ " : e.type === "income" ? "+" : "−"}{fmt(e.amount)}
      </div>
      {showBudgetToggle && (
        <button onClick={() => onToggleBudget(e.id)} title={e.excludeFromBudget ? "Excluded from budget — click to include" : "In budget — click to exclude"} style={{
          background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 8,
          color: e.excludeFromBudget ? COLORS.mutedLight : COLORS.green,
          cursor: "pointer", padding: "5px 7px", display: "flex"
        }}><Target size={13} /></button>
      )}
      {onEdit && (
        <button onClick={() => onEdit(e)} aria-label="Edit entry" style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", padding: 4, display: "flex" }}>
          <Pencil size={14} />
        </button>
      )}
      {onRemove && (
        <button onClick={() => onRemove(e.id)} aria-label="Delete entry" style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", padding: 4, display: "flex" }}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

const TOAST_STYLES = {
  success: COLORS.orange,
  info: COLORS.blue,
  danger: COLORS.rose,
};

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", zIndex: 300,
      display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 380,
      padding: "0 14px", boxSizing: "border-box", pointerEvents: "none"
    }}>
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />)}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const bg = TOAST_STYLES[toast.type] || TOAST_STYLES.success;
  const Icon = toast.Icon;
  return (
    <div
      className={toast.leaving ? "toast-leaving" : "toast-item"}
      onClick={() => onDismiss(toast.id)}
      style={{
        pointerEvents: "auto", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 10,
        background: bg, color: "#fff", borderRadius: 14, padding: "11px 14px",
        boxShadow: "0 10px 28px rgba(16,24,40,0.2)"
      }}
    >
      <span style={{ width: 26, height: 26, minWidth: 26, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={14} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{toast.message}</span>
    </div>
  );
}

function Badge({ children }) {
  return <span style={{ fontSize: 10, color: COLORS.muted, background: COLORS.bg, borderRadius: 5, padding: "1px 7px", fontWeight: 600 }}>{children}</span>;
}

function StatRow({ icon, color, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 32, height: 32, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{icon}</span>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
      </div>
      <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function SummaryCard({ icon, label, value, color, sub }) {
  return (
    <div style={{ background: COLORS.bg, borderRadius: 14, padding: "14px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, fontWeight: 700 }}>
        <span style={{ color }}>{icon}</span>{label}
      </div>
      <div className="mono" style={{ fontSize: 17, fontWeight: 800, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
    </div>
  );
}

function SectionCard({ title, icon, right, children }) {
  return (
    <div style={{ background: COLORS.card, borderRadius: 20, padding: 18, boxShadow: SHADOW, transition: "background-color .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
          {icon}{title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// Category picker used throughout the app: the trigger looks like a
// color-coded pill for the current selection, and the dropdown offers every
// option as its own colored pill instead of a plain text list. Pass
// `compact` for tight spaces (e.g. a table row); omit `onAddCategory` to
// hide the "add new category" affordance (e.g. read-only pickers).
// Generic icon-pill dropdown: the trigger shows the selected item's icon (in
// a tinted circle matching its color) and label, and the open panel lists
// every item the same way. Backs both AccountSelect (below) and the account
// "Type" picker. `items` is [{ id, label, Icon, color }].
function IconPillSelect({ value, onChange, items, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (id) => { onChange(id); setOpen(false); };
  const current = items.find((it) => it.id === value) || items[0];
  const badgeSize = compact ? 18 : 22;
  const iconSize = compact ? 10 : 12;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{
        width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: compact ? 6 : 8, padding: compact ? "4px 8px 4px 4px" : "6px 11px 6px 6px", borderRadius: compact ? 8 : 10,
        border: "1px solid " + COLORS.border, background: COLORS.card, cursor: "pointer"
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: compact ? 6 : 8, minWidth: 0 }}>
          {current && (
            <span style={{
              width: badgeSize, height: badgeSize, borderRadius: "50%", background: withAlpha(current.color, "22"),
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <current.Icon size={iconSize} color={current.color} />
            </span>
          )}
          <span style={{ fontSize: compact ? 11.5 : 14, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current ? current.label : "Select…"}
          </span>
        </span>
        <ChevronDown size={compact ? 12 : 14} style={{ color: COLORS.muted, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div className="nav-dropdown" style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
          background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 12, padding: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.16)", maxHeight: 260, overflowY: "auto"
        }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {items.map((item) => {
              const active = item.id === value;
              return (
                <button key={item.id} type="button" onClick={() => pick(item.id)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "4px 11px 4px 4px", borderRadius: 999,
                  border: "1px solid " + (active ? item.color : COLORS.border),
                  background: active ? withAlpha(item.color, "22") : COLORS.bg,
                  color: active ? item.color : COLORS.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer"
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%", background: withAlpha(item.color, active ? "33" : "22"),
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>
                    <item.Icon size={11} color={item.color} />
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Account picker used throughout the app: shows each account as a pill with
// its account-type icon and color. Pass `allowUnassigned` to include a
// blank "Unassigned" option (value ""); pass `compact` for tight spaces.
function AccountSelect({ value, onChange, accounts, allowUnassigned, compact }) {
  const items = accounts.map((a) => {
    const t = ACCOUNT_TYPES.find((t) => t.id === a.type) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
    return { id: a.id, label: a.name, Icon: t.icon, color: t.color };
  });
  const withUnassigned = allowUnassigned ? [{ id: "", label: "Unassigned", Icon: X, color: COLORS.mutedLight }, ...items] : items;
  return <IconPillSelect value={value} onChange={onChange} items={withUnassigned} compact={compact} />;
}

// Account "Type" picker (Bank, E-Wallet, Cash, …) — same pill style, backed
// by the fixed ACCOUNT_TYPES list rather than the user's own accounts.
function AccountTypeSelect({ value, onChange, compact }) {
  const items = ACCOUNT_TYPES.map((t) => ({ id: t.id, label: t.label, Icon: t.icon, color: t.color }));
  return <IconPillSelect value={value} onChange={onChange} items={items} compact={compact} />;
}

function CategorySelect({ value, onChange, options, type, onAddCategory, compact, allowGroups }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAdding(false); }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const commit = () => {
    const name = newName.trim();
    if (!name) { setAdding(false); return; }
    if (onAddCategory(type, name) === false) return;
    onChange(name);
    setNewName("");
    setAdding(false);
    setOpen(false);
  };

  const pick = (c) => { onChange(c); setOpen(false); };
  const color = catColor(value);

  // Options are shown under their parent group when the type has any; with
  // allowGroups (budgets), the group itself is also pickable ("covers all").
  const gset = (type && CATEGORY_GROUPS_LIVE[type]) || EMPTY_GROUPS.expense;
  const sections = gset.parents
    .map((p) => ({ parent: p, items: options.filter((o) => gset.map[o] === p) }))
    .filter((s) => s.items.length > 0);
  const ungrouped = options.filter((o) => !gset.map[o] || !gset.parents.includes(gset.map[o]));
  const pill = (c, isGroup) => {
    const active = c === value;
    const optColor = catColor(c);
    return (
      <button key={(isGroup ? "g:" : "") + c} type="button" onClick={() => pick(c)} style={{
        display: "flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 999,
        border: "1px solid " + (active ? optColor : COLORS.border),
        background: active ? withAlpha(optColor, "22") : COLORS.bg,
        color: active ? optColor : COLORS.text, fontSize: 12.5, fontWeight: isGroup ? 800 : 600, cursor: "pointer"
      }}>
        <span style={{ width: 7, height: 7, borderRadius: 2, background: optColor, flexShrink: 0 }} />
        {isGroup ? `${c} (all)` : c}
      </button>
    );
  };
  const sectionLabel = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.mutedLight, marginBottom: 6 };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{
        width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: compact ? 6 : 8, padding: compact ? "5px 8px" : "9px 11px", borderRadius: compact ? 8 : 10,
        border: "1px solid " + COLORS.border, background: COLORS.card, cursor: "pointer"
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: compact ? 6 : 8, minWidth: 0 }}>
          <span style={{ width: compact ? 7 : 9, height: compact ? 7 : 9, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: compact ? 11.5 : 14, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        </span>
        <ChevronDown size={compact ? 12 : 14} style={{ color: COLORS.muted, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div className="nav-dropdown" style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
          background: COLORS.card, border: "1px solid " + COLORS.border, borderRadius: 12, padding: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.16)", maxHeight: 260, overflowY: "auto"
        }}>
          {adding ? (
            <div style={{ display: "flex", gap: 6, padding: 2 }}>
              <input autoFocus placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setAdding(false); }}
                style={{ flex: 1, minWidth: 0, fontSize: 12.5 }} />
              <button onClick={commit} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Add</button>
              <button onClick={() => setAdding(false)} style={{ background: COLORS.bg, border: "1px solid " + COLORS.border, borderRadius: 8, padding: "0 10px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", color: COLORS.muted }}>✕</button>
            </div>
          ) : (
            <>
              {sections.length === 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {options.map((o) => pill(o, false))}
                </div>
              ) : (
                <div>
                  {sections.map((s) => (
                    <div key={s.parent} style={{ marginBottom: 10 }}>
                      {allowGroups ? <div style={{ marginBottom: 6 }}>{pill(s.parent, true)}</div> : <div style={sectionLabel}>{s.parent}</div>}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{s.items.map((o) => pill(o, false))}</div>
                    </div>
                  ))}
                  {ungrouped.length > 0 && (
                    <div>
                      <div style={sectionLabel}>Ungrouped</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ungrouped.map((o) => pill(o, false))}</div>
                    </div>
                  )}
                </div>
              )}
              {onAddCategory && (
                <button type="button" onClick={() => setAdding(true)} style={{
                  marginTop: 8, width: "100%", background: "none", border: "1px dashed " + COLORS.border, borderRadius: 999,
                  padding: "6px 11px", fontSize: 12, fontWeight: 700, color: COLORS.muted, cursor: "pointer"
                }}>+ Add new category</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 5, fontWeight: 600 }}>{children}</div>;
}

function EmptyNote({ children }) {
  return <div style={{ padding: "16px 4px", color: COLORS.mutedLight, fontSize: 13 }}>{children}</div>;
}

function SelectBox({ value, onChange, children }) {
  return (
    <div style={{ position: "relative" }}>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ fontSize: 12, padding: "6px 26px 6px 10px", appearance: "none" }}>
        {children}
      </select>
      <ChevronDown size={13} style={{ position: "absolute", right: 8, top: 9, pointerEvents: "none", color: COLORS.muted }} />
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
      * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
      .mono { font-variant-numeric: tabular-nums; }
      ::selection { background: ${COLORS.orangeLight}; }
      input, select {
        font-family: inherit; background: ${COLORS.card}; border: 1px solid ${COLORS.border}; color: ${COLORS.text};
        border-radius: 10px; padding: 9px 11px; font-size: 14px; outline: none; transition: border-color .15s, background-color .2s ease, color .2s ease;
      }
      input:focus, select:focus { border-color: ${COLORS.orange}; }
      input::placeholder { color: ${COLORS.mutedLight}; }
      button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${COLORS.orange}; outline-offset: 2px; }
      input[type="checkbox"] { accent-color: ${COLORS.orange}; }
      button {
        transition: opacity .15s ease, transform .12s cubic-bezier(0.4,0,0.2,1), box-shadow .15s ease, background .15s ease, color .15s ease, border-color .15s ease;
        -webkit-tap-highlight-color: transparent;
      }
      button:hover { opacity: 0.88; }
      button:active { transform: scale(0.94); }
      .nav-dropdown { animation: dropdownIn .12s ease-out; transform-origin: top left; }
      @keyframes dropdownIn { from { opacity: 0; transform: scale(0.96) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .hero-wave { animation: waveScroll 9s linear infinite; }
      @keyframes waveScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .tab-panel { animation: tabIn .25s cubic-bezier(0.4,0,0.2,1); }
      @keyframes tabIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      .toast-item { animation: toastIn .25s cubic-bezier(0.4,0,0.2,1); }
      @keyframes toastIn { from { opacity: 0; transform: translateY(-10px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .toast-leaving { animation: toastOut .2s ease forwards; }
      @keyframes toastOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-8px) scale(0.96); } }

      .mobile-menu-btn { display: none; }
      .sidebar-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 250;
        opacity: 0; pointer-events: none; transition: opacity .2s ease;
      }
      .sidebar-backdrop.open { opacity: 1; pointer-events: auto; }
      .sidebar-drawer {
        position: fixed; top: 0; left: 0; bottom: 0; width: 78%; max-width: 300px;
        background: ${COLORS.card}; z-index: 260; display: flex; flex-direction: column;
        transform: translateX(-100%); transition: transform .25s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 0 0 40px rgba(0,0,0,0.25);
      }
      .sidebar-drawer.open { transform: translateX(0); }

      @media (max-width: 767px) {
        .mobile-menu-btn { display: flex; align-items: center; justify-content: center; }
        .nav-top-bar { display: none !important; }
      }
      @media (min-width: 768px) {
        .sidebar-drawer, .sidebar-backdrop { display: none !important; }
      }

      @media (prefers-reduced-motion: reduce) {
        .hero-wave, .tab-panel, .nav-dropdown, .toast-item, .toast-leaving, .sidebar-drawer, .sidebar-backdrop, button { animation: none !important; transition: none !important; }
      }
    `}</style>
  );
}
