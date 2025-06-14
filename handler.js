import { Config } from './config.js';
import { Iglu } from './iglu.js';
import { Shader } from './shader.js';

let gl = null;

export class ShaderHandler {
  constructor(canvas, isTest = false) {
    this.isTest = isTest;
    Iglu.Init(canvas);
    gl = Iglu.GL();

    this.canvas = canvas;
    this.scale = 1;
    const w = canvas.width, h = canvas.height;
    this.viewsize = new Float32Array([canvas.width, canvas.height]);
    this.statesize = new Float32Array([w / this.scale, h / this.scale]);
    this.timer = null;

    this.programs = {
      copy: new Iglu.Program(Shader.quad, Shader.copy),
    };
    this.buffers = {
      quad: new Iglu.Buffer().update(Iglu.QUAD2)
    };
    this.textures = {
      front: new Iglu.Texture().blank(w, h),
      back: new Iglu.Texture().blank(w, h)
    };
    this.framebuffers = {
      step: new Iglu.Framebuffer(),
      default: new Iglu.Framebuffer(null),
    };

    this.t = 0;
    this.seed = Config.seed;
  }
  set(state) {
    const rgba = new Uint8Array(this.statesize[0] * this.statesize[1] * 4);
    for (let i = 0; i < state.length; ++i) {
      let ii = i * 4;
      rgba[ii] = state[i] & 0xff;
      rgba[ii + 1] = (state[i] & 0xffff) >> 8;
      rgba[ii + 2] = (state[i] & 0xffffff) >> 16;
      rgba[ii + 3] = 255;
    }
    this.textures.front.set(rgba, this.statesize[0], this.statesize[1]);
    return this;
  }
  swap() {
    const tmp = this.textures.front;
    this.textures.front = this.textures.back;
    this.textures.back = tmp;
    return this;
  }
  resize(canvas) {
    this.canvas = canvas;
    this.viewsize = new Float32Array([canvas.width, canvas.height]);
  }
  new(program) {
    this.programs.cellular = new Iglu.Program(
      Shader.quad, Shader.main(program));
    this.t = 0;
    // this.set(new Uint32Array(this.statesize[0] * this.statesize[1]));
  }
  step() {
    this.framebuffers.step.attach(this.textures.back);
    this.textures.front.bind(0);
    gl.viewport(0, 0, this.statesize[0], this.statesize[1]);
    this.programs.cellular.use()
      .attrib('quad', this.buffers.quad, 2)
      .uniformi('state', 0)
      .uniform('scale', this.statesize)
      .uniform('t', this.t)
      .uniform('seed', this.seed)
      .draw(gl.TRIANGLE_STRIP, 4);
    this.swap();
    this.t++;
    return this;
  }
  draw() {
    this.framebuffers.default.bind();
    this.textures.front.bind(0);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.programs.copy.use()
      .attrib('quad', this.buffers.quad, 2)
      .uniformi('state', 0)
      .uniform('time', this.t)
      .uniform('scale', this.viewsize)
      .uniform('test', this.isTest ? 1.0 : 0.0)
      .draw(gl.TRIANGLE_STRIP, 4);
    return this;
  }
  get() {
    this.framebuffers.step.attach(this.textures.front);
    const rgba = new Uint8Array(this.statesize[0] * this.statesize[1] * 4);
    gl.readPixels(0, 0, this.statesize[0], this.statesize[1], gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    return rgba;
  }
  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer);
    }
    // Bug?
    gl.getExtension('WEBGL_lose_context').loseContext();
  }
}
