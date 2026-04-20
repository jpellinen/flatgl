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

  float shadow;
  if (projCoords.z > 1.0) {
    shadow = 1.0;
  } else {
    vec2 texelSize = vec2(1.0) / vec2(textureSize(u_shadowMap, 0));
    shadow = 0.0;
    for (int x = -1; x <= 1; ++x)
      for (int y = -1; y <= 1; ++y)
        shadow += texture(u_shadowMap,
          vec3(projCoords.xy + vec2(x, y) * texelSize, projCoords.z));
    shadow /= 9.0;
  }
  float diffuse = max(dot(normalize(v_normal), normalize(u_lightDir)), 0.0);
  vec3 light = u_ambientIntensity * vec3(1.0) + u_lightIntensity * diffuse * u_lightColor * shadow;

  fragColor = texture(u_texture, v_uv) * vec4(u_baseColor, 1.0) * vec4(light, 1.0);
}
