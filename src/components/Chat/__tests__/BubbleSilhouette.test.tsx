/**
 * Tests for BubbleSilhouette — pure SVG path renderer for chat bubbles.
 * Verifies it renders with various size/side/tail combos and that the path
 * mirroring + adaptive radius branches are exercised.
 */

import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("react-native-svg", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement("Svg", props, children),
    Path: (props: Record<string, unknown>) =>
      React.createElement("Path", props),
  };
});

import { BubbleSilhouette } from "../BubbleSilhouette";

describe("BubbleSilhouette", () => {
  it("renders a right-side bubble with tail at default size", () => {
    const { toJSON } = render(
      <BubbleSilhouette width={200} height={60} side="right" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders a left-side bubble (path is mirrored)", () => {
    const { toJSON } = render(
      <BubbleSilhouette width={200} height={60} side="left" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders without tail for non-terminal bubbles in a burst", () => {
    const { toJSON } = render(
      <BubbleSilhouette
        width={200}
        height={60}
        side="right"
        withTail={false}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it("uses adaptive corner radius for small/pill-sized bubbles", () => {
    // h ≤ 2 * RADIUS forces r = h/2 (pill shape)
    const { toJSON } = render(
      <BubbleSilhouette width={120} height={20} side="right" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it("renders a stroked outline when stroke prop is set", () => {
    const tree = render(
      <BubbleSilhouette
        width={150}
        height={50}
        side="right"
        stroke="#fff"
        strokeWidth={2}
      />,
    );
    // The Path element should carry stroke + zero fill.
    const json = tree.toJSON();
    expect(JSON.stringify(json)).toContain("stroke");
  });

  it("renders a left mirrored shape without tail", () => {
    const { toJSON } = render(
      <BubbleSilhouette width={200} height={60} side="left" withTail={false} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it("returns null when width or height is non-positive", () => {
    const { toJSON } = render(
      <BubbleSilhouette width={0} height={50} side="right" />,
    );
    expect(toJSON()).toBeNull();

    const { toJSON: toJSON2 } = render(
      <BubbleSilhouette width={150} height={0} side="left" />,
    );
    expect(toJSON2()).toBeNull();
  });

  it("renders with custom fill colour for masks", () => {
    const tree = render(
      <BubbleSilhouette width={150} height={50} side="right" fill="#ff0000" />,
    );
    expect(JSON.stringify(tree.toJSON())).toContain("#ff0000");
  });
});
