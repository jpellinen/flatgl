import { Component } from '@/core/Component';
import type { Entity } from '@/core/Entity';
import type { World } from '@/core/World';

export abstract class ScriptBehaviour extends Component {
  abstract onUpdate(entity: Entity, world: World, dt: number): void;
  onStart?(entity: Entity, world: World): void;
  onDestroy?(entity: Entity, world: World): void;
}
