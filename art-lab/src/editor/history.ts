export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(
    private readonly copy: (state: T) => T,
    private readonly maxSteps: number,
    private readonly sizeOf: (state: T) => number = () => 0,
    private readonly maxSize = Infinity,
  ) {}

  record(state: T): void {
    this.past.push(this.copy(state));
    while (this.past.length > this.maxSteps || this.size() > this.maxSize) this.past.shift();
    this.future = [];
  }

  undo(current: T): T | null {
    const back = this.past.pop();
    if (back === undefined) return null;
    this.future.push(this.copy(current));
    return back;
  }

  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(this.copy(current));
    return next;
  }

  private size(): number {
    return this.past.reduce((sum, s) => sum + this.sizeOf(s), 0);
  }
}
