import type { Entity } from '../core/Entity';
import type { System } from '../core/System';
import { World } from '../core/World';
import { ScriptBehaviour } from '../components/ScriptBehaviour';

export class ScriptSystem implements System {
  private started = new Set<ScriptBehaviour>();

  constructor(private world: World) {}

  update(dt: number): void {
    for (const entity of this.world.query(ScriptBehaviour)) {
      for (const b of this.world.getAll(entity, ScriptBehaviour)) {
        if (!this.started.has(b)) {
          this.started.add(b);
          b.onStart?.(entity, this.world);
        }
        b.onUpdate(entity, this.world, dt);
      }
    }
  }

  // Call instead of world.destroy() when you need onDestroy to fire.
  destroyEntity(entity: Entity): void {
    for (const b of this.world.getAll(entity, ScriptBehaviour)) {
      b.onDestroy?.(entity, this.world);
      this.started.delete(b);
    }
    this.world.destroy(entity);
  }

  // Fires onDestroy on all scripted entities, then destroys everything in the world.
  destroyAll(): void {
    for (const entity of this.world.query(ScriptBehaviour)) {
      for (const b of this.world.getAll(entity, ScriptBehaviour))
        b.onDestroy?.(entity, this.world);
    }
    this.started.clear();
    this.world.destroyAll();
  }
}
