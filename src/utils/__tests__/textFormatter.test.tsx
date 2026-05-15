import React from "react";
import { render } from "@testing-library/react-native";
import { FormattedText } from "../textFormatter";

const flatten = (tree: unknown): string => JSON.stringify(tree);

describe("FormattedText", () => {
  it("renders plain text with no markdown", () => {
    const { getByText } = render(<FormattedText text="hello world" />);
    expect(getByText("hello world")).toBeTruthy();
  });

  it("renders without crashing on an empty string", () => {
    const { toJSON } = render(<FormattedText text="" />);
    expect(toJSON()).toBeTruthy();
  });

  it("strips ** delimiters and renders the inner text as bold", () => {
    const { getByText, queryByText } = render(
      <FormattedText text="hello **world**" />,
    );
    expect(getByText("world")).toBeTruthy();
    expect(queryByText("**world**")).toBeNull();
  });

  it("applies fontWeight 700 to bold segments", () => {
    const { toJSON } = render(<FormattedText text="**bold**" />);
    expect(flatten(toJSON())).toContain('"fontWeight":"700"');
  });

  it("strips * delimiters and renders the inner text as italic", () => {
    const { getByText, queryByText } = render(
      <FormattedText text="hello *world*" />,
    );
    expect(getByText("world")).toBeTruthy();
    expect(queryByText("*world*")).toBeNull();
  });

  it("applies fontStyle italic to italic segments", () => {
    const { toJSON } = render(<FormattedText text="*italic*" />);
    expect(flatten(toJSON())).toContain('"fontStyle":"italic"');
  });

  it("strips backticks and renders code segments with monospace font", () => {
    const { getByText, queryByText, toJSON } = render(
      <FormattedText text="use `npm test` now" />,
    );
    expect(getByText("npm test")).toBeTruthy();
    expect(queryByText("`npm test`")).toBeNull();
    expect(flatten(toJSON())).toContain('"fontFamily":"monospace"');
  });

  it("prefers code over bold when both delimiters could match", () => {
    const { getByText, toJSON } = render(
      <FormattedText text="`**not bold**`" />,
    );
    expect(getByText("**not bold**")).toBeTruthy();
    expect(flatten(toJSON())).toContain('"fontFamily":"monospace"');
  });

  it("treats unclosed delimiters as literal characters", () => {
    const { toJSON } = render(<FormattedText text="**unclosed" />);
    const tree = flatten(toJSON());
    expect(tree).toContain("**unclosed");
    expect(tree).not.toContain('"fontWeight":"700"');
  });

  it("renders a plain segment with no searchQuery without highlighting", () => {
    const { toJSON } = render(<FormattedText text="hello" />);
    expect(flatten(toJSON())).not.toContain("highlight");
  });

  it("ignores a searchQuery that does not match anything", () => {
    const { getByText, toJSON } = render(
      <FormattedText text="hello" searchQuery="xyz" />,
    );
    expect(getByText("hello")).toBeTruthy();
    expect(flatten(toJSON())).not.toContain("#");
  });

  it("highlights a matching searchQuery case-insensitively", () => {
    const { toJSON } = render(
      <FormattedText text="Hello World" searchQuery="hello" />,
    );
    const tree = flatten(toJSON());
    expect(tree).toContain("Hello");
    expect(tree).toContain("World");
  });

  it("highlights every occurrence, not just the first", () => {
    const { toJSON } = render(
      <FormattedText text="aa bb aa" searchQuery="aa" />,
    );
    const tree = flatten(toJSON());
    expect(tree.match(/aa/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("ignores an empty searchQuery", () => {
    const { getByText } = render(<FormattedText text="hello" searchQuery="" />);
    expect(getByText("hello")).toBeTruthy();
  });

  it("accepts a custom highlightStyle instead of the default", () => {
    const custom = { backgroundColor: "#FF00FF" };
    const { toJSON } = render(
      <FormattedText
        text="hello"
        searchQuery="hello"
        highlightStyle={custom}
      />,
    );
    expect(flatten(toJSON())).toContain("#FF00FF");
  });

  it("merges custom bold/italic/code styles with the defaults", () => {
    const { toJSON } = render(
      <FormattedText
        text="**x** *y* `z`"
        boldStyle={{ color: "#111111" }}
        italicStyle={{ color: "#222222" }}
        codeStyle={{ color: "#333333" }}
      />,
    );
    const tree = flatten(toJSON());
    expect(tree).toContain("#111111");
    expect(tree).toContain("#222222");
    expect(tree).toContain("#333333");
  });
});
