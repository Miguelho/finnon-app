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

test("project motivation message switches singular/plural by participants", () => {
  const singular = t(dict, "mobile.home.projectMotivationMessage", {
    participants: 1,
    project: "Viaje",
    percent: 18,
  });
  const plural = t(dict, "mobile.home.projectMotivationMessage", {
    participants: 2,
    project: "Viaje",
    percent: 18,
  });

  assert.equal(
    singular,
    "Este mes acercas Viaje un 18% más. Sigue así para cumplir el objetivo."
  );
  assert.equal(
    plural,
    "Este mes acercáis Viaje un 18% más. Seguid así para cumplir el objetivo."
  );
});

test("project completed description switches singular/plural by participants", () => {
  const singular = t(dict, "mobile.home.projectCompletedDescription", {
    participants: 1,
    amount: "€500",
  });
  const plural = t(dict, "mobile.home.projectCompletedDescription", {
    participants: 2,
    amount: "€500",
  });

  assert.equal(singular, "Has ahorrado €500.");
  assert.equal(plural, "Habéis ahorrado €500.");
});

test("project all done title switches singular/plural by participants", () => {
  const singular = t(dict, "mobile.home.projectAllDoneTitle", { participants: 1 });
  const plural = t(dict, "mobile.home.projectAllDoneTitle", { participants: 2 });

  assert.equal(singular, "¡Has cumplido todos tus proyectos!");
  assert.equal(plural, "¡Habéis cumplido todos vuestros proyectos!");
});

test("getDictionary falls back to es", () => {
  const fallback = getDictionary("fr");
  assert.equal(fallback.common.tagline, "Tus finanzas personales, organizadas");
});
