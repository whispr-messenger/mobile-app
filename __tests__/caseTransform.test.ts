import { toSnakeCase, snakecaseKeys } from "../src/utils/caseTransform";

describe("toSnakeCase", () => {
  it("converts a camelCase string to snake_case", () => {
    expect(toSnakeCase("camelCase")).toBe("camel_case");
  });

  it("converts a longer camelCase identifier", () => {
    expect(toSnakeCase("firstNameLastName")).toBe("first_name_last_name");
  });

  it("returns an empty string unchanged", () => {
    expect(toSnakeCase("")).toBe("");
  });

  it("lowercases every uppercase letter and prefixes it with underscore", () => {
    expect(toSnakeCase("ABC")).toBe("_a_b_c");
  });

  it("leaves all-lowercase strings untouched", () => {
    expect(toSnakeCase("already_snake")).toBe("already_snake");
  });

  it("does not touch digits", () => {
    expect(toSnakeCase("user123Id")).toBe("user123_id");
  });
});

describe("snakecaseKeys", () => {
  it("converts a flat object's keys to snake_case", () => {
    expect(snakecaseKeys({ firstName: "Ada", lastName: "Lovelace" })).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
    });
  });

  it("recursively converts nested objects", () => {
    expect(
      snakecaseKeys({
        userInfo: { firstName: "Ada", phoneNumber: "+33" },
      }),
    ).toEqual({
      user_info: { first_name: "Ada", phone_number: "+33" },
    });
  });

  it("recursively maps arrays of objects", () => {
    expect(
      snakecaseKeys([{ firstName: "Ada" }, { firstName: "Grace" }]),
    ).toEqual([{ first_name: "Ada" }, { first_name: "Grace" }]);
  });

  it("preserves Date instances without converting their internals", () => {
    const d = new Date("2025-01-01T00:00:00Z");
    const result = snakecaseKeys({ createdAt: d }) as { created_at: Date };
    expect(result.created_at).toBe(d);
  });

  it("returns null unchanged", () => {
    expect(snakecaseKeys(null)).toBeNull();
  });

  it("returns undefined unchanged", () => {
    expect(snakecaseKeys(undefined)).toBeUndefined();
  });

  it("returns primitive values untouched", () => {
    expect(snakecaseKeys("hello")).toBe("hello");
    expect(snakecaseKeys(42)).toBe(42);
    expect(snakecaseKeys(true)).toBe(true);
  });

  it("handles an empty object", () => {
    expect(snakecaseKeys({})).toEqual({});
  });
});
