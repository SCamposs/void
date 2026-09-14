export const particlesVertexShader = /* glsl */ `
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
uniform float uPixelRatio;
uniform float uPointScale;
uniform float uOverall;
uniform float uHigh;
attribute vec2 aReference;
attribute float aSeed;
varying float vAlpha;
varying float vEnergy;
varying float vPopulation;

void main() {
  vec3 position = texture2D(texturePosition, aReference).xyz;
  float population = texture2D(textureVelocity, aReference).w;
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  float perspective = 280.0 / max(1.0, -viewPosition.z);
  float populationSize = population < 0.5 ? 1.0 : (population < 1.5 ? 0.78 : 0.64);
  float densityWave = sin(position.x * 2.8 + position.z * 1.3)
    + sin(position.y * 3.7 - position.x * 0.9)
    + cos(position.z * 4.4 + position.y * 1.1);
  float density = smoothstep(-1.25, 1.65, densityWave);
  float flicker = 0.84 + aSeed * 0.34 + uHigh * (0.42 + 0.34 * step(1.5, population));
  float densitySize = mix(0.82, 1.14, density);
  gl_PointSize = clamp(uPointScale * uPixelRatio * perspective * populationSize * flicker * densitySize, 0.7, 5.2 * uPixelRatio);
  gl_Position = projectionMatrix * viewPosition;
  vPopulation = population;
  vEnergy = uOverall * 1.15 + uHigh * (0.28 + 0.38 * step(1.5, population)) + density * 0.16;
  float baseAlpha = population < 0.5 ? 0.48 : (population < 1.5 ? 0.22 : 0.15);
  vAlpha = baseAlpha * mix(0.32, 1.22, density);
}
`;

export const particlesFragmentShader = /* glsl */ `
varying float vAlpha;
varying float vEnergy;
varying float vPopulation;

void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float distanceToCenter = dot(point, point);
  if (distanceToCenter > 1.0) discard;
  float core = 1.0 - smoothstep(0.0, 0.2, distanceToCenter);
  float body = 1.0 - smoothstep(0.08, 0.72, distanceToCenter);
  float halo = 1.0 - smoothstep(0.16, 1.0, distanceToCenter);
  float populationFade = vPopulation < 0.5 ? 1.0 : (vPopulation < 1.5 ? 0.76 : 0.58);
  float alpha = (core * 0.55 + body * 0.44 + halo * 0.1) * vAlpha * populationFade;
  vec3 ice = mix(vec3(0.69, 0.78, 0.86), vec3(0.965, 0.99, 1.0), clamp(core + vEnergy * 0.72, 0.0, 1.0));
  gl_FragColor = vec4(ice * (0.86 + core * 0.48 + vEnergy * 0.62), alpha);
}
`;

export const fallbackVertexShader = /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform float uReducedMotion;
uniform float uOverall;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uPixelRatio;
uniform float uPointScale;
attribute float aSeed;
attribute float aPopulation;
varying float vAlpha;
varying float vEnergy;
varying float vPopulation;

void main() {
  vec3 normal = normalize(position);
  float motion = uMotion * mix(0.28, 1.0, 1.0 - uReducedMotion);
  float phase = aSeed * 37.0;
  vec3 tangent = normalize(cross(normal, normalize(vec3(0.23 + sin(phase), 0.91, -0.34 + cos(phase)))));
  float flow = sin(uTime * (0.22 + aSeed * 0.08) + phase + position.y * 3.0);
  float breath = sin(uTime * 0.31 + phase) * 0.018 + uBass * 0.065;
  vec3 displaced = position * (1.0 + breath * motion);
  displaced += tangent * flow * (0.035 + aPopulation * 0.018) * motion * (1.0 + uMid * 1.2);
  displaced += normal * sin(uTime * 1.7 + phase) * uHigh * 0.022 * motion;
  vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  gl_PointSize = clamp(uPointScale * uPixelRatio * 250.0 / max(1.0, -viewPosition.z), 0.7, 4.2 * uPixelRatio);
  vPopulation = aPopulation;
  vEnergy = uOverall;
  vAlpha = aPopulation < 0.5 ? 0.42 : 0.2;
}
`;
