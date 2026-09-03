import type { Mechanic, Mode } from "./types";

// Состояние прогона, кодируемое в query-строке (BFR-22 / ТЗ §6).
export interface UrlState {
  mode: Mode;
  scenario: string | null;
  persona: string | null;
  corridor: string | null;
  date: string | null;
  delay: number | null;
  mechanic: Mechanic;
}

const DEFAULTS: UrlState = {
  mode: "demo",
  scenario: "S2",
  persona: null,
  corridor: null,
  date: null,
  delay: null,
  mechanic: "C",
};

export function readUrl(): UrlState {
  const p = new URLSearchParams(location.search);
  const mode = (p.get("mode") as Mode) || DEFAULTS.mode;
  return {
    mode: ["demo", "review", "data"].includes(mode) ? mode : "demo",
    scenario: p.get("scenario"),
    persona: p.get("persona"),
    corridor: p.get("corridor"),
    date: p.get("date"),
    delay: p.get("delay") ? Number(p.get("delay")) : null,
    mechanic: ((p.get("mechanic") as Mechanic) || DEFAULTS.mechanic).toUpperCase() as Mechanic,
  };
}

export function writeUrl(s: Partial<UrlState>) {
  const cur = readUrl();
  const next = { ...cur, ...s };
  const p = new URLSearchParams();
  if (next.mode && next.mode !== "demo") p.set("mode", next.mode);
  if (next.scenario) p.set("scenario", next.scenario);
  if (next.persona) p.set("persona", next.persona);
  if (next.corridor) p.set("corridor", next.corridor);
  if (next.date) p.set("date", next.date);
  if (next.delay != null) p.set("delay", String(next.delay));
  if (next.mechanic && next.mechanic !== "C") p.set("mechanic", next.mechanic);
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

// Анонимный идентификатор сессии для группировки событий. Не ПДн.
export function sessionId(): string {
  const k = "stand_session";
  let v = sessionStorage.getItem(k);
  if (!v) {
    v = "s_" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(k, v);
  }
  return v;
}

// --- форматирование ---------------------------------------------------
const nf = new Intl.NumberFormat("ru-RU");

export function money(n: number | null | undefined, suffix = "₽"): string {
  if (n == null) return "—";
  return `${nf.format(Math.round(n))} ${suffix}`;
}

export function units(n: number | null | undefined, currencyShort: string): string {
  if (n == null) return "—";
  return `${nf.format(Math.round(n))} ${currencyShort}`;
}

export function rate(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toFixed(5).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

export function pct(bp: number): string {
  return (Math.abs(bp) / 100).toFixed(2).replace(".", ",") + "%";
}

export function ddmm(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
