// Core ECS
export { World } from './core/World';
export type { Entity } from './core/Entity';
export { Script } from './components/Script';
export type { ScriptBehaviour } from './components/Script';
export { Transform } from './components/Transform';

// Math
export { Vec3 } from './math/Vec3';
export { Mat4 } from './math/Mat4';

// Asset loading
export { ObjLoader } from './loaders/ObjLoader';
export type { ObjData } from './loaders/ObjLoader';

// Opaque rendering handles (returned by Engine factories)
export { Mesh } from './components/Mesh';
export { Material } from './components/Material';
export { Texture } from './renderer/Texture';

// Engine entry point + configuration types
export { Engine } from './engine/Engine';
export type {
  EngineOptions,
  LightOptions,
  PostProcessOptions,
  MaterialOptions,
} from './engine/Engine';
export { TopDownCamera } from './engine/TopDownCamera';
export type { TopDownCameraOptions } from './engine/TopDownCamera';
export type { InputSnapshot } from './engine/InputSystem';
