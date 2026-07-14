import { type ReactNode } from "react";
import * as RMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "./kit";

export function Menu({
  trigger,
  children,
  align = "end",
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
}) {
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content
          align={align}
          sideOffset={6}
          className={cn(
            "z-50 min-w-[184px] rounded-xl border border-border bg-surface p-1 elevated",
            "animate-content-in origin-[var(--radix-dropdown-menu-content-transform-origin)]",
          )}
        >
          {children}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  icon,
}: {
  children: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <RMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] outline-none",
        danger
          ? "text-danger data-[highlighted]:bg-danger-soft"
          : "text-fg data-[highlighted]:bg-surface-2",
      )}
    >
      {icon && (
        <span className={danger ? "text-danger" : "text-subtle"}>{icon}</span>
      )}
      {children}
    </RMenu.Item>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <RMenu.Separator className="my-1 h-px bg-border" />;
}
