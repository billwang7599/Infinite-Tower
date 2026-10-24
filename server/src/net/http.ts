/** Small helpers for the JSON API (auth/routes.ts). */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiError } from "@infinite-tower/shared";

const MAX_BODY = 4 * 1024;

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * The request's JSON body. Requiring `application/json` also keeps other sites out: a cross-site form can't
 * send that content type without the browser asking this server first (CORS), and it says no.
 */
export async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!req.headers["content-type"]?.startsWith("application/json")) throw new HttpError(415, "Send JSON.");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY) throw new HttpError(413, "That request is too big.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "That isn't valid JSON.");
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...headers }).end(JSON.stringify(body));
}

export function sendError(res: ServerResponse, status: number, error: string): void {
  sendJson(res, status, { error } satisfies ApiError);
}
