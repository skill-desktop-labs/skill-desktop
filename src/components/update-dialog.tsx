import { Modal } from "./ui/dialog";
import { Button } from "./ui/kit";
import type { UpdateStatus } from "../hooks/use-updater";

export function UpdateDialog({
  status,
  onApply,
  onDismiss,
}: {
  status: UpdateStatus;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const open = status.kind === "available" || status.kind === "downloading" || status.kind === "installing";

  const busy = status.kind === "downloading" || status.kind === "installing";

  const pct = status.kind === "downloading" ? Math.round(status.progress * 100) : 0;

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onDismiss();
      }}
      title={busy ? "Updating…" : "A new version is available"}
      description={
        status.kind === "available"
          ? `Version ${status.version} is ready to install. The app will restart after the update.`
          : undefined
      }
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onDismiss} disabled={busy}>
            Later
          </Button>
          <Button variant="primary" onClick={onApply} disabled={busy}>
            {status.kind === "downloading" && `Downloading… ${pct}%`}
            {status.kind === "installing" && "Installing…"}
            {status.kind === "available" && "Download & Restart"}
          </Button>
        </>
      }
    >
      <div className="px-6 pb-4 text-[13px] text-muted">
        {status.kind === "downloading" && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-accent transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {status.kind === "installing" && (
          <p>The update is being applied. The app will restart shortly.</p>
        )}
        {status.kind === "available" && status.notes && (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-surface-2 p-3 font-sans text-[12px] text-fg">
            {status.notes}
          </pre>
        )}
      </div>
    </Modal>
  );
}
