/**
 * Seed script for demo accounts (Google Play Store review).
 *
 * Creates demo accounts with two users each to showcase shared finances:
 *   - review@finnon.app      → Spanish market (EUR) – owner (Ana García)
 *   - review2@finnon.app     → Spanish market (EUR) – contributor (Carlos García)
 *   - review-en@finnon.app   → English market (GBP) – owner (Alex Smith)
 *   - review-en2@finnon.app  → English market (GBP) – contributor (Jamie Smith)
 *
 * Usage (from apps/web):
 *   npx tsx scripts/seed-demo-accounts.ts
 *
 * Required env vars (loaded automatically from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  or  SUPABASE_SECRET_KEY
 *   DEMO_USER_PASSWORD
 */

import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { seedDefaultCategories } from "@poleursus/shared/src/categories/defaults";

// Load env vars from .env.local (relative to apps/web)
function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(__dirname, "..", ".env.production"));

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD;

if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL env var.");
  process.exit(1);
}
if (!SUPABASE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY.");
  process.exit(1);
}
if (!DEMO_PASSWORD) {
  console.error("Missing DEMO_USER_PASSWORD env var.");
  process.exit(1);
}
const DEMO_PASSWORD_VALUE: string = DEMO_PASSWORD;

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SEED_MARKER = "[demo-seed]";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Locale = "es" | "en";
type AvatarColor = "blue" | "green" | "coral" | "purple";

type DemoAccountConfig = {
  email: string;
  displayName: string;
  avatarColor: AvatarColor;
  accountName: string;
  currency: string;
  locale: Locale;
  secondaryUser: {
    email: string;
    displayName: string;
    avatarColor: AvatarColor;
  };
};

type SeedTransaction = {
  type: "income" | "expense";
  amountCents: number;
  categoryName: string;
  date: string;
  merchant: string | null;
};

type SeedRecurringItem = {
  type: "income" | "expense";
  amountCents: number;
  categoryName: string;
  merchant: string;
  dayOfMonth: number;
};

// ---------------------------------------------------------------------------
// Demo account definitions
// ---------------------------------------------------------------------------

const DEMO_ACCOUNTS: DemoAccountConfig[] = [
  {
    email: "review@finnon.app",
    displayName: "Ana García",
    avatarColor: "blue",
    accountName: "Hogar García",
    currency: "EUR",
    locale: "es",
    secondaryUser: {
      email: "review2@finnon.app",
      displayName: "Carlos García",
      avatarColor: "coral",
    },
  },
  {
    email: "review-en@finnon.app",
    displayName: "Alex Smith",
    avatarColor: "green",
    accountName: "Smith Household",
    currency: "GBP",
    locale: "en",
    secondaryUser: {
      email: "review-en2@finnon.app",
      displayName: "Jamie Smith",
      avatarColor: "purple",
    },
  },
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function subMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - n);
  return d;
}

function clampDay(yearMonth: string, day: number, today: Date): string {
  const maxDay = Math.min(
    day,
    new Date(
      Number(yearMonth.slice(0, 4)),
      Number(yearMonth.slice(5, 7)),
      0
    ).getDate()
  );
  const candidate = `${yearMonth}-${String(maxDay).padStart(2, "0")}`;
  const todayStr = today.toISOString().slice(0, 10);
  return candidate > todayStr ? todayStr : candidate;
}

// ---------------------------------------------------------------------------
// Step 1: Ensure auth user
// ---------------------------------------------------------------------------

async function ensureAuthUser(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  const { data: listData } = await admin.auth.admin.listUsers();
  const existing = listData?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    console.log(`  Auth user exists: ${email} (${existing.id})`);
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) throw new Error(`Failed to create user ${email}: ${error.message}`);
  console.log(`  Created auth user: ${email} (${data.user.id})`);
  return data.user.id;
}

async function ensureProfileAvatarColor(
  userId: string,
  color: AvatarColor
): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ avatar_color: color })
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      `Failed to set avatar color for ${userId}: ${error.message}`
    );
  }

  console.log(`  Profile color set: ${userId} -> ${color}`);
}

// ---------------------------------------------------------------------------
// Step 2: Ensure account
// ---------------------------------------------------------------------------

async function ensureAccount(
  userId: string,
  config: DemoAccountConfig
): Promise<string> {
  const { data: existing } = await admin
    .from("accounts")
    .select("id")
    .eq("owner_user_id", userId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`  Account exists: ${existing.id}`);
    return existing.id as string;
  }

  const { data, error } = await admin
    .from("accounts")
    .insert({
      name: config.accountName,
      base_currency: config.currency,
      owner_user_id: userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create account: ${error.message}`);
  console.log(`  Created account: ${data.id}`);
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Step 2b: Ensure secondary user is a member of the account
// ---------------------------------------------------------------------------

async function ensureAccountMember(
  accountId: string,
  userId: string,
  role: "viewer" | "contributor" | "admin"
): Promise<void> {
  const { error } = await admin
    .from("account_members")
    .upsert(
      { account_id: accountId, user_id: userId, role },
      { onConflict: "account_id,user_id", ignoreDuplicates: true }
    );

  if (error)
    throw new Error(`Failed to add account member: ${error.message}`);
  console.log(`  Account member added: ${userId} as ${role}`);
}

// ---------------------------------------------------------------------------
// Step 3: Seed categories
// ---------------------------------------------------------------------------

async function ensureCategories(
  accountId: string,
  locale: Locale
): Promise<Map<string, string>> {
  const result = await seedDefaultCategories(admin, accountId, locale);
  console.log(
    `  Categories: ${result.inserted} inserted, ${result.skipped} skipped`
  );

  const { data: categories } = await admin
    .from("categories")
    .select("id, name")
    .eq("account_id", accountId);

  const map = new Map<string, string>();
  for (const cat of categories ?? []) {
    map.set((cat.name as string).toLowerCase(), cat.id as string);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Step 4: Seed transactions
// ---------------------------------------------------------------------------

function getSpanishTransactions(today: Date): SeedTransaction[] {
  const cm = formatMonth(today);
  const lm = formatMonth(subMonths(today, 1));
  const lm2 = formatMonth(subMonths(today, 2));

  return [
    // 2 months ago
    { type: "income", amountCents: 220000, categoryName: "nómina", date: clampDay(lm2, 1, today), merchant: "Empresa TechSol" },
    { type: "expense", amountCents: 85000, categoryName: "hogar", date: clampDay(lm2, 2, today), merchant: "Alquiler" },
    { type: "expense", amountCents: 7800, categoryName: "alimentación", date: clampDay(lm2, 3, today), merchant: "Mercadona" },
    { type: "expense", amountCents: 11500, categoryName: "alimentación", date: clampDay(lm2, 7, today), merchant: "Carrefour" },
    { type: "expense", amountCents: 3200, categoryName: "restaurantes", date: clampDay(lm2, 5, today), merchant: "La Tasca de Juan" },
    { type: "expense", amountCents: 1799, categoryName: "suscripciones", date: clampDay(lm2, 6, today), merchant: "Netflix" },
    { type: "expense", amountCents: 1099, categoryName: "suscripciones", date: clampDay(lm2, 6, today), merchant: "Spotify" },
    { type: "expense", amountCents: 4500, categoryName: "transporte", date: clampDay(lm2, 8, today), merchant: "Repsol" },
    { type: "expense", amountCents: 6500, categoryName: "suministros", date: clampDay(lm2, 14, today), merchant: "Iberdrola" },
    { type: "expense", amountCents: 3500, categoryName: "suministros", date: clampDay(lm2, 15, today), merchant: "Movistar" },
    { type: "expense", amountCents: 3999, categoryName: "salud", date: clampDay(lm2, 10, today), merchant: "Basic-Fit" },
    { type: "expense", amountCents: 4500, categoryName: "transporte", date: clampDay(lm2, 20, today), merchant: "Renfe" },

    // Last month
    { type: "income", amountCents: 220000, categoryName: "nómina", date: clampDay(lm, 1, today), merchant: "Empresa TechSol" },
    { type: "income", amountCents: 8500, categoryName: "nómina", date: clampDay(lm, 12, today), merchant: "Wallapop" },
    { type: "expense", amountCents: 85000, categoryName: "hogar", date: clampDay(lm, 2, today), merchant: "Alquiler" },
    { type: "expense", amountCents: 9200, categoryName: "alimentación", date: clampDay(lm, 3, today), merchant: "Mercadona" },
    { type: "expense", amountCents: 6800, categoryName: "alimentación", date: clampDay(lm, 10, today), merchant: "Lidl" },
    { type: "expense", amountCents: 4500, categoryName: "alimentación", date: clampDay(lm, 18, today), merchant: "Carrefour" },
    { type: "expense", amountCents: 5200, categoryName: "restaurantes", date: clampDay(lm, 5, today), merchant: "Burger King" },
    { type: "expense", amountCents: 3800, categoryName: "restaurantes", date: clampDay(lm, 14, today), merchant: "Pizzería Napoli" },
    { type: "expense", amountCents: 1799, categoryName: "suscripciones", date: clampDay(lm, 6, today), merchant: "Netflix" },
    { type: "expense", amountCents: 1099, categoryName: "suscripciones", date: clampDay(lm, 6, today), merchant: "Spotify" },
    { type: "expense", amountCents: 5500, categoryName: "transporte", date: clampDay(lm, 8, today), merchant: "Cepsa" },
    { type: "expense", amountCents: 2000, categoryName: "transporte", date: clampDay(lm, 22, today), merchant: "Metro Madrid" },
    { type: "expense", amountCents: 6500, categoryName: "suministros", date: clampDay(lm, 14, today), merchant: "Iberdrola" },
    { type: "expense", amountCents: 3500, categoryName: "suministros", date: clampDay(lm, 15, today), merchant: "Movistar" },
    { type: "expense", amountCents: 3999, categoryName: "salud", date: clampDay(lm, 10, today), merchant: "Basic-Fit" },
    { type: "expense", amountCents: 2900, categoryName: "ocio", date: clampDay(lm, 16, today), merchant: "Amazon" },
    { type: "expense", amountCents: 6500, categoryName: "ropa", date: clampDay(lm, 20, today), merchant: "Zara" },
    { type: "expense", amountCents: 4500, categoryName: "transporte", date: clampDay(lm, 25, today), merchant: "Mapfre seguro" },
    { type: "expense", amountCents: 1200, categoryName: "salud", date: clampDay(lm, 19, today), merchant: "Farmacia" },

    // Current month
    { type: "income", amountCents: 220000, categoryName: "nómina", date: clampDay(cm, 1, today), merchant: "Empresa TechSol" },
    { type: "expense", amountCents: 85000, categoryName: "hogar", date: clampDay(cm, 2, today), merchant: "Alquiler" },
    { type: "expense", amountCents: 10500, categoryName: "alimentación", date: clampDay(cm, 3, today), merchant: "Mercadona" },
    { type: "expense", amountCents: 5800, categoryName: "alimentación", date: clampDay(cm, 8, today), merchant: "Carrefour" },
    { type: "expense", amountCents: 1799, categoryName: "suscripciones", date: clampDay(cm, 5, today), merchant: "Netflix" },
    { type: "expense", amountCents: 1099, categoryName: "suscripciones", date: clampDay(cm, 5, today), merchant: "Spotify" },
    { type: "expense", amountCents: 3500, categoryName: "restaurantes", date: clampDay(cm, 6, today), merchant: "Casa Pepe" },
    { type: "expense", amountCents: 4800, categoryName: "transporte", date: clampDay(cm, 7, today), merchant: "Repsol" },
    { type: "expense", amountCents: 3999, categoryName: "salud", date: clampDay(cm, 8, today), merchant: "Basic-Fit" },
    { type: "expense", amountCents: 6500, categoryName: "suministros", date: clampDay(cm, 10, today), merchant: "Iberdrola" },
    { type: "expense", amountCents: 3500, categoryName: "suministros", date: clampDay(cm, 10, today), merchant: "Movistar" },
    { type: "expense", amountCents: 2500, categoryName: "ocio", date: clampDay(cm, 11, today), merchant: "Steam" },
    { type: "expense", amountCents: 2900, categoryName: "ropa", date: clampDay(cm, 9, today), merchant: "Primark" },
  ];
}

function getEnglishTransactions(today: Date): SeedTransaction[] {
  const cm = formatMonth(today);
  const lm = formatMonth(subMonths(today, 1));
  const lm2 = formatMonth(subMonths(today, 2));

  return [
    // 2 months ago
    { type: "income", amountCents: 240000, categoryName: "salary", date: clampDay(lm2, 1, today), merchant: "Acme Corp" },
    { type: "expense", amountCents: 110000, categoryName: "home", date: clampDay(lm2, 2, today), merchant: "Rent" },
    { type: "expense", amountCents: 7500, categoryName: "groceries", date: clampDay(lm2, 3, today), merchant: "Tesco" },
    { type: "expense", amountCents: 9800, categoryName: "groceries", date: clampDay(lm2, 7, today), merchant: "Sainsbury's" },
    { type: "expense", amountCents: 2800, categoryName: "restaurants", date: clampDay(lm2, 5, today), merchant: "Nando's" },
    { type: "expense", amountCents: 1099, categoryName: "subscriptions", date: clampDay(lm2, 6, today), merchant: "Netflix" },
    { type: "expense", amountCents: 1099, categoryName: "subscriptions", date: clampDay(lm2, 6, today), merchant: "Spotify" },
    { type: "expense", amountCents: 4500, categoryName: "transport", date: clampDay(lm2, 8, today), merchant: "BP" },
    { type: "expense", amountCents: 7500, categoryName: "utilities", date: clampDay(lm2, 14, today), merchant: "British Gas" },
    { type: "expense", amountCents: 3200, categoryName: "utilities", date: clampDay(lm2, 15, today), merchant: "BT Internet" },
    { type: "expense", amountCents: 2499, categoryName: "health", date: clampDay(lm2, 10, today), merchant: "PureGym" },
    { type: "expense", amountCents: 3500, categoryName: "transport", date: clampDay(lm2, 20, today), merchant: "TfL Oyster" },

    // Last month
    { type: "income", amountCents: 240000, categoryName: "salary", date: clampDay(lm, 1, today), merchant: "Acme Corp" },
    { type: "income", amountCents: 6500, categoryName: "salary", date: clampDay(lm, 15, today), merchant: "eBay sale" },
    { type: "expense", amountCents: 110000, categoryName: "home", date: clampDay(lm, 2, today), merchant: "Rent" },
    { type: "expense", amountCents: 8200, categoryName: "groceries", date: clampDay(lm, 3, today), merchant: "Tesco" },
    { type: "expense", amountCents: 6500, categoryName: "groceries", date: clampDay(lm, 10, today), merchant: "Aldi" },
    { type: "expense", amountCents: 4200, categoryName: "groceries", date: clampDay(lm, 18, today), merchant: "Sainsbury's" },
    { type: "expense", amountCents: 4500, categoryName: "restaurants", date: clampDay(lm, 5, today), merchant: "Pizza Express" },
    { type: "expense", amountCents: 3200, categoryName: "restaurants", date: clampDay(lm, 14, today), merchant: "Wagamama" },
    { type: "expense", amountCents: 1099, categoryName: "subscriptions", date: clampDay(lm, 6, today), merchant: "Netflix" },
    { type: "expense", amountCents: 1099, categoryName: "subscriptions", date: clampDay(lm, 6, today), merchant: "Spotify" },
    { type: "expense", amountCents: 5200, categoryName: "transport", date: clampDay(lm, 8, today), merchant: "Shell" },
    { type: "expense", amountCents: 1500, categoryName: "transport", date: clampDay(lm, 22, today), merchant: "Uber" },
    { type: "expense", amountCents: 7500, categoryName: "utilities", date: clampDay(lm, 14, today), merchant: "British Gas" },
    { type: "expense", amountCents: 3200, categoryName: "utilities", date: clampDay(lm, 15, today), merchant: "BT Internet" },
    { type: "expense", amountCents: 2499, categoryName: "health", date: clampDay(lm, 10, today), merchant: "PureGym" },
    { type: "expense", amountCents: 2500, categoryName: "leisure", date: clampDay(lm, 16, today), merchant: "Amazon" },
    { type: "expense", amountCents: 5500, categoryName: "clothing", date: clampDay(lm, 20, today), merchant: "H&M" },
    { type: "expense", amountCents: 5500, categoryName: "transport", date: clampDay(lm, 25, today), merchant: "Admiral insurance" },
    { type: "expense", amountCents: 900, categoryName: "health", date: clampDay(lm, 19, today), merchant: "Boots" },

    // Current month
    { type: "income", amountCents: 240000, categoryName: "salary", date: clampDay(cm, 1, today), merchant: "Acme Corp" },
    { type: "expense", amountCents: 110000, categoryName: "home", date: clampDay(cm, 2, today), merchant: "Rent" },
    { type: "expense", amountCents: 9500, categoryName: "groceries", date: clampDay(cm, 3, today), merchant: "Tesco" },
    { type: "expense", amountCents: 5500, categoryName: "groceries", date: clampDay(cm, 8, today), merchant: "Sainsbury's" },
    { type: "expense", amountCents: 1099, categoryName: "subscriptions", date: clampDay(cm, 5, today), merchant: "Netflix" },
    { type: "expense", amountCents: 1099, categoryName: "subscriptions", date: clampDay(cm, 5, today), merchant: "Spotify" },
    { type: "expense", amountCents: 3200, categoryName: "restaurants", date: clampDay(cm, 6, today), merchant: "Nando's" },
    { type: "expense", amountCents: 4200, categoryName: "transport", date: clampDay(cm, 7, today), merchant: "BP" },
    { type: "expense", amountCents: 2499, categoryName: "health", date: clampDay(cm, 8, today), merchant: "PureGym" },
    { type: "expense", amountCents: 7500, categoryName: "utilities", date: clampDay(cm, 10, today), merchant: "British Gas" },
    { type: "expense", amountCents: 3200, categoryName: "utilities", date: clampDay(cm, 10, today), merchant: "BT Internet" },
    { type: "expense", amountCents: 1800, categoryName: "leisure", date: clampDay(cm, 11, today), merchant: "Steam" },
    { type: "expense", amountCents: 2500, categoryName: "clothing", date: clampDay(cm, 9, today), merchant: "Primark" },
  ];
}

function getSpanishSecondaryTransactions(today: Date): SeedTransaction[] {
  const cm = formatMonth(today);
  const lm = formatMonth(subMonths(today, 1));
  const lm2 = formatMonth(subMonths(today, 2));

  return [
    // 2 months ago
    { type: "income", amountCents: 185000, categoryName: "nómina", date: clampDay(lm2, 1, today), merchant: "Clínica Dental Sonrisa" },
    { type: "expense", amountCents: 6200, categoryName: "alimentación", date: clampDay(lm2, 4, today), merchant: "Lidl" },
    { type: "expense", amountCents: 8500, categoryName: "alimentación", date: clampDay(lm2, 12, today), merchant: "Dia" },
    { type: "expense", amountCents: 4200, categoryName: "restaurantes", date: clampDay(lm2, 9, today), merchant: "100 Montaditos" },
    { type: "expense", amountCents: 5200, categoryName: "transporte", date: clampDay(lm2, 11, today), merchant: "Repsol" },
    { type: "expense", amountCents: 3500, categoryName: "ocio", date: clampDay(lm2, 16, today), merchant: "Fnac" },
    { type: "expense", amountCents: 2500, categoryName: "salud", date: clampDay(lm2, 18, today), merchant: "Farmacia" },

    // Last month
    { type: "income", amountCents: 185000, categoryName: "nómina", date: clampDay(lm, 1, today), merchant: "Clínica Dental Sonrisa" },
    { type: "expense", amountCents: 7800, categoryName: "alimentación", date: clampDay(lm, 4, today), merchant: "Mercadona" },
    { type: "expense", amountCents: 5500, categoryName: "alimentación", date: clampDay(lm, 11, today), merchant: "Lidl" },
    { type: "expense", amountCents: 6900, categoryName: "alimentación", date: clampDay(lm, 21, today), merchant: "Dia" },
    { type: "expense", amountCents: 3800, categoryName: "restaurantes", date: clampDay(lm, 7, today), merchant: "Telepizza" },
    { type: "expense", amountCents: 5600, categoryName: "restaurantes", date: clampDay(lm, 17, today), merchant: "El Corte Inglés Gourmet" },
    { type: "expense", amountCents: 4800, categoryName: "transporte", date: clampDay(lm, 9, today), merchant: "Cepsa" },
    { type: "expense", amountCents: 1500, categoryName: "transporte", date: clampDay(lm, 23, today), merchant: "BiciMAD" },
    { type: "expense", amountCents: 4500, categoryName: "ocio", date: clampDay(lm, 13, today), merchant: "GAME" },
    { type: "expense", amountCents: 8900, categoryName: "ropa", date: clampDay(lm, 20, today), merchant: "Pull & Bear" },
    { type: "expense", amountCents: 1800, categoryName: "salud", date: clampDay(lm, 24, today), merchant: "Farmacia" },

    // Current month
    { type: "income", amountCents: 185000, categoryName: "nómina", date: clampDay(cm, 1, today), merchant: "Clínica Dental Sonrisa" },
    { type: "expense", amountCents: 9200, categoryName: "alimentación", date: clampDay(cm, 4, today), merchant: "Mercadona" },
    { type: "expense", amountCents: 6100, categoryName: "alimentación", date: clampDay(cm, 10, today), merchant: "Lidl" },
    { type: "expense", amountCents: 4500, categoryName: "restaurantes", date: clampDay(cm, 7, today), merchant: "La Tagliatella" },
    { type: "expense", amountCents: 5000, categoryName: "transporte", date: clampDay(cm, 6, today), merchant: "Repsol" },
    { type: "expense", amountCents: 3200, categoryName: "ocio", date: clampDay(cm, 9, today), merchant: "Amazon" },
    { type: "expense", amountCents: 1500, categoryName: "salud", date: clampDay(cm, 11, today), merchant: "Farmacia" },
  ];
}

function getEnglishSecondaryTransactions(today: Date): SeedTransaction[] {
  const cm = formatMonth(today);
  const lm = formatMonth(subMonths(today, 1));
  const lm2 = formatMonth(subMonths(today, 2));

  return [
    // 2 months ago
    { type: "income", amountCents: 200000, categoryName: "salary", date: clampDay(lm2, 1, today), merchant: "NHS Trust" },
    { type: "expense", amountCents: 7200, categoryName: "groceries", date: clampDay(lm2, 4, today), merchant: "Waitrose" },
    { type: "expense", amountCents: 5800, categoryName: "groceries", date: clampDay(lm2, 12, today), merchant: "M&S Food" },
    { type: "expense", amountCents: 3500, categoryName: "restaurants", date: clampDay(lm2, 9, today), merchant: "Pret A Manger" },
    { type: "expense", amountCents: 4800, categoryName: "transport", date: clampDay(lm2, 11, today), merchant: "Shell" },
    { type: "expense", amountCents: 2800, categoryName: "leisure", date: clampDay(lm2, 16, today), merchant: "Waterstones" },
    { type: "expense", amountCents: 1500, categoryName: "health", date: clampDay(lm2, 18, today), merchant: "Boots" },

    // Last month
    { type: "income", amountCents: 200000, categoryName: "salary", date: clampDay(lm, 1, today), merchant: "NHS Trust" },
    { type: "expense", amountCents: 8500, categoryName: "groceries", date: clampDay(lm, 4, today), merchant: "Waitrose" },
    { type: "expense", amountCents: 4200, categoryName: "groceries", date: clampDay(lm, 11, today), merchant: "M&S Food" },
    { type: "expense", amountCents: 6300, categoryName: "groceries", date: clampDay(lm, 21, today), merchant: "Ocado" },
    { type: "expense", amountCents: 3200, categoryName: "restaurants", date: clampDay(lm, 7, today), merchant: "Greggs" },
    { type: "expense", amountCents: 4800, categoryName: "restaurants", date: clampDay(lm, 17, today), merchant: "Five Guys" },
    { type: "expense", amountCents: 5200, categoryName: "transport", date: clampDay(lm, 9, today), merchant: "BP" },
    { type: "expense", amountCents: 1800, categoryName: "transport", date: clampDay(lm, 23, today), merchant: "TfL Oyster" },
    { type: "expense", amountCents: 3500, categoryName: "leisure", date: clampDay(lm, 13, today), merchant: "Vue Cinema" },
    { type: "expense", amountCents: 7200, categoryName: "clothing", date: clampDay(lm, 20, today), merchant: "John Lewis" },
    { type: "expense", amountCents: 1200, categoryName: "health", date: clampDay(lm, 24, today), merchant: "Superdrug" },

    // Current month
    { type: "income", amountCents: 200000, categoryName: "salary", date: clampDay(cm, 1, today), merchant: "NHS Trust" },
    { type: "expense", amountCents: 8800, categoryName: "groceries", date: clampDay(cm, 4, today), merchant: "Waitrose" },
    { type: "expense", amountCents: 5500, categoryName: "groceries", date: clampDay(cm, 10, today), merchant: "M&S Food" },
    { type: "expense", amountCents: 3800, categoryName: "restaurants", date: clampDay(cm, 7, today), merchant: "Costa Coffee" },
    { type: "expense", amountCents: 4500, categoryName: "transport", date: clampDay(cm, 6, today), merchant: "Shell" },
    { type: "expense", amountCents: 2500, categoryName: "leisure", date: clampDay(cm, 9, today), merchant: "Amazon" },
    { type: "expense", amountCents: 900, categoryName: "health", date: clampDay(cm, 11, today), merchant: "Boots" },
  ];
}

async function seedTransactions(
  accountId: string,
  userId: string,
  currency: string,
  categoryMap: Map<string, string>,
  transactions: SeedTransaction[]
): Promise<void> {
  const { count } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("created_by", userId)
    .like("notes", `%${SEED_MARKER}%`);

  if (count && count > 0) {
    console.log(`  Transactions: already seeded (${count} found for user), skipping`);
    return;
  }

  const rows = transactions.map((tx) => ({
    account_id: accountId,
    type: tx.type,
    amount_minor: tx.amountCents,
    currency,
    amount_base_minor: tx.amountCents,
    fx_rate: 1,
    fx_date: tx.date,
    category_id: categoryMap.get(tx.categoryName) ?? null,
    date: tx.date,
    merchant: tx.merchant,
    notes: SEED_MARKER,
    created_by: userId,
  }));

  const { error } = await admin.from("transactions").insert(rows);
  if (error) throw new Error(`Failed to seed transactions: ${error.message}`);
  console.log(`  Transactions: inserted ${rows.length}`);
}

// ---------------------------------------------------------------------------
// Step 5: Seed recurring items
// ---------------------------------------------------------------------------

function getSpanishRecurringItems(): SeedRecurringItem[] {
  return [
    { type: "expense", amountCents: 85000, categoryName: "hogar", merchant: "Alquiler", dayOfMonth: 2 },
    { type: "expense", amountCents: 6500, categoryName: "suministros", merchant: "Iberdrola", dayOfMonth: 14 },
    { type: "expense", amountCents: 3500, categoryName: "suministros", merchant: "Movistar", dayOfMonth: 15 },
    { type: "expense", amountCents: 1799, categoryName: "suscripciones", merchant: "Netflix", dayOfMonth: 6 },
    { type: "expense", amountCents: 1099, categoryName: "suscripciones", merchant: "Spotify", dayOfMonth: 6 },
    { type: "expense", amountCents: 3999, categoryName: "salud", merchant: "Basic-Fit", dayOfMonth: 10 },
    { type: "expense", amountCents: 4500, categoryName: "transporte", merchant: "Mapfre seguro", dayOfMonth: 25 },
  ];
}

function getEnglishRecurringItems(): SeedRecurringItem[] {
  return [
    { type: "expense", amountCents: 110000, categoryName: "home", merchant: "Rent", dayOfMonth: 2 },
    { type: "expense", amountCents: 7500, categoryName: "utilities", merchant: "British Gas", dayOfMonth: 14 },
    { type: "expense", amountCents: 3200, categoryName: "utilities", merchant: "BT Internet", dayOfMonth: 15 },
    { type: "expense", amountCents: 1099, categoryName: "subscriptions", merchant: "Netflix", dayOfMonth: 6 },
    { type: "expense", amountCents: 1099, categoryName: "subscriptions", merchant: "Spotify", dayOfMonth: 6 },
    { type: "expense", amountCents: 2499, categoryName: "health", merchant: "PureGym", dayOfMonth: 10 },
    { type: "expense", amountCents: 5500, categoryName: "transport", merchant: "Admiral insurance", dayOfMonth: 25 },
  ];
}

async function seedRecurringItems(
  accountId: string,
  userId: string,
  currency: string,
  categoryMap: Map<string, string>,
  items: SeedRecurringItem[]
): Promise<void> {
  const { count } = await admin
    .from("recurring_items")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .like("notes", `%${SEED_MARKER}%`);

  if (count && count > 0) {
    console.log(`  Recurring items: already seeded (${count} found), skipping`);
    return;
  }

  const now = new Date().toISOString();
  const startDate = "2025-06-01";

  const rows = items.map((item) => ({
    account_id: accountId,
    type: item.type,
    amount_minor: item.amountCents,
    currency,
    category_id: categoryMap.get(item.categoryName) ?? null,
    merchant: item.merchant,
    notes: SEED_MARKER,
    start_date: startDate,
    frequency: "monthly" as const,
    interval: 1,
    day_of_month: item.dayOfMonth,
    is_paused: false,
    created_by: userId,
    created_at: now,
    updated_at: now,
  }));

  const { error } = await admin.from("recurring_items").insert(rows);
  if (error)
    throw new Error(`Failed to seed recurring items: ${error.message}`);
  console.log(`  Recurring items: inserted ${rows.length}`);
}

// ---------------------------------------------------------------------------
// Step 6: Seed financial goals
// ---------------------------------------------------------------------------

async function seedFinancialGoals(
  accountId: string,
  userId: string,
  currency: string,
  today: Date
): Promise<void> {
  const cm = formatMonth(today);
  const lm = formatMonth(subMonths(today, 1));
  const lm2 = formatMonth(subMonths(today, 2));

  // Target amounts vary by currency to feel realistic
  const isEur = currency === "EUR";
  const now = new Date().toISOString();

  const goals = [
    {
      account_id: accountId,
      month: lm2,
      type: "save" as const,
      target_amount_base_minor: isEur ? 40000 : 35000,
      created_by: userId,
      final_saved_minor: isEur ? 45200 : 38500,
      completed: true,
      completed_at: `${lm2}-22`,
      closed_at: new Date(
        Number(lm.slice(0, 4)),
        Number(lm.slice(5, 7)) - 1,
        1
      ).toISOString(),
      created_at: now,
      updated_at: now,
    },
    {
      account_id: accountId,
      month: lm,
      type: "save" as const,
      target_amount_base_minor: isEur ? 45000 : 40000,
      created_by: userId,
      final_saved_minor: isEur ? 42300 : 37800,
      completed: false,
      completed_at: null,
      closed_at: new Date(
        Number(cm.slice(0, 4)),
        Number(cm.slice(5, 7)) - 1,
        1
      ).toISOString(),
      created_at: now,
      updated_at: now,
    },
    {
      account_id: accountId,
      month: cm,
      type: "save" as const,
      target_amount_base_minor: isEur ? 50000 : 45000,
      created_by: userId,
      final_saved_minor: null,
      completed: null,
      completed_at: null,
      closed_at: null,
      created_at: now,
      updated_at: now,
    },
  ];

  for (const goal of goals) {
    const { error } = await admin
      .from("financial_goals")
      .upsert(goal, { onConflict: "account_id,month,type" });

    if (error)
      throw new Error(
        `Failed to seed goal for ${goal.month}: ${error.message}`
      );
  }

  console.log(`  Financial goals: upserted ${goals.length}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Finnon Demo Account Seeder ===\n");

  for (const config of DEMO_ACCOUNTS) {
    console.log(`\nProcessing: ${config.email}`);

    const userId = await ensureAuthUser(
      config.email,
      DEMO_PASSWORD_VALUE,
      config.displayName
    );
    await ensureProfileAvatarColor(userId, config.avatarColor);

    const accountId = await ensureAccount(userId, config);

    const categoryMap = await ensureCategories(accountId, config.locale);

    const txns =
      config.locale === "es"
        ? getSpanishTransactions(new Date())
        : getEnglishTransactions(new Date());
    await seedTransactions(accountId, userId, config.currency, categoryMap, txns);

    // Secondary user (shared finances)
    console.log(`\n  Secondary user: ${config.secondaryUser.email}`);
    const secondaryUserId = await ensureAuthUser(
      config.secondaryUser.email,
      DEMO_PASSWORD_VALUE,
      config.secondaryUser.displayName
    );
    await ensureProfileAvatarColor(
      secondaryUserId,
      config.secondaryUser.avatarColor
    );
    await ensureAccountMember(accountId, secondaryUserId, "contributor");

    const secondaryTxns =
      config.locale === "es"
        ? getSpanishSecondaryTransactions(new Date())
        : getEnglishSecondaryTransactions(new Date());
    await seedTransactions(
      accountId,
      secondaryUserId,
      config.currency,
      categoryMap,
      secondaryTxns
    );

    const recurrents =
      config.locale === "es"
        ? getSpanishRecurringItems()
        : getEnglishRecurringItems();
    await seedRecurringItems(
      accountId,
      userId,
      config.currency,
      categoryMap,
      recurrents
    );

    await seedFinancialGoals(accountId, userId, config.currency, new Date());
  }

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
