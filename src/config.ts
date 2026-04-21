// Shadow
export const SHADOW_MAP_SIZE = 1024;
export const SHADOW_LIGHT_NEAR = 0.1;
export const SHADOW_LIGHT_FAR = 25;
export const SHADOW_ORTHO_EXTENT = 6;

// Light
export const LIGHT_POSITION = [5, 7.5, 5] as const;
export const LIGHT_DIRECTION = [1, 2, 1] as const; // normalized in code
export const LIGHT_INTENSITY = 0.8;
export const AMBIENT_INTENSITY = 0.2;

// Camera
export const CAMERA_POSITION = [0, 2, 4] as const;
export const CAMERA_FOV = Math.PI / 3;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 100;

// Input
export const ORBIT_SENSITIVITY = 0.005;
export const ORBIT_PITCH_CLAMP = 0.01;
export const ORBIT_ZOOM_SENSITIVITY = 0.001;
export const ORBIT_ZOOM_MIN = 1.5;
export const ORBIT_ZOOM_MAX = 20;
export const AUTO_ROTATE_SPEED = 0.3;

// Geometry
export const PLANE_HALF_EXTENT = 4;

// Checkerboard texture
export const CHECKER_SIZE = 8;
export const CHECKER_LIGHT = 255;
export const CHECKER_DARK = 64;
