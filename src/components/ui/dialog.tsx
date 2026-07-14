import { type ReactNode } from "react";
import * as RDialog from "@radix-ui/react-dialog";
import * as RAlert from "@radix-ui/react-alert-dialog";
import { X } from "@phosphor-icons/react";
import { Button, IconButton, cn } from "./kit";

const OVERLAY =
  "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-overlay-in";
// Center with grid instead of `translate(-50%,-50%)`: a persistent transform
// promotes the dialog to a GPU layer that WKWebView (Tauri/macOS) rasterizes on
// a half-pixel boundary, blurring text and 1px borders. Grid centering keeps the
// resting state transform-free, so it stays pixel-snapped and sharp.
const POSITION_WRAP =
  "fixed inset-0 z-50 grid place-items-center p-4 pointer-events-none";
const CONTENT_WRAP =
  "relative w-[min(92vw,var(--w))] max-h-[86vh] overflow-hidden flex flex-col " +
  "rounded-2xl border border-border bg-surface elevated animate-content-in " +
  "focus:outline-none pointer-events-auto";

/* -------------------------------------------------------------------------- */
/* Modal (generic dialog)                                                     */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={OVERLAY} />
        <div className={POSITION_WRAP}>
          <RDialog.Content
            className={CONTENT_WRAP}
            style={{ ["--w" as string]: `${width}px` }}
          >
            <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
              <div className="flex flex-col gap-1">
                <RDialog.Title className="text-[16px] font-semibold text-fg">
                  {title}
                </RDialog.Title>
                {description && (
                  <RDialog.Description className="text-[13px] text-muted">
                    {description}
                  </RDialog.Description>
                )}
              </div>
              <RDialog.Close asChild>
                <IconButton aria-label="Close" className="-mr-1.5 -mt-1">
                  <X size={17} />
                </IconButton>
              </RDialog.Close>
            </header>

            <div className="flex-1 overflow-y-auto px-6 pb-1">{children}</div>

            {footer && (
              <footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
                {footer}
              </footer>
            )}
          </RDialog.Content>
        </div>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/* -------------------------------------------------------------------------- */
/* Confirm (destructive)                                                      */
/* -------------------------------------------------------------------------- */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <RAlert.Root open={open} onOpenChange={onOpenChange}>
      <RAlert.Portal>
        <RAlert.Overlay className={OVERLAY} />
        <div className={POSITION_WRAP}>
          <RAlert.Content
            className={cn(CONTENT_WRAP, "p-6 gap-4")}
            style={{ ["--w" as string]: "420px" }}
          >
            <RAlert.Title className="text-[16px] font-semibold text-fg">
              {title}
            </RAlert.Title>
            <RAlert.Description asChild>
              <div className="text-[13px] leading-relaxed text-muted">
                {children}
              </div>
            </RAlert.Description>
            <div className="mt-1 flex items-center justify-end gap-2">
              <RAlert.Cancel asChild>
                <Button variant="secondary">Cancel</Button>
              </RAlert.Cancel>
              <RAlert.Action asChild>
                <Button variant="danger" onClick={onConfirm}>
                  {confirmLabel}
                </Button>
              </RAlert.Action>
            </div>
          </RAlert.Content>
        </div>
      </RAlert.Portal>
    </RAlert.Root>
  );
}
