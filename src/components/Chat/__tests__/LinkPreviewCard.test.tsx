/**
 * Tests for LinkPreviewCard - on doit refuser d'ouvrir une URL avec un
 * schema autre que http/https, sinon un backend compromis pourrait pousser
 * `javascript:` ou `intent:` dans un message et obtenir de l'execution
 * arbitraire cote client (WHISPR-1328).
 */

import React from "react";
import { Linking } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#000", secondary: "#444", tertiary: "#888" },
    }),
  }),
}));

import { LinkPreviewCard } from "./src/components/Chat/LinkPreviewCard";
import type { MessageLinkPreview } from "./src/types/messaging";

const basePreview = (url: string): MessageLinkPreview => ({
  url,
  canonicalUrl: url,
  title: "Title",
  description: "desc",
  domain: "example.com",
  siteName: "Example",
  imageUrl: undefined,
});

const flush = async () => {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
};

describe("LinkPreviewCard URL scheme guard", () => {
  let openSpy: jest.SpyInstance;
  let canOpenSpy: jest.SpyInstance;

  beforeEach(() => {
    openSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    canOpenSpy = jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
  });

  afterEach(() => {
    openSpy.mockRestore();
    canOpenSpy.mockRestore();
  });

  it("opens https URLs through Linking.openURL", async () => {
    const { getByRole } = render(
      <LinkPreviewCard
        preview={basePreview("https://example.com")}
        isSent={false}
      />,
    );
    fireEvent.press(getByRole("link"));
    await flush();
    expect(openSpy).toHaveBeenCalledWith("https://example.com");
  });

  it("opens http URLs through Linking.openURL", async () => {
    const { getByRole } = render(
      <LinkPreviewCard
        preview={basePreview("http://example.com")}
        isSent={false}
      />,
    );
    fireEvent.press(getByRole("link"));
    await flush();
    expect(openSpy).toHaveBeenCalledWith("http://example.com");
  });

  it("never calls Linking.openURL for javascript: scheme", async () => {
    const { getByRole } = render(
      <LinkPreviewCard
        preview={basePreview("javascript:alert(1)")}
        isSent={false}
      />,
    );
    fireEvent.press(getByRole("link"));
    await flush();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("never calls Linking.openURL for intent: scheme", async () => {
    const { getByRole } = render(
      <LinkPreviewCard
        preview={basePreview("intent://attacker#Intent;scheme=http;end")}
        isSent={false}
      />,
    );
    fireEvent.press(getByRole("link"));
    await flush();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("never calls Linking.openURL for file: scheme", async () => {
    const { getByRole } = render(
      <LinkPreviewCard
        preview={basePreview("file:///etc/passwd")}
        isSent={false}
      />,
    );
    fireEvent.press(getByRole("link"));
    await flush();
    expect(openSpy).not.toHaveBeenCalled();
  });
});
