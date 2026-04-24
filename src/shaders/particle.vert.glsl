#version 300 es

layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec3 a_inst_pos;
layout(location = 2) in float a_inst_size;
layout(location = 3) in vec3 a_inst_color;
layout(location = 4) in float a_inst_alpha;
layout(location = 5) in float a_inst_rotation;

uniform mat4 u_view;
uniform mat4 u_projection;

out vec2 v_uv;
out vec3 v_color;
out float v_alpha;

void main() {
  float cosR = cos(a_inst_rotation);
  float sinR = sin(a_inst_rotation);
  vec2 rotCorner = vec2(
    a_corner.x * cosR - a_corner.y * sinR,
    a_corner.x * sinR + a_corner.y * cosR
  );
  vec3 right = vec3(u_view[0][0], u_view[1][0], u_view[2][0]);
  vec3 up    = vec3(u_view[0][1], u_view[1][1], u_view[2][1]);
  vec3 world = a_inst_pos + (right * rotCorner.x + up * rotCorner.y) * a_inst_size;
  gl_Position = u_projection * u_view * vec4(world, 1.0);
  v_uv    = a_corner * 0.5 + 0.5;
  v_color = a_inst_color;
  v_alpha = a_inst_alpha;
}
