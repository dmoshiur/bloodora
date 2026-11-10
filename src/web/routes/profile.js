// Canonical authenticated account pages. All persistence belongs to the API.
import express from "express";
import multer from "multer";
import { apiPutForm, buildFormData } from "../api.js";
import { requireLogin, normalizeUser } from "../middleware/auth.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });
router.get("/", requireLogin, (req, res) => {
  res.render("my_profile", { title: `${req.t("prof_title")} - ${res.locals.siteName}`, user: req.user });
});
router.get("/edit", requireLogin, (req, res) => {
  res.render("edit_profile", { title: `${req.t("prof_edit")} - ${res.locals.siteName}`, user: req.user, error: null });
});
router.post("/edit", requireLogin, upload.single("profile_pic"), async (req, res) => {
  const b = req.body;
  const fields = { name: b.name, phone: b.phone, holding: b.holding,
    birth_certificate: b.birth_certificate, date_of_birth: b.date_of_birth };
  try {
    const d = await apiPutForm("/api/users/me", buildFormData(fields, req.file, "profile_pic"), req.session.token);
    const user = normalizeUser(d?.user);
    if (String(user.id) !== String(req.user.id)) throw new Error(req.t("prof_save_unconfirmed"));
    req.session.userCache = { user, at: Date.now() };
    req.session.flash = { type: "success", message: req.t("prof_saved") };
    res.redirect("/profile");
  } catch (e) {
    // Keep submitted text on failure. Never replace the real account cache or
    // claim success on a missing endpoint, validation error or malformed response.
    const error = e.status === 404 ? req.t("prof_api_missing") :
      e.status >= 400 && e.status < 500 ? e.message : req.t("prof_save_unconfirmed");
    res.status(e.status >= 400 && e.status < 500 ? e.status : 502).render("edit_profile", {
      title: `${req.t("prof_edit")} - ${res.locals.siteName}`, error,
      user: { ...req.user, name: b.name, phone: b.phone, address_holding: b.holding,
        birth_certificate_number: b.birth_certificate, date_of_birth: b.date_of_birth },
    });
  }
});
export default router;
