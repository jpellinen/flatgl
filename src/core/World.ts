import { Component } from './Component';
import { Entity } from './Entity';

type Ctor<T> = abstract new (...args: never[]) => T;

export class World {
  private nextId = 0;
  private freed: Entity[] = [];
  private store = new Map<Ctor<unknown>, Map<Entity, Component>>();
  private version = 0;
  private queryCache = new Map<string, { result: Entity[]; ver: number }>();
  private ctorIds = new Map<Ctor<unknown>, number>();
  private nextCtorId = 0;
  private destroyHooks: ((entity: Entity) => void)[] = [];

  private ctorId(ctor: Ctor<unknown>): number {
    let id = this.ctorIds.get(ctor);
    if (id === undefined) this.ctorIds.set(ctor, (id = this.nextCtorId++));
    return id;
  }

  onDestroy(hook: (entity: Entity) => void): void {
    this.destroyHooks.push(hook);
  }

  create(): Entity {
    return this.freed.pop() ?? this.nextId++;
  }

  add<T extends Component>(entity: Entity, component: T): void {
    const type = component.constructor as Ctor<T>;
    if (!this.store.has(type)) this.store.set(type, new Map());
    this.store.get(type)!.set(entity, component);
    this.version++;
  }

  get<T>(entity: Entity, type: Ctor<T>): T | undefined {
    return this.store.get(type as Ctor<unknown>)?.get(entity) as T | undefined;
  }

  has<T>(entity: Entity, type: Ctor<T>): boolean {
    return this.store.get(type as Ctor<unknown>)?.has(entity) ?? false;
  }

  remove<T>(entity: Entity, type: Ctor<T>): void {
    if (this.store.get(type as Ctor<unknown>)?.delete(entity)) this.version++;
  }

  destroy(entity: Entity): void {
    for (const hook of this.destroyHooks) hook(entity);
    for (const map of this.store.values()) {
      const c = map.get(entity);
      if (c === undefined) continue;
      c.destroy?.();
      map.delete(entity);
    }
    this.freed.push(entity);
    this.version++;
  }

  destroyAll(): void {
    if (this.destroyHooks.length > 0) {
      const entities = new Set<Entity>();
      for (const map of this.store.values()) {
        for (const entity of map.keys()) entities.add(entity);
      }
      for (const entity of entities) {
        for (const hook of this.destroyHooks) hook(entity);
      }
    }
    const seen = new Set<object>();
    for (const map of this.store.values()) {
      for (const component of map.values()) {
        if (component && !seen.has(component as object)) {
          seen.add(component as object);
          component.destroy?.();
        }
      }
    }
    this.store.clear();
    this.freed.length = 0;
    this.nextId = 0;
    this.version++;
  }

  query(...types: Ctor<unknown>[]): Entity[] {
    if (types.length === 0) return [];
    let key: string;
    if (types.length === 1) {
      key = String(this.ctorId(types[0]));
    } else if (types.length === 2) {
      const a = this.ctorId(types[0]);
      const b = this.ctorId(types[1]);
      key = a <= b ? `${a},${b}` : `${b},${a}`;
    } else {
      key = types
        .map((t) => this.ctorId(t))
        .sort((a, b) => a - b)
        .join(',');
    }
    const cached = this.queryCache.get(key);
    if (cached && cached.ver === this.version) return cached.result;

    const [first, ...rest] = types;
    const primary = this.store.get(first);
    const result: Entity[] = [];
    if (primary) {
      for (const entity of primary.keys()) {
        if (rest.every((t) => this.store.get(t)?.has(entity)))
          result.push(entity);
      }
    }

    this.queryCache.set(key, { result, ver: this.version });
    return result;
  }
}
