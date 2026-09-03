import { ChevronRight } from "lucide-react";
import type { Corridor, Persona, ReserveView } from "../types";
import { Card } from "../components/ui";
import { ddmm, units } from "../store";

// B2 — Главная. Блок «Быстрые переводы» с плитками, ниже маркетинговые ряды.
// Карточка активного резерва вставляется под «Быстрые переводы».
export function Home({
  persona,
  corridor,
  reserve,
  onStartTransfer,
  onManageReserve,
}: {
  persona: Persona;
  corridor: Corridor;
  reserve: ReserveView | null;
  onStartTransfer: () => void;
  onManageReserve: () => void;
}) {
  const showReserve =
    reserve && ["ACTIVE", "EXECUTED", "EXPIRED"].includes(reserve.state);

  return (
    <div className="animate-fade-in">
      <h1 className="text-[32px] font-bold">Платежи</h1>

      <section className="mt-6">
        <h2 className="mb-3 text-[15px] font-semibold text-text-muted">Быстрые переводы</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            onClick={onStartTransfer}
            className="flex h-24 flex-col justify-between rounded-product bg-field p-4 text-left transition active:scale-[.99]"
          >
            <span className="text-2xl">🌍</span>
            <span className="text-[14px] font-medium">За рубеж</span>
          </button>
          {["По телефону", "Между счетами", "По реквизитам", "Себе"].map((t) => (
            <div
              key={t}
              className="flex h-24 flex-col justify-between rounded-product bg-field p-4 opacity-60"
            >
              <span className="text-2xl">↦</span>
              <span className="text-[14px] font-medium">{t}</span>
            </div>
          ))}
        </div>
      </section>

      {showReserve && (
        <button onClick={onManageReserve} className="mt-4 block w-full text-left">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] text-text-muted">Ожидание выгодного курса</div>
                <div className="text-[15px] font-semibold">
                  {units(reserve!.amount_rub, "₽")} · {corridor.country}
                </div>
                <div className="mt-1 text-[13px] text-text-muted">
                  {reserve!.state === "ACTIVE" &&
                    `${reserve!.condition_text} · осталось ${reserve!.days_left} дн.`}
                  {reserve!.state === "EXECUTED" &&
                    `Исполнен ${ddmm(reserve!.executed_on!)} · ждали ${reserve!.waited_days} дн.`}
                  {reserve!.state === "EXPIRED" && "Срок истёк, деньги разблокированы"}
                </div>
              </div>
              <ChevronRight className="text-text-muted" />
            </div>
          </Card>
        </button>
      )}

      <section className="mt-6 space-y-3">
        {["Деньги за рекомендации", "Альфа-Выгодно"].map((t) => (
          <div key={t} className="rounded-product bg-field p-5 text-[15px] text-text-muted">
            {t}
          </div>
        ))}
      </section>
    </div>
  );
}

// B2a — «За рубеж»: список стран. Воспроизводится как есть.
export function CountryList({
  corridors,
  current,
  onPick,
}: {
  corridors: Corridor[];
  current: string;
  onPick: (c: string) => void;
}) {
  const order = ["RUB_TJS", "RUB_UZS", "RUB_KGS", "RUB_KZT", "RUB_AMD"];
  const extra = ["Беларусь", "Азербайджан", "Китай"];
  const sorted = [...corridors].sort(
    (a, b) => order.indexOf(a.corridor) - order.indexOf(b.corridor)
  );
  return (
    <div className="animate-fade-in">
      <h1 className="text-[32px] font-bold">Перевод за рубеж</h1>
      <p className="mt-1 text-[13px] text-text-muted">Выберите страну получателя</p>
      <div className="mt-5 space-y-1">
        {sorted.map((c) => (
          <button
            key={c.corridor}
            onClick={() => onPick(c.corridor)}
            className={
              "flex w-full items-center gap-3 rounded-field px-4 py-3 text-left text-[15px] transition " +
              (c.corridor === current ? "bg-field" : "hover:bg-field/60")
            }
          >
            <span className="text-xl">{c.flag}</span>
            <span className="font-medium">{c.country}</span>
          </button>
        ))}
        {extra.map((c) => (
          <div
            key={c}
            className="flex items-center gap-3 rounded-field px-4 py-3 text-[15px] text-text-muted opacity-60"
          >
            <span className="text-xl">·</span>
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}
