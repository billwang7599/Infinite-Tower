export type LockAnswer = "grant" | "refuse" | "later" | "noRaw";

export function fakePointerLock(answer: LockAnswer = "grant") {
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), {
    pointerLockElement: null as unknown,
    exits: 0,
    exitPointerLock() {
      doc.exits++;
      lockChange(null);
    },
  });
  const lockChange = (element: unknown) => {
    doc.pointerLockElement = element;
    doc.dispatchEvent(new Event("pointerlockchange"));
  };
  const grant = () => lockChange(canvas);
  const canvas = Object.assign(new EventTarget(), {
    requests: [] as (PointerLockOptions | undefined)[],
    requestPointerLock(options?: PointerLockOptions): Promise<void> {
      canvas.requests.push(options);
      const refusal = answer === "refuse" ? "NotAllowedError"
        : answer === "noRaw" && options?.unadjustedMovement ? "NotSupportedError" : null;
      if (refusal) return Promise.reject(new DOMException("refused", refusal));
      if (answer !== "later") grant();
      return Promise.resolve();
    },
  });
  return {
    win: win as unknown as Window, doc, canvas, grant,
    escape: () => lockChange(null),
  };
}

export const settle = () => new Promise(setImmediate);
