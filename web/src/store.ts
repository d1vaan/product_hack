// Состояние прогона в query-строке — теперь только выбранный сценарий.
export interface UrlState {
  scenario: string | null;
}

export function readUrl(): UrlState {
  const p = new URLSearchParams(location.search);
  return { scenario: p.get("scenario") };
}

export function writeUrl(s: UrlState) {
  const p = new URLSearchParams();
  if (s.scenario) p.set("scenario", s.scenario);
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
  // адаптивная точность: у мелких валют (UZS ≈ 0,0069) 5 знаков теряют цифры
  const abs = Math.abs(n);
  const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 5 : 6;
  return n
    .toFixed(digits)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "")
    .replace(".", ",");
}

export function pct(bp: number): string {
  return (Math.abs(bp) / 100).toFixed(2).replace(".", ",") + "%";
}

export function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
