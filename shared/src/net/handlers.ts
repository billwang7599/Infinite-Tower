/** Helpers for routing messages by their `t` tag, with each handler getting the exact message type. */

/** The member of a message union with tag `T`. */
export type MsgOf<M extends { t: string }, T extends M["t"]> = Extract<M, { t: T }>;

/** One handler per message tag. `Ctx` is whatever the receiver needs (e.g. the server's Session). */
export type Handlers<M extends { t: string }, Ctx = void> = {
  [T in M["t"]]: (msg: MsgOf<M, T>, ctx: Ctx) => void;
};

/** Call the handler for `msg.t`. */
export function dispatch<M extends { t: string }, Ctx>(handlers: Handlers<M, Ctx>, msg: M, ctx: Ctx): void {
  (handlers[msg.t as M["t"]] as (m: M, c: Ctx) => void)(msg, ctx);
}
