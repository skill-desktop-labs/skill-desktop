import { useEffect } from "react";
import { CheckCircle } from "@phosphor-icons/react";

export function Toast({
  message,
  onDone,
}: {
  message: string | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, 2400);
    return () => window.clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex justify-center">
      <div className="animate-content-in flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-[13px] font-medium text-fg elevated">
        <CheckCircle size={16} weight="fill" className="text-accent-text" />
        {message}
      </div>
    </div>
  );
}
