import { all, batch, run } from "./query.js";

/**
 * Table DDL only — CREATE TABLE IF NOT EXISTS. Every statement is idempotent. Indexes are deliberately NOT in this array: they
 * are created AFTER the column-alignment migrations (see INDEXES), because
 * CREATE INDEX on a column that does not exist yet fails the whole batch.
 */
const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_super_admin INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user',
    donation_role TEXT NOT NULL DEFAULT 'Both',
    blood_group TEXT,
    city TEXT,
    address_holding TEXT,
    division TEXT,
    district TEXT,
    upazila TEXT,
    union_area TEXT,
    can_donate INTEGER NOT NULL DEFAULT 0,
    last_donation TEXT,
    age INTEGER,
    date_of_birth TEXT,
    birth_certificate_number TEXT,
    bkash_number TEXT,
    nagad_number TEXT,
    upay_number TEXT,
    rocket_number TEXT,
    pathao_number TEXT,
    card_last_four TEXT,
    card_type TEXT,
    is_verified INTEGER NOT NULL DEFAULT 0,
    image_file TEXT,
    session_token TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    description TEXT,
    image_file TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    sales_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    division TEXT,
    district TEXT,
    upazila TEXT,
    payment_method TEXT NOT NULL,
    payment_ref TEXT,
    subtotal REAL NOT NULL,
    delivery_fee REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_image TEXT,
    price REAL NOT NULL,
    qty INTEGER NOT NULL,
    line_total REAL NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS blood_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    hospital TEXT,
    patient_name TEXT,
    patient_relation TEXT,
    hospital_name TEXT,
    hospital_address TEXT,
    contact_person TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    urgent_reason TEXT,
    needed_by TEXT,
    additional_info TEXT,
    blood_group TEXT NOT NULL,
    units INTEGER NOT NULL DEFAULT 1,
    quantity TEXT,
    division TEXT,
    district TEXT,
    upazila TEXT,
    location_division TEXT,
    location_district TEXT,
    location_upazila TEXT,
    urgent INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    is_fulfilled INTEGER NOT NULL DEFAULT 0,
    fulfilled_at TEXT,
    fulfilled_by TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    user_id TEXT,
    message TEXT NOT NULL,
    meta TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // One institutional registry: a hospital is a kind of organization, not a duplicate entity.
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK(kind IN ('organization','hospital')),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    district TEXT NOT NULL,
    address TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    publish_contact INTEGER NOT NULL DEFAULT 0 CHECK(publish_contact IN (0,1)),
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
    review_note TEXT,
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    request_key TEXT NOT NULL,
    request_fingerprint TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(created_by, request_key)
  )`,

  `CREATE TABLE IF NOT EXISTS organization_members (
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('owner','manager','volunteer')),
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(organization_id, user_id)
  )`,

  `CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY,
    donor_id TEXT NOT NULL REFERENCES users(id),
    request_id TEXT REFERENCES blood_requests(id),
    recorded_by TEXT NOT NULL REFERENCES users(id),
    donated_at TEXT NOT NULL,
    blood_group TEXT NOT NULL,
    units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 10),
    note TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  )`,

  // User↔admin messaging (subject + reply threading; recipient_id 'admin'
  // means the site administrator).
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL,
    is_admin_message INTEGER NOT NULL DEFAULT 0,
    is_admin_reply INTEGER NOT NULL DEFAULT 0,
    replied_to TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Live Messaging (support chat): sessions are keyed by an opaque
  // session_key (guests included), messages are appended per session.
  `CREATE TABLE IF NOT EXISTS live_sessions (
    id TEXT PRIMARY KEY,
    session_key TEXT NOT NULL UNIQUE,
    user_id TEXT,
    visitor_name TEXT NOT NULL DEFAULT 'Guest',
    last_message TEXT,
    last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
    unread_admin INTEGER NOT NULL DEFAULT 0,
    unread_visitor INTEGER NOT NULL DEFAULT 0,
    is_open INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS live_messages (
    id TEXT PRIMARY KEY,
    session_key TEXT NOT NULL,
    sender_type TEXT NOT NULL DEFAULT 'visitor',
    sender_name TEXT,
    body TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    owner_id TEXT,
    purpose TEXT NOT NULL DEFAULT 'upload',
    filename TEXT NOT NULL UNIQUE,
    mime TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    width INTEGER,
    height INTEGER,
    checksum TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_url TEXT,
    public_id TEXT,
    original_name TEXT,
    data BLOB,
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`,

  // kind: 'product' (product_id set) or 'site' (general testimonial).
  // status: pending → approved | rejected (admin moderation queue).
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    user_id TEXT NOT NULL,
    author_name TEXT,
    kind TEXT NOT NULL DEFAULT 'product',
    rating INTEGER NOT NULL DEFAULT 5,
    title TEXT,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_approved INTEGER NOT NULL DEFAULT 0,
    is_featured INTEGER NOT NULL DEFAULT 0,
    admin_reply TEXT,
    admin_replied_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Anti-D medication entries (Admin → Content manager; seeds from content.ts).
  `CREATE TABLE IF NOT EXISTS anti_d_info (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    timing TEXT NOT NULL,
    dosage TEXT NOT NULL,
    image_file TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Educational resources (Admin → Content manager; seeds from content.ts).
  `CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    content TEXT NOT NULL,
    summary TEXT,
    image_file TEXT,
    is_featured INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Single active site notice (shown in the site header).
  `CREATE TABLE IF NOT EXISTS site_notice (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // Outgoing email log (Admin → SMTP & Email).
  `CREATE TABLE IF NOT EXISTS email_log (
    id TEXT PRIMARY KEY,
    to_email TEXT,
    subject TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY, owner_key TEXT NOT NULL,
    user_id TEXT REFERENCES users(id), created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS ai_submissions (
    conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
    request_id TEXT NOT NULL, message TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending','completed','failed')),
    response TEXT, created_at TEXT NOT NULL,
    PRIMARY KEY(conversation_id, request_id)
  )`,
  // Live AI Help conversation history (per conversation_id).
  `CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  // ---------------------------------------------------------------------
  // v3 — notifications, payments ledger, audit trail, RBAC, navigation,
  // password-reset/verification tokens and a shared rate-limit store.
  //
  // Timestamps in every v3 table are written by the application as ISO-8601
  // UTC (`2026-09-13T06:49:18.894Z`) instead of SQLite's `datetime('now')`
  // (`2026-09-13 06:49:18`). Mixing the two formats is what broke the SSE
  // cursors: a string comparison between the two is always false, so streams
  // silently emitted nothing. `src/utils/time.ts` normalizes both on read so
  // rows written by older deployments keep working.
  // ---------------------------------------------------------------------

  // In-app notification centre. `user_id` is either a real user id or the
  // sentinel 'admins' for the admin desk (same convention as messages'
  // recipient_id = 'admin'). `dedupe_key` makes creation idempotent: callers
  // pass a deterministic key for "one notification per event" and a random one
  // when repeats are legitimate.
  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    audience TEXT NOT NULL DEFAULT 'user',
    type TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT,
    lang TEXT NOT NULL DEFAULT 'en',
    entity_type TEXT,
    entity_id TEXT,
    link TEXT,
    dedupe_key TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    read_at TEXT,
    created_at TEXT NOT NULL
  )`,

  // Payment ledger. One row per money movement (charge or refund) so an order's
  // payment history survives status changes and duplicate confirmations.
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    order_id TEXT,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BDT',
    method TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'charge',
    status TEXT NOT NULL DEFAULT 'pending',
    gateway TEXT,
    gateway_ref TEXT,
    confirmed_by TEXT,
    confirmed_at TEXT,
    note TEXT,
    meta TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // Admin/security audit trail (secrets are redacted before insert).
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    summary TEXT,
    meta TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL
  )`,

  // RBAC. `users.role` stays the source of truth for the existing contract;
  // roles/permissions describe what each role may do and are re-read from the
  // database on every privileged request (never trusted from a JWT claim).
  `CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 1,
    seeded_permissions TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    group_name TEXT,
    description TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_key TEXT NOT NULL,
    permission_key TEXT NOT NULL,
    PRIMARY KEY (role_key, permission_key)
  )`,

  // Navigation manager. Seeded once from the built-in site route catalogue so
  // GET /api/meta/routes keeps its exact shape, then admin-editable.
  `CREATE TABLE IF NOT EXISTS navigation (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    title TEXT,
    purpose TEXT,
    keywords TEXT,
    area TEXT NOT NULL DEFAULT 'public',
    section TEXT NOT NULL DEFAULT 'main',
    icon TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    requires_auth INTEGER NOT NULL DEFAULT 0,
    requires_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  // Single-use hashed tokens (password reset, email verification). Only the
  // SHA-256 hash is stored — a database leak cannot be replayed.
  `CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
  )`,

  // SMS metadata only. Message bodies and OTP codes are deliberately excluded
  // so delivery logs can never become a plaintext OTP history.
  `CREATE TABLE IF NOT EXISTS sms_deliveries (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    to_phone TEXT NOT NULL,
    template TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    last_error TEXT,
    cost_amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BDT',
    dedupe_key TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS phone_otps (
    phone TEXT NOT NULL,
    purpose TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_sent_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    consumed_at INTEGER,
    PRIMARY KEY (phone, purpose)
  )`,

  // Shared rate-limit counters. Serverless instances do not share memory, so
  // the in-process limiter alone cannot stop a distributed brute-force; the
  // sensitive scopes (login/register/reset/payment/AI) also count here.
  `CREATE TABLE IF NOT EXISTS rate_limits (
    bucket TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_end INTEGER NOT NULL
  )`,

  // Outgoing mail that still has to be delivered (SMTP off/failed at request
  // time). Flushed opportunistically and by GET /api/cron/maintenance.
  `CREATE TABLE IF NOT EXISTS delivery_profiles (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, label TEXT NOT NULL, provider TEXT NOT NULL,
    sender_email TEXT, sender_name TEXT, sender_id TEXT, secret TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS email_outbox (
    id TEXT PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    html TEXT NOT NULL,
    text TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    dedupe_key TEXT,
    provider_id TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT
  )`,

];

export const SETTINGS_DEFAULTS: Record<string, string> = {
  // --- identity / branding (original site_settings fields) ---
  site_name: "BloodFerry",
  site_tagline: "DONATE • TRANSFUSE • SAVE LIVES",
  site_description: "Connecting blood donors to save lives across Bangladesh.",
  site_email: "info.bloodora@gmail.com",
  site_phone: "+8801709202140",
  site_address: "Kalai, Rajshahi, Bangladesh",
  facebook_url: "https://www.facebook.com/profile.php?id=61575592734038",
  twitter_url: "#",
  instagram_url: "#",
  linkedin_url: "#",
  logo_file: "/assets/brand/bloodferry-logo.png",
  favicon_file: "/favicon.png",
  brand_primary: "#e31b23",
  brand_accent: "#ff3340",
  brand_font_style: "calligraphic",
  default_language: "en",
  footer_note: "BloodFerry — donate blood, save lives.",
  primary_color: "#c62828",
  font_style: "default",
  announcement: "",
  whatsapp: "",
  support_phone: "+8801709202140",
  email: "info.bloodora@gmail.com",
  address: "Kalai, Rajshahi, Bangladesh",
  language: "en",
  // --- payment gateways (merchant numbers shown at checkout) ---
  bkash_merchant_number: "01709202140",
  nagad_merchant_number: "01800000000",
  upay_merchant_number: "01600000000",
  rocket_merchant_number: "01900000000",
  pathao_merchant_number: "01500000000",
  bKash_number: "",
  bKash_merchant: "",
  Nagad_number: "",
  Nagad_merchant: "",
  Rocket_number: "",
  Rocket_merchant: "",
  card_enabled: "0",
  // --- delivery (Kalai-only, ৳10 flat) ---
  delivery_areas: "Kalai",
  delivery_fee: "10",
  free_shipping_threshold: "0",
  // --- SMTP ---
  // Deliberately NOT defaulted here. `resolveSmtpSettings()` treats a stored
  // value as an explicit admin choice that overrides the environment, so seeding
  // `smtp_enabled: "0"` / `smtp_port: "587"` silently disabled mail (and ignored
  // SMTP_PORT) on every deployment that configures SMTP_* through env vars —
  // with no way to tell from the panel why nothing was being sent. Absent rows
  // mean "use the environment"; the first save from Admin → SMTP & Email writes
  // real values and the panel becomes the override from then on.
  // --- Live AI Help ---
  ai_enabled: "1",
  ai_provider: "",
  ai_model: "",
  ai_base_url: "",
  ai_api_key: "",
  ai_temperature: "0.5",
  ai_max_tokens: "900",
  ai_persona: "",
  ai_prompts: "",
  // --- live features toggles ---
  live_chat_enabled: "1",
  live_activity_enabled: "1",
};

/**
 * Attach migration-stage context to a failure. The message carries the stage
 * name; the structured fields (stage, pendingAlters, statements/tables) name
 * tables and columns only — never values, hosts or SQL text.
 */
function stageError(stage: string, err: unknown, extra: Record<string, unknown> = {}): Error {
  const cause = err as Error | undefined;
  const wrapped = new Error(`schema ${stage} stage failed: ${cause?.message ?? String(err)}`);
  Object.assign(wrapped, { stage, ...extra, cause });
  return wrapped;
}

/** Add one column if the table does not have it yet. Single-table helper. */
export async function ensureColumn(table: string, column: string, definition: string): Promise<void> {
  const rows = await all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!rows.some((r) => r.name === column)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Columns added after v1 tables existed — backfilled idempotently. */
const MIGRATIONS: Array<[string, string, string]> = [
  // users (v2: donor profile + wallet + admin levels)
  ["users", "is_super_admin", "INTEGER NOT NULL DEFAULT 0"],
  ["users", "donation_role", "TEXT NOT NULL DEFAULT 'Both'"],
  ["users", "address_holding", "TEXT"],
  ["users", "division", "TEXT"],
  ["users", "district", "TEXT"],
  ["users", "upazila", "TEXT"],
  ["users", "union_area", "TEXT"],
  ["users", "can_donate", "INTEGER NOT NULL DEFAULT 0"],
  ["users", "last_donation", "TEXT"],
  ["users", "age", "INTEGER"],
  ["users", "date_of_birth", "TEXT"],
  ["users", "birth_certificate_number", "TEXT"],
  ["users", "bkash_number", "TEXT"],
  ["users", "nagad_number", "TEXT"],
  ["users", "upay_number", "TEXT"],
  ["users", "rocket_number", "TEXT"],
  ["users", "pathao_number", "TEXT"],
  ["users", "card_last_four", "TEXT"],
  ["users", "card_type", "TEXT"],
  // orders
  ["orders", "payment_ref", "TEXT"],
  ["orders", "upazila", "TEXT"],
  // messages (v2: subject + threading)
  ["messages", "subject", "TEXT NOT NULL DEFAULT ''"],
  ["messages", "is_admin_message", "INTEGER NOT NULL DEFAULT 0"],
  ["messages", "replied_to", "TEXT"],
  ["users", "is_active", "INTEGER NOT NULL DEFAULT 1"],
  ["blood_requests", "institution_id", "TEXT REFERENCES organizations(id)"],
  // blood_requests (v2: original request form fields)
  ["blood_requests", "patient_name", "TEXT"],
  ["blood_requests", "patient_relation", "TEXT"],
  ["blood_requests", "hospital_name", "TEXT"],
  ["blood_requests", "hospital_address", "TEXT"],
  ["blood_requests", "contact_person", "TEXT"],
  ["blood_requests", "contact_phone", "TEXT"],
  ["blood_requests", "contact_email", "TEXT"],
  ["blood_requests", "urgent_reason", "TEXT"],
  ["blood_requests", "needed_by", "TEXT"],
  ["blood_requests", "additional_info", "TEXT"],
  ["blood_requests", "quantity", "TEXT"],
  ["blood_requests", "location_division", "TEXT"],
  ["blood_requests", "location_district", "TEXT"],
  ["blood_requests", "location_upazila", "TEXT"],
  ["blood_requests", "is_fulfilled", "INTEGER NOT NULL DEFAULT 0"],
  ["blood_requests", "fulfilled_at", "TEXT"],
  ["blood_requests", "fulfilled_by", "TEXT"],
  ["blood_requests", "updated_at", "TEXT"],
  // reviews (v2: three-state moderation + author name)
  ["reviews", "status", "TEXT NOT NULL DEFAULT 'pending'"],
  ["reviews", "author_name", "TEXT"],
  // resources (v2: read_time from the original content manager)
  ["resources", "read_time", "TEXT"],
  // live_messages (v3: idempotent sends — a retried/double-submitted message
  // reconciles to the stored row instead of inserting a second bubble)
  ["live_messages", "client_message_id", "TEXT"],
  // users (v3: preferences, verification + login metadata)
  ["users", "language", "TEXT NOT NULL DEFAULT 'en'"],
  ["users", "email_verified", "INTEGER NOT NULL DEFAULT 0"],
  ["users", "email_verified_at", "TEXT"],
  ["users", "last_login_at", "TEXT"],
  ["users", "notify_email", "INTEGER NOT NULL DEFAULT 1"],
  ["users", "notify_inapp", "INTEGER NOT NULL DEFAULT 1"],
  // ai_messages (v3: usage tracking + how much reasoning was stripped)
  ["ai_messages", "tokens", "INTEGER"],
  ["ai_messages", "reasoning_chars", "INTEGER NOT NULL DEFAULT 0"],
  // v4: durable, idempotent multi-provider delivery. Existing rows remain valid.
  ["email_outbox", "dedupe_key", "TEXT"],
  ["email_outbox", "provider_id", "TEXT"],
  ["email_outbox", "profile_id", "TEXT"],
  ["email_outbox", "claim_token", "TEXT"],
  ["email_outbox", "lease_until", "TEXT"],
  ["email_outbox", "next_attempt_at", "TEXT"],
  ["users", "phone_verified", "INTEGER NOT NULL DEFAULT 0"],
  ["users", "phone_verified_at", "TEXT"],
  ["users", "notify_sms", "INTEGER NOT NULL DEFAULT 0"],
  // v4: object-storage metadata. Existing BLOB rows remain readable unchanged.
  ["uploads", "external_url", "TEXT"],
  ["uploads", "storage_provider", "TEXT NOT NULL DEFAULT 'turso'"],
  // v4-column-alignment-v1: the production failure. users.is_active was in this
  // list but products.is_active and navigation.is_active were not, so a legacy
  // database could never create the indexes that reference them. SQLite's
  // ALTER TABLE ... ADD COLUMN fills existing rows with the declared DEFAULT —
  // every pre-existing product stays visible (is_active = 1) and every existing
  // navigation entry stays visible; no record is lost, rewritten or reseeded.
  ["products", "is_active", "INTEGER NOT NULL DEFAULT 1"],
  ["navigation", "is_active", "INTEGER NOT NULL DEFAULT 1"],
];

/**
 * Every index in the schema, created ONLY after the column-alignment migrations
 * have run (step 4 below) — never inside the CREATE TABLE batch.
 *
 * This ordering is the repair for the production bootstrap failure
 * ("no such column: is_active (at offset 62)"): the index
 * `idx_users_admin ON users(is_admin, is_active)` used to live in the same
 * batch as the CREATE TABLEs, which runs BEFORE the ALTER that adds the
 * column to a legacy database — so the whole batch failed and the database
 * never became ready. CREATE INDEX IF NOT EXISTS is idempotent, so re-running
 * this list on an aligned database is a no-op.
 */
const INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
  `CREATE INDEX IF NOT EXISTS idx_users_admin ON users(is_admin, is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_users_verified ON users(is_verified)`,
  `CREATE INDEX IF NOT EXISTS idx_users_blood ON users(blood_group)`,
  `CREATE INDEX IF NOT EXISTS idx_users_district ON users(district)`,
  `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`,
  `CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_blood_status ON blood_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_blood_group ON blood_requests(blood_group)`,
  `CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_organizations_directory ON organizations(kind, status, district, name)`,
  `CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id, active)`,
  `CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_id, donated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_donations_request ON donations(request_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id)`,
  `CREATE INDEX IF NOT EXISTS idx_live_sessions_open ON live_sessions(is_open)`,
  `CREATE INDEX IF NOT EXISTS idx_live_messages_key ON live_messages(session_key)`,
  `CREATE INDEX IF NOT EXISTS idx_media_owner ON media_assets(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_media_created ON media_assets(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(is_approved)`,
  `CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner ON ai_conversations(owner_key, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(user_id, dedupe_key)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_order ON transactions(order_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_key)`,
  `CREATE INDEX IF NOT EXISTS idx_nav_area ON navigation(area, is_active, position)`,
  `CREATE INDEX IF NOT EXISTS idx_tokens_user ON auth_tokens(user_id, purpose)`,
  `CREATE INDEX IF NOT EXISTS idx_tokens_expires ON auth_tokens(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sms_deliveries_created ON sms_deliveries(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sms_deliveries_status ON sms_deliveries(status, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_deliveries_dedupe ON sms_deliveries(dedupe_key)`,
  `CREATE INDEX IF NOT EXISTS idx_phone_otps_expiry ON phone_otps(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_rate_limits_end ON rate_limits(window_end)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_default ON delivery_profiles(kind) WHERE is_default=1`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_status ON email_outbox(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_requests_institution ON blood_requests(institution_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_live_messages_client
     ON live_messages(session_key, client_message_id)`,
  `CREATE INDEX IF NOT EXISTS idx_live_messages_created ON live_messages(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)`,
  `CREATE INDEX IF NOT EXISTS idx_blood_created ON blood_requests(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_blood_user ON blood_requests(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_live_sessions_activity ON live_sessions(last_message_at)`,
  `CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_due ON email_outbox(status, next_attempt_at, lease_until)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_dedupe ON email_outbox(dedupe_key)`,
];

/**
 * Apply all DDL + migrations + settings defaults. Idempotent — safe on boot.
 *
 * ROUND-TRIP BUDGET (this is the whole point of the function's shape):
 *
 * The previous implementation `await`ed one `run()` per statement:
 *   80 DDL + 56 PRAGMA + N ALTER + 10 indexes + 45 settings inserts
 *   = ~185 sequential HTTPS requests to Turso on EVERY cold start.
 * Measured against a remote database that is 5.5 s at a 20 ms RTT, 18 s at
 * 50 ms and 39 s at 80 ms — all past a serverless function's maxDuration, so
 * the platform killed the invocation before the first `/api/*` response could
 * ever be written. Restarting from zero on the next request made the failure
 * permanent rather than transient: the API "loaded forever" and never came up.
 *
 * Grouping the same statements into `batch()` calls makes each group ONE HTTP
 * request, so the schema stage now costs at most 8 round trips:
 *
 *   1. every CREATE TABLE statement
 *   2. one `PRAGMA table_info` per *distinct* migrated table
 *   3. only the ALTERs that are genuinely missing (zero on a warm database)
 *   4. every index in the schema (safe: all indexed columns exist by now)
 *   5. the settings defaults (`ON CONFLICT DO NOTHING`)
 *   6. the `bootstrap-column-alignment-v1` marker in schema_migrations, which is
 *      written only after every stage above succeeded
 *
 * Semantics are unchanged: `batch()` wraps the group in a transaction, and every
 * statement was already idempotent, so a partially applied group is impossible
 * and a re-run is a no-op.
 */
export async function applySchema(): Promise<void> {
  // Every stage names itself in the error it throws, so a cold-start failure
  // in the log says WHICH step broke (ddl/pragma/alter/index/settings/marker)
  // and which columns were pending — never values, hosts or SQL text.
  try {
    // (1) All table creation in a single request. Indexes deliberately do NOT
    // run here: on a legacy database some indexed columns do not exist yet.
    await batch(DDL);
  } catch (err) {
    throw stageError("ddl", err, { statements: DDL.length });
  }

  // (2) Discover existing columns for every migrated table at once.
  const tables = [...new Set(MIGRATIONS.map(([table]) => table))];
  let infos;
  try {
    infos = await batch(tables.map((table) => `PRAGMA table_info(${table})`));
  } catch (err) {
    throw stageError("pragma", err, { tables });
  }
  const existing = new Map<string, Set<string>>();
  tables.forEach((table, i) => {
    const rows = (infos[i]?.rows ?? []) as unknown as Array<{ name: string }>;
    existing.set(table, new Set(rows.map((r) => r.name)));
  });

  // (3) Add only what is actually missing. BEGIN IMMEDIATE serializes
  // concurrent instances: a second instance waits on the write lock instead of
  // racing the ALTER, and if it still cannot acquire it fails fast with
  // SQLITE_BUSY — the caller's backoff retries and converges, because every
  // statement here is idempotent. Existing records keep their data; SQLite
  // backfills the new columns with the declared DEFAULT.
  const alters: string[] = [];
  for (const [table, column, definition] of MIGRATIONS) {
    if (!existing.get(table)?.has(column)) {
      alters.push(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
  const pendingAlters = alters.map((sql) => {
    const col = /ADD COLUMN (\S+)/.exec(sql)?.[1];
    const tbl = /ALTER TABLE (\S+)/.exec(sql)?.[1];
    return `${tbl}.${col}`;
  });
  if (alters.length > 0) {
    try {
      await batch(alters, "write");
    } catch (err) {
      throw stageError("alter", err, { pendingAlters });
    }
  }

  // (4) Every index in the schema — safe now: all indexed columns exist.
  try {
    await batch(INDEXES, "write");
  } catch (err) {
    throw stageError("index", err, { pendingAlters });
  }

  // One-time brand migration; keep every account and domain row untouched.
  try {
    await batch([
      `UPDATE settings SET value = 'BloodFerry' WHERE key = 'site_name' AND value IN ('BloodOra', 'Bloodora')`,
      `UPDATE settings SET value = replace(value, 'BloodOra', 'BloodFerry') WHERE key IN ('footer_note', 'site_description')`,
      `UPDATE settings SET value = 'DONATE • TRANSFUSE • SAVE LIVES' WHERE key = 'site_tagline' AND NOT EXISTS (SELECT 1 FROM schema_migrations WHERE id = 'bloodferry-brand-v1')`,
      `UPDATE settings SET value = CASE key WHEN 'logo_file' THEN '/assets/brand/bloodferry-logo.png' ELSE '/favicon.png' END WHERE key IN ('logo_file', 'favicon_file') AND NOT EXISTS (SELECT 1 FROM schema_migrations WHERE id = 'bloodferry-brand-v1')`,
      `INSERT INTO schema_migrations VALUES ('bloodferry-brand-v1', datetime('now')) ON CONFLICT(id) DO NOTHING`,
    ], "write");
  } catch (err) {
    throw stageError("brand-migration", err);
  }

  // (5) Settings defaults, inserted but never overwriting an admin's edit.
  try {
    await batch(
      Object.entries(SETTINGS_DEFAULTS).map(
        ([key, value]) =>
          [`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`, [key, value]] as [string, unknown[]],
      ),
      "write",
    );
  } catch (err) {
    throw stageError("settings", err, { keys: Object.keys(SETTINGS_DEFAULTS).length });
  }

  // (6) Record the column-alignment repair LAST — only after every stage above
  // has succeeded. A failure anywhere rethrows before this point, so a broken
  // migration is never marked applied; the next boot re-runs the idempotent
  // sequence and converges.
  try {
    await batch([
      `INSERT INTO schema_migrations (id, applied_at) VALUES ('bootstrap-column-alignment-v1', datetime('now')) ON CONFLICT(id) DO NOTHING`,
    ], "write");
  } catch (err) {
    throw stageError("marker", err);
  }
}

export const TABLES = [
  "schema_migrations",
  "users",
  "products",
  "orders",
  "order_items",
  "blood_requests",
  "donations",
  "organizations",
  "organization_members",
  "activities",
  "messages",
  "live_sessions",
  "live_messages",
  "settings",
  "uploads",
  "sessions",
  "reviews",
  "anti_d_info",
  "resources",
  "site_notice",
  "email_log",
  "ai_messages",
  "ai_conversations",
  "ai_submissions",
  "notifications",
  "transactions",
  "audit_logs",
  "roles",
  "permissions",
  "role_permissions",
  "navigation",
  "auth_tokens",
  "rate_limits",
  "email_outbox",
  "delivery_profiles",
  "sms_deliveries",
  "media_assets",
  "phone_otps",
];
