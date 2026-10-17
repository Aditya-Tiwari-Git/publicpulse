import { it, expect } from "vitest";
import { geographicReference } from "../src/lib/geography";
import type { Geography } from "../src/types";
const locations: Geography[] = [
  { id: "s1", name: "State A", level: "state", parent_id: null },
  { id: "s2", name: "State B", level: "state", parent_id: null },
  { id: "d1", name: "District", level: "district", parent_id: "s1" },
  { id: "d2", name: "District", level: "district", parent_id: "s2" },
  { id: "l1", name: "Town", level: "locality", parent_id: "d1" },
  { id: "w1", name: "Ward 1", level: "ward", parent_id: "l1" },
  { id: "w2", name: "Ward 2", level: "ward", parent_id: "d2" },
];
it("resolves the deepest validated location within the selected hierarchy", () => {
  expect(
    geographicReference(
      {
        state: "State A",
        district: "District",
        locality: "Town",
        ward: "Ward 1",
      },
      locations,
    ),
  ).toBe("w1");
});
it("does not assign a reference outside the selected parent hierarchy", () => {
  expect(
    geographicReference(
      { state: "State A", district: "District", ward: "Ward 2" },
      locations,
    ),
  ).toBe("d1");
});
