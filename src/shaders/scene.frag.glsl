#version 300 es

precision mediump float;

uniform sampler2D u_texture;
uniform mediump sampler2DShadow u_shadowMap;
uniform vec3 u_lightDir;
uniform vec3 u_lightColor;
uniform float u_lightIntensity;
uniform float u_ambientIntensity;
uniform vec3 u_baseColor;

in vec3 v_normal;
in vec2 v_uv;
in vec4 v_shadowCoord;

out vec4 fragColor;

void main() {
  vec3 projCoords = v_shadowCoord.xyz / v_shadowCoord.w * 0.5 + 0.5;
  projCoords.z -= 0.005;

  float shadow = (projCoords.z <= 1.0) ? texture(u_shadowMap, projCoords) : 1.0;
  float diffuse = max(dot(normalize(v_normal), normalize(u_lightDir)), 0.0);
  vec3 light = u_ambientIntensity * vec3(1.0) + u_lightIntensity * diffuse * u_lightColor * shadow;

  fragColor = texture(u_texture, v_uv) * vec4(u_baseColor, 1.0) * vec4(light, 1.0);
}
