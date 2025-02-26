import { Config } from './config.js'; 

const main = (program) => `#version 300 es
#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D state;
uniform vec2 scale;
uniform float t;
uniform float seed;
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
  vec4 self = texture(state, gl_FragCoord.xy / scale);
  vec2 at = (gl_FragCoord.xy) / scale;
  at -= vec2(0.5);
  at *= 2.0 * PI;

  float x = at.x;
  float y = at.y;

  float p = atan(at.y, at.x) / PI * 2.0;
  float q = length(at);

  float tt = (t * 0.001);

  // v0 = (dot(vec2(-0.0204, q),
  //         vec2(tt, ((((tt - -0.5745) - mix(fract(0.6685),
  //         fract(0.6685 + atan(0.3279, -0.4514)), x)) - (((max(tt, q) + ((((0.6357 / (tt / (tan(y) * q))) * ((atan(0.9587, (-0.822 * (tt / dot(vec2(tt, -0.6979),
  //         vec2(tt, tt))))) * -0.9273) / (cos(-1.0 * (y * p)) - (-0.7007 / y)))) - 0.1138) - y)) * tt) + pow(0.7753, x))) / p))) / -0.1262);

  // LLM thought this is the simplification of the above expression
  // v0 = dot(vec2(-0.0204, q), vec2(tt, 1.0/p * (tt + pow(0.7753, x)))) / -0.1262;
  
  float h = 0.0;
  float s = 0.0;
  float v = 0.0;
  float r = 0.0;
  float g = 0.0;
  float b = 0.0;
  ${program}

  self.rgb = hsv2rgb(vec3(h, s, v));
  self.rgb += vec3(r, g, b);

  self.rgb *= vec3(0.15);
  fragColor = vec4(self);
}`;

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
out vec4 fragColor;

float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 7.1414))) * 43459.5453);
}

void main() {
  vec2 screenPosition = (gl_FragCoord.xy) / scale;
  vec3 texColor = texture(state, screenPosition).rgb;

  float r = (rand(screenPosition * vec2(4.0, 1.0)) - 0.5) * 0.25;
  float g = (rand(screenPosition * vec2(1.0, 4.0)) - 0.5) * 0.25;
  float b = (rand(screenPosition * vec2(4.0, 4.0)) - 0.5) * 0.25;

  // texColor = 0.2 + pow(texColor, vec3(2.0));

  // texColor = vec3((texColor.r + texColor.g + texColor.b) / 2.0);
  texColor.r += r;
  texColor.g += g;
  texColor.b += b;
  fragColor = vec4(texColor, 1.0);
}
`;

export const Shader = {
  main: main,
  copy: copy,
  quad: quad,
};
