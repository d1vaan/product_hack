import React from "react";
import type { Mode } from "../types";

// Служебная шапка стенда: тёмная узкая полоса, визуально отделена от макета,
// чтобы её нельзя было спутать с интерфейсом банка.
export function StandHeader({
  mode,
  onMode,
  right,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  right?: React.ReactNode;
}) {
  const tabs: [Mode, string][] = [
    ["demo", "Демо"],
    ["review", "Разбор"],
    ["data", "Данные"],
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 overflow-hidden bg-[#15161A] px-4 py-2 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden truncate text-[12px] uppercase tracking-wide text-white/50 sm:inline">
          Демо-стенд · триггерный слой переводов
        </span>
        <div className="flex shrink-0 gap-1 rounded-full bg-white/10 p-0.5">
          {tabs.map(([m, label]) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              className={
                "rounded-full px-3 py-1 text-[13px] transition " +
                (mode === m ? "bg-white text-[#15161A]" : "text-white/70 hover:text-white")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-3 truncate text-[12px] text-white/60 sm:flex">
        {right}
      </div>
    </div>
  );
}

// Левая колонка: карточка профиля, общий баланс, секции продуктов.
// Статична, служит фоном достоверности; интерактивна только визуально.
export function Sidebar() {
  const sections = ["Карты", "Счета", "Кредиты", "Инвестиции"];
  return (
    <aside className="hidden w-[34%] min-w-[320px] flex-col gap-4 lg:flex">
      <div className="rounded-content bg-surface p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-field" />
          <div>
            <div className="text-[15px] font-semibold">Гость</div>
            <div className="text-[13px] text-text-muted">Демо-режим</div>
          </div>
        </div>
        <div className="mt-5 text-[13px] text-text-muted">Общий баланс</div>
        <div className="text-[28px] font-bold">1 248 300 ₽</div>
      </div>
      <div className="rounded-content bg-surface p-6 shadow-card">
        {sections.map((s, i) => (
          <div
            key={s}
            className={
              "flex items-center justify-between py-3 text-[15px] " +
              (i ? "" : "")
            }
          >
            <span>{s}</span>
            <span className="text-text-muted">›</span>
          </div>
        ))}
      </div>
      <button className="h-14 w-full rounded-btn bg-cta text-[16px] font-semibold text-white">
        Новый продукт
      </button>
    </aside>
  );
}

// Таб-бар веб-приложения над карточкой контента.
export function TabBar({ active = "Платежи" }: { active?: string }) {
  const tabs = ["Главный", "Платежи", "Выгода", "История", "Чаты"];
  return (
    <div className="flex gap-4 overflow-x-auto whitespace-nowrap px-1 pb-3 text-[15px] sm:gap-6">
      {tabs.map((t) => (
        <span
          key={t}
          className={t === active ? "font-semibold text-text" : "text-text-muted"}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
