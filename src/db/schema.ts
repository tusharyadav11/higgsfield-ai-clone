import { date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  passwordHash: text("password_hash").notNull(), // scrypt: salt:hash (hex)
  referralCode: text("referral_code").notNull().unique(),
  referredBy: uuid("referred_by"),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(), // sha256 of the cookie value
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only ledger: balance = SUM(delta). (user, reason, ref) is unique so grants are idempotent.
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(), // signup | daily | referral_invited | referral_joined | generate | refund | promo
    ref: text("ref").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("credit_ledger_idem").on(t.userId, t.reason, t.ref), index("credit_ledger_user").on(t.userId)],
);

export const streaks = pgTable("streaks", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  streak: integer("streak").notNull().default(0),
  lastClaim: date("last_claim"), // UTC date
});

export const generations = pgTable(
  "generations",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    model: text("model").notNull(),
    prompt: text("prompt").notNull(),
    aspect: text("aspect").notNull(),
    url: text("url").notNull(),
    poster: text("poster"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("generations_user_created").on(t.userId, t.createdAt)],
);

export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: text("post_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })],
);

export const referrals = pgTable("referrals", {
  id: uuid("id").primaryKey().defaultRandom(),
  referrerId: uuid("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredId: uuid("referred_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  keyHash: text("key_hash").notNull().unique(), // sha256 of kn_… key; plaintext shown once
  prefix: text("prefix").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const promoRedemptions = pgTable(
  "promo_redemptions",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] })],
);

export const quotes = pgTable("quotes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  teamSize: integer("team_size").notNull(),
  useCase: text("use_case").notNull().default(""),
  expectedCredits: integer("expected_credits"),
  message: text("message").notNull().default(""),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  config: jsonb("config"),
  kind: text("kind").notNull().default("quote"), // 'quote' | 'demo'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
