#version 300 es

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec2 a_uv;
#ifdef USE_SKINNING
layout(location = 3) in uvec4 a_joints;
layout(location = 4) in vec4 a_weights;
#endif

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform mat4 u_lightSpaceMatrix;
#ifdef USE_SKINNING
uniform mat4 u_jointMatrices[64];
#endif

out vec3 v_normal;
out vec3 v_worldPos;
out vec2 v_uv;
out vec4 v_shadowCoord;

void main() {
#ifdef USE_SKINNING
  mat4 skin =
    a_weights.x * u_jointMatrices[a_joints.x] +
    a_weights.y * u_jointMatrices[a_joints.y] +
    a_weights.z * u_jointMatrices[a_joints.z] +
    a_weights.w * u_jointMatrices[a_joints.w];
  // mat3(skin) is correct only when bones have uniform scale; for non-uniform
  // scale use transpose(inverse(mat3(u_model * skin))) as the normal matrix.
  vec4 skinnedPos    = skin * vec4(a_position, 1.0);
  vec3 skinnedNormal = mat3(skin) * a_normal;
  vec4 worldPos = u_model * skinnedPos;
  v_normal      = mat3(u_model) * skinnedNormal;
#else
  vec4 worldPos = u_model * vec4(a_position, 1.0);
  v_normal      = mat3(u_model) * a_normal;
#endif
  gl_Position   = u_projection * u_view * worldPos;
  v_worldPos    = worldPos.xyz;
  v_uv          = a_uv;
  v_shadowCoord = u_lightSpaceMatrix * worldPos;
}
