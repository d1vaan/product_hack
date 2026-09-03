import type { ReactNode } from "react";
import type { Evaluation, Health, Persona, Scenario, StandEvent } from "../types";
import type { Mechanic } from "../types";
import { AssumptionMark } from "../components/ui";
import { ddmm } from "../store";

export interface Knobs {
  driftThreshold: number;
  mechanic: Mechanic;
  budget: number;
  cooldown: number;
  reservePercentile: number;
  reserveWindow: number;
  openDelay: number;
}

// Панель разбора (режим «Разбор»). Справа от макета на десктопе, снизу на узком.
export function AnalysisPanel({
  scenarios,
  activeScenario,
  onScenario,
  personas,
  knobs,
  onKnob,
  onPlay,
  onPlusDay,
  simDate,
  events,
  texts,
  ev,
  health,
}: {
  scenarios: Scenario[];
  activeScenario: Scenario | null;
  onScenario: (id: string) => void;
  personas: Persona[];
  knobs: Knobs;
  onKnob: (k: Partial<Knobs>) => void;
  onPlay: () => void;
  onPlusDay: () => void;
  simDate: string;
  events: StandEvent[];
  texts: any[];
  ev: Evaluation | null;
  health: Health | null;
}) {
  const persona = personas.find((p) => p.id === activeScenario?.persona);

  return (
    <div className="w-full space-y-4 lg:w-[420px] lg:shrink-0">
      {/* Пульт сценария */}
      <Block title="Пульт сценария">
        <select
          value={activeScenario?.id || ""}
          onChange={(e) => onScenario(e.target.value)}
          className="w-full rounded-field bg-field px-3 py-2 text-[14px]"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} · {s.title}
              {s.optional ? " (опц.)" : ""}
            </option>
          ))}
        </select>
        {activeScenario && (
          <p className="mt-2 text-[13px] leading-snug text-text-muted">
            {activeScenario.summary}
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
          <Meta k="Портрет" v={persona?.name || "—"} />
          <Meta k="Коридор" v={activeScenario?.corridor || "—"} />
          <Meta k="Дата среза" v={simDate} />
          <Meta
            k="Задержка открытия"
            v={<>{knobs.openDelay} мин <AssumptionMark /></>}
          />
          <Meta k="Вход" v={activeScenario?.entry || "—"} />
          <Meta
            k="Ожидаемое состояние"
            v={
              <span
                className={
                  ev && activeScenario && ev.state !== activeScenario.expected_state
                    ? "font-semibold text-accent"
                    : ""
                }
              >
                {activeScenario?.expected_state || "—"}
                {ev ? ` · факт ${ev.state}` : ""}
              </span>
            }
          />
        </dl>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onPlay}
            className="h-10 flex-1 rounded-btn bg-cta text-[14px] font-semibold text-white"
          >
            Проиграть
          </button>
          <button
            onClick={onPlusDay}
            className="h-10 rounded-btn bg-field px-4 text-[14px] font-semibold"
            title="Сдвинуть дату среза на следующий торговый день и переоценить резервы"
          >
            +1 день
          </button>
        </div>
      </Block>

      {/* Крутилки поведения — числа помечены как параметр стенда */}
      <Block title="Крутилки поведения">
        <Slider
          label="Задержка открытия, мин"
          min={5}
          max={1440}
          step={5}
          value={knobs.openDelay}
          onChange={(v) => onKnob({ openDelay: v })}
        />
        <Slider
          label="Порог DRIFT, б.п."
          min={5}
          max={100}
          step={5}
          value={knobs.driftThreshold}
          onChange={(v) => onKnob({ driftThreshold: v })}
        />
        <div className="mt-2 text-[13px] text-text-muted">Механика подачи DRIFT</div>
        <div className="mt-1 flex gap-2">
          {(["A", "B", "C"] as Mechanic[]).map((m) => (
            <button
              key={m}
              onClick={() => onKnob({ mechanic: m })}
              className={
                "h-9 flex-1 rounded-btn text-[13px] font-semibold transition " +
                (knobs.mechanic === m ? "bg-cta text-white" : "bg-field")
              }
            >
              {m === "A" ? "A · дельта" : m === "B" ? "B · контекст" : "C · оба"}
            </button>
          ))}
        </div>
        <Slider
          label="Бюджет пушей в месяц"
          min={1}
          max={30}
          step={1}
          value={knobs.budget}
          onChange={(v) => onKnob({ budget: v })}
        />
        <Slider
          label="Cooldown, дней"
          min={0}
          max={14}
          step={1}
          value={knobs.cooldown}
          onChange={(v) => onKnob({ cooldown: v })}
        />
        <Slider
          label="Перцентиль резерва, %"
          min={5}
          max={50}
          step={5}
          value={knobs.reservePercentile}
          onChange={(v) => onKnob({ reservePercentile: v })}
        />
        <Slider
          label="Окно резерва, дней"
          min={10}
          max={90}
          step={5}
          value={knobs.reserveWindow}
          onChange={(v) => onKnob({ reserveWindow: v })}
        />
        <p className="mt-2 text-[12px] text-text-muted">
          Все значения выше — параметры стенда, не измеренные данные.
        </p>
      </Block>

      {/* Лента событий */}
      <Block title="Лента событий">
        <div className="max-h-64 space-y-1 overflow-auto text-[12px]">
          {events.length === 0 && <div className="text-text-muted">пока пусто</div>}
          {events
            .slice()
            .reverse()
            .map((e, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-text-muted">{e.ts.slice(11, 19)}</span>
                <span className="font-semibold">{e.type}</span>
                <span className="text-text-muted">
                  {e.payload?.reason
                    ? String(e.payload.reason)
                    : e.payload?.state
                      ? String(e.payload.state)
                      : ""}
                </span>
              </div>
            ))}
        </div>
      </Block>

      {/* Библиотека текстов */}
      <Block title="Библиотека текстов">
        <div className="space-y-3 text-[13px]">
          {texts.map((t) => (
            <div key={t.scenario_code}>
              <div className="font-semibold">{t.scenario_code}</div>
              {t.plaque_template && (
                <div className="text-text">✓ {t.plaque_template}</div>
              )}
              {t.forbidden && (
                <div className="text-text-muted">
                  ✗ {t.forbidden} — <span className="italic">{t.why_forbidden}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Block>

      {/* Источник сигналов */}
      <Block title="Источник сигналов">
        {health ? (
          <div className="text-[13px]">
            <div>
              Активный источник:{" "}
              <span className="font-semibold">
                {health.signals_source.active === "http" ? "HTTP-модель" : "файл"}
              </span>
              {health.signals_source.fell_back && (
                <span className="text-accent"> · откат с модели</span>
              )}
            </div>
            <div>model_version: {health.signals_source.model_version || "—"}</div>
            <div>
              Диапазон дат: {health.dates_available.from} … {health.dates_available.to}
            </div>
            {ev?.signal && (
              <div className="mt-1">
                Сигнал: {ev.signal.scenario_code} · {ev.signal.indicator} ·{" "}
                {ev.signal.speed} · {ev.signal.direction}
              </div>
            )}
          </div>
        ) : (
          <div className="text-text-muted text-[13px]">нет данных</div>
        )}
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-content bg-surface p-4 shadow-card">
      <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

function Meta({ k, v }: { k: string; v: ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mt-3 block">
      <div className="flex justify-between text-[13px]">
        <span className="text-text-muted">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-black"
      />
    </label>
  );
}
