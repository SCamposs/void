# Orbit renderer

Orbit is a quiet, full-window visual instrument: a living ice-white particle body suspended in near-total black. It is intentionally not a dashboard, visualizer HUD, or decorative loading animation. The visible surface is the instrument; controls stay secondary and disappear when idle.

## Visual model

The primary body is one particle system with three seeded populations:

- 75.5% shell particles form the dense elastic body.
- 20.3% atmosphere particles sit just outside the shell.
- 4.2% wisps use wider radii and looser restoring forces.

Each particle keeps a static home direction and radius. The simulation combines a time-varying analytic curl field, tangential projection, weak angular circulation, a radial spring, population-specific damping, and a soft moving home target. The home field preserves the sphere without freezing the flow or allowing curl sinks to collapse the body. The renderer varies point scale, opacity, and cold-white color by depth, velocity, population, and broad density bands. Additive blending and restrained bloom produce a luminous volume without a solid mesh or opaque core.

## Renderer architecture

`OrbitModule.tsx` owns semantic React state only: human-facing settings, microphone permission state, control visibility, and renderer failure state. Per-frame simulation and audio values never enter React state.

The rendering path is:

1. `OrbitRenderer` creates a Three.js `WebGLRenderer`, a stable camera, the particle scene, optional post-processing, and the frame loop.
2. `capabilities.ts` selects the GPU path only when WebGL2 and floating-point color attachments are available.
3. `ParticleSimulation` uses Three.js `GPUComputationRenderer` ping-pong targets for position and velocity textures. A separate immutable texture stores each particle's home direction and seed.
4. Custom vertex and fragment shaders fetch simulation textures and draw circular ice-white particles.
5. If floating-point GPU computation is unavailable, `ProceduralFallback` keeps a lower-cost WebGL particle field.
6. If WebGL itself is unavailable, `CanvasFallbackRenderer` provides a small CPU-driven 2D particle sphere rather than a blank or broken module.

WebGL2 was chosen over an experimental WebGPU-first implementation because Three.js currently supports the required GPU compute pattern directly through `GPUComputationRenderer`, while the Tauri Windows WebView2 target benefits from the mature WebGL rendering and context-recovery path. The capability gate keeps this an implementation choice rather than a device requirement.

## Motion and interaction

The velocity shader layers broad, detail, and filament-scale divergence-free fields. Flow is projected around the particle's radial normal so most motion slides over the body. Elastic radial and home forces counter drift; damping and maximum-speed limits keep integration stable. The position shader clamps frame time and recovers invalid values.

Pointer input is ray-cast onto the orb. A smooth local falloff pushes particles away and adds a tangential bend. Attack is quick, release is slower, and the spring field repairs the surface after the pointer leaves. Reduced-motion mode greatly lowers field speed and pointer strength rather than replacing the scene with a static image.

## Microphone response

Microphone access is opt-in and begins only after the user presses the microphone button. `OrbitAudioAnalyzer` keeps the media stream, Web Audio nodes, FFT buffers, and attack/release smoothers in runtime objects. It extracts:

- 40–220 Hz bass for pressure and radial breathing.
- 220–2,400 Hz mids for turbulence and tangential flow.
- 2,400–9,000 Hz highs for fine motion and particle detail.
- 40–9,000 Hz overall energy for restrained global intensity.
- Positive onsets for a short radial travelling wave.

An RMS-like band estimate, noise gate, sensitivity control, and separate attack/release time constants prevent quiet-room flicker and abrupt snapping. Denial or missing media APIs leave Orbit running in quiet mode. Stopping or leaving Orbit stops every media track, disconnects nodes, closes the audio context, clears buffers, and resets smoothers.

## Quality and performance

The presets are deliberately bounded:

| Preset | Texture | Particles | DPR cap | Bloom |
| --- | ---: | ---: | ---: | --- |
| Performance | 128 × 256 | 32,768 | 1.15 | Off |
| Balanced | 256 × 256 | 65,536 | 1.5 | Restrained |
| Quality | 256 × 512 | 131,072 | 2.0 | Restrained |

Automatic mode starts from device hints, observes a smoothed frame time after warm-up, and changes tiers only after sustained evidence. Downgrades are faster than upgrades; upgrades are conservative and stop at Balanced to avoid oscillation and surprise cost. A quality change rebuilds and disposes the old simulation and post-processing targets.

`ResizeObserver` keeps the camera, renderer, composer, and DPR in sync. Rendering pauses while the document is hidden. WebGL context loss stops the loop and context restoration rebuilds the visual. Module disposal cancels animation frames, disconnects observers/listeners, releases geometries, materials, textures, compute targets and composer passes, disposes the renderer, and releases the graphics context.

## UX principles

- The module contains no title bar, permanent telemetry, particle count, frequency graph, or technical status readout.
- Pointer movement reveals only microphone and settings controls; they fade after inactivity.
- Keyboard focus keeps controls visible. Buttons have semantic labels and visible focus. Escape closes settings.
- Settings use human terms: Calm/Balanced/Alive, Automatic/Performance/Balanced/Quality, and microphone sensitivity.
- Failure and microphone-denied messages are short, calm, and do not cover the visual unnecessarily.

## Validation

Automated tests cover quality selection and hysteresis, DPR caps, capability fallback, FFT bin mapping, normalized band energy, the noise gate, attack/release smoothing, pointer falloff, and settings migration. The project checks also include TypeScript, ESLint, the full Vitest suite, the production web build, and the Tauri build.

Manual QA should cover:

- Quiet start with no microphone prompt.
- Mic allow, toggle off, denial/unavailable fallback, and re-entry cleanup.
- Visible bass pressure, mid turbulence, high-frequency detail, and transient wave with suitable audio.
- Pointer indentation/bending followed by smooth recovery.
- Automatic and all three explicit quality presets.
- Reduced-motion preference, narrow and wide resizing, background/foreground visibility, and repeated module entry/exit.
- No console errors, duplicate canvases, retained media indicators, or increasing renderer resources after re-entry.
- Final behavior in a native Tauri window, not only a browser preview.

## References and licensing

The implementation was informed by, but does not copy, the following references:

- [Three.js GPUComputationRenderer example](https://threejs.org/examples/#webgl_gpgpu_birds) and current Three.js documentation.
- [Particle-Curl-Noise](https://github.com/AlessandroBertoglio/Particle-Curl-Noise) for the GPU-particle/curl-noise architecture (ISC).
- [gpu-party](https://github.com/yomboprime/gpu-party) for ping-pong GPU simulation concepts (ISC).
- [Aural-Pro](https://github.com/EmilHvitfeldt/aural-pro) for audio-band-to-shader design ideas (MIT).
- [samantha-ui](https://github.com/patriciogonzalezvivo/samantha-ui) for runtime-ref smoothing and explicit Three.js disposal patterns (MIT).

The curl field and all production shaders in VOID are original implementations written for Orbit. No reference source, shader body, asset, or visual branding was copied into the project.
