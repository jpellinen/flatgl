import type { Entity } from '../core/Entity';
import type { World } from '../core/World';

export interface ScriptBehaviour {
  onStart?(entity: Entity, world: World): void;
  onUpdate(entity: Entity, world: World, dt: number): void;
  onDestroy?(entity: Entity, world: World): void;
}

export class Script {
  readonly behaviours: ScriptBehaviour[];
  constructor(...behaviours: ScriptBehaviour[]) {
    this.behaviours = behaviours;
  }
}
