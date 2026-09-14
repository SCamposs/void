export const simulationPositionShader = /* glsl */ `
uniform float uDelta;
uniform float uTime;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 seededDirection(vec2 uv) {
  float z = hash12(uv + 1.71) * 2.0 - 1.0;
  float angle = hash12(uv + 7.13) * 6.28318530718;
  float radial = sqrt(max(0.0, 1.0 - z * z));
  return vec3(cos(angle) * radial, sin(angle) * radial, z);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 positionData = texture2D(texturePosition, uv);
  vec4 velocityData = texture2D(textureVelocity, uv);
  vec3 position = positionData.xyz;
  float targetRadius = positionData.w;
  float delta = clamp(uDelta, 0.0, 0.034);

  bool invalid = any(notEqual(position, position)) || length(position) > 3.4 || length(position) < 0.02;
  if (invalid) {
    vec3 direction = seededDirection(uv + fract(uTime * 0.0001));
    position = direction * targetRadius;
  } else {
    position += velocityData.xyz * delta;
  }

  gl_FragColor = vec4(position, targetRadius);
}
`;
