import { X } from "lucide-react";
import { minutesToHHMM } from "../store";

// B1 — карточка уведомления в правом верхнем углу поверх интерфейса.
// Имитация браузерного уведомления, 380 px. Экрана блокировки в вебе нет.
// Ровно один факт с числом и периодом, без глаголов будущего и «успейте».

export function PushToast({
  text,
  sentAtMinutes,
  onOpen,
  onClose,
}: {
  text: string;
  sentAtMinutes: number;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute right-6 top-6 z-30 w-[380px] max-w-[calc(100%-2rem)] animate-toast-in">
      <div className="rounded-[20px] bg-surface p-4 shadow-toast">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-cta text-[13px] font-bold text-white">
            A
          </div>
          <button className="min-w-0 flex-1 text-left" onClick={onOpen}>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-text">Альфа-Онлайн</span>
              <span className="text-[12px] text-text-muted">{minutesToHHMM(sentAtMinutes)}</span>
            </div>
            <p className="mt-0.5 text-[14px] leading-snug text-text">{text}</p>
          </button>
          <button
            aria-label="Закрыть уведомление"
            onClick={onClose}
            className="shrink-0 text-text-muted transition hover:text-text"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
