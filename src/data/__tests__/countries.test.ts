import {
  countries,
  getCountriesByRegion,
  getRegions,
  searchCountries,
  type Country,
} from "../countries";

describe("countries dataset", () => {
  it("ships a non-empty list of countries", () => {
    expect(countries.length).toBeGreaterThan(50);
  });

  it("has the expected shape on every entry", () => {
    countries.forEach((c: Country) => {
      expect(c.id).toEqual(expect.any(String));
      expect(c.name).toEqual(expect.any(String));
      expect(c.code).toMatch(/^\+\d+$/);
      expect(c.flag).toEqual(expect.any(String));
      expect(c.region).toEqual(expect.any(String));
    });
  });

  it("has unique ids", () => {
    const ids = countries.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("searchCountries", () => {
  it("matches by name (case insensitive)", () => {
    const fr = searchCountries("france");
    expect(fr.some((c) => c.name.toLowerCase().includes("france"))).toBe(true);
  });

  it("matches by code (the leading + matters too — verified separately)", () => {
    const result = searchCountries("33");
    expect(result.some((c) => c.code.includes("33"))).toBe(true);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchCountries("zzzz_no_match_zzzz")).toEqual([]);
  });
});

describe("getCountriesByRegion", () => {
  it("returns only countries from the requested region", () => {
    const regions = getRegions();
    const region = regions[0];
    const filtered = getCountriesByRegion(region);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((c) => c.region === region)).toBe(true);
  });

  it("returns an empty list for an unknown region", () => {
    expect(getCountriesByRegion("Atlantis")).toEqual([]);
  });
});

describe("getRegions", () => {
  it("returns the unique set of regions present in the dataset", () => {
    const regions = getRegions();
    expect(new Set(regions).size).toBe(regions.length);
    expect(regions.length).toBeGreaterThan(1);
  });
});
