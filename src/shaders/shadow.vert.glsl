#version 300 es

layout(location = 0) in vec3 a_position;
#ifdef USE_SKINNING
// locations 1 (normal) and 2 (uv) are present in the VAO but not needed here
layout(location = 3) in uvec4 a_joints;
layout(location = 4) in vec4 a_weights;
#endif

uniform mat4 u_lightSpaceMatrix;
uniform mat4 u_model;
#ifdef USE_SKINNING
uniform mat4 u_jointMatrices[64];
#endif

void main() {
#ifdef USE_SKINNING
  mat4 skin =
    a_weights.x * u_jointMatrices[a_joints.x] +
    a_weights.y * u_jointMatrices[a_joints.y] +
    a_weights.z * u_jointMatrices[a_joints.z] +
    a_weights.w * u_jointMatrices[a_joints.w];
  gl_Position = u_lightSpaceMatrix * u_model * skin * vec4(a_position, 1.0);
#else
  gl_Position = u_lightSpaceMatrix * u_model * vec4(a_position, 1.0);
#endif
}
