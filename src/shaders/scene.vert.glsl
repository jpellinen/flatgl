#version 300 es

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat4 u_lightSpaceMatrix;

out vec3 v_normal;
out vec2 v_uv;
out vec4 v_shadowCoord;

void main() {
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  gl_Position = u_projection * u_view * worldPos;
  v_normal = mat3(u_model) * a_normal;
  v_uv = a_uv;
  v_shadowCoord = u_lightSpaceMatrix * worldPos;
}
