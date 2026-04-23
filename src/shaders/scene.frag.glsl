#version 300 es

precision mediump float;

uniform sampler2D u_texture;
uniform mediump sampler2DShadow u_shadowMap;
uniform vec3 u_lightDir;
uniform vec3 u_lightColor;
uniform float u_lightIntensity;
uniform float u_ambientIntensity;
uniform vec3 u_baseColor;
uniform vec3 u_cameraPos;
uniform float u_specular;
uniform float u_receiveShadows;

in vec3 v_normal;
in vec3 v_worldPos;
in vec2 v_uv;
in vec4 v_shadowCoord;

out vec4 fragColor;

// Poisson disk for soft shadows
const vec2 POISSON[9] = vec2[](
  vec2(-0.827, -0.400),
  vec2(-0.629,  0.418),
  vec2(-0.144, -0.817),
  vec2( 0.083,  0.474),
  vec2( 0.433, -0.351),
  vec2( 0.671,  0.286),
  vec2(-0.275,  0.103),
  vec2( 0.214, -0.037),
  vec2(-0.020,  0.940)
);

void main() {
  vec3 projCoords = v_shadowCoord.xyz / v_shadowCoord.w * 0.5 + 0.5;
  projCoords.z -= 0.005;

  float shadow;
  if (u_receiveShadows < 0.5 || projCoords.z > 1.0) {
    shadow = 1.0;
  } else {
    vec2 texelSize = vec2(3.0) / vec2(textureSize(u_shadowMap, 0));
    shadow = 0.0;
    for (int i = 0; i < 9; ++i)
      shadow += texture(u_shadowMap,
        vec3(projCoords.xy + POISSON[i] * texelSize, projCoords.z));
    shadow /= 9.0;
    shadow = 0.4 + 0.6 * shadow;
  }

  vec3 N = normalize(v_normal);
  vec3 L = normalize(u_lightDir);
  float diffuse = max(dot(N, L), 0.0);

  vec3 V = normalize(u_cameraPos - v_worldPos);
  vec3 H = normalize(L + V);
  float specular = pow(max(dot(N, H), 0.0), 32.0) * u_specular;

  vec3 light = u_ambientIntensity * vec3(0.45, 0.55, 1.0)
             + u_lightIntensity * (diffuse + specular) * u_lightColor * shadow;

  fragColor = texture(u_texture, v_uv) * vec4(u_baseColor, 1.0) * vec4(light, 1.0);
}
