/*
Based on https://github.com/skeeto/igloojs
*/

let gl = null;
const QUAD2 = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const GL = () => gl;

const Init = (canvas) => {
  const GetContext = (canvas) => {
    try {
      const gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true});
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.disable(gl.DEPTH_TEST);
      return gl;
    } catch (e) {
        throw new Error('Could not create WebGL context.');
    }
  };

  gl = GetContext(canvas);
  if (gl == null) {
    alert('Could not initialize WebGL!');
    throw 'no webgl';
  }
};

class Program {
    constructor(vertex, fragment) {
        this.program = gl.createProgram();
        this.vars = {};
        gl.attachShader(this.program,
            this.makeShader(gl.VERTEX_SHADER, vertex));
        gl.attachShader(this.program,
            this.makeShader(gl.FRAGMENT_SHADER, fragment));
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(this.program));
        }
    }
    makeShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            return shader;
        } else {
            throw new Error(gl.getShaderInfoLog(shader));
        }
    }
    use() {
        gl.useProgram(this.program);
        return this;
    }
    uniform(name, value, i=false) {
        if (!(name in this.vars)) {
            this.vars[name] = gl.getUniformLocation(this.program, name);
        }
        const v = this.vars[name];

        const isArray = (object) => {
            var name = Object.prototype.toString.apply(object, []),
                re = / (Float(32|64)|Int(16|32|8)|Uint(16|32|8(Clamped)?))?Array]$/;
            return re.exec(name) != null;
        };
        if (isArray(value)) {
            var method = 'uniform' + value.length + (i ? 'i' : 'f') + 'v';
            gl[method](v, value);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            if (i) {
                gl.uniform1i(v, value);
            } else {
                gl.uniform1f(v, value);
            }
        } else {
            throw new Error('Invalid uniform value: ' + value);
        }
        return this;
    }
    uniformi(name, value) {
        return this.uniform(name, value, true);
    }
    attrib(name, value, size) {
        if (!(name in this.vars)) {
            this.vars[name] = gl.getAttribLocation(this.program, name);
        }
        value.bind();
        gl.enableVertexAttribArray(this.vars[name]);
        gl.vertexAttribPointer(this.vars[name], size, gl.FLOAT,
                               false, 0, 0);
        return this;
    }
    draw() {
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}

class Buffer {
    constructor() {
        this.buffer = gl.createBuffer();
        this.target = gl.ARRAY_BUFFER;
        return this;
    }
    bind() {
        gl.bindBuffer(this.target, this.buffer);
    }
    update(data) {
        this.bind();
        gl.bufferData(this.target, data, gl.STATIC_DRAW);
        return this;
    }
}

class Texture {
    constructor() {
        this.texture = gl.createTexture();
        this.format = gl.RGBA;
        this.type = gl.UNSIGNED_BYTE;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return this;
    }
    bind(u) {
        if (u != null) {
            gl.activeTexture(gl.TEXTURE0 + u);
        }
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
    }
    blank(w, h) {
        this.bind();
        gl.texImage2D(gl.TEXTURE_2D, 0, this.format, w, h,
                      0, this.format, this.type, null);
        return this;
    }
    set(source, w, h) {
        this.bind();
        source = new Uint8Array(source);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0,
            w, h, this.format, this.type, source);
    }
}

class Framebuffer {
    constructor(buffer=gl.createFramebuffer()) {
        this.buffer = buffer;
    }
    bind() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.buffer);
    }
    attach(texture) {
        this.bind();
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
                                gl.TEXTURE_2D, texture.texture, 0);
    }
}

const Iglu = {
  GL: GL,
  QUAD2: QUAD2,
  Init: Init,
  Program: Program,
  Buffer: Buffer,
  Texture: Texture,
  Framebuffer: Framebuffer,
};

let Config = {
  min_depth: 8,
  min_expr_depth: 12,
  seed: fxrand() * 4.0,
};


const random = fxrand;
const choice = (from) => from[random() * from.length | 0];
// Float format and quantization.
const ff = (n) => {
  const res = (n * 10000.0 | 0) / 10000.0 + '';
  if (res.indexOf('.') === -1) {
    return res + '.0';
  }
  return res;
};

let VARS = ['z'];

class AConst {
  constructor(val) {
    this.val = val;
  }
  print() {
    return `${ff(this.val)}`;
  }
  dependencies() {
    return new Set([]);
  }
  depth() {
    return 1;
  }
  static random(depth=0) {
    return new AConst((random() - 0.5) * 2.0);
  }
}

class AVar {
  constructor(name) {
    this.name = name;
  }
  print() {
    return this.name;
  }
  dependencies() {
    return new Set([this.name]);
  }
  depth() {
    return 1;
  }
  static random(depth=0) {
    return new AVar(choice(VARS));
  }
  dependencies() {
    return new Set([this.name]);
  }
}

const ARITHMETIC_OPS = ['+', '-', '*', '/'];
class AOp {
  constructor(left_term, right_term, op) {
    this.left_term = left_term;
    this.right_term = right_term;
    this.op = op;
  }
  print() {
    return `(${this.left_term.print()} ${this.op} ${this.right_term.print()})`;
  }
  dependencies() {
    return new Set(
      [...this.left_term.dependencies(),
       ...this.right_term.dependencies()]);
  }
  depth() {
    return Math.max(
      this.left_term.depth(), this.right_term.depth()) + 1;
  }
  static random(depth=0) {
    return new AOp(
      AExpr.random(depth + 1),
      AExpr.random(depth + 1),
      choice(Object.values(ARITHMETIC_OPS)));
  }
}

class ASimpleOp {
  constructor(left_term, right_term, op) {
    this.left_term = left_term;
    this.right_term = right_term;
    this.op = op;
  }
  print() {
    return `(${this.left_term.print()} ${this.op} ${this.right_term.print()})`;
  }
  dependencies() {
    return new Set(
      [...this.left_term.dependencies(),
       ...this.right_term.dependencies()]);
  }
  depth() {
    return Math.max(
      this.left_term.depth(), this.right_term.depth()) + 1;
  }
  static random(depth=0) {
    return new AOp(
      ASimpleExpr.random(depth + 1),
      ASimpleExpr.random(depth + 1),
      choice(Object.values(ARITHMETIC_OPS)));
  }
  dependencies() {
    return new Set(
      [...this.left_term.dependencies(),
       ...this.right_term.dependencies()]);
  }
}

class AMath {
  constructor(func, args) {
    this.func = func;
    this.args = args;
    this.value = random() > 0.5 ? 1.0 : -1.0;
  }
  print() {
    const print_args = () => this.args.map(a =>  `${a.expr.print()}`);
    // const print_args = () => this.args.map(a =>
    //     `clamp(${a.expr.print()}, ${ff(a.clamp[0])}, ${ff(a.clamp[1])})`);
    const printed_args = print_args();

    // if (this.func === 'noise') {
    //   return `${this.func}(vec2(${printed_args[0]}, ${printed_args[1]}))`;
    // }
    if (this.func === 'dot') {
      return `${this.func}(vec2(${printed_args[0]}, ${printed_args[1]}),
        vec2(${printed_args[2]}, ${printed_args[3]}))`;
    }
    if (this.func === 'mod') {
      return `${this.func}(${printed_args[0]} > 0.0 ? ${printed_args[0]} : -(${printed_args[0]}),
      ${printed_args[1]} > 0.0 ? 
        max(${printed_args[1]}, 1.0)
        : -(
        max(${printed_args[1]}, 1.0)
        ))`;
    }
    if (this.func === 'mix') {
      return `${this.func}((${printed_args[0]}),
        (${printed_args[0]} + ${printed_args[1]}), ${printed_args[2]})`;
    }
    if (this.func === 'sin' || this.func === 'cos') {
      return `${this.func}(${ff(this.value)} * ${printed_args[0]})`;
    }

    return `${this.func}(${printed_args.join(', ')})`;
  }
  dependencies() {
    const deps = [];
    for (const arg of Object.values(this.args)) {
      deps.push(...arg.expr.dependencies());
    }
    return new Set(deps);
  }
  depth() {
    return Math.max(...
      this.args.map(a => a.expr.depth())) + 1;
  }
  static random(depth=0) {
    const funcs = {...FUNCS};
    const [func, info] = choice(Object.entries(funcs));

    const args = [];
    for (let i = 0; i < info.params; ++i) {
      const types = info.arg_types[i];

      const makeArg = (i) => {
        while (true) {
          const expr = choice(types).random(depth + 1);
          // Do not depend on t in mod second argument.
          // const deps = expr.dependencies();
          // if (func === 'mod' && i == 1 && 
          //     (deps.has('p') || deps.has('q')) ) {
          //   continue;
          // }
          // if (!deps.has('x') && !deps.has('y')) {
          //   continue;
          // }
          return expr;
        }
      }

      args.push({expr: makeArg()});
    }
    return new AMath(func, args);
  }
}

class AExpr {
  static random(depth=0, doMath=true) {
    const choices = [AConst, AVar, AOp];
    if (doMath) {
      choices.push(AMath);
    }
    if (depth < Config.min_expr_depth) {
      choices.push(AExpr);
    }
    return choice(choices).random(depth + 1);
  }
}

class ASimpleExpr {
  static random(depth=0) {
    const choices = [AVar];
    if (depth < 4) {
      choices.push(ASimpleOp);
    }
    return choice(choices).random(depth + 1);
  }
}

const BuildProgram = () => {
  VARS = ['x', 'y', 'p', 'q', 'tt', 'v0', 'v1', 'v0', 'v1', 'v0', 'v1'];
  const make = () => {
    while (true) {
      const expr = AExpr.random(0);
      if (expr.depth() < Config.min_depth) {
        continue;
      }
      return expr;
    }
  };

  const p0 = make();
  const p1 = make();
  const p2 = make();

  return `
    v0 = ${p0.print()};
    v1 = ${p1.print()};
    v2 = ${p2.print()};
  `;
};

const BuildColorProgram = () => {
  VARS = ['r', 'g', 'b'];
  const make = () => {
    while (true) {
      const expr = ASimpleExpr.random(0);
      if (expr.depth() < 3) {
        continue;
      }
      if (expr.dependencies().size < 1) {
        continue;
      }
      return expr;
    }
  };

  const r = make();
  const g = make();
  const b = make();

  return `
    r = ${r.print()};
    g = ${g.print()};
    b = ${b.print()};
  `;
}

const ALL_ARGS = [AVar, AConst, AExpr];

const FUNCS = {};
FUNCS['sin'] = {
  params: 1,
  arg_types: [ALL_ARGS],
};
// FUNCS['cos'] = {
//   params: 1,
//   arg_types: [ALL_ARGS],
// };
// FUNCS['tan'] = {
//   params: 1,
//   arg_types: [ALL_ARGS],
// };
// FUNCS['sign'] = {
//   params: 1,
//   arg_types: [ALL_ARGS],
// };
FUNCS['fract'] = {
  params: 1,
  arg_types: [ALL_ARGS],
};
// FUNCS['exp'] = {
//   params: 1,
//   arg_types: [ALL_ARGS],
// };
// FUNCS['atan'] = {
//   params: 2,
//   arg_types: [ALL_ARGS, ALL_ARGS],
// };
FUNCS['mod'] = {
  params: 2,
  arg_types: [ALL_ARGS, ALL_ARGS],
};
// FUNCS['min'] = {
//   params: 2,
//   arg_types: [ALL_ARGS, ALL_ARGS],
// };
// FUNCS['max'] = {
//   params: 2,
//   arg_types: [ALL_ARGS, ALL_ARGS],
// };
// FUNCS['pow'] = {
//   params: 2,
//   arg_types: [ALL_ARGS, ALL_ARGS],
// };
FUNCS['mix'] = {
  params: 3,
  arg_types: [ALL_ARGS, ALL_ARGS, ALL_ARGS],
};
FUNCS['dot'] = {
  params: 4,
  arg_types: [ALL_ARGS, ALL_ARGS, ALL_ARGS, ALL_ARGS],
};


const main = (program, colorProgram) => {
    const res = `#version 300 es
#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D state;
uniform vec2 scale;
uniform float t;
uniform float seed;
uniform float deltaX;
uniform float deltaY;
out vec4 fragColor;

const float PI = 3.14159;

vec2 rotate(vec2 v, float a) {
  float s = sin(a);
  float c = cos(a);
  mat2 m = mat2(c, -s, s, c);
  return m * v;
}

float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898 - seed, 4.1414 + seed))) * 43459.5453);
}

float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 u = fract( mod(p + vec2(0.5), vec2(1.0)) );
    u = u*u*(3.0-2.0*u);
    float res = mix(
        mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
        mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
    return res*res;
}

// All components are in the range [0…1], including hue.
vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

// All components are in the range [0…1], including hue.
vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 at = gl_FragCoord.xy / scale;
  vec4 self = texture(state, at);
  // at -= vec2(deltaX, deltaY);
  at -= vec2(0.5, 0.5);
  at *= 8.0;
  float tt = (t * 0.001);
  float x = at.x;
  float y = at.y;

  float p = atan(at.y, at.x) / PI * 2.0;
  float q = length(at);

  // float h0;
  // float h1;
  
  // float nw = texture(state, (gl_FragCoord.xy + vec2(-8.0, 0.0)) / scale).r;
  // float ne = texture(state, (gl_FragCoord.xy + vec2(8.0, 0.0)) / scale).r;
  // float nn = texture(state, (gl_FragCoord.xy + vec2(0.0, -8.0)) / scale).r;
  // float ns = texture(state, (gl_FragCoord.xy + vec2(0.0, 8.0)) / scale).r;

  float v0 = 0.0;
  float v1 = 0.0;
  float v2 = 0.0;

  ${program}

  v0 = clamp(v0, 0.0, 1.0);
  v1 = clamp(v1, 0.0, 1.0);
  v2 = clamp(v2, 0.0, 1.0);


  float r = 0.0;
  float g = 0.0;
  float b = 0.0;

  ${colorProgram}

  r = (v0 + v1 + v2) * 0.5;
  g = (v0 + v1 + v2) * 0.5;
  b = (v0 + v1 + v2) * 0.5;

  // float hue0 = (h0 + 0.5) * 0.5;
  // vec3 rgb0 = hsv2rgb(mix(
  //   vec3(hue0, 0.1, 0.1),
  //   vec3(hue0 - 0.1, 0.6, 0.8),
  //   v0));
  // float hue1 = h0 - h1;
  // vec3 rgb1 = hsv2rgb(mix(
  //   vec3(hue1, 0.1, 0.1),
  //   vec3(hue1 - 0.1, 0.6, 0.8),
  //   v1));

  // vec3 rgb = mix(rgb0, rgb1, 0.5);
  // r = rgb.r;
  // g = rgb.g;
  // b = rgb.b;

  vec3 rgb = vec3(r, g, b);

  // fragColor = vec4(self.rgb + rgb * 0.1, 1.0);
  fragColor = vec4(rgb, 1.0);

  // fragColor = vec4(
  //   smoothstep(0.0, 1.0, r),
  //   smoothstep(0.0, 1.0, g),
  //   smoothstep(0.0, 1.0, b),
  //   1.0);

}`;
  return res;
}

const quad = `#version 300 es
#ifdef GL_ES
precision highp float;
#endif
in vec2 quad;
void main() {
  gl_Position=vec4(quad,0,1.0);
}
`;

const copy = `#version 300 es
#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D state;
uniform vec2 scale;
uniform float time;
uniform float isTest;
uniform float deltaY; // Center of focus (0.0 to 1.0)
out vec4 fragColor;

// Tilt-shift parameters
const float focusWidth = 0.33;  // Width of the in-focus area
const float blurStrength = 4.0; // Maximum blur strength

float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 7.1414))) * 43459.5453);
}

// Simple box blur function
vec3 boxBlur(vec2 uv, float blurSize) {
    vec3 color = vec3(0.0);
    float total = 0.0;
    
    // Adjust sample count based on blur size
    int sampleCount = int(blurSize * 2.0) + 1;
    sampleCount = min(sampleCount, 16); // Limit samples for performance
    
    for (int x = -sampleCount; x <= sampleCount; x++) {
        for (int y = -sampleCount; y <= sampleCount; y++) {
            float distance = length(vec2(float(x), float(y)));
            if (distance > blurSize * 2.0) continue; // Skip samples outside the blur radius

            vec2 offset = vec2(float(x), float(y)) * blurSize / scale;
            vec2 samplePos = uv + offset; // Add slight randomness
            // When close to the edge, clamp the sample position
            samplePos = clamp(samplePos, vec2(0.0), vec2(1.0));
            
            // Only sample if within bounds
            if (samplePos.x >= 0.0 && samplePos.x <= 1.0 && 
                samplePos.y >= 0.0 && samplePos.y <= 1.0) {
                color += texture(state, samplePos).rgb;
                total += 1.0;
            }
        }
    }
    
    return color / total;
}

void main() {
    vec2 screenPosition = gl_FragCoord.xy / scale;
    
    // Calculate distance from focus center (vertical tilt-shift)
    // float distFromCenter = abs(screenPosition.y - deltaY);
    float distFromCenter = abs(screenPosition.y - 0.5);

    // Calculate blur amount based on distance from center
    float blurAmount = smoothstep(0.0, focusWidth, distFromCenter) * blurStrength;
    
    // Get color with blur
    vec3 texColor;
    // Apply blur
    texColor = boxBlur(screenPosition, blurAmount);
    
    // Add noise
    float r = (rand(screenPosition * 4.0) - 0.5) * 0.1;
    float g = (rand(screenPosition * 4.0 + vec2(0.011, 0.0)) - 0.5) * 0.1;
    float b = (rand(screenPosition * 4.0 + vec2(0.0, 0.07)) - 0.5) * 0.1;
    
    texColor.r += r;
    texColor.g += g;
    texColor.b += b;
    
    fragColor = vec4(texColor, 1.0);

    if (isTest > 0.0) {
        fragColor = vec4(texture(state, screenPosition).rgb, 1.0);
    }
}

`;

const Shader = {
  main: main,
  copy: copy,
  quad: quad,
};


// let gl = null;

class ShaderHandler {
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
    this.deltaX = fxrand() * 0.6 + 0.2
    this.deltaY = fxrand() * 0.6 + 0.2
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
  new(program, colorProgram) {
    this.programs.cellular = new Iglu.Program(
      Shader.quad, Shader.main(program, colorProgram));
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
      .uniform('deltaX', this.deltaX)
      .uniform('deltaY', this.deltaY)
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
      .uniform('deltaY', this.deltaY)
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


const testProgram = (program, colorProgram) => {
  let testCanvas = document.createElement('canvas');
  testCanvas.setAttribute('width', 128);
  testCanvas.setAttribute('height', 128);

  let testHandler = new ShaderHandler(testCanvas, /* isTest= */ true);
  testHandler.new(program, colorProgram);

  for (let i = 0; i < 256; ++i) {
    testHandler.step();
  }
  testHandler.draw();

  const pxTotal = testCanvas.width;

  let histogram = {};
  for (let i = 0; i < 4 * 4 * 4; ++i) {
    histogram[i] = 0;
  }

  const rgba = testHandler.get();
  testHandler.stop();
  testHandler = null;
  testCanvas = null;

  for (let i = 0; i < rgba.length; i += 4) {
    let ii = i / 4.0;
    let x = (ii % pxTotal);
    let y = (ii / pxTotal) | 0;

    const quant = (num, lim) => (num / (256 / lim)) | 0;
    const rgb = {
      r: quant(rgba[i], 4),
      g: quant(rgba[i + 1], 4),
      b: quant(rgba[i + 2], 4)};

    histogram[rgb.r * 16 + rgb.g * 4 + rgb.b] += 1;
  }

  // console.log(histogram[0] + histogram[63]);
  // console.log(histogram);

  let cnt = 0;
  for (const hist of Object.values(histogram)) {
    if (hist > 0) {
      cnt++;
    }
    if (hist > 10000) {
      return false;
    }
  }
  if (cnt < 2) {
    return false;
  }
  return true;
};

const testedProgram = () => {
  let tries = 0;
  while (tries < 100) {
    const program = BuildProgram();
    const colorProgram = BuildColorProgram();
    if (testProgram(program, colorProgram)) {
      return {program, colorProgram};
    }
    tries++;
  }
  console.log('gave up');
  return {program: BuildProgram(), colorProgram: BuildColorProgram()};
};

const start = () => {
  const {program, colorProgram} = testedProgram();
  console.log(program);
  console.log(colorProgram);
  console.log(fxhash);

  const canvas = document.getElementById('canvas');
  let handler = new ShaderHandler(canvas);
  handler.new(program, colorProgram);

  const play = () => {
    handler.timer = setInterval(() => {
        if (handler.t == 256) {
          // console.log('fxpreview');
          fxpreview();
          // clearInterval(handler.timer);
        }
        handler.step();
        handler.draw();
        handler.t++;
      }, 10);
  };

  const record = async () => {
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    for (let t = 0; t < 4096; ++t) {
      handler.step();
      handler.draw();
      handler.t += 8;

      var download = function() {
        var link = document.createElement('a');
        const tt = String(t).padStart(4, '0');
        link.download = `frame${tt}.png`;
        link.href = document.getElementById('canvas').toDataURL()
        link.click();
      };
      requestAnimationFrame(download);
      await sleep(500);
    }

  };

  setTimeout(() => {
    play();
    // record();
  }, 0);

  // const next = () => {
  //   location.reload();
  //   // program = testedProgram();
  //   // clearInterval(handler.timer);
  //   // handler.new(program);

  //   // setTimeout(() => {
  //   //   play();
  //   // }, 0);
  // }

  // window.addEventListener('touched', () => {
  //   next();
  // });
  // window.addEventListener('click', () => {
  //   next();
  // });

};

window.addEventListener('DOMContentLoaded', () => {
  start();

  const hash = `?hash=${fxhash}`;
  if (window.location.search !== hash) {
    window.location.search = hash;
  }
  document.getElementById('canvas').addEventListener('click', function() {

    const alphabet = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
    const hash = "oo" + Array(49).fill(0).map(_=>alphabet[(Math.random()*alphabet.length)|0]).join('')
    window.location.search = `?hash=${hash}`;
  });
});


// const download = function() {
//   var link = document.createElement('a');
//   link.download = `${window.fxhash}.png`;
//   link.href = document.getElementById('canvas').toDataURL()
//   link.click();
// };
// window.download = download;


// // Set timeout to reload after 10 seconds
// setTimeout(() => {
//   console.log('Reloading...');
//   window.location.reload();
// }, 5000);

