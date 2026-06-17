import { Component } from './Component';
import { Entity } from './Entity';

type Ctor<T> = abstract new (...args: never[]) => T;

function hasDestroy(c: unknown): c is { destroy(): void } {
  return typeof (c as Record<string, unknown>).destroy === 'function';
}

function protoOf(ctor: Ctor<unknown>): object {
  return (ctor as unknown as { prototype: object }).prototype;
}

function isSubclassOf(derived: Ctor<unknown>, base: Ctor<unknown>): boolean {
  return (
    derived === base ||
    Object.prototype.isPrototypeOf.call(protoOf(base), protoOf(derived))
  );
}

// Returns intermediate constructors between `type` and Component (exclusive on both ends).
// Memoised per constructor since prototype chains never change.
const ancestorCache = new Map<Ctor<unknown>, readonly Ctor<unknown>[]>();
function getAncestors(type: Ctor<unknown>): readonly Ctor<unknown>[] {
  let cached = ancestorCache.get(type);
  if (!cached) {
    const arr: Ctor<unknown>[] = [];
    let proto = Object.getPrototypeOf(protoOf(type));
    while (
      proto &&
      proto !== Object.prototype &&
      proto !== Component.prototype
    ) {
      const ctor = (proto as { constructor: Ctor<unknown> }).constructor;
      arr.push(ctor);
      proto = Object.getPrototypeOf(proto);
    }
    ancestorCache.set(type, (cached = arr));
  }
  return cached;
}

export class World {
  private nextId = 0;
  private freed: Entity[] = [];
  private store = new Map<Ctor<unknown>, Map<Entity, unknown>>();
  // Separate index for abstract base types so get/query on exact types is unaffected.
  private ancestorIndex = new Map<Ctor<unknown>, Set<Entity>>();
  private version = 0;
  private queryCache = new Map<string, { result: Entity[]; ver: number }>();
  private ctorIds = new Map<Ctor<unknown>, number>();
  private nextCtorId = 0;

  private ctorId(ctor: Ctor<unknown>): number {
    let id = this.ctorIds.get(ctor);
    if (id === undefined) this.ctorIds.set(ctor, (id = this.nextCtorId++));
    return id;
  }

  create(): Entity {
    return this.freed.pop() ?? this.nextId++;
  }

  add<T extends Component>(entity: Entity, component: T): void {
    const type = component.constructor as Ctor<T>;
    if (!this.store.has(type)) this.store.set(type, new Map());
    this.store.get(type)!.set(entity, component);
    for (const ancestor of getAncestors(type)) {
      let set = this.ancestorIndex.get(ancestor);
      if (!set) this.ancestorIndex.set(ancestor, (set = new Set()));
      set.add(entity);
    }
    this.version++;
  }

  get<T>(entity: Entity, type: Ctor<T>): T | undefined {
    return this.store.get(type as Ctor<unknown>)?.get(entity) as T | undefined;
  }

  has<T>(entity: Entity, type: Ctor<T>): boolean {
    return this.store.get(type as Ctor<unknown>)?.has(entity) ?? false;
  }

  // Returns all components on `entity` that are instances of `type` or any subclass.
  getAll<T>(entity: Entity, type: Ctor<T>): T[] {
    const result: T[] = [];
    for (const [ctor, map] of this.store) {
      if (map.has(entity) && isSubclassOf(ctor, type as Ctor<unknown>)) {
        result.push(map.get(entity) as T);
      }
    }
    return result;
  }

  remove<T>(entity: Entity, type: Ctor<T>): void {
    const deleted = this.store.get(type as Ctor<unknown>)?.delete(entity);
    if (deleted) {
      for (const ancestor of getAncestors(type as Ctor<unknown>)) {
        if (!this.hasSubclassOf(entity, ancestor, type as Ctor<unknown>)) {
          this.ancestorIndex.get(ancestor)?.delete(entity);
        }
      }
      this.version++;
    }
  }

  destroy(entity: Entity): void {
    for (const map of this.store.values()) {
      const c = map.get(entity);
      if (c === undefined) continue;
      if (hasDestroy(c)) c.destroy();
      map.delete(entity);
    }
    for (const set of this.ancestorIndex.values()) set.delete(entity);
    this.freed.push(entity);
    this.version++;
  }

  destroyAll(): void {
    const seen = new Set<object>();
    for (const map of this.store.values()) {
      for (const component of map.values()) {
        if (component && !seen.has(component as object)) {
          seen.add(component as object);
          if (hasDestroy(component)) component.destroy();
        }
      }
    }
    this.store.clear();
    this.ancestorIndex.clear();
    this.freed.length = 0;
    this.nextId = 0;
    this.version++;
  }

  spawn(...components: Component[]): Entity {
    const entity = this.create();
    for (const c of components) this.add(entity, c);
    return entity;
  }

  query(...types: Ctor<unknown>[]): Entity[] {
    if (types.length === 0) return [];
    const key = types
      .map((t) => this.ctorId(t))
      .sort((a, b) => a - b)
      .join(',');
    const cached = this.queryCache.get(key);
    if (cached && cached.ver === this.version) return cached.result;

    const [first, ...rest] = types;
    const storeMap = this.store.get(first);
    const indexSet = this.ancestorIndex.get(first);
    let primary: Iterable<Entity>;
    if (storeMap && storeMap.size > 0 && indexSet && indexSet.size > 0) {
      const combined = new Set<Entity>(storeMap.keys());
      for (const e of indexSet) combined.add(e);
      primary = combined;
    } else if (storeMap && storeMap.size > 0) {
      primary = storeMap.keys();
    } else {
      primary = indexSet ?? [];
    }
    const result: Entity[] = [];
    for (const entity of primary) {
      if (rest.every((t) => this.entityHas(entity, t))) result.push(entity);
    }

    this.queryCache.set(key, { result, ver: this.version });
    return result;
  }

  private entityHas(entity: Entity, type: Ctor<unknown>): boolean {
    return (
      (this.store.get(type)?.has(entity) ?? false) ||
      (this.ancestorIndex.get(type)?.has(entity) ?? false)
    );
  }

  // Returns true if entity still has a component that is a subclass of `ancestor`,
  // ignoring `excluding` (the type that was just removed).
  private hasSubclassOf(
    entity: Entity,
    ancestor: Ctor<unknown>,
    excluding: Ctor<unknown>,
  ): boolean {
    for (const [ctor, map] of this.store) {
      if (ctor !== excluding && isSubclassOf(ctor, ancestor) && map.has(entity))
        return true;
    }
    return false;
  }
}
