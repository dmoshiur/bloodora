/**
 * Vercel Express entry — thin wrapper around src/application.
 *
 * The root `app.ts` is the Express preset's single entrypoint; the rewrite
 * `/(.*) -> /app` sends every request to it. The file is intentionally tiny:
 * all logic lives in `src/application.ts`, so local `npm run dev` and Vercel
 * use the same code without a second api/ function.
 *
 * The wrapper mirrors the former duplicate wrapper's defensive init: if `createApp()`
 * throws (e.g. due to a malformed env var) the module still exports a
 * callable handler that returns JSON 500 instead of crashing the function
 * (which Vercel surfaces as "Invalid export must be a function" + timeout).
 */
import createApp from "./src/application.js";
import { logger } from "./src/utils/logger.js";

process.on("uncaughtException", (err) => {
  logger.error("uncaught exception (app, process kept alive)", { err: String((err as Error)?.stack ?? err) });
});
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection (app, process kept alive)", { reason: String((reason as Error)?.stack ?? reason) });
});

let app: ReturnType<typeof createApp> | null = null;
let initError: Error | null = null;
try {
  app = createApp();
} catch (err) {
  initError = err instanceof Error ? err : new Error(String(err));
  logger.error("app: failed to create app — serving init-error handler until restart", {
    err: String(initError.stack ?? initError.message),
  });
}

function handler(req: import("express").Request, res: import("express").Response, next?: import("express").NextFunction): void {
  if (initError || !app) {
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: "SERVER_INIT_FAILED",
          message: initError?.message ?? "Server initialization failed",
        },
      });
    }
    return;
  }
  (app as unknown as (req: unknown, res: unknown, next?: unknown) => void)(req, res, next);
}

export default handler;
export { handler };
