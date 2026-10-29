import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { Button, Tooltip } from "../ui/Controls";
export function WindowControls() {
  const [error, setError] = useState("");
  if (!isTauri()) return null;
  const act = async (action: "minimize" | "maximize" | "close") => {
    try {
      const window = getCurrentWindow();
      if (action === "minimize") await window.minimize();
      if (action === "maximize") await window.toggleMaximize();
      if (action === "close") await window.close();
      setError("");
    } catch { setError("The window action could not be completed."); }
  };
  return <><div className="window-controls" role="group" aria-label="Window controls">
    <Tooltip label="Minimize"><Button aria-label="Minimize window" onClick={() => void act("minimize")}><Minus size={15} /></Button></Tooltip>
    <Tooltip label="Maximize or restore"><Button aria-label="Maximize or restore window" onClick={() => void act("maximize")}><Square size={12} /></Button></Tooltip>
    <Tooltip label="Close"><Button className="window-close" aria-label="Close window" onClick={() => void act("close")}><X size={15} /></Button></Tooltip>
  </div>{error && <span className="window-error" role="status">{error}</span>}</>;
}
