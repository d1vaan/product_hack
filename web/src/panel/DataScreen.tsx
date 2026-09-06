import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { Corridor, Health, RatePoint } from "../types";
import { ddmm, rate } from "../store";

// Режим «Данные»: график курса со сработками, таблица сигналов, плашка
// ограничений. Никаких цифр конверсии.
export function DataScreen({
  corridors,
  corridor,
  onCorridor,
  simDate,
  health,
}: {
  corridors: Corridor[];
  corridor: string;
  onCorridor: (c: string) => void;
  simDate: string;
  health: Health | null;
}) {
  const [points, setPoints] = useState<RatePoint[]>([]);
  const [signals, setSignals] = useState<any[]>([]);

  useEffect(() => {
    api.rates(corridor).then((r) => setPoints(r.points)).catch(() => setPoints([]));
    api
      .signals(health?.dates_available.to || simDate, corridor)
      .then((s) => setSignals(s.signals))
      .catch(() => setSignals([]));
  }, [corridor, simDate, health]);

  const meta = corridors.find((c) => c.corridor === corridor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {corridors.map((c) => (
          <button
            key={c.corridor}
            onClick={() => onCorridor(c.corridor)}
            className={
              "h-9 rounded-full px-3 text-[13px] " +
              (c.corridor === corridor ? "bg-cta text-white" : "bg-field")
            }
          >
            {c.flag} {c.country}
          </button>
        ))}
      </div>

      <div className="rounded-content bg-surface p-4 shadow-card">
        <div className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
          Курс {meta?.currency_gen} · рублей за 1 {meta?.currency_acc}
        </div>
        <RateChart points={points} signals={signals} simDate={simDate} />
      </div>

      <div className="rounded-content bg-surface p-4 shadow-card">
        <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
          Сигналы
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-text-muted">
              <tr>
                <th className="py-1 pr-3">Дата</th>
                <th className="py-1 pr-3">Индикатор</th>
                <th className="py-1 pr-3">Направление</th>
                <th className="py-1 pr-3">Скорость</th>
                <th className="py-1 pr-3">Сила</th>
                <th className="py-1 pr-3">Код</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s, i) => (
                <tr key={i}>
                  <td className="py-1 pr-3">{s.date}</td>
                  <td className="py-1 pr-3">{s.indicator}</td>
                  <td className="py-1 pr-3">{s.direction}</td>
                  <td className="py-1 pr-3">{s.speed}</td>
                  <td className="py-1 pr-3">{s.strength}</td>
                  <td className="py-1 pr-3 font-semibold">{s.scenario_code}</td>
                </tr>
              ))}
              {signals.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-2 text-text-muted">
                    сигналов по коридору нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MLPipeline corridor={corridor} simDate={simDate} health={health} />

      <div className="rounded-content bg-plaque p-4 text-[13px] leading-relaxed text-text-muted">
        Показан официальный курс ЦБ РФ, не курс исполнения. Данные — открытый дневной
        ряд. Отклик клиентов (открытия, конверсия, отписки) на стенде не измеряется —
        это меряет пилот.
      </div>
    </div>
  );
}

// Видимая работа ML-конвейера: парсер котировок → модель выгодного момента
// (rule+ML движки) → модель «какой сигнал в пуш» (метамодель + частотная политика).
function MLPipeline({
  corridor,
  simDate,
  health,
}: {
  corridor: string;
  simDate: string;
  health: Health | null;
}) {
  const [engines, setEngines] = useState<any | null>(null);
  const [decision, setDecision] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ml = health?.ml_services;
  const anyMl =
    ml && (ml.parser.configured || ml.moment_model.configured || ml.push_model.configured);

  useEffect(() => {
    if (!anyMl || !simDate) return;
    let alive = true;
    setErr(null);
    api.mlEngineSignals(simDate, corridor)
      .then((r) => alive && setEngines(r))
      .catch((e) => alive && setErr(String(e)));
    api.mlDecisions(simDate, corridor)
      .then((r) => alive && setDecision(r))
      .catch(() => alive && setDecision(null));
    return () => {
      alive = false;
    };
  }, [corridor, simDate, anyMl]);

  if (!anyMl) {
    return (
      <div className="rounded-content bg-surface p-4 text-[13px] text-text-muted shadow-card">
        ML-сервисы не подключены — стенд работает на файле <code>data/signals.json</code>.
        Поднять конвейер: <code>docker compose -f docker-compose.yml -f
        docker-compose.ml.yml --profile ml up --build</code>.
      </div>
    );
  }

  const svc = (label: string, p?: { configured: boolean; reachable?: boolean; health?: any }) => {
    const ok = p?.configured && p?.reachable;
    const mv = p?.health?.model_version || p?.health?.source || p?.health?.meta_model;
    return (
      <div className="rounded-field bg-field px-3 py-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className={"h-2 w-2 rounded-full " + (ok ? "bg-black" : "bg-accent")} />
          {label}
        </div>
        {mv && <div className="mt-0.5 text-[12px] text-text-muted">{String(mv)}</div>}
      </div>
    );
  };

  const fired: any[] =
    (engines?.signals || []).filter((s: any) => s.signal) ?? [];

  return (
    <div className="rounded-content bg-surface p-4 shadow-card">
      <div className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-muted">
        ML-конвейер · срез {ddmm(engines?.as_of_scored || simDate)}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {svc("1 · Парсер котировок", ml?.parser)}
        {svc("2 · Модель момента", ml?.moment_model)}
        {svc("3 · Модель пуша", ml?.push_model)}
      </div>

      {err && <div className="mt-2 text-[12px] text-accent">{err}</div>}

      <div className="mt-3 text-[13px] font-semibold">
        Движки «выгодного момента» ({engines?.n_fired ?? 0} из {engines?.n_engines ?? 0} сработали)
      </div>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="text-text-muted">
            <tr>
              <th className="py-1 pr-3">Сценарий</th>
              <th className="py-1 pr-3">Семья</th>
              <th className="py-1 pr-3">Гориз.</th>
              <th className="py-1 pr-3">Тип</th>
              <th className="py-1 pr-3">Движок</th>
              <th className="py-1 pr-3">score</th>
              <th className="py-1 pr-3">conf.</th>
            </tr>
          </thead>
          <tbody>
            {fired.map((s, i) => (
              <tr key={i}>
                <td className="py-1 pr-3">{s.scenario}</td>
                <td className="py-1 pr-3">{s.target_family}</td>
                <td className="py-1 pr-3">{s.horizon}</td>
                <td className="py-1 pr-3">{s.engine_type}</td>
                <td className="py-1 pr-3">{s.engine_name}</td>
                <td className="py-1 pr-3">{s.raw_score == null ? "—" : Number(s.raw_score).toFixed(3)}</td>
                <td className="py-1 pr-3">{s.confidence == null ? "—" : Number(s.confidence).toFixed(2)}</td>
              </tr>
            ))}
            {fired.length === 0 && (
              <tr>
                <td colSpan={7} className="py-2 text-text-muted">
                  на эту дату ни один движок по коридору не сработал
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-field bg-plaque p-3 text-[12px] leading-relaxed">
        <span className="font-semibold">Решение модели пуша: </span>
        {decision?.went_to_push?.length
          ? decision.went_to_push
              .map((e: any) => `${e.corridor} · ${e.scenario} · h${e.horizon} · conf ${Number(e.confidence).toFixed(2)}`)
              .join("; ")
          : "в этот день сигнал в пуш не ушёл"}
        <div className="mt-1 text-text-muted">
          {decision?.note ||
            "движок сработал → метамодель по confidence/uplift → частотная политика (cooldown 3 дн., ≤2 за 7 дн.)"}
        </div>
      </div>
    </div>
  );
}

// Компактный SVG-график без внешних зависимостей.
function RateChart({
  points,
  signals,
  simDate,
}: {
  points: RatePoint[];
  signals: any[];
  simDate: string;
}) {
  const W = 900;
  const H = 260;
  const pad = { l: 52, r: 12, t: 12, b: 24 };

  const view = useMemo(() => {
    if (points.length === 0) return null;
    const xs = points.map((_, i) => i);
    const ys = points.map((p) => p.rate);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanY = maxY - minY || 1;
    const x = (i: number) =>
      pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
    const y = (v: number) =>
      pad.t + (1 - (v - minY) / spanY) * (H - pad.t - pad.b);
    const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.rate)}`).join(" ");
    const dateIdx = (d: string) => points.findIndex((p) => p.date >= d);
    return { x, y, path, minY, maxY, dateIdx };
  }, [points]);

  if (!view) return <div className="py-10 text-center text-text-muted">нет данных</div>;

  const simIdx = view.dateIdx(simDate);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]">
        {/* сетка Y */}
        {[0, 0.5, 1].map((f) => {
          const v = view.minY + f * (view.maxY - view.minY);
          return (
            <g key={f}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={view.y(v)}
                y2={view.y(v)}
                stroke="#E3E5E9"
              />
              <text x={4} y={view.y(v) + 4} fontSize={11} fill="#8A8F98">
                {rate(v)}
              </text>
            </g>
          );
        })}

        {/* линия курса */}
        <path d={view.path} fill="none" stroke="#0A0A0A" strokeWidth={1.5} />

        {/* вертикаль даты среза */}
        {simIdx >= 0 && (
          <line
            x1={view.x(simIdx)}
            x2={view.x(simIdx)}
            y1={pad.t}
            y2={H - pad.b}
            stroke="#EF3124"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {/* отметки сработок */}
        {signals.map((s, i) => {
          const idx = view.dateIdx(s.date);
          if (idx < 0) return null;
          return (
            <g key={i}>
              <circle cx={view.x(idx)} cy={view.y(points[idx].rate)} r={4} fill="#EF3124" />
              <text
                x={view.x(idx)}
                y={view.y(points[idx].rate) - 8}
                fontSize={10}
                fill="#8A8F98"
                textAnchor="middle"
              >
                {s.scenario_code}
              </text>
            </g>
          );
        })}

        {/* подписи X по краям */}
        <text x={pad.l} y={H - 6} fontSize={11} fill="#8A8F98">
          {points[0].date}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize={11} fill="#8A8F98" textAnchor="end">
          {points[points.length - 1].date}
        </text>
        {simIdx >= 0 && (
          <text
            x={view.x(simIdx)}
            y={H - 6}
            fontSize={11}
            fill="#EF3124"
            textAnchor="middle"
          >
            срез {ddmm(simDate)}
          </text>
        )}
      </svg>
    </div>
  );
}
