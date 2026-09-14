export type OrbitRendererBackend = "gpgpu" | "procedural";

export type OrbitCapabilities = {
  backend: OrbitRendererBackend;
  reason?: string;
};

export function chooseRendererBackend(options: {
  webgl2: boolean;
  floatColorBuffer: boolean;
}): OrbitCapabilities {
  if (!options.webgl2) return { backend: "procedural", reason: "WebGL2 is unavailable." };
  if (!options.floatColorBuffer) return { backend: "procedural", reason: "Float render targets are unavailable." };
  return { backend: "gpgpu" };
}

export function inspectRendererCapabilities(renderer: { capabilities: { isWebGL2: boolean }; extensions: { has(name: string): boolean } }): OrbitCapabilities {
  return chooseRendererBackend({
    webgl2: renderer.capabilities.isWebGL2,
    floatColorBuffer: renderer.extensions.has("EXT_color_buffer_float"),
  });
}
