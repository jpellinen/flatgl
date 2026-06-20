#version 300 es

precision highp float;

uniform mat4 u_invViewProjection;
uniform sampler2D u_skybox;

in vec2 v_clip;
out vec4 fragColor;

const float PI = 3.14159265359;

void main() {
  vec4 worldPos = u_invViewProjection * vec4(v_clip, 1.0, 1.0);
  vec3 ray = normalize(worldPos.xyz / worldPos.w);

  float u = atan(ray.z, ray.x) / (2.0 * PI) + 0.5;
  float v = asin(clamp(ray.y, -1.0, 1.0)) / PI + 0.5;

  fragColor = textureLod(u_skybox, vec2(u, v), 0.0);
}
