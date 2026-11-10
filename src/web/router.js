// EJS presentation layer. Domain operations use the in-process gateway in
// api.js; this module owns only pages, browser compatibility routes and UI state.
import express from "express";
import { apiPageBudget } from "./api.js";
import { siteContext } from "./middleware/site.js";
import { loadUser } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import pageRoutes from "./routes/pages.js";
import donorRoutes from "./routes/donors.js";
import bloodRoutes from "./routes/blood.js";
import shopRoutes from "./routes/shop.js";
import adminRoutes from "./routes/admin.js";
import messageRoutes from "./routes/messages.js";
import reviewRoutes from "./routes/reviews.js";
import supportRoutes from "./routes/support.js";
import aiRoutes from "./routes/ai.js";
import dashboardRoutes from "./routes/dashboard.js";
import profileRoutes from "./routes/profile.js";

export function httpError(status, message) {
  const error = new Error(message || `HTTP ${status}`);
  error.status = status;
  return error;
}

function renderError(req, res, status, view, extra = {}) {
  const titles = { 400: "Bad Request", 403: "Forbidden", 404: "Not Found", 500: "Server Error" };
  res.status(status);
  res.render(view, {
    title: `${status} ${titles[status] || ""} - ${res.locals.siteName || "BloodOra"}`,
    requestPath: req.originalUrl,
    ...extra,
  }, (error, html) => {
    if (error) {
      console.error(`renderError(${status}) failed:`, error.message);
      if (!res.headersSent) res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${status}</title></head><body><main><h1>${status}</h1><p>${titles[status] || "Error"}</p><p><a href="/">Go to home</a></p></main></body></html>`);
      return;
    }
    res.send(html);
  });
}

export function createWebRouter() {
  const app = express.Router();

  app.use(apiPageBudget);
  app.use((req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    res.locals.session = req.session;
    const cart = req.session?.cart || {};
    res.locals.sessionCartCount = Object.keys(cart).length;
    res.locals.cartCount = res.locals.sessionCartCount;
    if (req.session?.flash) {
      res.locals.flash = req.session.flash;
      delete req.session.flash;
    } else res.locals.flash = null;
    next();
  });
  app.use(siteContext);
  app.use(loadUser);

  app.use("/", pageRoutes);
  app.use("/", authRoutes);
  app.use("/donors", donorRoutes);
  app.use("/", bloodRoutes);
  app.use("/shop", shopRoutes);
  app.use("/admin", adminRoutes);
  app.use("/messages", messageRoutes);
  app.use("/reviews", reviewRoutes);
  app.use("/support", supportRoutes);
  app.use("/ai-help", aiRoutes);
  app.use("/profile", profileRoutes);
  app.use("/dashboard", dashboardRoutes);

  // Existing public URL aliases are retained during and after unification.
  app.get("/profile/switch-back", (req, res) => res.redirect("/admin/profile/switch-back"));
  app.get("/my-orders", (req, res) => res.redirect("/shop/my-orders"));
  app.get("/my_orders", (req, res) => res.redirect("/shop/my-orders"));
  app.get("/admin/shop/products", (req, res) => res.redirect("/shop/admin/products"));
  app.get("/admin/shop/product/add", (req, res) => res.redirect("/shop/admin/product/add"));
  app.get("/admin/shop/product/edit/:id", (req, res) => res.redirect(`/shop/admin/product/edit/${req.params.id}`));
  app.post("/admin/shop/product/delete/:id", (req, res) => res.redirect(307, `/shop/admin/product/delete/${req.params.id}`));
  app.get("/admin/shop/orders", (req, res) => res.redirect("/shop/admin/orders"));
  app.get("/admin/shop/order/:id", (req, res) => res.redirect(`/shop/admin/order/${req.params.id}`));
  app.get("/admin/shop/order/:id/invoice", (req, res) => res.redirect(`/shop/admin/order/${req.params.id}/invoice`));
  app.post("/admin/shop/order/:id/confirm-payment", (req, res) => res.redirect(307, `/shop/admin/order/${req.params.id}/confirm-payment`));
  app.post("/admin/shop/order/:id/update-status", (req, res) => res.redirect(307, `/shop/admin/order/${req.params.id}/update-status`));
  app.get("/profile/view/:id", (req, res) => res.redirect(`/donors/profile/view/${req.params.id}`));
  app.get("/profile/my", (req, res) => res.redirect("/profile"));
  app.post("/toggle_status", (req, res) => res.redirect(307, "/donors/toggle_status"));
  app.post("/apply-for-verification", (req, res) => res.redirect(307, "/donors/apply-for-verification"));
  app.get("/admin/messages", (req, res) => res.redirect("/messages/admin/messages"));
  app.get("/admin/message/reply/:id", (req, res) => res.redirect(`/messages/admin/message/reply/${req.params.id}`));

  app.use((req, res) => renderError(req, res, 404, "404"));
  app.use((error, req, res, next) => {
    if (req.originalUrl.startsWith("/api/")) return next(error);
    const status = error.status || error.statusCode || (error.type === "entity.parse.failed" ? 400 : 0) || (error.code === "LIMIT_FILE_SIZE" ? 400 : 0) || 500;
    if (status >= 500) console.error("Unhandled web error:", error);
    if ((req.headers.accept || "").includes("application/json") || req.xhr) {
      return res.status(status).json({ success: false, message: status >= 500 && process.env.NODE_ENV === "production" ? "Something went wrong. Please try again." : error.message || "Error" });
    }
    const view = ({ 400: "400", 403: "403", 404: "404", 500: "500" })[status] || "500";
    const detail = status >= 500 ? (process.env.NODE_ENV === "production" ? "" : error.message) : error.message;
    return renderError(req, res, status, view, { detail });
  });
  return app;
}
