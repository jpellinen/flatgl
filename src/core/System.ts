export interface System {
  update?(dt?: number): void;
  render?(): void;
  destroy?(): void;
}
