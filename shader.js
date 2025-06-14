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
  vec2 at = gl_FragCoord.xy / scale;
  vec4 self = texture(state, at);
  at -= vec2(0.3, 0.2);
  at *= 8.0;
  float tt = (t * 0.001);
  float x = at.x;
  float y = at.y;

  float p = atan(at.y, at.x) / PI * 2.0;
  float q = length(at);
  
  float v0 = 0.0;

  ${program}

  float v1 = clamp(v0, 0.0, 1.0);
  float v2 = clamp(v0, -1.0, 1.0);
  float v3 = clamp(v0, -2.0, 2.0);
  float v4 = clamp(v0, -4.0, 4.0);
  
  fragColor = vec4(
    v1,
    v2 * 0.5 + 0.5,
    v3 * 0.25 + 0.5, 1.0);
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
uniform float isTest;
out vec4 fragColor;

// Tilt-shift parameters
const float focusCenter = 0.5; // Center of focus (0.0 to 1.0)
const float focusWidth = 0.33;  // Width of the in-focus area
const float blurStrength = 8.0; // Maximum blur strength

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
    float distFromCenter = abs(screenPosition.y - focusCenter);

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

export const Shader = {
  main: main,
  copy: copy,
  quad: quad,
};
