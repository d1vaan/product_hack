import { PrimaryButton, SecondaryButton, GhostButton } from "../components/ui";
import { units } from "../store";

// C10 / O1 — Предупреждение о лимите получателя (сценарий S7).
// Решение о канале принимает не только отправитель.
export function RecipientLimitWarning({
  check,
  onSplit,
  onProceed,
  onBack,
}: {
  check: {
    recipient_units: number;
    per_operation: number;
    per_month: number;
    reason: string;
    currency_short: string;
    exceeds_operation: boolean;
    exceeds_month: boolean;
  };
  onSplit: () => void;
  onProceed: () => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-[28px] font-bold">Проверьте лимит получателя</h1>
      <div className="mt-4 rounded-field bg-plaque p-5 text-[15px] leading-relaxed">
        У получателя {check.reason}. Лимит: {units(check.per_operation, check.currency_short)}{" "}
        за операцию, {units(check.per_month, check.currency_short)} в месяц. Этот перевод —{" "}
        {units(check.recipient_units, check.currency_short)}
        {check.exceeds_operation
          ? " — превышает лимит за операцию."
          : check.exceeds_month
            ? " — почти исчерпает месячный лимит."
            : "."}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onSplit}>Разбить на части</PrimaryButton>
        <SecondaryButton onClick={onProceed}>Всё равно перевести</SecondaryButton>
        <GhostButton onClick={onBack}>Назад</GhostButton>
      </div>
    </div>
  );
}
