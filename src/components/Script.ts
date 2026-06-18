import { Component } from '../core/Component';
import type { Entity } from '../core/Entity';
import type { World } from '../core/World';

export interface ScriptBehavior {
  onStart?(entity: Entity, world: World): void;
  onUpdate(entity: Entity, world: World, dt: number): void;
  onDestroy?(entity: Entity, world: World): void;
}

export class Script extends Component {
  readonly behaviors: ScriptBehavior[];
  constructor(...behaviors: ScriptBehavior[]) {
    super();
    this.behaviors = behaviors;
  }
}
