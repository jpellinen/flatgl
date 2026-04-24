#version 300 es
precision mediump float;

uniform sampler2D u_texture;

in vec2 v_uv;
in vec3 v_color;
in float v_alpha;

out vec4 fragColor;

void main() {
  vec4 tex = texture(u_texture, v_uv);
  fragColor = vec4(v_color * tex.rgb, tex.a * v_alpha);
}
