import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { readUrl, writeUrl, sessionId } from "./store";
import type {
  Corridor,
  Evaluation,
  Health,
  Persona,
  ReserveView,
  Scenario,
} from "./types";
import { PhoneFrame, StandBar } from "./components/Shell";
import { BackButton } from "./components/ui";
import { PushToast } from "./components/PushToast";
import { Launcher } from "./Launcher";
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

// Механика подачи DRIFT и порог — фиксированы (пульт стенда убран).
const MECHANIC = "C";
const DRIFT_THR = 20;

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

  const [phase, setPhase] = useState<"launcher" | "flow">(
    url0.scenario ? "flow" : "launcher"
  );
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [health, setHealth] = useState<Health | null>(null);

  const [scenarioId, setScenarioId] = useState<string>(url0.scenario || "");
  const [simDate, setSimDate] = useState<string>("");
  const [screen, setScreen] = useState<Screen>("home");
  const [ev, setEv] = useState<Evaluation | null>(null);
  const [pushEval, setPushEval] = useState<Evaluation | null>(null);
  const [amountRub, setAmountRub] = useState<number>(0);
  const [openDelay, setOpenDelay] = useState<number>(360);
  const [reserve, setReserve] = useState<ReserveView | null>(null);
  const [limitCheck, setLimitCheck] = useState<any | null>(null);

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

  // --- начальная загрузка -----------------------------------------------
  useEffect(() => {
    Promise.all([api.corridors(), api.personas(), api.scenarios(), api.health()])
      .then(([c, p, s, h]) => {
        setCorridors(c);
        setPersonas(p);
        setScenarios(s);
        setHealth(h);
      })
      .catch((e) => console.error("bootstrap failed", e));
  }, []);

  // --- запрос к /evaluate ---------------------------------------------
  const evalBody = useCallback(
    (entry: "PUSH" | "SELF", date: string, atMinutes?: number) => {
      const sc = activeScenario!;
      const pushMin = sc.push_sent_at ? hhmm(sc.push_sent_at) : null;
      const simMinutes =
        atMinutes ??
        (entry === "PUSH" && pushMin != null ? pushMin + openDelay : 12 * 60);
      return {
        corridor: sc.corridor,
        sim_date: date,
        sim_minutes: simMinutes,
        entry,
        push_sent_at_minutes: entry === "PUSH" ? pushMin : null,
        push_rate: entry === "PUSH" ? sc.push_rate : null,
        amount_rub: amountRub || persona?.typical_amount_rub || 20000,
        drift_mechanic: MECHANIC,
        drift_threshold_bp: DRIFT_THR,
        session_id: sid,
      };
    },
    [activeScenario, openDelay, amountRub, persona, sid]
  );

  // --- проиграть сценарий с начала ----------------------------------
  const play = useCallback(async () => {
    const sc = scenarios.find((s) => s.id === scenarioId);
    if (!sc) return;
    setReserve(null);
    setAmountRub(0);
    setLimitCheck(null);
    setSimDate(sc.as_of_date);
    setOpenDelay(sc.open_delay_min);

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
        drift_mechanic: MECHANIC,
        drift_threshold_bp: DRIFT_THR,
        session_id: sid,
      };
      try {
        setPushEval(await api.evaluate(body));
      } catch (e) {
        console.error(e);
      }
      setEv(null);
      setScreen("push");
    } else {
      const body = {
        corridor: sc.corridor,
        sim_date: sc.as_of_date,
        sim_minutes: 12 * 60,
        entry: "SELF",
        push_sent_at_minutes: null,
        push_rate: null,
        amount_rub:
          personas.find((p) => p.id === sc.persona)?.typical_amount_rub || 20000,
        drift_mechanic: MECHANIC,
        drift_threshold_bp: DRIFT_THR,
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
  }, [scenarios, scenarioId, personas, sid]);

  // прогон при готовности данных и при каждой смене сценария (в режиме отыгрыша)
  useEffect(() => {
    if (phase !== "flow") return;
    if (scenarios.length && personas.length && corridors.length && scenarioId) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarios.length, personas.length, corridors.length, scenarioId, phase]);

  // синхронизация URL
  useEffect(() => {
    writeUrl({ scenario: phase === "flow" ? scenarioId || null : null });
  }, [phase, scenarioId]);

  // --- переходы ----------------------------------------------------
  function backToLauncher() {
    setPhase("launcher");
    setScenarioId("");
    setEv(null);
    setPushEval(null);
    setReserve(null);
    setScreen("home");
  }

  function pickScenario(id: string) {
    setScenarioId(id);
    setPhase("flow");
  }

  async function openPush() {
    if (!activeScenario) return;
    try {
      setEv(await api.evaluate(evalBody("PUSH", simDate)));
      setScreen("transfer");
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
  }

  async function onSecondary() {
    if (!ev) return;
    if (ev.actions.secondary === "RESERVE") setScreen("reserve-setup");
    else setScreen("home");
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
  }

  async function cancelReserve() {
    if (!reserve) return;
    const rv = await api.cancelReserve(reserve.id, simDate, sid).catch(() => null);
    if (rv) setReserve(rv);
    setScreen("home");
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
  }

  // --- рендер ----------------------------------------------------
  if (phase === "launcher") {
    return (
      <div className="min-h-screen bg-[#15161A]">
        {scenarios.length ? (
          <Launcher scenarios={scenarios} corridors={corridors} onPick={pickScenario} />
        ) : (
          <div className="p-10 text-center text-white/50">Загрузка…</div>
        )}
      </div>
    );
  }

  const loading = !corridor || !persona || !activeScenario;

  return (
    <div className="flex h-[100dvh] flex-col items-center bg-[#15161A] px-0 py-0 sm:h-auto sm:min-h-screen sm:px-4 sm:py-5">
      <div className="w-full max-w-[393px] shrink-0 pt-3 sm:pt-0">
        <StandBar
          title={activeScenario ? `${activeScenario.id} · ${activeScenario.title}` : "Сценарий"}
          onBack={backToLauncher}
          onReplay={play}
          onPlusDay={reserve?.state === "ACTIVE" ? plusDay : undefined}
        />
      </div>

      {loading ? (
        <div className="p-10 text-center text-white/50">Загрузка…</div>
      ) : (
        <PhoneFrame>
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

          {screen !== "home" && screen !== "push" && (
            <div className="px-5 pt-4">
              <BackButton onClick={() => setScreen("home")} />
            </div>
          )}

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
              onDone={backToLauncher}
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
            <ReserveExecuted rv={reserve} corridor={corridor} onDone={backToLauncher} />
          )}
          {screen === "reserve-expired" && reserve && (
            <ReserveExpired
              rv={reserve}
              onTransferNow={reserveTransferNow}
              onDone={backToLauncher}
            />
          )}
        </PhoneFrame>
      )}
    </div>
  );
}
