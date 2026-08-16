import { useState, useEffect, useRef, useMemo } from "react";
import { storage } from "./storage.js";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import {
  Plus, Minus, Trash2, TrendingUp, TrendingDown, Wallet, ChevronDown,
  LayoutDashboard, List, PiggyBank, Repeat, Users, Zap, Power,
  CalendarDays, ChevronLeft, ChevronRight, Target, BarChart3, Sparkles,
  Landmark, Banknote, CreditCard, CircleDollarSign
} from "lucide-react";

/* ---------- design tokens ---------- */

const COLORS = {
  bg: "#F7F6FB", card: "#FFFFFF", border: "#ECEAF3",
  text: "#1F2430", muted: "#8A8FA3", mutedLight: "#C3C6D4",
  orange: "#FF7A3D", orangeDark: "#E8590C", orangeLight: "#FFEDE2",
  green: "#16A34A", greenLight: "#DCFCE7",
  rose: "#EF4444", roseLight: "#FEE2E2",
  amber: "#F59E0B", amberLight: "#FEF3C7",
  blue: "#3B82F6", blueLight: "#DBEAFE",
  purple: "#8B5CF6", purpleLight: "#EDE7FE",
};
const SHADOW = "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.06)";

/* ---------- constants ---------- */

const CATS_EXPENSE = ["Food", "Groceries", "Transport", "Rent", "Bills", "Shopping", "Health", "Entertainment", "Other"];
const CATS_INCOME = ["Salary", "Freelance", "Gift", "Investment", "Other"];
const CAT_COLORS = {
  Food: "#FF7A3D", Groceries: "#FBBF24", Transport: "#3B82F6", Rent: "#8B5CF6",
  Bills: "#F43F5E", Shopping: "#EC4899", Health: "#14B8A6", Entertainment: "#6366F1", Other: "#94A3B8",
  Salary: "#16A34A", Freelance: "#06B6D4", Gift: "#F472B6", Investment: "#FACC15"
};
const QUICK_ADDS = [
  { label: "Grab Ride", amount: 12, category: "Transport" },
  { label: "Kopitiam", amount: 8, category: "Food" },
  { label: "Coffee", amount: 6, category: "Food" },
  { label: "Groceries", amount: 50, category: "Groceries" },
  { label: "Petrol", amount: 40, category: "Transport" },
  { label: "Lunch", amount: 15, category: "Food" },
  { label: "Parking", amount: 3, category: "Transport" },
  { label: "Streaming", amount: 45, category: "Entertainment" },
];
const STORAGE_KEY = "finance-app-data";
const PERIOD_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const ACCOUNT_TYPES = [
  { id: "bank", label: "Bank", icon: Landmark, color: "#3B82F6" },
  { id: "ewallet", label: "E-Wallet", icon: Wallet, color: "#FF7A3D" },
  { id: "cash", label: "Cash", icon: Banknote, color: "#16A34A" },
  { id: "savings", label: "Savings", icon: PiggyBank, color: "#8B5CF6" },
  { id: "credit", label: "Credit Card", icon: CreditCard, color: "#F43F5E" },
  { id: "investment", label: "Investment", icon: TrendingUp, color: "#14B8A6" },
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
function relDateLabel(dateStr) {
  if (dateStr === todayISO()) return "Today";
  const y = addDays(new Date(), -1);
  if (dateStr === isoOf(y)) return "Yesterday";
  const opts = { day: "numeric", month: "short" };
  if (monthKey(dateStr) !== thisMonthKey()) opts.year = "numeric";
  return parseLocal(dateStr).toLocaleDateString("en-MY", opts);
}

function emptyData() {
  return { entries: [], budgets: {}, recurring: [], masterBudgets: {}, accounts: [] };
}
function normalizeBudgets(raw) {
  const out = {};
  Object.entries(raw || {}).forEach(([cat, val]) => {
    out[cat] = typeof val === "number" ? { monthly: val } : val;
  });
  return out;
}

/* ---------- root component ---------- */

export default function FinanceTracker() {
  const [data, setData] = useState(emptyData());
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [preset, setPreset] = useState({ type: null, token: 0 });
  const generatedRef = useRef(false);

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
            masterBudgets: parsed.masterBudgets || {},
            accounts: parsed.accounts || []
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
    if (!loaded || generatedRef.current) return;
    generatedRef.current = true;
    setData((prev) => {
      if (!prev.recurring.length) return prev;
      const today = new Date();
      const cmk = thisMonthKey();
      const newEntries = [];
      const updatedRecurring = prev.recurring.map((r) => {
        if (!r.active) return r;
        if (r.lastRun === cmk) return r;
        const dim = daysInMonth(today.getFullYear(), today.getMonth() + 1);
        const runDay = Math.min(r.day, dim);
        if (today.getDate() >= runDay) {
          const dateStr = `${cmk}-${String(runDay).padStart(2, "0")}`;
          newEntries.push({
            id: uid(), createdAt: Date.now(), type: r.type, amount: r.amount,
            category: r.category, note: r.name, date: dateStr, recurring: true
          });
          return { ...r, lastRun: cmk };
        }
        return r;
      });
      if (!newEntries.length) return prev;
      return { ...prev, entries: [...prev.entries, ...newEntries], recurring: updatedRecurring };
    });
  }, [loaded]);

  const addEntry = (entry) => setData((prev) => ({ ...prev, entries: [...prev.entries, { id: uid(), createdAt: Date.now(), ...entry }] }));
  const removeEntry = (id) => setData((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));

  const setBudget = (category, periodType, limit) => {
    setData((prev) => {
      const catBudget = { ...(prev.budgets[category] || {}), [periodType]: limit };
      return { ...prev, budgets: { ...prev.budgets, [category]: catBudget } };
    });
  };
  const removeBudget = (category, periodType) => {
    setData((prev) => {
      const catBudget = { ...(prev.budgets[category] || {}) };
      delete catBudget[periodType];
      const budgets = { ...prev.budgets };
      if (Object.keys(catBudget).length === 0) delete budgets[category]; else budgets[category] = catBudget;
      return { ...prev, budgets };
    });
  };
  const setMasterBudget = (periodType, limit) => setData((prev) => ({ ...prev, masterBudgets: { ...prev.masterBudgets, [periodType]: limit } }));
  const removeMasterBudget = (periodType) => setData((prev) => {
    const m = { ...prev.masterBudgets };
    delete m[periodType];
    return { ...prev, masterBudgets: m };
  });

  const addRecurring = (item) => setData((prev) => ({ ...prev, recurring: [...prev.recurring, { id: uid(), lastRun: null, ...item }] }));
  const toggleRecurring = (id) => setData((prev) => ({ ...prev, recurring: prev.recurring.map((r) => r.id === id ? { ...r, active: !r.active } : r) }));
  const removeRecurring = (id) => setData((prev) => ({ ...prev, recurring: prev.recurring.filter((r) => r.id !== id) }));

  const addAccount = (acc) => setData((prev) => ({ ...prev, accounts: [...prev.accounts, { id: uid(), createdAt: Date.now(), ...acc }] }));
  const removeAccount = (id) => setData((prev) => ({
    ...prev,
    accounts: prev.accounts.filter((a) => a.id !== id),
    entries: prev.entries.map((e) => e.accountId === id ? { ...e, accountId: null } : e)
  }));

  const goAdd = (type) => { setPreset({ type, token: Date.now() }); setTab("add"); };

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "accounts", label: "Accounts", icon: Landmark },
    { id: "add", label: "Add", icon: Plus },
    { id: "ledger", label: "Ledger", icon: List },
    { id: "periods", label: "Periods", icon: CalendarDays },
    { id: "insights", label: "Insights", icon: BarChart3 },
    { id: "budgets", label: "Budgets", icon: PiggyBank },
    { id: "recurring", label: "Recurring", icon: Repeat },
  ];

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: COLORS.bg, color: COLORS.text, minHeight: "100%", padding: "22px 16px 60px", boxSizing: "border-box" }}>
      <GlobalStyle />
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: COLORS.muted, textTransform: "uppercase", marginBottom: 4, fontWeight: 700 }}>Finance</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Personal Finance Tracker</h1>
        </div>

        <nav style={{ display: "flex", gap: 6, marginBottom: 22, overflowX: "auto", paddingBottom: 2 }}>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
              padding: "9px 15px", borderRadius: 999, border: "none",
              background: tab === id ? COLORS.orange : "transparent",
              color: tab === id ? "#fff" : COLORS.muted,
              fontSize: 13, fontWeight: 700, cursor: "pointer"
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>

        {tab === "dashboard" && <Dashboard entries={data.entries} budgets={data.budgets} accounts={data.accounts} onQuickAction={goAdd} onGoInsights={() => setTab("insights")} />}
        {tab === "accounts" && <Accounts accounts={data.accounts} entries={data.entries} onAdd={addAccount} onRemove={removeAccount} />}
        {tab === "add" && <AddTransaction onAdd={addEntry} preset={preset} accounts={data.accounts} />}
        {tab === "ledger" && <Ledger entries={data.entries} onRemove={removeEntry} />}
        {tab === "periods" && <Periods entries={data.entries} />}
        {tab === "insights" && <Insights entries={data.entries} />}
        {tab === "budgets" && (
          <Budgets
            entries={data.entries}
            budgets={data.budgets}
            onSetBudget={setBudget}
            onRemoveBudget={removeBudget}
            masterBudgets={data.masterBudgets}
            onSetMasterBudget={setMasterBudget}
            onRemoveMasterBudget={removeMasterBudget}
          />
        )}
        {tab === "recurring" && <Recurring recurring={data.recurring} onAdd={addRecurring} onToggle={toggleRecurring} onRemove={removeRecurring} />}
      </div>
    </div>
  );
}

/* ---------- dashboard ---------- */

function Dashboard({ entries, budgets, accounts, onQuickAction, onGoInsights }) {
  const cmk = thisMonthKey();
  const totals = useMemo(() => {
    const accountFloor = accounts.reduce((s, a) => s + a.initialBalance, 0);
    const balance = accountFloor + entries.reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0);
    const monthEntries = entries.filter((e) => monthKey(e.date) === cmk);
    const income = monthEntries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = monthEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { balance, income, expense, net: income - expense };
  }, [entries, accounts, cmk]);

  const budgetUsage = useMemo(() => {
    const withMonthly = Object.entries(budgets).filter(([, p]) => p.monthly != null);
    if (!withMonthly.length) return null;
    const totalLimit = withMonthly.reduce((s, [, p]) => s + p.monthly, 0);
    const cats = withMonthly.map(([c]) => c);
    const spent = entries.filter((e) => e.type === "expense" && monthKey(e.date) === cmk && cats.includes(e.category)).reduce((s, e) => s + e.amount, 0);
    return { pct: totalLimit > 0 ? Math.round((spent / totalLimit) * 100) : 0, spent, totalLimit };
  }, [entries, budgets, cmk]);

  const recent = useMemo(() => (
    [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 5)
  ), [entries]);

  return (
    <div>
      <HeroCard balance={totals.balance} net={totals.net} />

      <div style={{ display: "flex", justifyContent: "space-around", margin: "18px 0 20px" }}>
        <QuickAction icon={<Minus size={18} />} color={COLORS.rose} label="Add Expense" onClick={() => onQuickAction("expense")} />
        <QuickAction icon={<Plus size={18} />} color={COLORS.green} label="Add Income" onClick={() => onQuickAction("income")} />
        <QuickAction icon={<Sparkles size={18} />} color={COLORS.orange} label="Insights" onClick={onGoInsights} />
      </div>

      <SectionCard title="This Month">
        <StatRow icon={<TrendingUp size={16} />} color={COLORS.green} label="Income" value={fmt(totals.income)} />
        <StatRow icon={<TrendingDown size={16} />} color={COLORS.rose} label="Expenses" value={fmt(totals.expense)} />
        <StatRow icon={<Wallet size={16} />} color={COLORS.orange} label={totals.net >= 0 ? "Saved" : "Overspent"} value={fmt(Math.abs(totals.net))} />
        {budgetUsage && (
          <StatRow icon={<Target size={16} />} color={COLORS.blue} label="Budget Used" value={`${budgetUsage.pct}%`} />
        )}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Recent Transactions">
        {recent.length === 0 && <EmptyNote>No transactions yet — add your first one above.</EmptyNote>}
        {recent.map((e, i) => <TxRow key={e.id} e={e} last={i === recent.length - 1} />)}
      </SectionCard>
    </div>
  );
}

function HeroCard({ balance, net }) {
  const positive = net >= 0;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${COLORS.orange}, ${COLORS.orangeDark})`,
      borderRadius: 24, padding: "22px 22px 30px", color: "#fff", position: "relative", overflow: "hidden"
    }}>
      <div style={{ fontSize: 12.5, opacity: 0.9, fontWeight: 600 }}>Total Balance</div>
      <div style={{ fontSize: 34, fontWeight: 800, margin: "6px 0 12px" }}>{fmt(balance)}</div>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700,
        background: "rgba(255,255,255,0.2)", padding: "5px 11px", borderRadius: 999
      }}>
        {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {positive ? "+" : "−"}{fmt(Math.abs(net))} this month
      </div>
      <svg viewBox="0 0 400 60" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 46, opacity: 0.22 }}>
        <path d="M0,40 C60,10 100,50 160,30 C220,10 260,45 320,25 C360,12 380,30 400,20 L400,60 L0,60 Z" fill="#ffffff" />
      </svg>
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

function Accounts({ accounts, entries, onAdd, onRemove }) {
  const [form, setForm] = useState({ name: "", type: "bank", initialBalance: "" });
  const [error, setError] = useState("");

  const balanceFor = (accountId) => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return 0;
    const net = entries.filter((e) => e.accountId === accountId).reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0);
    return acc.initialBalance + net;
  };

  const unassignedNet = useMemo(() => (
    entries.filter((e) => !e.accountId).reduce((s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0)
  ), [entries]);

  const totalAcrossAccounts = accounts.reduce((s, a) => s + balanceFor(a.id), 0) + unassignedNet;

  const submit = () => {
    if (!form.name.trim()) { setError("Give the account a name."); return; }
    setError("");
    onAdd({ name: form.name.trim(), type: form.type, initialBalance: parseFloat(form.initialBalance) || 0 });
    setForm({ name: "", type: form.type, initialBalance: "" });
  };

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
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }}>
              {ACCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
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
        {error && <div style={{ color: COLORS.rose, fontSize: 12.5, marginTop: 10, fontWeight: 600 }}>{error}</div>}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Your Accounts">
        {accounts.length === 0 && <EmptyNote>No accounts yet. Add your bank, e-wallet, or cash on hand above to start tracking real balances.</EmptyNote>}
        {accounts.map((a, i) => {
          const type = ACCOUNT_TYPES.find((t) => t.id === a.type) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
          const Icon = type.icon;
          const bal = balanceFor(a.id);
          const delta = bal - a.initialBalance;
          return (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 2px", borderBottom: i === accounts.length - 1 ? "none" : "1px solid " + COLORS.border }}>
              <span style={{ width: 38, height: 38, minWidth: 38, borderRadius: "50%", background: type.color + "22", color: type.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>{type.label} · Started at {fmt(a.initialBalance)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 14, fontWeight: 800 }}>{fmt(bal)}</div>
                {delta !== 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? COLORS.green : COLORS.rose }}>
                    {delta >= 0 ? "+" : "−"}{fmt(Math.abs(delta))}
                  </div>
                )}
              </div>
              <button onClick={() => onRemove(a.id)} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}>
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </SectionCard>
    </div>
  );
}

/* ---------- add transaction ---------- */

function AddTransaction({ onAdd, preset, accounts }) {
  const [form, setForm] = useState({ type: "expense", amount: "", category: CATS_EXPENSE[0], note: "", date: todayISO(), accountId: "" });
  const [split, setSplit] = useState(false);
  const [splitTotal, setSplitTotal] = useState("");
  const [splitPeople, setSplitPeople] = useState(2);
  const [error, setError] = useState("");

  useEffect(() => {
    if (accounts.length > 0) setForm((f) => f.accountId ? f : { ...f, accountId: accounts[0].id });
  }, [accounts]);

  const switchType = (type) => setForm((f) => ({ ...f, type, category: type === "expense" ? CATS_EXPENSE[0] : CATS_INCOME[0] }));

  useEffect(() => {
    if (preset && preset.type) switchType(preset.type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset && preset.token]);

  const yourShare = split && splitTotal && splitPeople > 0 ? parseFloat(splitTotal) / splitPeople : null;
  const owed = split && yourShare !== null ? parseFloat(splitTotal) - yourShare : null;

  const submit = () => {
    let amount = parseFloat(form.amount);
    let note = form.note.trim();
    let splitInfo = null;
    if (split) {
      const total = parseFloat(splitTotal);
      if (!total || total <= 0 || !splitPeople || splitPeople < 1) { setError("Enter a valid split total and number of people."); return; }
      amount = total / splitPeople;
      splitInfo = { total, people: splitPeople, yourShare: amount, owed: total - amount };
    }
    if (!amount || amount <= 0) { setError("Enter an amount greater than zero."); return; }
    if (!form.date) { setError("Pick a date."); return; }
    setError("");
    onAdd({ type: form.type, amount, category: form.category, note, date: form.date, split: splitInfo, accountId: form.accountId || null });
    setForm((f) => ({ ...f, amount: "", note: "" }));
    setSplit(false); setSplitTotal(""); setSplitPeople(2);
  };

  const quickAdd = (q) => onAdd({ type: "expense", amount: q.amount, category: q.category, note: q.label, date: todayISO(), split: null, accountId: form.accountId || null });

  return (
    <div>
      <SectionCard title="Quick Add" icon={<Zap size={13} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {QUICK_ADDS.map((q) => (
            <button key={q.label} onClick={() => quickAdd(q)} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 13px", borderRadius: 999, border: "1px solid " + COLORS.border, background: COLORS.bg,
              color: COLORS.text, cursor: "pointer"
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[q.category] }} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{q.label}</span>
              <span className="mono" style={{ fontSize: 11.5, color: COLORS.muted }}>{fmt(q.amount)}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="New Transaction">
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {["expense", "income"].map((t) => (
            <button key={t} onClick={() => switchType(t)} style={{
              flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid " + (form.type === t ? COLORS.orange : COLORS.border),
              background: form.type === t ? COLORS.orangeLight : "#fff",
              color: form.type === t ? COLORS.orangeDark : COLORS.muted,
              fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "capitalize"
            }}>{t}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <FieldLabel>Amount (RM){split ? " — auto from split" : ""}</FieldLabel>
            <input type="number" min="0" step="0.01" placeholder="0.00" value={split ? (yourShare !== null ? yourShare.toFixed(2) : "") : form.amount}
              disabled={split}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              style={{ width: "100%", boxSizing: "border-box", opacity: split ? 0.6 : 1 }} className="mono" />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }}>
              {(form.type === "expense" ? CATS_EXPENSE : CATS_INCOME).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Note (optional)</FieldLabel>
            <input type="text" placeholder="e.g. Lunch with team" value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} />
          </div>
          {accounts.length > 0 && (
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Account</FieldLabel>
              <select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }}>
                <option value="">Unassigned</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {form.type === "expense" && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.muted, cursor: "pointer", fontWeight: 600 }}>
              <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} style={{ width: 15, height: 15, padding: 0 }} />
              <Users size={14} /> This cost was split with others
            </label>
            {split && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10, background: COLORS.bg, border: "1px solid " + COLORS.border, borderRadius: 12, padding: 12 }}>
                <div>
                  <FieldLabel>Total Cost (RM)</FieldLabel>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={splitTotal} onChange={(e) => setSplitTotal(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} className="mono" />
                </div>
                <div>
                  <FieldLabel>People Sharing (incl. you)</FieldLabel>
                  <input type="number" min="1" step="1" value={splitPeople} onChange={(e) => setSplitPeople(parseInt(e.target.value) || 1)} style={{ width: "100%", boxSizing: "border-box" }} className="mono" />
                </div>
                {yourShare !== null && (
                  <div style={{ gridColumn: "1 / -1", fontSize: 12.5, color: COLORS.muted }} className="mono">
                    You pay <span style={{ color: COLORS.text }}>{fmt(yourShare)}</span> · Owed to you <span style={{ color: COLORS.green }}>{fmt(owed)}</span>
                  </div>
                )}
              </div>
            )}
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

/* ---------- ledger ---------- */

function Ledger({ entries, onRemove }) {
  const [monthFilter, setMonthFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");

  const months = useMemo(() => {
    const s = new Set(entries.map((e) => monthKey(e.date)));
    return [...s].sort().reverse();
  }, [entries]);

  const allCats = [...new Set([...CATS_EXPENSE, ...CATS_INCOME])];

  const filtered = useMemo(() => (
    [...entries]
      .filter((e) => monthFilter === "all" || monthKey(e.date) === monthFilter)
      .filter((e) => catFilter === "all" || e.category === catFilter)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  ), [entries, monthFilter, catFilter]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <SectionCard title="Transaction Ledger" right={
      <div style={{ display: "flex", gap: 8 }}>
        <SelectBox value={monthFilter} onChange={setMonthFilter}>
          <option value="all">All months</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </SelectBox>
        <SelectBox value={catFilter} onChange={setCatFilter}>
          <option value="all">All categories</option>
          {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectBox>
      </div>
    }>
      {filtered.length === 0 && <EmptyNote>No entries match this filter.</EmptyNote>}
      {groups.map(([date, items], gi) => (
        <div key={date} style={{ marginBottom: gi === groups.length - 1 ? 0 : 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.muted, padding: "10px 2px 4px" }}>{relDateLabel(date)}</div>
          {items.map((e, i) => <TxRow key={e.id} e={e} last={i === items.length - 1} onRemove={onRemove} hideDate />)}
        </div>
      ))}
    </SectionCard>
  );
}

/* ---------- periods (daily / weekly / monthly profit-or-loss) ---------- */

function Periods({ entries }) {
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
              background: periodType === id ? COLORS.orangeLight : "#fff", color: periodType === id ? COLORS.orangeDark : COLORS.muted,
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
        {inRange.map((e, i) => <TxRow key={e.id} e={e} last={i === inRange.length - 1} />)}
      </SectionCard>
    </div>
  );
}

const navBtnStyle = {
  background: "#fff", border: "1px solid " + COLORS.border, borderRadius: 10, color: COLORS.text,
  cursor: "pointer", padding: "8px 10px", display: "flex", alignItems: "center", boxShadow: SHADOW
};

/* ---------- insights ---------- */

function Insights({ entries }) {
  const [scope, setScope] = useState("month");
  const cmk = thisMonthKey();

  const scopedExpenses = useMemo(() => (
    entries.filter((e) => e.type === "expense" && (scope === "all" || monthKey(e.date) === cmk))
  ), [entries, scope, cmk]);

  const pieData = useMemo(() => {
    const map = {};
    scopedExpenses.forEach((e) => { map[e.category] = (map[e.category] || 0) + e.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [scopedExpenses]);

  const totalExpense = pieData.reduce((s, d) => s + d.value, 0);

  const trend6 = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = addMonths(new Date(), -i);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ mk, label: d.toLocaleDateString("en-MY", { month: "short" }) });
    }
    return months.map(({ mk, label }) => {
      const monthEntries = entries.filter((e) => monthKey(e.date) === mk);
      const income = monthEntries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
      const expense = monthEntries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      return { label, income, expense, net: income - expense };
    });
  }, [entries]);

  const avgDailySpend = useMemo(() => {
    if (scope === "month") {
      const daysElapsed = Math.max(1, new Date().getDate());
      return totalExpense / daysElapsed;
    }
    if (!entries.length) return 0;
    const dates = entries.map((e) => parseLocal(e.date).getTime());
    const spanDays = Math.max(1, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1);
    return totalExpense / spanDays;
  }, [scope, totalExpense, entries]);

  const biggestExpense = useMemo(() => (
    [...scopedExpenses].sort((a, b) => b.amount - a.amount)[0] || null
  ), [scopedExpenses]);

  return (
    <div>
      <SectionCard title="6-Month Cash Flow">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={trend6} margin={{ top: 6, right: 10, bottom: 0, left: -14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
            <XAxis dataKey="label" stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={COLORS.muted} fontSize={11} tickLine={false} axisLine={false} width={44} />
            <Tooltip contentStyle={{ background: "#fff", border: "1px solid " + COLORS.border, borderRadius: 10, fontSize: 12 }} formatter={(v) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="income" name="Income" fill={COLORS.green} radius={[5, 5, 0, 0]} barSize={14} />
            <Bar dataKey="expense" name="Expense" fill={COLORS.rose} radius={[5, 5, 0, 0]} barSize={14} />
            <Line type="monotone" dataKey="net" name="Net" stroke={COLORS.orangeDark} strokeWidth={2.5} dot={{ r: 3, fill: COLORS.orangeDark }} />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Expense Insights" right={
        <div style={{ display: "flex", gap: 6 }}>
          {[["month", "This Month"], ["all", "All Time"]].map(([id, label]) => (
            <button key={id} onClick={() => setScope(id)} style={{
              padding: "6px 12px", borderRadius: 999, border: "1px solid " + (scope === id ? COLORS.orange : COLORS.border),
              background: scope === id ? COLORS.orangeLight : "#fff", color: scope === id ? COLORS.orangeDark : COLORS.muted,
              fontSize: 11.5, fontWeight: 700, cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
      }>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <SummaryCard icon={<Wallet size={16} />} label="Avg Daily Spend" value={fmt(avgDailySpend)} color={COLORS.orange} />
          <SummaryCard icon={<Target size={16} />} label="Top Category" value={pieData[0] ? pieData[0].name : "—"} color={COLORS.blue} sub={pieData[0] ? fmt(pieData[0].value) : null} />
          <SummaryCard icon={<TrendingDown size={16} />} label="Biggest Expense" value={biggestExpense ? fmt(biggestExpense.amount) : "—"} color={COLORS.rose} sub={biggestExpense ? (biggestExpense.note || biggestExpense.category) : null} />
        </div>

        {pieData.length === 0 ? (
          <EmptyNote>No expenses recorded {scope === "month" ? "this month" : "yet"}.</EmptyNote>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 22, alignItems: "center" }}>
            <div style={{ position: "relative", width: 170, height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={CAT_COLORS[d.name] || "#94a3b8"} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid " + COLORS.border, borderRadius: 10, fontSize: 12 }} formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 800 }}>{fmt(totalExpense)}</div>
                <div style={{ fontSize: 10.5, color: COLORS.muted, fontWeight: 600 }}>Total</div>
              </div>
            </div>
            <div>
              {pieData.slice(0, 6).map((d) => {
                const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
                return (
                  <div key={d.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[d.name] || "#94a3b8" }} />{d.name}
                      </span>
                      <span className="mono" style={{ color: COLORS.muted }}>{fmt(d.value)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: COLORS.bg, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: CAT_COLORS[d.name] || "#94a3b8", borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ---------- budgets ---------- */

function Budgets({ entries, budgets, onSetBudget, onRemoveBudget, masterBudgets, onSetMasterBudget, onRemoveMasterBudget }) {
  const [cat, setCat] = useState(CATS_EXPENSE[0]);
  const [period, setPeriod] = useState("monthly");
  const [limit, setLimit] = useState("");

  const spentForCategoryPeriod = (category, periodType) => {
    const r = periodRange(periodType, new Date());
    return entries.filter((e) => e.type === "expense" && e.category === category && e.date >= r.start && e.date <= r.end).reduce((s, e) => s + e.amount, 0);
  };

  const masterSpent = useMemo(() => {
    const now = new Date();
    const sumIn = (pt) => {
      const r = periodRange(pt, now);
      return entries.filter((e) => e.type === "expense" && e.date >= r.start && e.date <= r.end).reduce((s, e) => s + e.amount, 0);
    };
    return { daily: sumIn("daily"), weekly: sumIn("weekly"), monthly: sumIn("monthly") };
  }, [entries]);

  const submitBudget = () => {
    const val = parseFloat(limit);
    if (!val || val <= 0) return;
    onSetBudget(cat, period, val);
    setLimit("");
  };

  const categoryBudgetEntries = Object.entries(budgets).filter(([, periods]) => Object.keys(periods).length > 0);

  return (
    <div>
      <SectionCard title="Master Budget" icon={<Target size={13} />}>
        <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
          An overall spending ceiling across all categories combined — sits above the per-category budgets below.
        </div>
        {["daily", "weekly", "monthly"].map((pt) => (
          <MasterBudgetRow
            key={pt}
            label={PERIOD_LABEL[pt]}
            limit={masterBudgets[pt]}
            spent={masterSpent[pt]}
            onSet={(val) => onSetMasterBudget(pt, val)}
            onRemove={() => onRemoveMasterBudget(pt)}
          />
        ))}
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Set a Category Budget">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <FieldLabel>Category</FieldLabel>
            <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }}>
              {CATS_EXPENSE.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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
            <FieldLabel>Limit (RM)</FieldLabel>
            <input type="number" min="0" step="1" placeholder="0.00" value={limit} onChange={(e) => setLimit(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} className="mono" />
          </div>
          <button onClick={submitBudget} style={{
            background: COLORS.orange, color: "#fff", border: "none", borderRadius: 10,
            padding: "9px 16px", fontWeight: 700, fontSize: 13.5, cursor: "pointer", height: 39
          }}>Set</button>
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Category Budgets">
        {categoryBudgetEntries.length === 0 && <EmptyNote>No category budgets set yet. Add one above.</EmptyNote>}
        {categoryBudgetEntries.map(([category, periods], idx) => (
          <div key={category} style={{ marginBottom: 16, paddingBottom: 14, borderBottom: idx === categoryBudgetEntries.length - 1 ? "none" : "1px solid " + COLORS.border }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: CAT_COLORS[category] || "#94a3b8" }} />
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{category}</span>
            </div>
            {["daily", "weekly", "monthly"].filter((pt) => periods[pt] != null).map((pt) => {
              const lim = periods[pt];
              const spent = spentForCategoryPeriod(category, pt);
              const pct = Math.min(100, (spent / lim) * 100);
              const over = spent > lim;
              const color = over ? COLORS.rose : pct >= 70 ? COLORS.amber : COLORS.green;
              return (
                <div key={pt} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: COLORS.muted, fontWeight: 600 }}>{PERIOD_LABEL[pt]}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span className="mono" style={{ color: over ? COLORS.rose : COLORS.muted }}>{fmt(spent)} / {fmt(lim)}</span>
                      <button onClick={() => onRemoveBudget(category, pt)} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}><Trash2 size={12} /></button>
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: COLORS.bg, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
                  </div>
                  {over && <div style={{ fontSize: 10.5, color: COLORS.rose, marginTop: 3, fontWeight: 600 }}>Over by {fmt(spent - lim)}</div>}
                </div>
              );
            })}
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

function MasterBudgetRow({ label, limit, spent, onSet, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(limit || "");

  useEffect(() => { setVal(limit || ""); }, [limit]);

  const save = () => {
    const n = parseFloat(val);
    if (!n || n <= 0) return;
    onSet(n);
    setEditing(false);
  };

  const pct = limit ? Math.min(100, (spent / limit) * 100) : 0;
  const over = limit && spent > limit;
  const color = over ? COLORS.rose : pct >= 70 ? COLORS.amber : COLORS.green;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        {!editing && limit ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 12, color: over ? COLORS.rose : COLORS.muted }}>{fmt(spent)} / {fmt(limit)}</span>
            <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Edit</button>
            <button onClick={onRemove} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}><Trash2 size={12} /></button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="number" min="0" step="1" placeholder="RM limit" value={val} onChange={(e) => setVal(e.target.value)}
              style={{ width: 100, padding: "5px 8px", fontSize: 12.5 }} className="mono" />
            <button onClick={save} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Save</button>
          </div>
        )}
      </div>
      {limit ? (
        <>
          <div style={{ height: 7, borderRadius: 4, background: COLORS.bg, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
          </div>
          {over && <div style={{ fontSize: 11, color: COLORS.rose, marginTop: 3, fontWeight: 600 }}>Over by {fmt(spent - limit)}</div>}
        </>
      ) : (
        <div style={{ fontSize: 11.5, color: COLORS.mutedLight }}>No {label.toLowerCase()} ceiling set.</div>
      )}
    </div>
  );
}

/* ---------- recurring ---------- */

function Recurring({ recurring, onAdd, onToggle, onRemove }) {
  const [form, setForm] = useState({ name: "", amount: "", type: "expense", category: CATS_EXPENSE[0], day: 1 });
  const [error, setError] = useState("");

  const switchType = (type) => setForm((f) => ({ ...f, type, category: type === "expense" ? CATS_EXPENSE[0] : CATS_INCOME[0] }));

  const submit = () => {
    const amount = parseFloat(form.amount);
    if (!form.name.trim()) { setError("Give it a name, e.g. Netflix."); return; }
    if (!amount || amount <= 0) { setError("Enter an amount greater than zero."); return; }
    if (!form.day || form.day < 1 || form.day > 31) { setError("Day must be between 1 and 31."); return; }
    setError("");
    onAdd({ name: form.name.trim(), amount, type: form.type, category: form.category, day: parseInt(form.day), active: true });
    setForm((f) => ({ ...f, name: "", amount: "" }));
  };

  return (
    <div>
      <SectionCard title="New Recurring Transaction">
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {["expense", "income"].map((t) => (
            <button key={t} onClick={() => switchType(t)} style={{
              flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid " + (form.type === t ? COLORS.orange : COLORS.border),
              background: form.type === t ? COLORS.orangeLight : "#fff", color: form.type === t ? COLORS.orangeDark : COLORS.muted,
              fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "capitalize"
            }}>{t}</button>
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
            <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }}>
              {(form.type === "expense" ? CATS_EXPENSE : CATS_INCOME).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Day of Month</FieldLabel>
            <input type="number" min="1" max="31" value={form.day} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))} style={{ width: "100%", boxSizing: "border-box" }} className="mono" />
          </div>
        </div>
        {error && <div style={{ color: COLORS.rose, fontSize: 12.5, marginBottom: 10, fontWeight: 600 }}>{error}</div>}
        <button onClick={submit} style={{
          display: "flex", alignItems: "center", gap: 6, background: COLORS.orange, color: "#fff",
          border: "none", borderRadius: 12, padding: "10px 18px", fontWeight: 700, fontSize: 13.5, cursor: "pointer"
        }}>
          <Plus size={16} /> Add Recurring
        </button>
        <div style={{ fontSize: 11.5, color: COLORS.mutedLight, marginTop: 10 }}>
          Runs automatically once the app is opened on or after its day each month — this needs the app to be opened, since it can't run in the background.
        </div>
      </SectionCard>

      <div style={{ height: 16 }} />

      <SectionCard title="Active Recurring Items">
        {recurring.length === 0 && <EmptyNote>No recurring transactions set up yet.</EmptyNote>}
        {recurring.map((r, i) => (
          <div key={r.id} style={{
            display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 10,
            padding: "11px 4px", borderBottom: i === recurring.length - 1 ? "none" : "1px solid " + COLORS.border, opacity: r.active ? 1 : 0.45
          }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: CAT_COLORS[r.category] || "#94a3b8" }} />
                <span style={{ fontSize: 11, color: COLORS.muted }}>{r.category} · Day {r.day}</span>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: r.type === "income" ? COLORS.green : COLORS.text }}>
              {r.type === "income" ? "+" : "−"}{fmt(r.amount)}
            </div>
            <button onClick={() => onToggle(r.id)} title={r.active ? "Pause" : "Resume"} style={{
              background: "#fff", border: "1px solid " + COLORS.border, borderRadius: 8, color: r.active ? COLORS.green : COLORS.mutedLight,
              cursor: "pointer", padding: "5px 7px", display: "flex"
            }}><Power size={13} /></button>
            <button onClick={() => onRemove(r.id)} style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", display: "flex" }}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}

/* ---------- shared small components ---------- */

function TxRow({ e, last, onRemove, hideDate }) {
  const cols = [hideDate ? null : "56px", "1fr", "auto", onRemove ? "26px" : null].filter(Boolean).join(" ");
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", gap: 10, padding: "10px 2px", borderBottom: last ? "none" : "1px solid " + COLORS.border }}>
      {!hideDate && <div className="mono" style={{ fontSize: 11, color: COLORS.muted }}>{e.date.slice(5)}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: (CAT_COLORS[e.category] || "#94a3b8") + "22", color: CAT_COLORS[e.category] || "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {e.type === "income" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note || e.category}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>{e.category}</span>
            {e.split && <Badge>Split · owed {fmt(e.split.owed)}</Badge>}
            {e.recurring && <Badge>Recurring</Badge>}
          </div>
        </div>
      </div>
      <div className="mono" style={{ fontSize: 13.5, fontWeight: 700, color: e.type === "income" ? COLORS.green : COLORS.text, textAlign: "right", whiteSpace: "nowrap" }}>
        {e.type === "income" ? "+" : "−"}{fmt(e.amount)}
      </div>
      {onRemove && (
        <button onClick={() => onRemove(e.id)} aria-label="Delete entry" style={{ background: "none", border: "none", color: COLORS.mutedLight, cursor: "pointer", padding: 4, display: "flex" }}>
          <Trash2 size={14} />
        </button>
      )}
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
    <div style={{ background: COLORS.card, borderRadius: 20, padding: 18, boxShadow: SHADOW }}>
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
        font-family: inherit; background: #fff; border: 1px solid ${COLORS.border}; color: ${COLORS.text};
        border-radius: 10px; padding: 9px 11px; font-size: 14px; outline: none; transition: border-color .15s;
      }
      input:focus, select:focus { border-color: ${COLORS.orange}; }
      input::placeholder { color: ${COLORS.mutedLight}; }
      button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid ${COLORS.orange}; outline-offset: 2px; }
      input[type="checkbox"] { accent-color: ${COLORS.orange}; }
      button { transition: opacity .15s, transform .1s; }
      button:hover { opacity: 0.85; }
      button:active { transform: scale(0.97); }
    `}</style>
  );
}
