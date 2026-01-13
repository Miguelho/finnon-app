import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestCategoryIcon } from "./suggest-icon";

test('suggestCategoryIcon matches "Comida" to ForkKnife', () => {
  const result = suggestCategoryIcon("Comida");
  assert.equal(result.primary, "ForkKnife");
  assert.equal(result.confidence, "high");
  assert.equal(result.matchedOn, "comida");
});

test('suggestCategoryIcon matches "Supermercado" to ShoppingCart', () => {
  const result = suggestCategoryIcon("Supermercado");
  assert.equal(result.primary, "ShoppingCart");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Gasolina" to GasPump', () => {
  const result = suggestCategoryIcon("Gasolina");
  assert.equal(result.primary, "GasPump");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Salario" to Briefcase', () => {
  const result = suggestCategoryIcon("Salario");
  assert.equal(result.primary, "Briefcase");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Gimnasio" to Barbell', () => {
  const result = suggestCategoryIcon("Gimnasio");
  assert.equal(result.primary, "Barbell");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Mascotas" to PawPrint', () => {
  const result = suggestCategoryIcon("Mascotas");
  assert.equal(result.primary, "PawPrint");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Veterinario" to PawPrint', () => {
  const result = suggestCategoryIcon("Veterinario");
  assert.equal(result.primary, "PawPrint");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Ocio" to GameController', () => {
  const result = suggestCategoryIcon("Ocio");
  assert.equal(result.primary, "GameController");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Familia" to UsersThree', () => {
  const result = suggestCategoryIcon("Familia");
  assert.equal(result.primary, "UsersThree");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Niños" to UsersThree', () => {
  const result = suggestCategoryIcon("Niños");
  assert.equal(result.primary, "UsersThree");
  assert.equal(result.confidence, "medium");
  assert.ok(result.suggestions.includes("Gift"));
  assert.ok(result.suggestions.includes("BookOpen"));
});

test('suggestCategoryIcon matches "Ninos" to UsersThree', () => {
  const result = suggestCategoryIcon("Ninos");
  assert.equal(result.primary, "UsersThree");
  assert.equal(result.confidence, "medium");
  assert.ok(result.suggestions.includes("Gift"));
  assert.ok(result.suggestions.includes("BookOpen"));
});

test('suggestCategoryIcon matches "Infancia" to Gift', () => {
  const result = suggestCategoryIcon("Infancia");
  assert.equal(result.primary, "Gift");
  assert.equal(result.confidence, "medium");
  assert.ok(result.suggestions.includes("UsersThree"));
  assert.ok(result.suggestions.includes("BookOpen"));
});

test('suggestCategoryIcon matches "groceries" to ShoppingCart', () => {
  const result = suggestCategoryIcon("groceries");
  assert.equal(result.primary, "ShoppingCart");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "restaurant" to ForkKnife', () => {
  const result = suggestCategoryIcon("restaurant");
  assert.equal(result.primary, "ForkKnife");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "gym" to Barbell', () => {
  const result = suggestCategoryIcon("gym");
  assert.equal(result.primary, "Barbell");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "salary" to Briefcase', () => {
  const result = suggestCategoryIcon("salary");
  assert.equal(result.primary, "Briefcase");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon handles "Educación" with accent', () => {
  const result = suggestCategoryIcon("Educación");
  assert.equal(result.primary, "GraduationCap");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon handles "Música" with accent', () => {
  const result = suggestCategoryIcon("Música");
  assert.equal(result.primary, "MusicNotes");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon handles "Teléfono" with accent', () => {
  const result = suggestCategoryIcon("Teléfono");
  assert.equal(result.primary, "Phone");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Comida y restaurantes"', () => {
  const result = suggestCategoryIcon("Comida y restaurantes");
  assert.equal(result.primary, "ForkKnife");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Transporte / Gasolina"', () => {
  const result = suggestCategoryIcon("Transporte / Gasolina");
  assert.equal(result.primary, "GasPump");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon matches "Ropa y accesorios"', () => {
  const result = suggestCategoryIcon("Ropa y accesorios");
  assert.equal(result.primary, "TShirt");
  assert.equal(result.confidence, "high");
});

test('suggestCategoryIcon falls back for "XYZ Random"', () => {
  const result = suggestCategoryIcon("XYZ Random");
  assert.equal(result.primary, "Tag");
  assert.equal(result.confidence, "low");
});

test("suggestCategoryIcon returns suggestions on fallback", () => {
  const result = suggestCategoryIcon("asdfghjkl");
  assert.ok(result.suggestions.includes("Tag"));
  assert.ok(result.suggestions.length > 0);
});

test("suggestCategoryIcon handles empty string", () => {
  const result = suggestCategoryIcon("");
  assert.equal(result.primary, "Tag");
  assert.equal(result.confidence, "low");
});

test("suggestCategoryIcon handles whitespace only", () => {
  const result = suggestCategoryIcon("   ");
  assert.equal(result.primary, "Tag");
  assert.equal(result.confidence, "low");
});

test('suggestCategoryIcon uses medium confidence for partial matches', () => {
  const result = suggestCategoryIcon("restauración");
  assert.equal(result.confidence, "medium");
  assert.equal(result.primary, "ForkKnife");
});

test("suggestCategoryIcon is case-insensitive", () => {
  assert.equal(suggestCategoryIcon("COMIDA").primary, "ForkKnife");
  assert.equal(suggestCategoryIcon("comida").primary, "ForkKnife");
  assert.equal(suggestCategoryIcon("Comida").primary, "ForkKnife");
  assert.equal(suggestCategoryIcon("CoMiDa").primary, "ForkKnife");
});
