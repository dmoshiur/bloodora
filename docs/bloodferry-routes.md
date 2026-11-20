# Backend route inventory

Source declarations, not a claim of live-provider verification. See `bloodferry-report.md` and `institutions.md` for tested functionality, scoped routes and limitations.

## `src/routes/admin.ts`

```ts
router.get("/dashboard", requireAnyPermission("users.view", "orders.view", "settings.view", "content.view", "shop.view"), ah(c.dashboard));
router.get("/settings", requirePermission("settings.view"), ah(c.settingsGet));
router.post("/settings", requirePermission("settings.manage"), ah(c.settingsPost));
router.get("/branding", requirePermission("settings.view"), ah(c.brandingGet));
router.post("/branding", requirePermission("settings.branding"), upload.fields([{ name: "logo", maxCount: 1 }, { name: "favicon", maxCount: 1 }]), ah(c.brandingPost));
router.get("/smtp", requirePermission("settings.smtp"), ah(c.smtpGet));
router.post("/smtp", requirePermission("settings.smtp"), ah(c.smtpPost));
router.post("/smtp/test", requirePermission("settings.smtp"), ah(c.smtpTest));
router.get("/smtp/log", requirePermission("settings.smtp"), ah(c.smtpLog));
router.get("/content/antid", requirePermission("content.view"), ah(c.antidList));
router.post("/content/antid", requirePermission("content.manage"), ah(c.antidCreate));
router.put("/content/antid/:id", requirePermission("content.manage"), ah(c.antidUpdate));
router.delete("/content/antid/:id", requirePermission("content.manage"), ah(c.antidDelete));
router.get("/content/resources", requirePermission("content.view"), ah(c.resourcesList));
router.post("/content/resources", requirePermission("content.manage"), ah(c.resourceCreate));
router.put("/content/resources/:id", requirePermission("content.manage"), ah(c.resourceUpdate));
router.delete("/content/resources/:id", requirePermission("content.manage"), ah(c.resourceDelete));
router.get("/activity", requirePermission("content.view"), ah(c.activityEvents));
router.post("/activity/announce", requirePermission("notice.manage"), ah(c.activityAnnounce));
router.post("/notice", requirePermission("notice.manage"), ah(c.noticeSet));
router.post("/notice/clear", requirePermission("notice.manage"), ah(c.noticeClear));
router.get("/notice/clear", requirePermission("notice.manage"), (_req, res) => {
router.post("/verify-donor/:id", requirePermission("users.verify"), ah(c.verifyDonor));
router.post("/promote/:id", requirePermission("users.role.assign"), ah(c.promote));
router.post("/demote/:id", requirePermission("users.role.assign"), ah(c.demote));
router.delete("/user/:id", requirePermission("users.delete"), ah(c.userDelete));
router.post("/user/update/:id", requirePermission("users.manage"), ah(c.userUpdate));
router.get("/user/details/:id", requirePermission("users.view"), ah(c.userDetails));
router.post("/create-admin", requirePermission("users.create_admin"), ah(c.createAdmin));
router.post("/impersonate/:id", requirePermission("users.impersonate"), ah(c.impersonate));
router.post("/switch-back", requirePermission("users.impersonate"), ah(c.switchBack));
router.get("/backup", requirePermission("system.backup"), ah(c.backup));
router.get("/mail/outbox", requirePermission("settings.smtp"), ah(c.mailOutbox));
router.post("/mail/flush", requirePermission("system.maintenance"), ah(c.mailFlush));
router.post("/maintenance", requirePermission("system.maintenance"), ah(c.maintenance));
```

## `src/routes/ai.ts`

```ts
router.use(optionalAuth);
router.get("/conversations", ah(conversations));
router.get("/conversations/:id/messages", ah(history));
router.get("/config", ah(publicConfig));
router.post("/chat", rateLimit({ scope: "ai-chat", shared: true, keyBy: req => req.user?.id, windowMs: 60 * 1000, max: 15 }), ah(chat));
router.post("/ask", rateLimit({ scope: "ai-ask", shared: true, keyBy: req => req.user?.id, windowMs: 60 * 1000, max: 10 }), ah(ask));
router.get("/status", ah(status));
router.get("/admin/config", requirePermission("ai.configure"), ah(adminConfigGet));
router.post("/admin/config", requirePermission("ai.configure"), ah(adminConfigPost));
router.post("/admin/test", requirePermission("ai.configure"), ah(adminTest));
router.get("/admin/models", requirePermission("ai.configure"), ah(adminModels));
router.get("/admin/conversations", requirePermission("ai.configure"), ah(adminConversations));
router.get("/admin/knowledge", requirePermission("ai.configure"), ah(adminKnowledge));
adminRouter.get("/config", requirePermission("ai.configure"), ah(adminConfigGet));
adminRouter.post("/config", requirePermission("ai.configure"), ah(adminConfigPost));
adminRouter.post("/test", requirePermission("ai.configure"), ah(adminTest));
adminRouter.get("/models", requirePermission("ai.configure"), ah(adminModels));
adminRouter.get("/conversations", requirePermission("ai.configure"), ah(adminConversations));
adminRouter.get("/knowledge", requirePermission("ai.configure"), ah(adminKnowledge));
adminRouter.get("/preview", requirePermission("ai.configure"), ah(knowledgePreview));
```

## `src/routes/auth.ts`

```ts
router.post(
router.post("/login", rateLimit({ scope: "login", windowMs: 15 * 60 * 1000, max: 10, shared: true, keyBy: byEmail }), ah(login));
router.post(
router.get("/reset-password/validate", rateLimit({ scope: "reset-validate", windowMs: 15 * 60 * 1000, max: 30, shared: true }), ah(validateReset));
router.post(
router.post("/verify-email/request", requireAuth, rateLimit({ scope: "verify-request", windowMs: 15 * 60 * 1000, max: 5, shared: true }), ah(requestVerification));
router.get("/verify-email", rateLimit({ scope: "verify-email", windowMs: 15 * 60 * 1000, max: 20, shared: true }), ah(verifyEmail));
router.post("/verify-email", rateLimit({ scope: "verify-email", windowMs: 15 * 60 * 1000, max: 20, shared: true }), ah(verifyEmail));
router.post("/phone/request", requireAuth, rateLimit({ scope: "phone-otp", windowMs: 15 * 60 * 1000, max: 5, shared: true, keyBy: (req) => req.user?.phone }), ah(requestPhoneCode));
router.post("/phone/verify", requireAuth, rateLimit({ scope: "phone-otp-verify", windowMs: 15 * 60 * 1000, max: 10, shared: true, keyBy: (req) => req.user?.phone }), ah(verifyPhoneCode));
router.post("/logout", requireAuth, ah(logout));
router.get("/me", requireAuth, ah(me));
router.patch("/profile", requireAuth, ah(updateProfile));
router.post("/password", requireAuth, ah(changePassword));
router.post("/profile/image", requireAuth, uploadProfileImage, ah(setProfileImage));
```

## `src/routes/blood.ts`

```ts
router.get("/", ah(listRequests));
router.get("/urgent", ah(urgentList));
router.post(
router.post("/urgent-contact", optionalAuth, rateLimit({ scope: "urgent-contact", windowMs: 15 * 60 * 1000, max: 10 }), ah(urgentContact));
router.get("/mine", requireAuth, ah(myRequests));
router.get("/:id", ah(getRequest));
router.post("/:id/fulfill", requireAuth, ah(fulfillRequest));
router.post("/:id/cancel", requireAuth, ah(cancelRequest));
adminRouter.get("/:id", requireAuth, requirePermission("requests.view"), ah(getAdminRequest));
adminRouter.patch("/:id/status", requireAuth, requirePermission("requests.moderate"), ah(setRequestStatus));
adminRouter.delete("/:id", requireAuth, requirePermission("requests.moderate"), ah(deleteRequest));
```

## `src/routes/donations.ts`

```ts
router.use(requireAuth);
router.get('/mine', ah(history));
router.post('/', requirePermission('requests.moderate'), ah(record));
donationAdminRouter.get('/donations',requireAuth,requirePermission('requests.view'),ah(adminList));
donationAdminRouter.post('/donations',requireAuth,requirePermission('requests.moderate'),ah(record));
```

## `src/routes/health.ts`

```ts
router.get("/", ah(health));
```

## `src/routes/index.ts`

```ts
api.get("/", (_req, res) => {
api.use("/health", healthRoutes);
api.use("/auth", authRoutes);
api.use("/meta", navPublicRoutes);
api.use("/meta", metaRoutes);
api.use("/user", userRouter);
api.use("/users", usersRoutes);
api.use("/donors", donorRouter);
api.use("/shop", shopRoutes);
api.use("/blood-requests", bloodRoutes);
api.use("/donations", donationRoutes);
api.use("/organizations", organizationRouter("organization"));
api.use("/hospitals", organizationRouter("hospital"));
api.use("/admin", institutionAdminRouter);
api.use("/admin", donationAdminRouter);
api.use("/messages", messageRoutes);
api.use("/support", supportRoutes);
api.use("/reviews", reviewRoutes);
api.use("/ai", aiRoutes);
api.use("/uploads", uploadRoutes);
api.use("/notifications", notificationRoutes);
api.use("/payments", paymentRoutes);
api.use("/rbac", rbacMeRoutes);
api.use("/support/admin", supportAdminRoutes);
api.use("/admin", integrationRoutes);
api.use("/admin", shopAdminRoutes);
api.use("/admin", rbacAdminRoutes);
api.use("/admin", paymentAdminRoutes);
api.use("/admin", navAdminRoutes);
api.use("/admin", adminRoutes);
api.use("/admin/blood-requests", bloodAdminRoutes);
api.use("/admin/ai", aiAdminRoutes);
api.use("/uploads", uploadServeRoutes);
```

## `src/routes/integrations.ts`

```ts
router.get("/integrations", requirePermission("settings.view"), ah(integrationStatus));
router.get("/sms", requirePermission("settings.view"), ah(smsDashboard));
router.post("/sms/test", requirePermission("settings.manage"), rateLimit({ scope: "sms-test", windowMs: 15 * 60 * 1000, max: 3, shared: true }), ah(testSms));
```

## `src/routes/messages.ts`

```ts
router.get("/", requireAuth, ah(inbox));
router.post("/", requireAuth, rateLimit({ scope: "message-send", windowMs: 15 * 60 * 1000, max: 20 }), ah(send));
router.get("/:id", requireAuth, ah(read));
router.get("/:id/original", requireAuth, ah(original));
router.post("/:id/reply", requireAuth, rateLimit({ scope: "message-reply", windowMs: 15 * 60 * 1000, max: 20 }), ah(reply));
router.get("/admin/list", requirePermission("messages.view"), ah(adminList));
router.post("/admin/reply/:id", requirePermission("messages.reply"), ah(adminReply));
```

## `src/routes/meta.ts`

```ts
router.get("/", ah(async (_req: Request, res: Response) => {
res.json(await metaService.get());
router.get("/chat-auth", optionalAuth, ah(async (req: Request, res: Response) => {
router.get("/settings", ah(async (_req: Request, res: Response) => {
router.get("/home", ah(async (_req: Request, res: Response) => {
router.get("/activity", ah(async (req: Request, res: Response) => {
router.get("/activity/stream", (req: Request, res: Response) => {
router.get("/reviews", ah(async (req: Request, res: Response) => {
router.get("/antid", ah(async (_req: Request, res: Response) => {
router.get("/compatibility", ah(async (_req: Request, res: Response) => {
router.get("/resources", ah(async (req: Request, res: Response) => {
router.get("/routes", ah(async (_req: Request, res: Response) => {
router.get("/locations", ah(async (_req: Request, res: Response) => {
```

## `src/routes/navigation.ts`

```ts
publicRouter.get("/nav", optionalAuth, ah(c.nav));
adminRouter.use(requireAuth);
adminRouter.get("/navigation", requirePermission("navigation.view"), ah(c.adminList));
adminRouter.post("/navigation/seed", requirePermission("navigation.manage"), ah(c.adminSeed));
adminRouter.post("/navigation/reorder", requirePermission("navigation.manage"), ah(c.adminReorder));
adminRouter.post("/navigation", requirePermission("navigation.manage"), ah(c.adminCreate));
adminRouter.put("/navigation/:id", requirePermission("navigation.manage"), ah(c.adminUpdate));
adminRouter.patch("/navigation/:id", requirePermission("navigation.manage"), ah(c.adminUpdate));
adminRouter.post("/navigation/:id/toggle", requirePermission("navigation.manage"), ah(c.adminToggle));
adminRouter.delete("/navigation/:id", requirePermission("navigation.manage"), ah(c.adminRemove));
```

## `src/routes/notifications.ts`

```ts
router.use(requireAuth);
router.get("/", ah(c.list));
router.get("/unread", ah(c.unread));
router.post("/read-all", ah(c.markAllRead));
router.post("/:id/read", rateLimit({ scope: "notify-read", windowMs: 60 * 1000, max: 120 }), ah(c.markRead));
router.delete("/:id", ah(c.remove));
```

## `src/routes/organizations.ts`

```ts
router.get('/',ah(c.list));
router.get('/mine',requireAuth,ah(c.mine));
router.post('/',requireAuth,rateLimit({scope:'institution-apply',max:10,windowMs:3600000,shared:true,keyBy:req=>req.user?.id}),ah(c.create));
router.get('/:id',optionalAuth,ah(c.get));
router.patch('/:id',requireAuth,ah(c.update));
router.get('/:id/requests',requireAuth,ah(c.requests));
router.post('/:id/requests',requireAuth,rateLimit({scope:'blood-create',max:10,windowMs:15*60*1000,shared:true,keyBy:req=>req.user?.id}),ah(c.submitRequest));
router.get('/:id/members',requireAuth,ah(c.members));
router.put('/:id/members',requireAuth,ah(c.setMember));
router.post('/:id/review',requirePermission('partners.manage'),ah(c.review));
institutionAdminRouter.get(`/${path}`,requirePermission('partners.view'),ah(c.adminList));
institutionAdminRouter.post(`/${path}/:id/review`,requirePermission('partners.manage'),ah(c.review));
```

## `src/routes/payments.ts`

```ts
router.use(requireAuth);
router.get("/me", ah(c.mine));
router.get("/order/:id", ah(c.forOrder));
adminRouter.use(requireAuth);
adminRouter.get("/payments", requirePermission("payments.view"), ah(c.adminList));
adminRouter.get("/payments/summary", requirePermission("payments.view"), ah(c.adminSummary));
adminRouter.get("/payments/order/:id", requirePermission("payments.view"), ah(c.adminOrderLedger));
adminRouter.post("/payments/order/:id/refund", requirePermission("payments.refund"), ah(c.adminRefund));
```

## `src/routes/rbac.ts`

```ts
meRouter.get("/me", requireAuth, ah(c.me));
adminRouter.use(requireAuth);
adminRouter.get("/roles", requirePermission("users.view"), ah(c.listRoles));
adminRouter.post("/roles", requirePermission("users.role.assign"), ah(c.createRole));
adminRouter.get("/roles/:key", requirePermission("users.view"), ah(c.getRole));
adminRouter.put("/roles/:key", requirePermission("users.role.assign"), ah(c.updateRole));
adminRouter.patch("/roles/:key", requirePermission("users.role.assign"), ah(c.updateRole));
adminRouter.delete("/roles/:key", requirePermission("users.role.assign"), ah(c.deleteRole));
adminRouter.get("/permissions", requirePermission("users.view"), ah(c.listPermissions));
adminRouter.post("/users/:id/role", requirePermission("users.role.assign"), ah(c.assignRole));
adminRouter.get("/audit", requirePermission("system.audit.view"), ah(c.audit));
```

## `src/routes/reviews.ts`

```ts
router.post(
router.get("/mine", requireAuth, ah(async (req, res) => {
router.get("/admin", requirePermission("reviews.moderate"), ah(async (req, res) => {
router.post("/admin/:id/status", requirePermission("reviews.moderate"), ah(async (req, res) => {
router.post("/admin/:id/feature", requirePermission("reviews.moderate"), ah(async (req, res) => {
router.post("/admin/:id/reply", requirePermission("reviews.moderate"), ah(async (req, res) => {
router.delete("/admin/:id", requirePermission("reviews.moderate"), ah(async (req, res) => {
```

## `src/routes/shop.ts`

```ts
router.get("/products", ah(listProducts));
router.get("/products/:id", ah(getProduct));
router.get("/categories", ah(listCategories));
router.post("/cart/validate-item", rateLimit({ scope: "cart-validate", windowMs: 60 * 1000, max: 120 }), ah(validateItem));
router.post("/cart/resolve", rateLimit({ scope: "cart-resolve", windowMs: 60 * 1000, max: 120 }), ah(resolveCart));
router.get("/checkout/context", requireAuth, ah(checkoutContext));
router.post("/orders", requireAuth, rateLimit({ scope: "order-place", windowMs: 15 * 60 * 1000, max: 10 }), ah(placeOrder));
router.get("/orders/mine", requireAuth, ah(myOrders));
router.get("/orders/:id", requireAuth, ah(getOrder));
router.post("/orders/:id/cancel", requireAuth, ah(cancelOrder));
router.post("/reviews", requireAuth, ah(submitReview));
adminRouter.get("/products", requireAuth, requirePermission("shop.view"), ah(listAdminProducts));
adminRouter.post("/products", requireAuth, requirePermission("shop.products.manage"), singleUpload("image"), ah(createProduct));
adminRouter.put("/products/:id", requireAuth, requirePermission("shop.products.manage"), singleUpload("image"), ah(updateProduct));
adminRouter.delete("/products/:id", requireAuth, requirePermission("shop.products.manage"), ah(deleteProduct));
adminRouter.get("/orders", requireAuth, requirePermission("orders.view"), ah(listAdminOrders));
adminRouter.get("/orders/:id", requireAuth, requirePermission("orders.view"), ah(getAdminOrder));
adminRouter.post("/orders/:id/confirm-payment", requireAuth, requirePermission("payments.confirm"), ah(confirmPayment));
adminRouter.post("/orders/:id/status", requireAuth, requirePermission("orders.manage"), ah(updateOrderStatus));
adminRouter.patch("/orders/:id/status", requireAuth, requirePermission("orders.manage"), ah(updateOrderStatus));
router.use("/admin", adminRouter);
```

## `src/routes/support.ts`

```ts
router.post("/session", optionalAuth, rateLimit({ scope: "support-session", windowMs: 60 * 1000, max: 30 }), ah(startSession));
router.get("/messages", rateLimit({ scope: "support-poll", windowMs: 60 * 1000, max: 120 }), ah(fetchMessages));
router.post("/messages", optionalAuth, rateLimit({ scope: "support-send", windowMs: 60 * 1000, max: 30 }), ah(sendMessage));
router.get("/stream", streamSession);
adminRouter.get("/sessions", requirePermission("chat.view"), ah(adminSessions));
adminRouter.get("/sessions/:key/messages", requirePermission("chat.view"), ah(adminMessages));
adminRouter.post("/sessions/:key/reply", requirePermission("chat.reply"), rateLimit({ scope: "support-reply", windowMs: 60 * 1000, max: 60 }), ah(adminReply));
adminRouter.post("/sessions/:key/close", requirePermission("chat.reply"), ah(adminClose));
adminRouter.get("/stream", requirePermission("chat.view"), adminStream);
```

## `src/routes/uploads.ts`

```ts
router.post("/", requireAuth, rateLimit({ scope: "upload", windowMs: 60 * 1000, max: 20 }), uploadFile, ah(upload));
serveRouter.get("/:file", ah(serveUpload));
```

## `src/routes/users.ts`

```ts
donorRouter.get("/", ah(listDonors));
userRouter.use(requireAuth);
userRouter.get("/dashboard", ah(dashboard));
router.get("/:id/public", optionalAuth, ah(publicProfile)); // lightweight alias kept for the original contract
router.get("/:id", optionalAuth, ah(publicProfile));
router.put("/me", requireAuth, singleUpload("profile_pic"), ah(updateSelf));
router.patch("/me/preferences", requireAuth, ah(setPreferences));
router.post("/me/preferences", requireAuth, ah(setPreferences));
router.post("/me/toggle-status", requireAuth, ah(toggleStatus));
router.post("/me/apply-verification", requireAuth, ah(applyVerification));
```

## Admin delivery profile additions

- `GET /api/admin/delivery-profiles` — authorized metadata only.
- `POST /api/admin/delivery-profiles` — encrypted provider profile creation.
- `POST /api/admin/delivery-profiles/:id/activate` — atomic channel default selection.
- `POST /api/admin/sms/send` — authorized, rate-limited manual paid send.

See `admin-delivery-profiles.md` for request schemas, permissions and limitations.
