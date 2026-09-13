import pino from "pino";

// No pino-pretty here on purpose: pino's `transport` option spawns a worker thread that Next.js's
// dev bundler can't resolve (logs still flush, no request is affected, but every request prints a
// MODULE_NOT_FOUND/"worker thread exited" error); importing pino-pretty directly instead breaks
// the Edge middleware bundle (`src/auth.ts` -> this file), since pino-pretty pulls in `node:stream`,
// which the Edge runtime doesn't support. Plain JSON logs in dev avoid both problems.
export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
