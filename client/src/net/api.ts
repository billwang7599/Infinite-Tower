import type { AccountInfo, ApiError, Credentials, GameServer } from "@infinite-tower/shared";

export const SERVER_UNREACHABLE =
  "Can't reach the game server. Start everything with `npm run dev` (server + client).";

/** null when not logged in. Throws if the server can't be reached. */
export async function currentAccount(): Promise<AccountInfo | null> {
  const res = await request("GET", "/api/me");
  return res.status === 401 ? null : parse<AccountInfo>(res);
}

export const logIn = (credentials: Credentials) => request("POST", "/api/login", credentials).then(parse<AccountInfo>);
export const register = (credentials: Credentials) => request("POST", "/api/register", credentials).then(parse<AccountInfo>);

export const listServers = () => request("GET", "/api/servers").then(parse<GameServer[]>);

export async function logOut(): Promise<void> {
  const res = await request("POST", "/api/logout");
  if (!res.ok) await parse(res);
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(path, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(SERVER_UNREACHABLE);
  }
}

/** Anything that isn't our JSON (Vite's proxy answering for a stopped server, say) counts as unreachable. */
async function parse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (res.ok && data) return data as T;
  const error = data && typeof data === "object" && "error" in data ? data.error : null;
  throw new Error(error ?? SERVER_UNREACHABLE);
}
