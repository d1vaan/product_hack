# ML-сервисы демо-стенда

Три рабочих контейнера, поднятых из кода ML-команды
(`ml/upstream` — git submodule на репозиторий
[AI_Product_Hack_trigger_model](https://github.com/YYukh/AI_Product_Hack_trigger_model),
зафиксирован на коммит `1898dee`, **не модифицируется**).

| Контейнер | Что демонстрирует | Код upstream |
|---|---|---|
| **parser** | Парсер котировок валютных пар (ЦБ РФ) | `src/cbr_loader.py` |
| **moment-model** | ML-модель выявления выгодного момента: rule + ML движки `GOOD_NOW` / `WINDOW_CLOSING` × горизонты 1/3/5/10/20 × 5 валют | `src/production_pipeline.py`, `src/production_config.py`, `src/indicators.py`, `src/ml_backtest.py` |
| **push-model** | ML-модель «какой сигнал пойдёт в пуш»: сменяемая метамодель + частотная политика (cooldown 3 дн., ≤2 сигнала за 7 дн.) | `src/meta_model.py`, `src/signal_contract.py`, `src/signal_policy.py`, `src/production_pipeline.py:filter_signal` |

Плюс одноразовый **ml-warmup** — прогоняет полный production-конвейер из
`ml/upstream/notebooks/prod_pipline.ipynb` и кладёт артефакты в общий том `mldata`.

## Запуск

```bash
cd ~/Desktop/product\ hack/dev/demo-stand
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.ml.yml --profile ml up --build
```

Первый старт: `ml-warmup` считает **15–30 минут** (walk-forward replay ~100 движков
с 2020 года + обучение метамодели). Результат кэшируется в docker-томе `ml_data` —
повторные запуски мгновенные. Ускорить первый прогон: `ML_REPLAY_FROM=2024-01-01`
в `.env` (~3–7 мин).

Чистый стенд без ML (регрессия): `docker compose up` — работает на `data/signals.json`.

## Как это связано со стендом

Оверлей `docker-compose.ml.yml` проставляет стенду:

- `RATES_URL=http://parser:8000` — курсы берутся у парсера (при сбое — файл `data/rates.csv`);
- `ML_URL=http://push-model:8000` — сигналы берутся у модели пуша в контракте
  `GET /health` + `GET /signals?as_of=&corridors=` (при сбое — `data/signals.json`);
- `MOMENT_URL=http://moment-model:8000` — сырой поток движков для экрана «Данные».

`ml-warmup` дополнительно переписывает `data/rates.csv` реальными курсами ЦБ и
`data/scenarios.json` (S1–S4) на реальные срабатывания модели. Синтетические
оригиналы сохраняются в `data/*.synthetic.*`.

Всё видно в UI: режим **Данные** → блок «ML-конвейер» (статусы трёх сервисов,
таблица сработавших движков на дату среза, решение модели пуша).

## Эндпоинты сервисов

**parser** — `/health`, `/pairs`, `/rates?corridor=`, `/rates/wide`, `POST /refresh`
**moment-model** — `/health`, `/registry`, `/engine-signals?as_of=&corridor=`, `/engine-signals/replay`
**push-model** — `/health`, `/signals?as_of=&corridors=` (контракт стенда), `/push-events`, `/decisions?as_of=`

## Артефакты прогрева (том `ml_data`)

```
ready.json                     маркер готовности + метаданные прогона
rates_wide.parquet             дневной ряд ЦБ (date × currency)
scoring_data.parquet           panel + causal-признаки + targets
raw_signals.parquet            выход всех движков день за днём (walk-forward)
raw_signals_calibrated.parquet + causal OOS-калибровка confidence
engine_states.joblib           обученные rule-параметры и ML-веса + расписание
engine_registry.parquet        человекочитаемый реестр движков
meta_model.joblib              обученная логистическая метамодель (если хватило данных)
push_events.parquet            финальный поток после метамодели + частотной политики
```

## Оффлайн

Если ЦБ недоступен, парсер и warmup используют снапшот
`ml/fallback/cbr_rates.csv` (реальные курсы AMD/KZT/KGS/TJS/UZS + контекстные
USD/EUR/CNY, 2020 … дата сборки). Управляется `CBR_PREFER` (`auto|live|fallback`).
