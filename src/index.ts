// Core ECS
export { World } from './core/World';
export { Component } from './core/Component';
export type { Entity } from './core/Entity';
export { Script } from './components/Script';
export type { ScriptBehavior } from './components/Script';
export { Transform } from './components/Transform';

// Math
export { Vec3 } from './math/Vec3';
export { Mat4 } from './math/Mat4';
export { Quat } from './math/Quat';

// Asset loading
export { ObjLoader } from './loaders/ObjLoader';
export type { ObjData } from './loaders/ObjLoader';
export { GltfLoader } from './loaders/GltfLoader';
export type {
  GltfDocument,
  GltfPrimitive,
  GltfSkin,
} from './loaders/GltfLoader';

// Opaque rendering handles (returned by Engine factories)
export { Mesh } from './components/Mesh';
export { SkinnedMesh } from './components/SkinnedMesh';
export { Skeleton } from './components/Skeleton';
export { Animator } from './components/Animator';
export type {
  AnimationClip,
  AnimationTrack,
  AnimationPath,
} from './components/Animator';
export { Material } from './components/Material';
export { Texture } from './renderer/Texture';

// Engine entry point + configuration types
export { Engine } from './engine/Engine';
export type {
  EngineOptions,
  LightOptions,
  PostProcessOptions,
  FogOptions,
  MaterialOptions,
  CameraOptions,
  ParticleEmitterOptions,
} from './engine/Engine';
export { ParticleEmitter } from './components/ParticleEmitter';
export { Camera } from './engine/Camera';
export type { InputSnapshot } from './engine/InputManager';
