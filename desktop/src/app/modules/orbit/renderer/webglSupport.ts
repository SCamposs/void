export function hasWebGL2Support(): boolean {
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2", { powerPreference: "high-performance" });
    const supported = context !== null;
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return supported;
  } catch {
    return false;
  }
}
