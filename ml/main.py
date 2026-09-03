"""Референсный контейнер модели — скелет для ML-команды.

Реализует контракт ТЗ §7: GET /health и GET /signals?as_of=&corridors=.
Внутри — не модель, а чтение того же файла-заглушки. Задача ML-команды:
заменить _load_signals() на реальный вывод, сохранив форму ответа.

Правила контракта, которые НЕЛЬЗЯ нарушать:
  * отдаём facts и scenario_code, НЕ текст, НЕ рекомендацию, НЕ вероятность;
  * ответ на as_of=T не зависит от данных после T;
  * scenario_code ∈ MOMENTUM_DOWN, LEVEL_LOW, REVERSAL_UP, SEASONAL, NEUTRAL.
"""
import json
import os

from fastapi import FastAPI, Query

MODEL_VERSION = os.getenv("MODEL_VERSION", "rules-level-v0.3")
SIGNALS_FILE = os.getenv("SIGNALS_FILE", "/data/signals.json")

app = FastAPI(title="FX-trigger model (reference)", version=MODEL_VERSION)


def _load_signals():
    try:
        with open(SIGNALS_FILE, encoding="utf-8") as f:
            return json.load(f).get("signals", [])
    except OSError:
        return []


@app.get("/health")
def health():
    return {"status": "ok", "model_version": MODEL_VERSION}


@app.get("/signals")
def signals(as_of: str = Query(...), corridors: str | None = Query(None)):
    wanted = {c.strip() for c in corridors.split(",")} if corridors else None
    out = []
    for s in _load_signals():
        if s["date"] > as_of:
            continue  # запрет заглядывания вперёд
        if wanted and s["corridor"] not in wanted:
            continue
        out.append(s)
    return {"as_of": as_of, "model_version": MODEL_VERSION, "signals": out}
