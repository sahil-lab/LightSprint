import { FLOATS_PER_PARTICLE, OFFSET, buildParticles } from "./formations";
import {
  BLUR_FRAGMENT,
  COMPOSITE_FRAGMENT,
  DOWNSAMPLE_FRAGMENT,
  FADE_FRAGMENT,
  PARTICLE_FRAGMENT,
  PARTICLE_VERTEX,
  QUAD_VERTEX,
} from "./shaders";

export type Tier = { readonly particles: number; readonly scale: number };

/** Quality levels, lowest first. The director moves between them from measured frame time. */
export const TIERS: readonly Tier[] = [
  { particles: 14000, scale: 0.6 },
  { particles: 30000, scale: 0.8 },
  { particles: 56000, scale: 1 },
  { particles: 96000, scale: 1 },
];

export type FrameState = {
  time: number;
  delta: number;
  /** 0 vortex, 1 graph, 2 field, 3 sprint; fractions are in transition. */
  scene: number;
  intro: number;
  /** Pointer in normalized device coordinates, y up. */
  pointerX: number;
  pointerY: number;
  pointerForce: number;
  /** Seconds since the last pulse, or a negative value when none is active. */
  pulse: number;
  alert: number;
  health: number;
  trails: boolean;
};

type Program = { handle: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> };
type Target = {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
};
type Targets = { scene: Target; nearA: Target; nearB: Target; wideA: Target; wideB: Target };

const FIELD_OF_VIEW = (40 * Math.PI) / 180;
const TANGENT = Math.tan(FIELD_OF_VIEW / 2);
const CAMERA_DISTANCE = 7;
const TRAIL = 0.8;
const BASE_GAIN = 0.42;
const REFERENCE_PARTICLES = 56000;
const PIXEL_BUDGET = 3_400_000;
const APERTURES = [0.05, 0.04, 0.085, 0.045];

const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;
const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function rotationX(angle: number): number[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [1, 0, 0, 0, c, s, 0, -s, c];
}

function rotationY(angle: number): number[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, 0, -s, 0, 1, 0, s, 0, c];
}

function rotationZ(angle: number): number[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c, s, 0, -s, c, 0, 0, 0, 1];
}

/** Column-major 3x3 product a * b. */
function multiply(a: readonly number[], b: readonly number[]): number[] {
  const out: number[] = [];
  for (let column = 0; column < 3; column += 1) {
    for (let row = 0; row < 3; row += 1) {
      let sum = 0;
      for (let k = 0; k < 3; k += 1) sum += (a[k * 3 + row] ?? 0) * (b[column * 3 + k] ?? 0);
      out.push(sum);
    }
  }
  return out;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL could not create a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "no compiler output";
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${log}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  uniformNames: readonly string[],
): Program {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const handle = gl.createProgram();
  if (!handle) throw new Error("WebGL could not create a program.");
  gl.attachShader(handle, vertex);
  gl.attachShader(handle, fragment);
  gl.linkProgram(handle);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(handle) ?? "no linker output";
    gl.deleteProgram(handle);
    throw new Error(`Shader linking failed: ${log}`);
  }
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  for (const name of uniformNames) uniforms.set(name, gl.getUniformLocation(handle, name));
  return { handle, uniforms };
}

function location(program: Program, name: string): WebGLUniformLocation | null {
  return program.uniforms.get(name) ?? null;
}

function createTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  halfFloat: boolean,
): Target | null {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  if (halfFloat) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  if (!complete) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    return null;
  }
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { framebuffer, texture, width, height };
}

/**
 * Renders the particle scene: additive points into a (half-float when available) target
 * that keeps short light trails, two bloom levels, then a filmic composite to the canvas.
 */
export class Engine {
  readonly software: boolean;
  readonly hdr: boolean;
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly particleProgram: Program;
  private readonly fadeProgram: Program;
  private readonly downsampleProgram: Program;
  private readonly blurProgram: Program;
  private readonly compositeProgram: Program;
  private readonly particleArray: WebGLVertexArrayObject;
  private readonly quadArray: WebGLVertexArrayObject;
  private readonly particleBuffer: WebGLBuffer;
  private readonly capacity: number;
  private readonly largestPoint: number;
  private readonly projection = new Float32Array(16);
  private readonly view = new Float32Array(16);
  private readonly rotations = new Float32Array(36);
  private readonly offsets = new Float32Array(12);
  private targets: Targets | null = null;
  private tierIndex = 0;
  private cssWidth = 1;
  private cssHeight = 1;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.canvas = canvas;
    this.gl = gl;

    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(
      debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    );
    this.software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);

    const floatTargets =
      gl.getExtension("EXT_color_buffer_float") ?? gl.getExtension("EXT_color_buffer_half_float");
    const probe = floatTargets ? createTarget(gl, 4, 4, true) : null;
    this.hdr = probe !== null;
    if (probe) {
      gl.deleteFramebuffer(probe.framebuffer);
      gl.deleteTexture(probe.texture);
    }

    this.particleProgram = createProgram(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT, [
      "uProjection",
      "uView",
      "uRotation[0]",
      "uOffset[0]",
      "uSize",
      "uField",
      "uSprint",
      "uState",
      "uMood",
      "uPointer",
    ]);
    this.fadeProgram = createProgram(gl, QUAD_VERTEX, FADE_FRAGMENT, ["uFade"]);
    this.downsampleProgram = createProgram(gl, QUAD_VERTEX, DOWNSAMPLE_FRAGMENT, [
      "uSource",
      "uTexel",
    ]);
    this.blurProgram = createProgram(gl, QUAD_VERTEX, BLUR_FRAGMENT, ["uSource", "uDirection"]);
    this.compositeProgram = createProgram(gl, QUAD_VERTEX, COMPOSITE_FRAGMENT, [
      "uSceneTexture",
      "uBloomNear",
      "uBloomWide",
      "uParams",
      "uGrade",
    ]);

    const highest = this.software ? TIERS[1] : TIERS[TIERS.length - 1];
    this.capacity = highest?.particles ?? 14000;
    const pointRange = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
    this.largestPoint = pointRange[1] ?? 64;

    const particleArray = gl.createVertexArray();
    const quadArray = gl.createVertexArray();
    const particleBuffer = gl.createBuffer();
    if (!particleArray || !quadArray || !particleBuffer) {
      throw new Error("WebGL could not allocate particle buffers.");
    }
    this.particleArray = particleArray;
    this.quadArray = quadArray;
    this.particleBuffer = particleBuffer;

    gl.bindVertexArray(particleArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, buildParticles(this.capacity), gl.STATIC_DRAW);
    const stride = FLOATS_PER_PARTICLE * 4;
    const attributes: readonly (readonly [index: number, size: number, offset: number])[] = [
      [0, 3, OFFSET.vortex],
      [1, 4, OFFSET.graphA],
      [2, 4, OFFSET.graphB],
      [3, 3, OFFSET.field],
      [4, 4, OFFSET.sprint],
      [5, 4, OFFSET.seed],
    ];
    for (const [index, size, offset] of attributes) {
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride, offset * 4);
    }
    gl.bindVertexArray(null);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  get tier(): number {
    return this.tierIndex;
  }

  get particles(): number {
    return Math.min(TIERS[this.tierIndex]?.particles ?? this.capacity, this.capacity);
  }

  setTier(index: number): void {
    this.tierIndex = Math.min(TIERS.length - 1, Math.max(0, index));
  }

  /** Size of the canvas in CSS pixels; render targets follow on the next frame. */
  setViewport(width: number, height: number): void {
    this.cssWidth = Math.max(1, width);
    this.cssHeight = Math.max(1, height);
  }

  render(state: FrameState): void {
    const gl = this.gl;
    const targets = this.prepareTargets();
    const { scene, nearA, nearB, wideA, wideB } = targets;
    const aspect = scene.width / scene.height;
    const count = this.particles;

    const fraction = state.scene - Math.floor(state.scene);
    const cameraDistance = CAMERA_DISTANCE - 1.15 * Math.sin(Math.PI * fraction);
    const halfHeight = TANGENT * CAMERA_DISTANCE;
    const halfWidth = halfHeight * aspect;
    // 0 on portrait screens, 1 on landscape ones; compositions blend between the two.
    const wide = clamp01((aspect - 0.75) / 0.6);

    this.writeProjection(aspect);
    this.writeView(cameraDistance, state.pointerX * 0.05, -state.pointerY * 0.035);

    const vortexScale = lerp(
      (halfWidth * 1.3) / 2.4,
      Math.min(halfWidth * 0.54, halfHeight * 0.96) / 2.4,
      wide,
    );
    const graphScale = lerp(halfWidth * 0.72, Math.min(halfWidth * 0.42, halfHeight * 1.4), wide);
    this.rotations.set(multiply(rotationZ(0.28), rotationX(0.52)), 0);
    this.rotations.set(
      multiply(
        rotationY(Math.sin(state.time * 0.21) * 0.2 + state.pointerX * 0.1),
        rotationX(0.08),
      ),
      9,
    );
    this.rotations.set(rotationX(0.07), 18);
    this.rotations.set(rotationY(-0.2), 27);
    this.offsets.set(
      [
        lerp(0, halfWidth * 0.3, wide),
        lerp(halfHeight * 0.38, halfHeight * 0.26, wide),
        0,
        lerp(0, halfWidth * 0.42, wide),
        lerp(halfHeight * 0.3, halfHeight * 0.04, wide),
        0,
        0,
        lerp(-1.75, -1.6, wide),
        0,
        0,
        0,
        0,
      ],
      0,
    );

    const trails = state.trails && this.hdr;
    const fade = trails ? Math.pow(TRAIL, state.delta * 60) : 0;
    // Fewer particles are drawn brighter; narrow screens pack them closer, so dimmer.
    const gain =
      BASE_GAIN *
      Math.pow(REFERENCE_PARTICLES / count, 0.8) *
      Math.min(1.3, Math.max(0.3, aspect / 1.6)) *
      (trails ? 1 - fade : 1);
    const lower = Math.min(3, Math.max(0, Math.floor(state.scene)));
    const aperture = lerp(
      APERTURES[lower] ?? 0.05,
      APERTURES[Math.min(3, lower + 1)] ?? 0.05,
      fraction,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
    gl.viewport(0, 0, scene.width, scene.height);
    gl.bindVertexArray(this.quadArray);
    if (trails) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);
      gl.useProgram(this.fadeProgram.handle);
      gl.uniform1f(location(this.fadeProgram, "uFade"), fade);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }

    const particles = this.particleProgram;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(particles.handle);
    gl.uniformMatrix4fv(location(particles, "uProjection"), false, this.projection);
    gl.uniformMatrix4fv(location(particles, "uView"), false, this.view);
    gl.uniformMatrix3fv(location(particles, "uRotation[0]"), false, this.rotations);
    gl.uniform3fv(location(particles, "uOffset[0]"), this.offsets);
    gl.uniform4f(
      location(particles, "uSize"),
      vortexScale,
      graphScale,
      scene.height / (2 * TANGENT),
      Math.min(this.largestPoint, (80 * scene.height) / 900),
    );
    gl.uniform4f(
      location(particles, "uField"),
      TANGENT * aspect * 1.12,
      16,
      CAMERA_DISTANCE,
      state.pulse,
    );
    gl.uniform2f(
      location(particles, "uSprint"),
      2 * TANGENT * aspect * (CAMERA_DISTANCE + 7) * 1.1,
      halfHeight * 1.6,
    );
    gl.uniform4f(location(particles, "uState"), state.time, state.scene, state.intro, gain);
    gl.uniform4f(location(particles, "uMood"), state.alert, state.health, cameraDistance, aperture);
    gl.uniform3f(
      location(particles, "uPointer"),
      state.pointerX * halfWidth,
      state.pointerY * halfHeight,
      state.pointerForce,
    );
    gl.bindVertexArray(this.particleArray);
    gl.drawArrays(gl.POINTS, 0, count);

    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.quadArray);
    this.downsample(scene, nearA);
    this.blur(nearA, nearB, 1, 0);
    this.blur(nearB, nearA, 0, 1);
    this.downsample(nearA, wideA);
    this.blur(wideA, wideB, 1.5, 0);
    this.blur(wideB, wideA, 0, 1.5);

    const composite = this.compositeProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(composite.handle);
    this.bindTexture(0, scene.texture);
    this.bindTexture(1, nearA.texture);
    this.bindTexture(2, wideA.texture);
    gl.uniform1i(location(composite, "uSceneTexture"), 0);
    gl.uniform1i(location(composite, "uBloomNear"), 1);
    gl.uniform1i(location(composite, "uBloomWide"), 2);
    gl.uniform4f(
      location(composite, "uParams"),
      state.time,
      state.scene,
      this.hdr ? 1.05 : 1.5,
      aspect,
    );
    gl.uniform4f(location(composite, "uGrade"), state.alert, state.health, 1, 0.028);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    if (this.targets) this.deleteTargets(this.targets);
    this.targets = null;
    gl.deleteBuffer(this.particleBuffer);
    gl.deleteVertexArray(this.particleArray);
    gl.deleteVertexArray(this.quadArray);
    for (const program of [
      this.particleProgram,
      this.fadeProgram,
      this.downsampleProgram,
      this.blurProgram,
      this.compositeProgram,
    ]) {
      gl.deleteProgram(program.handle);
    }
  }

  private prepareTargets(): Targets {
    const { canvas, gl } = this;
    const scale = Math.min(window.devicePixelRatio || 1, 2) * (TIERS[this.tierIndex]?.scale ?? 1);
    let width = Math.max(8, Math.round(this.cssWidth * scale));
    let height = Math.max(8, Math.round(this.cssHeight * scale));
    const area = width * height;
    if (area > PIXEL_BUDGET) {
      const shrink = Math.sqrt(PIXEL_BUDGET / area);
      width = Math.round(width * shrink);
      height = Math.round(height * shrink);
    }
    if (this.targets && canvas.width === width && canvas.height === height) return this.targets;

    canvas.width = width;
    canvas.height = height;
    if (this.targets) this.deleteTargets(this.targets);
    const create = (targetWidth: number, targetHeight: number): Target => {
      const target = createTarget(
        gl,
        Math.max(2, targetWidth),
        Math.max(2, targetHeight),
        this.hdr,
      );
      if (!target) throw new Error("WebGL could not allocate a render target.");
      return target;
    };
    this.targets = {
      scene: create(width, height),
      nearA: create(width >> 2, height >> 2),
      nearB: create(width >> 2, height >> 2),
      wideA: create(width >> 3, height >> 3),
      wideB: create(width >> 3, height >> 3),
    };
    return this.targets;
  }

  private deleteTargets(targets: Targets): void {
    for (const target of Object.values(targets)) {
      this.gl.deleteFramebuffer(target.framebuffer);
      this.gl.deleteTexture(target.texture);
    }
  }

  private bindTexture(unit: number, texture: WebGLTexture): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
  }

  private downsample(source: Target, destination: Target): void {
    const gl = this.gl;
    const program = this.downsampleProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
    gl.viewport(0, 0, destination.width, destination.height);
    gl.useProgram(program.handle);
    this.bindTexture(0, source.texture);
    gl.uniform1i(location(program, "uSource"), 0);
    gl.uniform2f(location(program, "uTexel"), 1 / source.width, 1 / source.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private blur(source: Target, destination: Target, x: number, y: number): void {
    const gl = this.gl;
    const program = this.blurProgram;
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
    gl.viewport(0, 0, destination.width, destination.height);
    gl.useProgram(program.handle);
    this.bindTexture(0, source.texture);
    gl.uniform1i(location(program, "uSource"), 0);
    gl.uniform2f(location(program, "uDirection"), x / source.width, y / source.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private writeProjection(aspect: number): void {
    const near = 0.1;
    const far = 80;
    const focal = 1 / TANGENT;
    this.projection.fill(0);
    this.projection[0] = focal / aspect;
    this.projection[5] = focal;
    this.projection[10] = (far + near) / (near - far);
    this.projection[11] = -1;
    this.projection[14] = (2 * far * near) / (near - far);
  }

  /** View = translate(0, 0, -distance) * rotateX(pitch) * rotateY(yaw), column-major. */
  private writeView(distance: number, yaw: number, pitch: number): void {
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    this.view.set([
      cy,
      sp * sy,
      -cp * sy,
      0,
      0,
      cp,
      sp,
      0,
      sy,
      -sp * cy,
      cp * cy,
      0,
      0,
      0,
      -distance,
      1,
    ]);
  }
}
