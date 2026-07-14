import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Check } from "@phosphor-icons/react";
import type { AgentId, InstallMethod, SourceType } from "../../lib/types";
import { AGENT_MAP } from "../../lib/agents";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap " +
  "transition-[background-color,border-color,color,transform] duration-100 " +
  "active:translate-y-px disabled:opacity-45 disabled:pointer-events-none select-none";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover",
  secondary:
    "bg-surface text-fg border border-border-strong hover:bg-surface-2 hover:border-subtle",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-danger-fg hover:bg-danger-hover",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-3.5 text-[14px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

/** Square, icon-only button (nav dots, toolbar actions). */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { size?: number }
>(({ className, size = 32, ...props }, ref) => (
  <button
    ref={ref}
    style={{ width: size, height: size }}
    className={cn(
      "inline-flex items-center justify-center rounded-lg text-muted",
      "transition-colors duration-100 hover:bg-surface-2 hover:text-fg",
      "active:translate-y-px disabled:opacity-45 disabled:pointer-events-none",
      className,
    )}
    {...props}
  />
));
IconButton.displayName = "IconButton";

/* -------------------------------------------------------------------------- */
/* Text field                                                                 */
/* -------------------------------------------------------------------------- */

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-lg border bg-surface px-3 text-[14px] text-fg",
      "placeholder:text-subtle transition-colors duration-100",
      "focus:outline-none focus-visible:outline-none",
      invalid
        ? "border-danger focus:border-danger"
        : "border-border-strong focus:border-accent",
      className,
    )}
    style={{ boxShadow: "none" }}
    {...props}
  />
));
TextInput.displayName = "TextInput";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  error,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                          */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border-strong bg-surface-2 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[7px] px-3 py-1 text-[13px] font-medium transition-colors duration-100",
              active
                ? "bg-surface text-fg elevated"
                : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Checkbox (custom, accessible)                                              */
/* -------------------------------------------------------------------------- */

export function CheckTick({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-100",
        checked
          ? "border-accent bg-accent text-accent-fg"
          : "border-border-strong bg-surface",
      )}
    >
      {checked && <Check size={12} weight="bold" />}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

/** Agent identity chip: official brand favicon + optional label. */
export function AgentBadge({
  id,
  showLabel = false,
  size = 22,
}: {
  id: AgentId;
  showLabel?: boolean;
  size?: number;
}) {
  const meta = AGENT_MAP[id];
  return (
    <span className="inline-flex items-center gap-1.5" title={meta.label}>
      <span
        style={{ width: size, height: size }}
        // Neutral white tile keeps every brand mark legible in both themes
        // (some marks are near-black and would vanish on dark surfaces).
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white"
      >
        <img
          src={meta.icon}
          alt=""
          draggable={false}
          className="h-[72%] w-[72%] select-none object-contain"
        />
      </span>
      {showLabel && <span className="text-[13px] text-fg">{meta.label}</span>}
    </span>
  );
}

export function SourceBadge({ type }: { type: SourceType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border px-1.5 py-0.5",
        "font-mono text-[11px] font-medium uppercase tracking-wide text-muted",
      )}
      title={type === "git" ? "Cloned from a Git repository" : undefined}
    >
      {type}
    </span>
  );
}

export function MethodBadge({ method }: { method: InstallMethod }) {
  const isSymlink = method === "symlink";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        isSymlink
          ? "bg-accent-soft text-accent-text"
          : "bg-surface-2 text-muted border border-border",
      )}
    >
      {isSymlink ? "Symlink" : "Copy"}
    </span>
  );
}
