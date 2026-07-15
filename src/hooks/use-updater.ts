import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "available"; version: string; notes: string }
  | { kind: "downloading"; progress: number }
  | { kind: "installing" }
  | { kind: "error"; message: string };

const CHECK_DELAY_MS = 2000;

export function useUpdater() {
  const [status, setStatus] = useState<UpdateStatus>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const update: Update | null = await check();
        if (cancelled || !update?.available) return;
        setStatus({
          kind: "available",
          version: update.version,
          notes: update.body ?? "",
        });
      } catch (err) {
        // Update check is best-effort; never surface failure to user.
        console.warn("update check failed", err);
      }
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const apply = async () => {
    if (status.kind !== "available") return;
    try {
      const update = await check();
      if (!update?.available) {
        setStatus({ kind: "idle" });
        return;
      }
      let total = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            setStatus({ kind: "downloading", progress: 0 });
            break;
          case "Progress":
            downloaded += event.data.chunkLength ?? 0;
            setStatus({
              kind: "downloading",
              progress: total ? downloaded / total : 0,
            });
            break;
          case "Finished":
            setStatus({ kind: "installing" });
            break;
        }
      });
      await relaunch();
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const dismiss = () => setStatus({ kind: "idle" });

  return { status, apply, dismiss };
}
