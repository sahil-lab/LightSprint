export const QUAD_VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

export const PARTICLE_VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aVortex;
layout(location = 1) in vec4 aGraphA;
layout(location = 2) in vec4 aGraphB;
layout(location = 3) in vec3 aField;
layout(location = 4) in vec4 aSprint;
layout(location = 5) in vec4 aSeed;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat3 uRotation[4];
uniform vec3 uOffset[4];
uniform vec4 uSize;    // vortex scale, graph scale, pixels per unit, largest point
uniform vec4 uField;   // width factor, far depth, camera distance, seconds since pulse
uniform vec2 uSprint;  // lane length, half height
uniform vec4 uState;   // time, scene, intro, gain
uniform vec4 uMood;    // alert, health, focus distance, aperture
uniform vec3 uPointer; // world x, world y, force

out vec3 vColor;
out float vBlur;

const float TAU = 6.28318530718;
const float PI = 3.14159265359;

void main() {
  float time = uState.x;

  // Scene 0: an orbiting spiral of many independent points.
  float radius = aVortex.x;
  float angle = aVortex.y + time * 0.055 + 0.16 * sin(time * 0.31 + aSeed.x * TAU) / (0.6 + radius);
  vec3 vortex = vec3(
    cos(angle) * radius,
    aVortex.z + 0.04 * sin(time * 0.5 + aSeed.w * TAU),
    sin(angle) * radius
  );
  vortex = uRotation[0] * (vortex * uSize.x) + uOffset[0];

  // Scene 1: a dependency graph whose edges all flow the same way.
  float travel = fract(aGraphA.w + time * max(aGraphB.w, 0.0));
  float eased = travel * travel * (3.0 - 2.0 * travel);
  vec3 graph = vec3(mix(aGraphA.x, aGraphB.x, travel), mix(aGraphA.yz, aGraphB.yz, eased));
  graph = uRotation[1] * (graph * uSize.y) + uOffset[1];
  float node = 1.0 - step(0.0001, abs(aGraphB.w));

  // Scene 2: a calm field of light that fills the view at every depth.
  float depth = mix(3.4, -uField.y, aField.y);
  float across = aField.x * (uField.z - depth) * uField.x;
  float wave = 0.17 * sin(across * 0.8 + time * 0.45) * cos(depth * 0.5 - time * 0.3)
    + 0.06 * sin(across * 2.1 - depth * 1.6 + time * 0.75);
  float ripple = 0.0;
  if (uField.w >= 0.0) {
    float ring = length(vec2(across, depth + 2.0)) - uField.w * 3.2;
    ripple = exp(-ring * ring * 1.4) * exp(-uField.w * 0.45);
  }
  vec3 field = uRotation[2] * vec3(across, wave + ripple * 0.55, depth) + uOffset[2];

  // Scene 3: streaks of light, everything moving in one direction.
  float along = mod(aSprint.x * uSprint.x + time * aSprint.w, uSprint.x) - 0.5 * uSprint.x;
  vec3 sprint = uRotation[3] * vec3(along, aSprint.y * uSprint.y, mix(-7.0, 2.6, aSprint.z)) + uOffset[3];

  // Each particle leaves and arrives at its own moment, so formations flow into each other.
  float segment = min(floor(uState.y), 2.0);
  float local = clamp(uState.y - segment, 0.0, 1.0);
  float progress = smoothstep(aSeed.z * 0.45, aSeed.z * 0.45 + 0.55, local);
  float scene = segment + progress;
  vec4 weight = max(vec4(0.0), 1.0 - abs(vec4(scene) - vec4(0.0, 1.0, 2.0, 3.0)));
  vec3 position = weight.x * vortex + weight.y * graph + weight.z * field + weight.w * sprint;

  float turbulence = sin(progress * PI);
  position += (sin(position.yzx * 1.3 + aSeed.w * TAU + time * 0.6)
    + 0.5 * sin(position.zxy * 2.9 - time * 0.8)) * turbulence * 0.5;
  position += sin(vec3(37.0, 41.0, 29.0) * time + aSeed.xyz * TAU) * uMood.x * 0.035;

  // Intro: every particle starts in one point of light and bursts outward.
  float burst = clamp(uState.z * 1.5 - aSeed.w * 0.5, 0.0, 1.0);
  burst = 1.0 - pow(1.0 - burst, 3.0);
  position = mix(uOffset[0] + (position - uOffset[0]) * 0.012, position, burst);

  vec2 away = position.xy - uPointer.xy;
  float push = exp(-dot(away, away) / 0.6) * uPointer.z;
  position.xy += normalize(away + vec2(0.0001)) * push * 0.6;
  position.z += push * 0.45;

  vec4 viewPosition = uView * vec4(position, 1.0);
  gl_Position = uProjection * viewPosition;

  // Depth of field: points away from the focal plane grow into dim discs.
  float range = max(0.25, -viewPosition.z);
  float size = mix(0.009, 0.03, pow(aSeed.y, 5.0));
  float focusPixels = uSize.z * 2.0 * size / range;
  float blurPixels = uSize.z * uMood.w * abs(1.0 / range - 1.0 / uMood.z);
  float rawPixels = focusPixels + blurPixels;
  gl_PointSize = clamp(rawPixels, 1.6, uSize.w);
  vBlur = clamp(blurPixels / rawPixels * 1.5 - 0.15, 0.0, 1.0);
  float shrink = min(1.0, rawPixels / 1.6);
  float energy = shrink * shrink * focusPixels / max(rawPixels, 1.6);
  // Distant light fades into the dark instead of piling up at the horizon.
  energy *= mix(1.0, 0.16, smoothstep(9.0, 21.0, range));

  vec3 color = mix(vec3(0.74, 1.0, 0.3), vec3(0.3, 1.0, 0.66), smoothstep(0.15, 0.95, aSeed.x));
  color = mix(color, vec3(0.78, 0.95, 1.0), step(0.88, aSeed.w));
  color = mix(color, vec3(1.0, 0.6, 0.2), step(0.975, aSeed.z));
  color = mix(color, vec3(0.92, 1.0, 0.84), node * weight.y * 0.6);
  color = mix(color, vec3(1.0, 0.26, 0.2), uMood.x * 0.9);
  color = mix(vec3(dot(color, vec3(0.3, 0.6, 0.1))), color, mix(0.15, 1.0, uMood.y));

  float twinkle = 0.7 + 0.3 * sin(time * (0.5 + aSeed.x * 1.7) + aSeed.w * 40.0);
  float brightness = mix(0.55, 2.4, pow(aSeed.y, 3.0));
  float accent = 1.0 + node * weight.y * 0.5 + ripple * weight.z * 3.0;
  // Dense formations are drawn dimmer so their structure stays readable.
  float sceneGain = dot(weight, vec4(1.0, 0.42, 0.8, 0.7));
  float flash = mix(0.03, 1.0, burst) * (1.0 + 2.0 * sin(burst * PI));
  vColor = color
    * (uState.w * twinkle * brightness * accent * sceneGain * energy * flash * mix(0.3, 1.0, uMood.y));
}`;

export const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 vColor;
in float vBlur;
out vec4 outColor;
void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float d = dot(point, point);
  if (d > 1.0) discard;
  float core = exp(-d * 4.5);
  float disc = (1.0 - smoothstep(0.72, 1.0, d)) * (0.5 + 0.5 * d) * 0.34;
  outColor = vec4(vColor * mix(core, disc, vBlur), 1.0);
}`;

export const FADE_FRAGMENT = `#version 300 es
precision highp float;
uniform float uFade;
out vec4 outColor;
void main() {
  outColor = vec4(0.0, 0.0, 0.0, uFade);
}`;

export const DOWNSAMPLE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 sum = texture(uSource, vUv + uTexel * vec2(-1.0, -1.0)).rgb
    + texture(uSource, vUv + uTexel * vec2(1.0, -1.0)).rgb
    + texture(uSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb
    + texture(uSource, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  outColor = vec4(sum * 0.25, 1.0);
}`;

export const BLUR_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uDirection;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 sum = texture(uSource, vUv).rgb * 0.2270270270;
  sum += texture(uSource, vUv + uDirection * 1.3846153846).rgb * 0.3162162162;
  sum += texture(uSource, vUv - uDirection * 1.3846153846).rgb * 0.3162162162;
  sum += texture(uSource, vUv + uDirection * 3.2307692308).rgb * 0.0702702703;
  sum += texture(uSource, vUv - uDirection * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(sum, 1.0);
}`;

export const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uSceneTexture;
uniform sampler2D uBloomNear;
uniform sampler2D uBloomWide;
uniform vec4 uParams; // time, scene, exposure, aspect
uniform vec4 uGrade;  // alert, health, bloom, grain
in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 centered = vUv - 0.5;
  float edge = dot(centered, centered);
  vec2 shift = centered * edge * 0.012;
  vec3 color = vec3(
    texture(uSceneTexture, vUv - shift).r,
    texture(uSceneTexture, vUv).g,
    texture(uSceneTexture, vUv + shift).b
  );
  color += (texture(uBloomNear, vUv).rgb * 0.5 + texture(uBloomWide, vUv).rgb * 0.85) * uGrade.z;

  vec2 drift = vec2(centered.x * uParams.w, centered.y);
  float fog = noise(drift * 1.6 + vec2(uParams.x * 0.02, -uParams.x * 0.015)) * 0.6
    + noise(drift * 3.4 - vec2(uParams.x * 0.03, 0.0)) * 0.4;
  vec3 haze = mix(vec3(0.1, 0.2, 0.05), vec3(0.02, 0.14, 0.12), smoothstep(0.0, 3.0, uParams.y));
  haze = mix(haze, vec3(0.3, 0.05, 0.03), uGrade.x * 0.7);
  color += haze * fog * fog * 0.16 * mix(0.4, 1.0, uGrade.y);

  color = 1.0 - exp(-color * uParams.z);
  color = pow(color, vec3(0.92));
  float vignette = 1.0 - smoothstep(0.2, 0.95, length(centered * vec2(1.0, 0.9)));
  color *= mix(0.55, 1.0, vignette);
  color += vec3(0.0196, 0.0275, 0.0235);
  color += (hash(gl_FragCoord.xy + fract(uParams.x) * 61.0) - 0.5) * uGrade.w;
  outColor = vec4(color, 1.0);
}`;
