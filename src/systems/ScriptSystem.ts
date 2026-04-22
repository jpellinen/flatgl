import type { Entity } from '../core/Entity';
import type { System } from '../core/System';
import { World } from '../core/World';
import { Script } from '../components/Script';

export class ScriptSystem implements System {
  private started = new Set<Entity>();

  constructor(private world: World) {}

  update(dt: number): void {
    for (const entity of this.world.query(Script)) {
      const script = this.world.get(entity, Script)!;

      if (!this.started.has(entity)) {
        this.started.add(entity);
        for (const b of script.behaviours) b.onStart?.(entity, this.world);
      }

      for (const b of script.behaviours) b.onUpdate(entity, this.world, dt);
    }
  }

  // Call instead of world.destroy() when you need onDestroy to fire.
  destroyEntity(entity: Entity): void {
    const script = this.world.get(entity, Script);
    if (script) {
      for (const b of script.behaviours) b.onDestroy?.(entity, this.world);
    }
    this.started.delete(entity);
    this.world.destroy(entity);
  }

  // Call before world.destroyAll() if onDestroy callbacks are needed.
  destroyAll(): void {
    for (const entity of this.world.query(Script)) {
      const script = this.world.get(entity, Script)!;
      for (const b of script.behaviours) b.onDestroy?.(entity, this.world);
    }
    this.started.clear();
  }
}
