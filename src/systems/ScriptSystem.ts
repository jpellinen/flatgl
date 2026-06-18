import type { Entity } from '../core/Entity';
import type { System } from '../core/System';
import { World } from '../core/World';
import { Script, ScriptBehavior } from '../components/Script';

export class ScriptSystem implements System {
  private started = new Map<Entity, Set<ScriptBehavior>>();

  constructor(private world: World) {
    world.onDestroy((entity) => {
      const script = this.world.get(entity, Script);
      if (script) {
        for (const b of script.behaviors) b.onDestroy?.(entity, this.world);
        this.started.delete(entity);
      }
    });
  }

  update(dt: number): void {
    for (const entity of this.world.query(Script)) {
      const script = this.world.get(entity, Script)!;
      let startedForEntity = this.started.get(entity);
      for (const b of script.behaviors) {
        if (!startedForEntity?.has(b)) {
          if (!startedForEntity) {
            startedForEntity = new Set();
            this.started.set(entity, startedForEntity);
          }
          startedForEntity.add(b);
          b.onStart?.(entity, this.world);
        }
        b.onUpdate(entity, this.world, dt);
      }
    }
  }
}
