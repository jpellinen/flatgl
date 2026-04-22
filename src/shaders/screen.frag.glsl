#version 300 es

precision mediump float;

// Simplified FXAA (Timothy Lottes) + contrast/saturation grade
#define FXAA_SPAN_MAX    8.0
#define FXAA_REDUCE_MUL  (1.0 / 8.0)
#define FXAA_REDUCE_MIN  (1.0 / 128.0)

uniform sampler2D u_screen;
uniform vec2      u_texelSize;  // 1.0 / vec2(width, height)
uniform float     u_fxaa;       // 1.0 = enabled, 0.0 = disabled
uniform float     u_contrast;   // 1.0 = neutral; >1 darkens shadows
uniform float     u_saturation; // 1.0 = neutral; <1 desaturates

in vec2 v_uv;
out vec4 fragColor;

vec3 fxaa(sampler2D tex, vec2 uv, vec2 texel) {
  vec3 rgbNW = texture(tex, uv + vec2(-1.0, -1.0) * texel).rgb;
  vec3 rgbNE = texture(tex, uv + vec2( 1.0, -1.0) * texel).rgb;
  vec3 rgbSW = texture(tex, uv + vec2(-1.0,  1.0) * texel).rgb;
  vec3 rgbSE = texture(tex, uv + vec2( 1.0,  1.0) * texel).rgb;
  vec3 rgbM  = texture(tex, uv).rgb;

  const vec3 luma = vec3(0.299, 0.587, 0.114);
  float lumaNW = dot(rgbNW, luma);
  float lumaNE = dot(rgbNE, luma);
  float lumaSW = dot(rgbSW, luma);
  float lumaSE = dot(rgbSE, luma);
  float lumaM  = dot(rgbM,  luma);

  float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

  vec2 dir;
  dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
  dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

  float dirReduce = max(
    (lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL),
    FXAA_REDUCE_MIN
  );
  float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcpDirMin, vec2(-FXAA_SPAN_MAX), vec2(FXAA_SPAN_MAX)) * texel;

  vec3 rgbA = 0.5 * (
    texture(tex, uv + dir * (1.0/3.0 - 0.5)).rgb +
    texture(tex, uv + dir * (2.0/3.0 - 0.5)).rgb
  );
  vec3 rgbB = rgbA * 0.5 + 0.25 * (
    texture(tex, uv + dir * -0.5).rgb +
    texture(tex, uv + dir *  0.5).rgb
  );

  float lumaB = dot(rgbB, luma);
  return (lumaB < lumaMin || lumaB > lumaMax) ? rgbA : rgbB;
}

void main() {
  vec3 col = u_fxaa > 0.5
    ? fxaa(u_screen, v_uv, u_texelSize)
    : texture(u_screen, v_uv).rgb;

  // Contrast (gamma-style power curve; 1.0 = identity)
  col = pow(max(col, vec3(0.0)), vec3(u_contrast));

  // Saturation (lerp toward luma; 1.0 = identity)
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, u_saturation);

  fragColor = vec4(col, 1.0);
}
