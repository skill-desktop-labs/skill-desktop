import { Toast } from "./toast";
import { useToastMessage, useToastActions } from "../../lib/toast-store";

/** Subscribes to the global toast store and renders toasts once at the Root. */
export function Toaster() {
  const message = useToastMessage();
  const { dismiss } = useToastActions();
  return <Toast message={message} onDone={dismiss} />;
}
