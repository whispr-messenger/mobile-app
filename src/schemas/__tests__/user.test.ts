import {
  OtpCodeSchema,
  PhoneNumberSchema,
  ProfileSetupFormSchema,
  UserSchema,
  UsernameSchema,
} from "../user";

describe("UserSchema", () => {
  it("parses a fully-populated backend user", () => {
    const user = UserSchema.parse({
      id: "u-1",
      username: "alice",
      phone_number: "+33611111111",
      first_name: "Alice",
      last_name: "Wonderland",
      avatar_url: "https://cdn/a.png",
      last_seen: "2026-05-01T00:00:00Z",
      is_active: true,
    });
    expect(user.username).toBe("alice");
  });

  it("accepts minimal user (id + username only) and defaults is_active to true", () => {
    const user = UserSchema.parse({ id: "u-1", username: "bob" });
    expect(user.is_active).toBe(true);
  });

  it("treats null values for nullable string fields as valid", () => {
    expect(() =>
      UserSchema.parse({ id: "u-1", username: "bob", first_name: null }),
    ).not.toThrow();
  });
});

describe("UsernameSchema", () => {
  it.each(["abc", "alice_42", "Привет_2026", "Δοκιμή"])("accepts %s", (val) => {
    expect(() => UsernameSchema.parse(val)).not.toThrow();
  });

  it.each([
    ["ab", /au moins 3/],
    ["a".repeat(21), /20 caractères/],
    ["alice space", /Lettres/],
    ["alice-dash", /Lettres/],
    ["", /au moins 3/],
  ])("rejects %s", (val, errPattern) => {
    expect(() => UsernameSchema.parse(val)).toThrow(errPattern);
  });

  it("trims surrounding whitespace before validation", () => {
    expect(UsernameSchema.parse("  alice  ")).toBe("alice");
  });
});

describe("PhoneNumberSchema", () => {
  it("accepts E.164 numbers", () => {
    expect(() => PhoneNumberSchema.parse("+33611111111")).not.toThrow();
    expect(() => PhoneNumberSchema.parse("+1234567")).not.toThrow();
  });

  it("rejects numbers without leading +", () => {
    expect(() => PhoneNumberSchema.parse("33611111111")).toThrow();
  });

  it("rejects numbers with spaces", () => {
    expect(() => PhoneNumberSchema.parse("+33 6 11 11 11 11")).toThrow();
  });
});

describe("OtpCodeSchema", () => {
  it("accepts a 6-digit code", () => {
    expect(OtpCodeSchema.parse("123456")).toBe("123456");
  });

  it.each(["12345", "1234567", "12345a", ""])("rejects %s", (val) => {
    expect(() => OtpCodeSchema.parse(val)).toThrow();
  });
});

describe("ProfileSetupFormSchema", () => {
  it("accepts a fully populated profile", () => {
    const parsed = ProfileSetupFormSchema.parse({
      firstName: "Alice",
      lastName: "Wonderland",
      username: "alice",
    });
    expect(parsed.firstName).toBe("Alice");
  });

  it("accepts an empty lastName", () => {
    expect(() =>
      ProfileSetupFormSchema.parse({
        firstName: "Alice",
        lastName: "",
        username: "alice",
      }),
    ).not.toThrow();
  });

  it("rejects empty firstName", () => {
    expect(() =>
      ProfileSetupFormSchema.parse({
        firstName: "",
        lastName: "",
        username: "alice",
      }),
    ).toThrow(/prénom/);
  });

  it("flags an invalid username through the same UsernameSchema rules", () => {
    expect(() =>
      ProfileSetupFormSchema.parse({
        firstName: "Alice",
        lastName: "",
        username: "ab",
      }),
    ).toThrow(/au moins 3/);
  });
});
