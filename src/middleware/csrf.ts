import crypto from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "../utils/errors.js";

// Session declaration is merged with the auth middleware's SessionData fields.
declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
  }
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

function sameOrigin(req: Request): boolean {
  const origin = req.headers.origin;
  if (origin) {
    try {
      return (
        new URL(origin).host.toLowerCase() === req.get("host")?.toLowerCase()
      );
    } catch {
      return false;
    }
  }
  const fetchSite = req.headers["sec-fetch-site"];
  if (fetchSite) return String(fetchSite).toLowerCase() === "same-origin";
  return false;
}

/**
 * True when the browser presented a session cookie but no usable session was
 * loaded — i.e. expired/destroyed session, a session store that failed open,
 * or a secret mismatch across instances. Distinct from a forged token so the
 * client can show a truthful "reload" state instead of "wrong password"-style
 * security messaging.
 */
function hasSessionCookie(req: Request): boolean {
  return /(?:^|;\s*)connect\.sid=/.test(req.headers.cookie ?? "");
}

function validToken(req: Request, expected: string): boolean {
  const supplied = String(
    req.headers["x-csrf-token"] ||
      (req.body as Record<string, unknown> | undefined)?._csrf ||
      "",
  );
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requiresCheck(req: Request): boolean {
  if (SAFE.has(req.method)) return false;
  if (!req.originalUrl.startsWith("/api/")) return true;
  // Bearer credentials are explicit, not ambient. Cookie-based API calls and
  // unauthenticated same-origin cost-incurring endpoints still need protection.
  if (req.headers.authorization?.toLowerCase().startsWith("bearer "))
    return false;
  // express-session creates a req.session object even for stateless API calls;
  // its presence alone is not cookie authentication. Only an ambient browser
  // cookie opts an Authorization-free API request into CSRF validation.
  return Boolean(req.headers.cookie);
}

/**
 * Synchronizer tokens for HTML forms plus Origin/Fetch-Site validation. Standard
 * multipart forms cannot be parsed this early, so their same-origin proof is
 * mandatory; URL-encoded/JSON requests must present the per-session token too.
 */
export const csrfProtection: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.session) return next();
  const isWebPage = !req.originalUrl.startsWith("/api/");
  let token = req.session.csrfToken;
  if (!token && isWebPage && SAFE.has(req.method)) {
    token = crypto.randomBytes(32).toString("base64url");
    req.session.csrfToken = token;
  }
  res.locals.csrfToken = token || "";

  if (isWebPage && token) {
    const originalSend = res.send.bind(res);
    res.send = ((body: unknown) => {
      if (
        typeof body === "string" &&
        /text\/html/i.test(String(res.getHeader("Content-Type") || "text/html"))
      ) {
        const hidden = `<input type="hidden" name="_csrf" value="${token}">`;
        body = body.replace(
          /<form\b[^>]*\bmethod\s*=\s*["']?post\b[^>]*>/gi,
          (form) => `${form}${hidden}`,
        );
      }
      return originalSend(body as never);
    }) as Response["send"];
  }

  if (!requiresCheck(req)) return next();
  if (!sameOrigin(req))
    return next(
      new ApiError(
        403,
        "CSRF_ORIGIN_REJECTED",
        "The request origin could not be verified. Reload the page and try again.",
      ),
    );
  const multipart = String(req.headers["content-type"] || "")
    .toLowerCase()
    .startsWith("multipart/form-data");
  if (!multipart && (!token || !validToken(req, token))) {
    if (!token && hasSessionCookie(req)) {
      // The browser sent connect.sid but no session could be loaded for it.
      // CSRF stays fully enabled; the distinction exists so the operator and
      // the user can tell "session store / instance mismatch" apart from a
      // tampered token, which is otherwise impossible from the error alone.
      return next(
        new ApiError(
          403,
          "CSRF_SESSION_MISSING",
          "Your session could not be validated. Reload the page and try again.",
        ),
      );
    }
    return next(
      new ApiError(
        403,
        "CSRF_TOKEN_INVALID",
        "The form expired or its security token is invalid. Reload and try again.",
      ),
    );
  }
  next();
};
