/** Routing messages by their `t` tag, each handler getting the exact message type. */

export type MsgOf<M extends { t: string }, T extends M["t"]> = Extract<M, { t: T }>;

/** One handler per message tag. `Ctx` is whatever the receiver needs. */
export type Handlers<M extends { t: string }, Ctx = void> = {
  [T in M["t"]]: (msg: MsgOf<M, T>, ctx: Ctx) => void;
};

export function dispatch<M extends { t: string }, Ctx>(handlers: Handlers<M, Ctx>, msg: M, ctx: Ctx): void {
  (handlers[msg.t as M["t"]] as (m: M, c: Ctx) => void)(msg, ctx);
}
