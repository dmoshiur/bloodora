// ==================== Stateless cookie-backed session store ====================
// Why this exists:
//   This app runs as a Vercel serverless function. express-session's default
//   MemoryStore is wrong there for three reasons:
//     1. it prints "MemoryStore is not designed for a production environment"
//     2. it leaks memory and never scales past one process
//     3. every cold lambda starts empty, so logins vanish at random
//   Keeping the session in a signed, compressed cookie instead makes the session
//   stateless: there is nothing server-side to leak, no warning, and the login
//   survives across invocations and across regions.
//
// The cookie is HMAC-SHA256 signed with SESSION_SECRET, so a visitor can read
// their own session data but cannot forge or edit it.
import crypto from "crypto";
import zlib from "zlib";
import { AsyncLocalStorage } from "async_hooks";
import { Store } from "express-session";

const DEFAULT_COOKIE_NAME = "bloodora.session";

// Browsers reject cookies bigger than ~4096 bytes; leave room for the name,
// attributes and signature.
const MAX_COOKIE_BYTES = 3800;

// express-session calls store.get/set/destroy with only (sid, session) — no
// req/res. AsyncLocalStorage hands the store the request it belongs to.
const requestContext = new AsyncLocalStorage();

/**
 * Must be mounted BEFORE `app.use(session(...))` so the store can reach the
 * current req/res while express-session reads and writes the cookie.
 */
export function sessionContext(req, res, next) {
  requestContext.run({ req, res }, next);
}

/**
 * Mount AFTER express-session. Multipart parsers may invoke their completion
 * callback from a stream resource created outside AsyncLocalStorage. Re-enter
 * this request's context when express-session persists the response so a
 * successful registration/profile POST cannot silently lose its cookie.
 */
export function sessionResponseContext(req, res, next) {
  const context = { req, res };
  for (const method of ["end", "write", "writeHead"]) {
    const original = res[method];
    res[method] = function (...args) {
      return requestContext.run(context, () => original.apply(this, args));
    };
  }
  next();
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function verify(payload, signature, secret) {
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(String(signature || ""));
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

function encode(obj) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(obj), "utf8"), { level: 9 }).toString("base64url");
}

function decode(payload) {
  return JSON.parse(zlib.gunzipSync(Buffer.from(payload, "base64url")).toString("utf8"));
}

export class CookieSessionStore extends Store {
  /**
   * @param {object} opts
   * @param {string} opts.secret  HMAC key (use the same SESSION_SECRET as express-session)
   * @param {string} [opts.name]  cookie name
   * @param {boolean} [opts.secure]  send the Secure flag (production)
   */
  constructor({ secret, name = DEFAULT_COOKIE_NAME, secure = false } = {}) {
    super();
    if (!secret) throw new Error("CookieSessionStore requires a `secret`");
    this.secret = secret;
    this.name = name;
    this.secure = secure;
  }

  // ---------- internals ----------
  _ctx(what) {
    const ctx = requestContext.getStore();
    if (!ctx) {
      // Without the request we can neither read nor write the cookie. Warn once
      // so a silent "everyone is logged out" is diagnosable instead of magic.
      if (!CookieSessionStore._warnedNoContext) {
        CookieSessionStore._warnedNoContext = true;
        console.warn(
          `CookieSessionStore.${what}() ran outside a request — mount the sessionContext middleware ` +
          `before app.use(session(...)) in server.js.`
        );
      }
      return null;
    }
    return ctx;
  }

  _readCookie() {
    const raw = this._ctx("get")?.req?.headers?.cookie;
    if (!raw) return null;
    for (const part of raw.split(";")) {
      const idx = part.indexOf("=");
      if (idx === -1) continue;
      if (part.slice(0, idx).trim() !== this.name) continue;
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
    return null;
  }

  _setCookie(value, maxAgeMs) {
    const res = this._ctx("set")?.res;
    if (!res || res.headersSent) return;

    const attrs = [`${this.name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
    if (this.secure) attrs.push("Secure");
    if (maxAgeMs === 0) {
      // Explicitly expire it — an empty value alone would just be a blank session cookie.
      attrs.push("Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    } else if (maxAgeMs > 0) {
      attrs.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
      attrs.push(`Expires=${new Date(Date.now() + maxAgeMs).toUTCString()}`);
    }

    // Never clobber other Set-Cookie headers set by the same response.
    const existing = res.getHeader("Set-Cookie");
    const list = existing === undefined ? [] : Array.isArray(existing) ? existing.slice() : [existing];
    list.push(attrs.join("; "));
    res.setHeader("Set-Cookie", list);
  }

  /** Trim the biggest optional fields until the cookie fits the browser limit. */
  _serialize(session) {
    // Order matters: drop the pure cache first, then transient flash messages,
    // and only as a last resort the cart. Login state (`token`) is never dropped.
    const dropOrder = ["userCache", "flash", "cart"];
    const candidate = JSON.parse(JSON.stringify(session));

    let payload = encode(candidate);
    for (const key of dropOrder) {
      if (signedLength(payload, this.secret) <= MAX_COOKIE_BYTES) return payload;
      if (key in candidate) {
        delete candidate[key];
        payload = encode(candidate);
      }
    }
    return signedLength(payload, this.secret) <= MAX_COOKIE_BYTES ? payload : null;
  }

  // ---------- express-session Store API ----------
  get(sid, callback) {
    try {
      const raw = this._readCookie();
      if (!raw) return callback(null, null);
      const dot = raw.lastIndexOf(".");
      if (dot === -1) return callback(null, null);
      const payload = raw.slice(0, dot);
      const signature = raw.slice(dot + 1);
      if (!verify(payload, signature, this.secret)) return callback(null, null);
      const session = decode(payload);
      callback(null, session && typeof session === "object" ? session : null);
    } catch (e) {
      callback(e);
    }
  }

  set(sid, session, callback) {
    try {
      const payload = this._serialize(session);
      if (payload) {
        const maxAgeMs = session?.cookie?.maxAge;
        this._setCookie(`${payload}.${sign(payload, this.secret)}`, maxAgeMs);
      } else {
        // Still too large after trimming every optional field. Keep the request
        // working rather than throwing, but make it visible in the logs.
        console.warn("CookieSessionStore: session exceeds the cookie size limit and could not be saved.");
      }
      callback(null);
    } catch (e) {
      callback(e);
    }
  }

  destroy(sid, callback) {
    try {
      this._setCookie("", 0);
      callback(null);
    } catch (e) {
      callback(e);
    }
  }

  // Sessions live entirely in the cookie, so touch() only refreshes expiry.
  touch(sid, session, callback) {
    this.set(sid, session, callback);
  }
}

function signedLength(payload, secret) {
  return payload.length + 1 + sign(payload, secret).length;
}
