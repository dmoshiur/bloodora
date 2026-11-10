// In-process application gateway for the EJS presentation layer.
//
// There is deliberately no BACKEND_URL and no fetch() to our own deployment.
// SSR handlers keep their original API-shaped contracts, but dispatch directly
// to the mounted Express domain router (controllers -> services -> repositories)
// inside this process. Browser clients still use the public /api routes.
import { AsyncLocalStorage } from "node:async_hooks";
import apiRouter from "../routes/index.js";
import { ensureDbReady } from "../db/init.js";

const requestContext = new AsyncLocalStorage();

export function apiPageBudget(req, res, next) {
  requestContext.run({ req, res, at: Date.now() + 8000 }, next);
}

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.type = data?.type || data?.code || data?.error?.code;
  }
}

function apiMessage(data, status) {
  return data?.message || data?.error?.message || `Request failed (${status})`;
}

async function multipartInput(formData) {
  const body = {};
  const files = {};
  let file;
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") {
      body[name] = value;
      continue;
    }
    const data = Buffer.from(await value.arrayBuffer());
    const upload = {
      fieldname: name,
      originalname: value.name || "upload.bin",
      encoding: "7bit",
      mimetype: value.type || "application/octet-stream",
      size: data.length,
      buffer: data,
    };
    (files[name] ||= []).push(upload);
    file ||= upload;
  }
  return { body, files: Object.keys(files).length ? files : undefined, file };
}

/** Build the small Express response surface used by JSON controllers. */
function captureResponse(parent, settle) {
  const headers = new Map();
  let payload;
  let statusCode = 200;
  const response = Object.create(parent);
  const finish = (body) => {
    payload = body;
    settle({ status: statusCode, body, headers });
    return response;
  };
  Object.defineProperties(response, {
    statusCode: { get: () => statusCode, set: (value) => { statusCode = value; }, configurable: true },
    headersSent: { get: () => payload !== undefined, configurable: true },
    writableEnded: { get: () => payload !== undefined, configurable: true },
  });
  response.status = (code) => { statusCode = code; return response; };
  response.json = (body) => finish(body);
  response.send = (body) => {
    if (typeof body === "string") {
      try { return finish(JSON.parse(body)); } catch { return finish({ message: body }); }
    }
    return finish(body);
  };
  response.end = (body) => finish(body ? { message: String(body) } : {});
  response.set = response.header = (name, value) => {
    if (typeof name === "object") for (const [k, v] of Object.entries(name)) headers.set(k.toLowerCase(), v);
    else headers.set(String(name).toLowerCase(), value);
    return response;
  };
  response.get = (name) => headers.get(String(name).toLowerCase());
  response.setHeader = (name, value) => { headers.set(String(name).toLowerCase(), value); };
  response.getHeader = (name) => headers.get(String(name).toLowerCase());
  response.removeHeader = (name) => { headers.delete(String(name).toLowerCase()); };
  response.append = (name, value) => {
    const key = String(name).toLowerCase();
    const previous = headers.get(key);
    headers.set(key, previous === undefined ? value : [].concat(previous, value));
    return response;
  };
  response.cookie = (name, value, options = {}) => response.append("Set-Cookie", `${name}=${encodeURIComponent(value)}; Path=${options.path || "/"}; HttpOnly; SameSite=Lax`);
  response.clearCookie = (name, options = {}) => response.append("Set-Cookie", `${name}=; Path=${options.path || "/"}; Max-Age=0; HttpOnly; SameSite=Lax`);
  response.type = () => response;
  response.location = () => response;
  response.redirect = (code, path) => finish({ redirect: typeof code === "number" ? path : code, status: typeof code === "number" ? code : 302 });
  response.sendStatus = (code) => { statusCode = code; return finish({ message: String(code) }); };
  return response;
}

/**
 * Dispatch through the real domain router without sockets or an HTTP hop.
 * Multipart bodies have already been parsed by the SSR multer middleware, so
 * they are normalized to Multer's req.file(s) shape and the second parser is
 * bypassed by using a JSON content type.
 */
export async function apiRequest(path, { method = "GET", token = null, json = null, formData = null, query = null } = {}) {
  const context = requestContext.getStore();
  if (!context?.req) throw new ApiError("Internal application request context is missing", 500);
  if (!path.startsWith("/api/") && path !== "/api") throw new ApiError("Invalid internal API path", 500);
  await ensureDbReady();
  const remaining = Math.min(8000, context.at - Date.now());
  if (remaining <= 0) throw new ApiError("The operation timed out. Please retry.", 504);

  const parent = context.req;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const suffix = params.size ? `?${params}` : "";
  const multipart = formData ? await multipartInput(formData) : null;
  const headers = { ...parent.headers, authorization: token ? `Bearer ${token}` : undefined, "content-type": "application/json" };
  if (!token) delete headers.authorization;
  const lang = parent.session?.lang;
  if (["en", "bn", "ar"].includes(lang)) headers["accept-language"] = lang;

  const request = Object.create(parent);
  Object.defineProperties(request, {
    method: { value: method.toUpperCase(), writable: true, configurable: true },
    url: { value: path.slice(4) + suffix, writable: true, configurable: true },
    originalUrl: { value: path + suffix, writable: true, configurable: true },
    baseUrl: { value: "/api", writable: true, configurable: true },
    path: { value: path.slice(4).split("?")[0] || "/", writable: true, configurable: true },
    query: { value: Object.fromEntries(params), writable: true, configurable: true },
    body: { value: multipart?.body ?? json ?? {}, writable: true, configurable: true },
    file: { value: multipart?.file, writable: true, configurable: true },
    files: { value: multipart?.files, writable: true, configurable: true },
    headers: { value: headers, writable: true, configurable: true },
    // The router is mounted below /api in production; these values recreate
    // that mount for route-level middleware without invoking app-level parsers.
    _parsedUrl: { value: undefined, writable: true, configurable: true },
    _parsedOriginalUrl: { value: undefined, writable: true, configurable: true },
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => done(new ApiError("The operation timed out. Please retry.", 504)), remaining);
    timer.unref?.();
    const done = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    };
    const respond = ({ status, body, headers: responseHeaders }) => {
      for (const [name, value] of responseHeaders) {
        if (name === "set-cookie") context.res.append("Set-Cookie", value);
      }
      const data = body && typeof body === "object" ? body : { data: body };
      if (status >= 400 || data.success === false || data.ok === false) {
        done(new ApiError(apiMessage(data, status), status, data));
      } else done(null, data);
    };
    const response = captureResponse(context.res, respond);
    response.req = request;
    request.res = response;
    const next = (error) => {
      if (!error) return done(new ApiError("Internal route not found", 404));
      const status = error.status || error.statusCode || 500;
      const data = { success: false, code: error.code, message: status >= 500 && status !== 503 && status !== 504 ? "Something went wrong. Please try again." : error.message };
      done(new ApiError(apiMessage(data, status), status, data));
    };
    try {
      apiRouter(request, response, next);
    } catch (error) { next(error); }
  });
}

export const apiGet = (path, token = null, query = null) => apiRequest(path, { method: "GET", token, query });
export const apiPost = (path, json = null, token = null) => apiRequest(path, { method: "POST", json, token });
export const apiPut = (path, json = null, token = null) => apiRequest(path, { method: "PUT", json, token });
export const apiPatch = (path, json = null, token = null) => apiRequest(path, { method: "PATCH", json, token });
export const apiDel = (path, token = null) => apiRequest(path, { method: "DELETE", token });
export const apiPostForm = (path, formData, token = null) => apiRequest(path, { method: "POST", formData, token });
export const apiPutForm = (path, formData, token = null) => apiRequest(path, { method: "PUT", formData, token });

export function buildFormData(fields = {}, file = null, fileField = "file") {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) fd.append(key, String(value));
  }
  if (file?.buffer) fd.append(fileField, new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" }), file.originalname || "upload.bin");
  return fd;
}

/** SSE is a browser concern now: redirect to the same-origin bounded endpoint. */
export async function proxyEventStream(req, res, backendPath) {
  const target = backendPath.startsWith("/api/") ? backendPath : `/api/${backendPath.replace(/^\/+/, "")}`;
  const query = new URL(target, "http://internal");
  res.redirect(307, `${query.pathname}${query.search}`);
}
