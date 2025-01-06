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

export const Iglu = {
  GL: GL,
  QUAD2: QUAD2,
  Init: Init,
  Program: Program,
  Buffer: Buffer,
  Texture: Texture,
  Framebuffer: Framebuffer,
};
