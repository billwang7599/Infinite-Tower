/** Every API error is an `ApiError`. Routes throw HttpError; body checks and Fastify's errors get a sentence here. */
import type { ApiError } from "@infinite-tower/shared";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";

export class HttpError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

const SEND_JSON = "Send JSON.";
const FASTIFY_SENTENCES: Record<string, string> = {
  FST_ERR_CTP_INVALID_MEDIA_TYPE: SEND_JSON,
  FST_ERR_CTP_BODY_TOO_LARGE: "That request is too big.",
  FST_ERR_CTP_INVALID_JSON_BODY: "That isn't valid JSON.",
  FST_ERR_CTP_EMPTY_JSON_BODY: "That isn't valid JSON.",
};

export function onError(err: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  if (hasZodFastifySchemaValidationErrors(err)) {
    // No body at all: the request wasn't JSON. Otherwise the first rule the body breaks is the message.
    if (req.body === undefined) return sendError(reply, 415, SEND_JSON);
    return sendError(reply, 400, err.validation[0]?.message ?? "That request isn't valid.");
  }
  const status = err.statusCode ?? 500;
  if (status < 500) {
    const sentence = err instanceof HttpError ? err.message : FASTIFY_SENTENCES[err.code] ?? err.message;
    return sendError(reply, status, sentence);
  }
  console.error(`[api] ${req.method} ${req.url} failed`, err);
  return sendError(reply, 500, "Something went wrong on the server. Try again.");
}

export function onNotFound(req: FastifyRequest, reply: FastifyReply) {
  if (req.url.startsWith("/api/")) return sendError(reply, 404, "No such API route.");
  return reply.code(404).type("text/plain").send("Not found. In development run `npm run dev` and open :5173.");
}

const sendError = (reply: FastifyReply, status: number, error: string) =>
  reply.code(status).send({ error } satisfies ApiError);
