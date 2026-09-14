// The field is the analytical curl of layered vector potentials. It is
// divergence-free by construction and avoids importing legacy reference code.
export const simulationVelocityShader = /* glsl */ `
uniform sampler2D textureHome;
uniform float uDelta;
uniform float uTime;
uniform float uMotion;
uniform float uReducedMotion;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uOverall;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uTransient;
uniform float uTransientAge;

vec3 safeNormal(vec3 value) {
  return value * inversesqrt(max(dot(value, value), 0.000001));
}

vec3 curlLayer(vec3 p, float t, vec3 frequency, vec3 phase) {
  vec3 q = vec3(
    dot(p, vec3(0.82, 0.31, -0.47)),
    dot(p, vec3(-0.21, 0.91, 0.36)),
    dot(p, vec3(0.53, -0.18, 0.83))
  );
  q *= frequency;
  q += phase + vec3(t * 0.37, -t * 0.29, t * 0.23);
  return vec3(
    -frequency.y * sin(q.y) - frequency.z * cos(q.z),
    -frequency.z * sin(q.z) - frequency.x * cos(q.x),
    -frequency.x * sin(q.x) - frequency.y * cos(q.y)
  );
}

vec3 curlNoise(vec3 p, float t) {
  vec3 broad = curlLayer(p, t, vec3(0.84, 1.03, 0.93), vec3(1.7, 4.2, 2.1));
  vec3 detail = curlLayer(p * 1.73 + broad * 0.055, t * 1.31, vec3(1.47, 1.19, 1.62), vec3(5.3, 0.8, 3.9));
  vec3 filament = curlLayer(p * 3.2, -t * 0.71, vec3(0.73, 0.91, 1.11), vec3(2.4, 5.8, 0.4));
  return safeNormal(broad * 0.62 + detail * 0.29 + filament * 0.09);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 positionData = texture2D(texturePosition, uv);
  vec4 velocityData = texture2D(textureVelocity, uv);
  vec4 homeData = texture2D(textureHome, uv);
  vec3 position = positionData.xyz;
  vec3 velocity = velocityData.xyz;
  float population = velocityData.w;
  float targetRadius = positionData.w;
  float seed = homeData.w;
  vec3 home = safeNormal(homeData.xyz);
  float radius = max(length(position), 0.001);
  vec3 normal = position / radius;
  float delta = clamp(uDelta, 0.0, 0.034);
  float motionScale = mix(0.34, 1.0, 1.0 - uReducedMotion) * uMotion;

  float atmosphere = step(0.5, population);
  float wisp = step(1.5, population);
  float breathing = sin(uTime * 0.31 + seed * 4.2) * 0.018 + sin(uTime * 0.173 + seed * 8.7) * 0.012;
  float audioPressure = uBass * (0.052 + 0.024 * sin(seed * 19.0 + uTime * 2.1)) + uOverall * 0.012;
  float desiredRadius = targetRadius * (1.0 + breathing * motionScale + audioPressure);

  vec3 homeFlow = curlNoise(home * 1.7 + seed, uTime * 0.075 + seed * 3.0);
  vec3 homeTangent = homeFlow - home * dot(homeFlow, home);
  vec3 movingHome = safeNormal(home + homeTangent * (0.035 + atmosphere * 0.025 + wisp * 0.04) * motionScale);
  vec3 homeTarget = movingHome * desiredRadius;
  float homeSpring = mix(0.82, 0.3, atmosphere) - wisp * 0.2;

  vec3 flow = curlNoise(position * (1.32 + seed * 0.18), uTime * 0.22 + seed * 2.0);
  vec3 tangent = flow - normal * dot(flow, normal);
  float tangentLength = length(tangent);
  if (tangentLength > 0.0001) tangent /= tangentLength;
  float flowStrength = mix(0.16, 0.25, atmosphere) + wisp * 0.12;
  flowStrength *= motionScale * (1.0 + uMid * 1.65);

  float spring = mix(2.8, 1.45, atmosphere) - wisp * 0.72;
  vec3 radialForce = normal * (desiredRadius - radius) * spring;
  vec3 angularDrift = cross(safeNormal(vec3(0.23, 0.91, -0.34)), normal) * 0.018 * motionScale;
  vec3 acceleration = tangent * flowStrength + radialForce + (homeTarget - position) * homeSpring + angularDrift;

  vec3 pointerDelta = position - uPointer;
  float pointerDistance = length(pointerDelta);
  float pointerFalloff = 1.0 - smoothstep(0.0, 0.72, pointerDistance);
  if (pointerFalloff > 0.0) {
    vec3 away = safeNormal(pointerDelta + normal * 0.08);
    vec3 bend = safeNormal(cross(normal, away));
    acceleration += (away * 1.18 + bend * 0.36) * pointerFalloff * uPointerStrength * mix(0.32, 1.0, 1.0 - uReducedMotion);
  }

  float waveRadius = uTransientAge * 1.85;
  float wave = exp(-pow((radius - waveRadius) * 8.0, 2.0)) * uTransient;
  acceleration += normal * wave * 2.2 * mix(0.15, 1.0, 1.0 - uReducedMotion);
  acceleration += curlNoise(position * 4.3 + seed, -uTime * 0.41) * uHigh * (0.046 + wisp * 0.058) * motionScale;
  acceleration += normal * uOverall * 0.065 * (0.5 + seed);

  velocity += acceleration * delta;
  float damping = mix(1.74, 1.34, atmosphere) - wisp * 0.18;
  velocity *= exp(-damping * delta);
  float maxSpeed = mix(0.38, 0.62, atmosphere) + wisp * 0.28;
  float speed = length(velocity);
  if (speed > maxSpeed) velocity *= maxSpeed / speed;

  bool invalid = any(notEqual(velocity, velocity)) || length(position) > 3.35;
  if (invalid) velocity = safeNormal(homeTarget - position) * 0.18;
  gl_FragColor = vec4(velocity, population);
}
`;
