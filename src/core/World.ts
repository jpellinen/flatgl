import { Entity } from './Entity';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctor<T> = new (...args: any[]) => T;

export class World {
  private nextId = 0;
  private store = new Map<Ctor<unknown>, Map<Entity, unknown>>();

  create(): Entity {
    return this.nextId++;
  }

  add<T extends object>(entity: Entity, component: T): void {
    const type = component.constructor as Ctor<T>;
    if (!this.store.has(type)) this.store.set(type, new Map());
    this.store.get(type)!.set(entity, component);
  }

  get<T>(entity: Entity, type: Ctor<T>): T | undefined {
    return this.store.get(type as Ctor<unknown>)?.get(entity) as T | undefined;
  }

  remove<T>(entity: Entity, type: Ctor<T>): void {
    this.store.get(type as Ctor<unknown>)?.delete(entity);
  }

  destroy(entity: Entity): void {
    for (const map of this.store.values()) map.delete(entity);
  }

  destroyAll(): void {
    const seen = new Set<object>();
    for (const store of this.store.values()) {
      for (const component of store.values()) {
        if (component && !seen.has(component as object)) {
          seen.add(component as object);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (typeof (component as any).destroy === 'function') (component as any).destroy();
        }
      }
    }
    this.store.clear();
  }

  query(...types: Ctor<unknown>[]): Entity[] {
    if (types.length === 0) return [];
    const [first, ...rest] = types;
    const primary = this.store.get(first);
    if (!primary) return [];
    const result: Entity[] = [];
    for (const entity of primary.keys()) {
      if (rest.every(t => this.store.get(t)?.has(entity))) result.push(entity);
    }
    return result;
  }
}
