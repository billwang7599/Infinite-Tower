import type { KeyMap } from "../../settings/bindings.js";
import { keyName } from "../keyNames.js";

/** A line names a key as `{group.action}` (`{overworld.interact}`), written out as the player's own first key. */
export function withKeys(line: string, keys: KeyMap): string {
  return line.replace(/\{(\w+)\.(\w+)\}/g, (token, group: string, action: string) => {
    const bound = (keys as Partial<Record<string, Partial<Record<string, readonly string[]>>>>)[group]?.[action];
    if (!bound) return token;
    return bound[0] ? keyName(bound[0]) : "(unbound)";
  });
}
