#version 300 es

precision mediump float;

const int   BLUR_SAMPLES     = 16;
const float VIGNETTE_SCALE   = 1.1;
const float MAX_BLUR_RADIUS  = 0.01;
const float GOLDEN_ANGLE     = 2.39996;  // ≈ 2π/φ, for spiral sampling

uniform sampler2D u_screen;
uniform float u_aspect;

in vec2 v_uv;

out vec4 fragColor;

void main() {
  vec2 d = (v_uv - 0.5) * vec2(u_aspect, 1.0);
  float t = clamp(length(d) * VIGNETTE_SCALE, 0.0, 1.0);
  float blurRadius = t * t * MAX_BLUR_RADIUS;

  vec3 col = vec3(0.0);
  for (int i = 0; i < BLUR_SAMPLES; i++) {
    float r = sqrt(float(i) + 0.5) / sqrt(float(BLUR_SAMPLES)) * blurRadius;
    float theta = float(i) * GOLDEN_ANGLE;
    col += texture(u_screen, v_uv + vec2(cos(theta), sin(theta)) * r).rgb;
  }
  fragColor = vec4(col / float(BLUR_SAMPLES), 1.0);
}
