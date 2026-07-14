import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { cn } from "../ui/kit";

export function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <MagnifyingGlass
        size={15}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search skills"
        className={cn(
          "h-9 w-[200px] rounded-lg border border-border-strong bg-surface pl-8 pr-8 text-[13px] text-fg",
          "placeholder:text-subtle transition-colors duration-100 focus:border-accent focus:outline-none",
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
        >
          <X size={13} weight="bold" />
        </button>
      )}
    </div>
  );
}
