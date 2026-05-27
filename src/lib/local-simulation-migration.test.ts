import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LEGACY_SIMULATION_KEY,
  MIGRATION_DONE_KEY,
  clearLegacySimulation,
  isMigrationDone,
  legacyToCreateInput,
  markMigrationDone,
  parseLegacySimulation,
  readLegacySimulation,
} from "@/lib/local-simulation-migration";

describe("local-simulation-migration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  describe("parseLegacySimulation", () => {
    it("accepts a well-formed payload and applies defaults", () => {
      const result = parseLegacySimulation({
        name: "  Apartamento ",
        propertyValue: 500_000,
        downPayment: 50_000,
        termMonths: 360,
        annualRate: 11.5,
        startDate: "2024-03-01",
      });
      expect(result).toEqual({
        name: "Apartamento",
        propertyValue: 500_000,
        downPayment: 50_000,
        termMonths: 360,
        annualRate: 11.5,
        startDate: "2024-03-01",
      });
    });

    it("supplies default name and today's startDate when missing or invalid", () => {
      const result = parseLegacySimulation({
        propertyValue: 100_000,
        downPayment: 10_000,
        termMonths: 240,
        annualRate: 9,
        startDate: "not-a-date",
      });
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Simulação importada do navegador");
      expect(result?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("rejects non-object, missing, or invalid values", () => {
      expect(parseLegacySimulation(null)).toBeNull();
      expect(parseLegacySimulation("foo")).toBeNull();
      expect(parseLegacySimulation({})).toBeNull();
      expect(
        parseLegacySimulation({
          propertyValue: -1,
          downPayment: 0,
          termMonths: 360,
          annualRate: 10,
        }),
      ).toBeNull();
      expect(
        parseLegacySimulation({
          propertyValue: 100_000,
          downPayment: 200_000,
          termMonths: 360,
          annualRate: 10,
        }),
      ).toBeNull();
      expect(
        parseLegacySimulation({
          propertyValue: 100_000,
          downPayment: 0,
          termMonths: 360.5,
          annualRate: 10,
        }),
      ).toBeNull();
    });
  });

  describe("readLegacySimulation", () => {
    it("returns null when the key is missing", () => {
      expect(readLegacySimulation()).toBeNull();
    });

    it("returns null when the stored value is not valid JSON", () => {
      window.localStorage.setItem(LEGACY_SIMULATION_KEY, "not json");
      expect(readLegacySimulation()).toBeNull();
    });

    it("parses and returns a valid payload", () => {
      window.localStorage.setItem(
        LEGACY_SIMULATION_KEY,
        JSON.stringify({
          name: "Casa",
          propertyValue: 300_000,
          downPayment: 30_000,
          termMonths: 300,
          annualRate: 10,
          startDate: "2025-01-01",
        }),
      );
      expect(readLegacySimulation()).toEqual({
        name: "Casa",
        propertyValue: 300_000,
        downPayment: 30_000,
        termMonths: 300,
        annualRate: 10,
        startDate: "2025-01-01",
      });
    });
  });

  describe("migration flag helpers", () => {
    it("returns false when the flag is absent", () => {
      expect(isMigrationDone()).toBe(false);
    });

    it("returns true once the flag is set", () => {
      markMigrationDone();
      expect(window.localStorage.getItem(MIGRATION_DONE_KEY)).toBe("1");
      expect(isMigrationDone()).toBe(true);
    });

    it("clears the legacy simulation entry without touching the flag", () => {
      window.localStorage.setItem(LEGACY_SIMULATION_KEY, "{}");
      window.localStorage.setItem(MIGRATION_DONE_KEY, "1");
      clearLegacySimulation();
      expect(window.localStorage.getItem(LEGACY_SIMULATION_KEY)).toBeNull();
      expect(window.localStorage.getItem(MIGRATION_DONE_KEY)).toBe("1");
    });
  });

  describe("legacyToCreateInput", () => {
    it("maps the legacy shape to the API CreateScenarioInput", () => {
      expect(
        legacyToCreateInput({
          name: "Casa",
          propertyValue: 300_000,
          downPayment: 30_000,
          termMonths: 300,
          annualRate: 10,
          startDate: "2025-01-01",
        }),
      ).toEqual({
        name: "Casa",
        propertyValue: 300_000,
        downPayment: 30_000,
        termMonths: 300,
        annualRate: 10,
        startDate: "2025-01-01",
      });
    });
  });
});
