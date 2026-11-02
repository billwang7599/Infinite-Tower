export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private readonly copy: (state: T) => T, private readonly maxSteps: number) {}

  record(state: T): void {
    this.past.push(this.copy(state));
    if (this.past.length > this.maxSteps) this.past.shift();
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
}
