import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { readUrl, writeUrl, sessionId } from "./store";
import type {
  Corridor,
  Evaluation,
  Health,
  Mechanic,
  Mode,
  Persona,
  ReserveView,
  Scenario,
  StandEvent,
} from "./types";
import { StandHeader, Sidebar, TabBar } from "./components/Shell";
import { BackButton } from "./components/ui";
import { PushToast } from "./components/PushToast";
import { Home, CountryList } from "./screens/Home";
import { TransferScreen, TransferConfirm, TransferSuccess } from "./screens/Transfer";
import { NotificationSettings } from "./screens/Settings";
import {
  ReserveSetup,
  ReserveConfirm,
  ReserveManage,
  ReserveExecuted,
  ReserveExpired,
} from "./screens/Reserve";
import { RecipientLimitWarning } from "./screens/RecipientLimit";
import { AnalysisPanel, type Knobs } from "./panel/Panel";
import { DataScreen } from "./panel/DataScreen";

type Screen =
  | "push"
  | "home"
  | "country"
  | "transfer"
  | "confirm"
  | "success"
  | "settings"
  | "reserve-setup"
  | "reserve-confirm"
  | "reserve-manage"
  | "reserve-executed"
  | "reserve-expired"
  | "recipient-limit";

const hhmm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

function nextTradingDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const url0 = useMemo(() => readUrl(), []);
  const sid = useMemo(() => sessionId(), []);

  const [mode, setMode] = useState<Mode>(url0.mode);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [texts, setTexts] = useState<any[]>([]);
  const [health, setHealth] = useState<Health | null>(null);

  const [scenarioId, setScenarioId] = useState<string>(url0.scenario || "S2");
  const [simDate, setSimDate] = useState<string>(url0.date || "");
  const [screen, setScreen] = useState<Screen>("home");
  const [ev, setEv] = useState<Evaluation | null>(null);
  const [pushEval, setPushEval] = useState<Evaluation | null>(null);
  const [amountRub, setAmountRub] = useState<number>(0);
  const [reserve, setReserve] = useState<ReserveView | null>(null);
  const [events, setEvents] = useState<StandEvent[]>([]);
  const [limitCheck, setLimitCheck] = useState<any | null>(null);

  const [knobs, setKnobs] = useState<Knobs>({
    driftThreshold: 20,
    mechanic: (url0.mechanic || "C") as Mechanic,
    budget: 8,
    cooldown: 3,
    reservePercentile: 25,
    reserveWindow: 30,
    openDelay: url0.delay ?? 360,
  });

  const activeScenario = useMemo(
    () => scenarios.find((s) => s.id === scenarioId) || null,
    [scenarios, scenarioId]
  );
  const persona = useMemo(
    () => personas.find((p) => p.id === activeScenario?.persona) || personas[0] || null,
    [personas, activeScenario]
  );
  const corridor = useMemo(
    () =>
      corridors.find((c) => c.corridor === activeScenario?.corridor) ||
      corridors[0] ||
      null,
    [corridors, activeScenario]
  );

  // --- начальная загрузка --------------------------------------------
  useEffect(() => {
    Promise.all([
      api.corridors(),
      api.personas(),
      api.scenarios(),
      api.texts(),
      api.health(),
    ])
      .then(([c, p, s, t, h]) => {
        setCorridors(c);
        setPersonas(p);
        setScenarios(s);
        setTexts(t);
        setHealth(h);
      })
      .catch((e) => console.error("bootstrap failed", e));
  }, []);

  const refreshEvents = useCallback(() => {
    api.events(sid, 200).then(setEvents).catch(() => {});
  }, [sid]);

  useEffect(() => {
    if (mode === "demo") return;
    refreshEvents();
    const t = setInterval(refreshEvents, 3000);
    return () => clearInterval(t);
  }, [mode, refreshEvents]);

  // --- построение запроса к /evaluate -------------------------------
  const evalBody = useCallback(
    (entry: "PUSH" | "SELF", date: string, atMinutes?: number) => {
      const sc = activeScenario!;
      const pushMin = sc.push_sent_at ? hhmm(sc.push_sent_at) : null;
      const simMinutes =
        atMinutes ??
        (entry === "PUSH" && pushMin != null ? pushMin + knobs.openDelay : 12 * 60);
      return {
        corridor: sc.corridor,
        sim_date: date,
        sim_minutes: simMinutes,
        entry,
        push_sent_at_minutes: entry === "PUSH" ? pushMin : null,
        push_rate: entry === "PUSH" ? sc.push_rate : null,
        amount_rub: amountRub || persona?.typical_amount_rub || 20000,
        drift_mechanic: knobs.mechanic,
        drift_threshold_bp: knobs.driftThreshold,
        session_id: sid,
      };
    },
    [activeScenario, knobs, amountRub, persona, sid]
  );

  // --- Проиграть ---------------------------------------------------
  const play = useCallback(async () => {
    const sc = scenarios.find((s) => s.id === scenarioId);
    if (!sc) return;
    setReserve(null);
    setAmountRub(0);
    setLimitCheck(null);
    const date = url0.date && url0.date === simDate ? simDate : sc.as_of_date;
    setSimDate(sc.as_of_date);
    if (sc.panel_hint?.push_budget_month) {
      setKnobs((k) => ({ ...k, budget: sc.panel_hint!.push_budget_month }));
    }
    setKnobs((k) => ({ ...k, openDelay: url0.delay ?? sc.open_delay_min }));

    if (sc.entry === "PUSH" && sc.push_sent_at) {
      const body = {
        corridor: sc.corridor,
        sim_date: sc.as_of_date,
        sim_minutes: hhmm(sc.push_sent_at),
        entry: "PUSH",
        push_sent_at_minutes: hhmm(sc.push_sent_at),
        push_rate: sc.push_rate,
        amount_rub:
          sc.amount_rub_override ||
          personas.find((p) => p.id === sc.persona)?.typical_amount_rub ||
          20000,
        drift_mechanic: knobs.mechanic,
        drift_threshold_bp: knobs.driftThreshold,
        session_id: sid,
      };
      try {
        const e0 = await api.evaluate(body);
        setPushEval(e0);
        await api.postEvent({
          type: "push_sent",
          payload: { corridor: sc.corridor, scenario_code: e0.plaque.scenario_code },
          sim_date: sc.as_of_date,
          session_id: sid,
        });
      } catch (e) {
        console.error(e);
      }
      setEv(null);
      setScreen("push");
    } else {
      // SELF
      const body = {
        corridor: sc.corridor,
        sim_date: sc.as_of_date,
        sim_minutes: 12 * 60,
        entry: "SELF",
        push_sent_at_minutes: null,
        push_rate: null,
        amount_rub:
          personas.find((p) => p.id === sc.persona)?.typical_amount_rub || 20000,
        drift_mechanic: knobs.mechanic,
        drift_threshold_bp: knobs.driftThreshold,
        session_id: sid,
      };
      try {
        setEv(await api.evaluate(body));
      } catch (e) {
        console.error(e);
      }
      setPushEval(null);
      setScreen("home");
    }
    setTimeout(refreshEvents, 200);
  }, [scenarios, scenarioId, personas, knobs, sid, url0, simDate, refreshEvents]);

  // прогон при первой готовности данных и при смене сценария
  useEffect(() => {
    if (scenarios.length && personas.length && corridors.length) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios.length, personas.length, corridors.length, scenarioId]);

  // синхронизация URL
  useEffect(() => {
    writeUrl({
      mode,
      scenario: scenarioId,
      mechanic: knobs.mechanic,
      date: simDate || null,
      delay: knobs.openDelay,
    });
  }, [mode, scenarioId, knobs.mechanic, knobs.openDelay, simDate]);

  // живое переключение механики подачи DRIFT / порога прямо на экране перевода
  useEffect(() => {
    if (!activeScenario || !ev) return;
    if (screen !== "transfer" && screen !== "confirm") return;
    if (ev.state !== "DRIFT") return;
    const entry = ev.entry || "SELF";
    api
      .evaluate(evalBody(entry, simDate))
      .then(setEv)
      .catch((e) => console.error(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knobs.mechanic, knobs.driftThreshold]);

  // --- переходы ---------------------------------------------------
  async function openPush() {
    if (!activeScenario) return;
    const body = evalBody("PUSH", simDate);
    try {
      const e = await api.evaluate(body);
      setEv(e);
      await api.postEvent({
        type: "push_opened",
        payload: { delay_min: knobs.openDelay, state: e.state },
        sim_date: simDate,
        session_id: sid,
      });
      setScreen("transfer");
      setTimeout(refreshEvents, 200);
    } catch (e) {
      console.error(e);
    }
  }

  async function goTransferFromHome() {
    if (!activeScenario) return;
    if (!ev) {
      try {
        setEv(await api.evaluate(evalBody("SELF", simDate)));
      } catch (e) {
        console.error(e);
      }
    }
    setScreen("country");
  }

  async function onTransfer(amount: number) {
    setAmountRub(amount);
    // проверка лимита получателя (S7 / O1)
    if (persona?.recipient_limit && health?.features.recipient_limit && activeScenario) {
      try {
        const chk = await api.recipientLimitCheck(
          persona.id,
          amount,
          activeScenario.corridor,
          simDate
        );
        if (chk.applies && (chk.exceeds_operation || chk.exceeds_month)) {
          setLimitCheck(chk);
          setScreen("recipient-limit");
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    setScreen("confirm");
  }

  async function onConfirm() {
    await api
      .postEvent({
        type: "transfer_confirmed",
        payload: { amount_rub: amountRub, state: ev?.state },
        sim_date: simDate,
        session_id: sid,
      })
      .catch(() => {});
    setScreen("success");
    setTimeout(refreshEvents, 200);
  }

  async function onSecondary() {
    if (!ev) return;
    if (ev.actions.secondary === "RESERVE") {
      setScreen("reserve-setup");
    } else {
      await api
        .postEvent({ type: "abandoned", payload: { state: ev.state }, sim_date: simDate, session_id: sid })
        .catch(() => {});
      setScreen("home");
      setTimeout(refreshEvents, 200);
    }
  }

  async function createReserve(opts: {
    amountRub: number;
    percentile: number;
    windowDays: number;
    fallback: boolean;
  }) {
    if (!activeScenario) return;
    try {
      const rv = await api.createReserve({
        corridor: activeScenario.corridor,
        amount_rub: opts.amountRub,
        created_on: simDate,
        percentile: opts.percentile,
        window_days: opts.windowDays,
        ttl_days: 7,
        fallback_send_on_expiry: opts.fallback,
        session_id: sid,
      });
      setReserve(rv);
      setScreen("reserve-confirm");
      setTimeout(refreshEvents, 200);
    } catch (e) {
      console.error(e);
    }
  }

  async function plusDay() {
    if (!simDate) return;
    const nd = nextTradingDay(simDate);
    setSimDate(nd);
    if (reserve && reserve.state === "ACTIVE") {
      try {
        const rv = await api.viewReserve(reserve.id, nd);
        setReserve(rv);
        if (rv.state === "EXECUTED") setScreen("reserve-executed");
        else if (rv.state === "EXPIRED") setScreen("reserve-expired");
      } catch (e) {
        console.error(e);
      }
    }
    if (screen === "transfer" && activeScenario) {
      try {
        setEv(await api.evaluate(evalBody(ev?.entry || "SELF", nd)));
      } catch (e) {
        console.error(e);
      }
    }
    setTimeout(refreshEvents, 200);
  }

  async function cancelReserve() {
    if (!reserve) return;
    const rv = await api.cancelReserve(reserve.id, simDate, sid).catch(() => null);
    if (rv) setReserve(rv);
    setScreen("home");
    setTimeout(refreshEvents, 200);
  }

  async function reserveTransferNow() {
    if (!reserve || !activeScenario) return;
    await api.transferNowReserve(reserve.id, simDate, sid).catch(() => {});
    try {
      setEv(await api.evaluate(evalBody("SELF", simDate)));
    } catch (e) {
      console.error(e);
    }
    setScreen("transfer");
    setTimeout(refreshEvents, 200);
  }

  // --- рендер ----------------------------------------------------
  const loading = !corridor || !persona || !activeScenario;

  return (
    <div className="min-h-screen">
      <StandHeader
        mode={mode}
        onMode={setMode}
        right={
          health ? (
            <span>
              источник: {health.signals_source.active === "http" ? "модель" : "файл"} · v
              {health.version}
            </span>
          ) : null
        }
      />

      {loading ? (
        <div className="p-10 text-center text-text-muted">Загрузка…</div>
      ) : mode === "data" ? (
        <div className="mx-auto max-w-6xl p-4 sm:p-6">
          <DataScreen
            corridors={corridors}
            corridor={corridor.corridor}
            onCorridor={(c) => {
              const sc = scenarios.find((s) => s.corridor === c);
              if (sc) setScenarioId(sc.id);
            }}
            simDate={simDate}
            health={health}
          />
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-4 sm:p-6 lg:flex-row">
          <Sidebar />

          <main className="relative min-w-0 flex-1">
            {/* Пуш поверх интерфейса */}
            {screen === "push" && pushEval && activeScenario?.push_sent_at && (
              <PushToast
                text={pushEval.push_text || "Курс изменился"}
                sentAtMinutes={hhmm(activeScenario.push_sent_at)}
                onOpen={openPush}
                onClose={() => setScreen("home")}
                stacked={activeScenario.id === "S6"}
                onSettings={
                  activeScenario.id === "S6" ? () => setScreen("settings") : undefined
                }
              />
            )}

            <TabBar active="Платежи" />

            <div className="mt-4">
              {screen !== "home" && screen !== "push" && (
                <BackButton onClick={() => setScreen("home")} />
              )}

              <div className="rounded-content bg-surface p-6 shadow-card sm:p-8">
                {(screen === "home" || screen === "push") && (
                  <Home
                    persona={persona}
                    corridor={corridor}
                    reserve={reserve}
                    onStartTransfer={goTransferFromHome}
                    onManageReserve={() => setScreen("reserve-manage")}
                  />
                )}

                {screen === "country" && (
                  <CountryList
                    corridors={corridors}
                    current={corridor.corridor}
                    onPick={() => setScreen("transfer")}
                  />
                )}

                {screen === "transfer" && ev && (
                  <TransferScreen
                    ev={ev}
                    persona={persona}
                    corridor={corridor}
                    simDate={simDate}
                    onTransfer={onTransfer}
                    onSecondary={onSecondary}
                    onBack={() => setScreen("home")}
                  />
                )}

                {screen === "recipient-limit" && limitCheck && (
                  <RecipientLimitWarning
                    check={limitCheck}
                    onSplit={() => setScreen("confirm")}
                    onProceed={() => setScreen("confirm")}
                    onBack={() => setScreen("transfer")}
                  />
                )}

                {screen === "confirm" && ev && (
                  <TransferConfirm
                    ev={ev}
                    corridor={corridor}
                    amountRub={amountRub || persona.typical_amount_rub}
                    simDate={simDate}
                    onConfirm={onConfirm}
                    onBack={() => setScreen("transfer")}
                  />
                )}

                {screen === "success" && ev && (
                  <TransferSuccess
                    ev={ev}
                    corridor={corridor}
                    amountRub={amountRub || persona.typical_amount_rub}
                    onDone={() => setScreen("home")}
                  />
                )}

                {screen === "settings" && (
                  <NotificationSettings
                    corridors={corridors}
                    activeCorridor={corridor.corridor}
                    overloaded={activeScenario.id === "S6"}
                    onSave={() => setScreen("home")}
                  />
                )}

                {screen === "reserve-setup" && (
                  <ReserveSetup
                    corridor={corridor}
                    defaultAmount={amountRub || persona.typical_amount_rub}
                    onCreate={createReserve}
                    onBack={() => setScreen("transfer")}
                  />
                )}
                {screen === "reserve-confirm" && reserve && (
                  <ReserveConfirm rv={reserve} corridor={corridor} onDone={() => setScreen("home")} />
                )}
                {screen === "reserve-manage" && reserve && (
                  <ReserveManage
                    rv={reserve}
                    onCancel={cancelReserve}
                    onTransferNow={reserveTransferNow}
                    onBack={() => setScreen("home")}
                  />
                )}
                {screen === "reserve-executed" && reserve && (
                  <ReserveExecuted rv={reserve} corridor={corridor} onDone={() => setScreen("home")} />
                )}
                {screen === "reserve-expired" && reserve && (
                  <ReserveExpired
                    rv={reserve}
                    onTransferNow={reserveTransferNow}
                    onDone={() => setScreen("home")}
                  />
                )}
              </div>
            </div>
          </main>

          {mode === "review" && (
            <AnalysisPanel
              scenarios={scenarios}
              activeScenario={activeScenario}
              onScenario={setScenarioId}
              personas={personas}
              knobs={knobs}
              onKnob={(k) => setKnobs((prev) => ({ ...prev, ...k }))}
              onPlay={play}
              onPlusDay={plusDay}
              simDate={simDate}
              events={events}
              texts={texts}
              ev={ev || pushEval}
              health={health}
            />
          )}
        </div>
      )}
    </div>
  );
}
