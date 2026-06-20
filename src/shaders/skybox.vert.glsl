#version 300 es

out vec2 v_clip;

void main() {
  float x = float((gl_VertexID & 1) << 2) - 1.0;
  float y = float((gl_VertexID & 2) << 1) - 1.0;
  gl_Position = vec4(x, y, 1.0, 1.0);
  v_clip = vec2(x, y);
}
