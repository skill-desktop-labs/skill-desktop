import { type ReactNode } from "react";
import { PuzzlePiece, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "./ui/kit";

function Shell({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-2 text-subtle">
        {icon}
      </div>
      <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      <p className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-muted">
        {body}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** No skills installed in this scope at all. */
export function EmptyScope({ onInstall }: { onInstall: () => void }) {
  return (
    <Shell
      icon={<PuzzlePiece size={26} weight="fill" />}
      title="No skills installed yet"
      body="Install a skill from a repository URL and it's immediately available in the agents you select."
      action={
        <Button variant="primary" onClick={onInstall}>
          Install skill
        </Button>
      }
    />
  );
}

/** Skills exist, but the current search / agent filter hides them all. */
export function EmptyFilter({
  onClear,
  showClear,
}: {
  onClear: () => void;
  showClear: boolean;
}) {
  return (
    <Shell
      icon={<MagnifyingGlass size={24} />}
      title="No skills match your filters"
      body="Try a different search term or adjust the agent filter."
      action={
        showClear ? (
          <Button variant="secondary" onClick={onClear}>
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
}
