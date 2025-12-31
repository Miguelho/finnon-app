import { test } from "node:test";
import assert from "node:assert/strict";
import { getDictionary, t } from "./helpers";

const dict = getDictionary("es");

test("t interpolates params", () => {
  const value = t(dict, "login.successDescription", { email: "test@example.com" });
  assert.equal(value, "Te hemos enviado un enlace de acceso a test@example.com");
});

test("t handles plural forms", () => {
  const one = t(dict, "home.participantsCount", { count: 1, locale: "es" });
  const other = t(dict, "home.participantsCount", { count: 2, locale: "es" });
  assert.equal(one, "1 participante");
  assert.equal(other, "2 participantes");
});

test("getDictionary falls back to es", () => {
  const fallback = getDictionary("fr");
  assert.equal(fallback.common.tagline, "Tus finanzas personales, organizadas");
});
