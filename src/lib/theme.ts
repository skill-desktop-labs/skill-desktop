import { useCallback, useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";

const KEY = "skill-desktop-theme";

function systemIsDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && systemIsDark());
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

/** Reads the stored preference, keeps <html data-theme> in sync, and
 *  follows the OS when the preference is "system". */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(
    () => (localStorage.getItem(KEY) as ThemePref) || "system",
  );

  useEffect(() => {
    apply(pref);
    localStorage.setItem(KEY, pref);
  }, [pref]);

  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const resolved: "light" | "dark" =
    pref === "system" ? (systemIsDark() ? "dark" : "light") : pref;

  // Cycle light -> dark -> system -> light for the toggle button.
  const cycle = useCallback(() => {
    setPref((p) => (p === "light" ? "dark" : p === "dark" ? "system" : "light"));
  }, []);

  return { pref, resolved, setPref, cycle };
}
