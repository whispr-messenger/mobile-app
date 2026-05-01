/**
 * BubbleSilhouette — single SVG path describing a chat bubble with an
 * integrated tail at the bottom corner. Used as a mask so the underlying
 * surface (gradient, BlurView) is rendered as one seamless shape, eliminating
 * the visible seam that appears when a separate tail is stacked on the bubble.
 *
 * Optionally also renders a stroked outline of the same path for received
 * bubbles that need a hairline border.
 */

import React from "react";
import Svg, { Path } from "react-native-svg";

const RADIUS = 18;
// Hand-tuned iMessage-style drop tail. Reference (w=150, h=45, r=18):
//   M18 0 H127 q24 0 25 22 V27 Q150 45 136 45
//   q-5 1 -2 8 Q136.5 56 133 55 129 53 126 49 124 45 116 45
//   H16 Q0 45 -2 25 L-2 20 Q0 0 18 0 Z
// The tail is anchored to the bottom-RIGHT corner (w, h) — its shape is
// invariant under vertical/horizontal growth. Only the straight side edges
// (between the corner curves) stretch when the bubble grows.
// The tail no longer extends horizontally past the bubble (the bottom-right
// corner flows inward into the tail), so TAIL_W is 0. Kept as a named
// constant in case future tweaks add a horizontal overshoot back.
const TAIL_W = 0;
const TAIL_H = 11; // downward extent past the bubble's bottom (tip at h + 11)

interface BubbleSilhouetteProps {
  width: number;
  height: number;
  side: "left" | "right";
  /** When false, draws a simple rounded rectangle without a tail. Used for
   * non-terminal messages in a burst from the same sender (iMessage groups
   * consecutive bubbles, only the last one carries a tail). */
  withTail?: boolean;
  /** When set, renders a stroked outline (no fill) instead of a filled
   * silhouette — used for the hairline border layer over received bubbles. */
  stroke?: string;
  strokeWidth?: number;
  /** Solid fill colour for the mask layer. Mask elements only need their
   * alpha channel; any opaque colour works. */
  fill?: string;
}

function buildRoundedRectPath(w: number, h: number, r: number): string {
  return [
    `M${r} 0`,
    `L${w - r} 0`,
    `Q${w} 0 ${w} ${r}`,
    `V${h - r}`,
    `Q${w} ${h} ${w - r} ${h}`,
    `L${r} ${h}`,
    `Q0 ${h} 0 ${h - r}`,
    `V${r}`,
    `Q0 0 ${r} 0`,
    "Z",
  ].join(" ");
}

function buildRightPath(w: number, h: number, r: number): string {
  // Reference geometry (offsets relative to the bottom-right corner (w, h)):
  //
  //   Three of the four corners are uniform quarter circles of radius r.
  //   Only the bottom-right corner is reshaped to flow into the tail.
  //
  //   Top-left:     L(0, r)  → Q(0, 0) → (r, 0)
  //   Top-right:    L(w, r)  → Q(w, 0) → (w - r, 0)
  //   Bottom-left:  L(0, h - r) → Q(0, h) → (r, h)
  //   Bottom-right: tail (custom)
  //
  // Only the straight side edges (r → h - r) stretch with bubble size.
  return [
    `M${r} 0`,
    `L${w - r} 0`,
    `Q${w} 0 ${w} ${r}`,
    `V${h - r}`,
    // Bottom-right tucked corner that flows into the tail.
    `Q${w} ${h} ${w - 14} ${h}`,
    `q-5 1 -2 8`,
    `Q${w - 13.5} ${h + TAIL_H} ${w - 17} ${h + 10}`,
    `T${w - 24} ${h + 4}`,
    `T${w - 34} ${h}`,
    `H${r}`,
    `Q0 ${h} 0 ${h - r}`,
    `V${r}`,
    `Q0 0 ${r} 0`,
    "Z",
  ].join(" ");
}

/**
 * Mirror an SVG path along the vertical axis x = w/2 (so x → w - x). Works on
 * absolute commands (M, L, H, V, Q, C, T, S, Z) AND relative ones (m, l, h,
 * v, q, c, t, s) — relative dx values flip sign, dy values stay.
 */
function mirrorPathHorizontally(path: string, w: number): string {
  const tokens = path.match(/[a-zA-Z]|-?\d*\.?\d+/g);
  if (!tokens) return path;
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (!/[a-zA-Z]/.test(cmd)) {
      i += 1;
      continue;
    }
    const isRelative = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();
    // Number of params per command.
    const arity: Record<string, number> = {
      M: 2,
      L: 2,
      T: 2,
      H: 1,
      V: 1,
      Q: 4,
      C: 6,
      S: 4,
      Z: 0,
    };
    const n = arity[upper] ?? 0;
    out.push(cmd);
    if (n === 0) {
      i += 1;
      continue;
    }
    const params = tokens.slice(i + 1, i + 1 + n).map(Number);
    i += 1 + n;
    if (upper === "H") {
      out.push(String(isRelative ? -params[0] : w - params[0]));
    } else if (upper === "V") {
      out.push(String(params[0]));
    } else {
      // Pairs: (x, y), (x, y), ...
      for (let k = 0; k < params.length; k += 2) {
        const x = params[k];
        const y = params[k + 1];
        out.push(String(isRelative ? -x : w - x));
        out.push(String(y));
      }
    }
  }
  return out.join(" ");
}

function buildPath(
  w: number,
  h: number,
  side: "left" | "right",
  withTail: boolean,
): string {
  // Adaptive corner radius:
  //  - On single-line bubbles (h ≤ 2*RADIUS) the radius equals h/2 so the
  //    shape becomes a true pill — the side arcs meet in the middle with no
  //    visible vertical edge.
  //  - On taller bubbles the radius caps at RADIUS so the corners stay
  //    moderate and the shape reads as a rounded box, not an over-rounded
  //    candy.
  const r = Math.min(h / 2, w / 2, RADIUS);
  if (!withTail) {
    return buildRoundedRectPath(w, h, r);
  }
  const rightPath = buildRightPath(w, h, r);
  return side === "right" ? rightPath : mirrorPathHorizontally(rightPath, w);
}

export const BubbleSilhouette: React.FC<BubbleSilhouetteProps> = ({
  width,
  height,
  side,
  withTail = true,
  stroke,
  strokeWidth = 1,
  fill = "#000",
}) => {
  if (width <= 0 || height <= 0) return null;
  // The tail extends OUTSIDE the bubble's logical width/height — the SVG
  // viewBox must be enlarged to include it (downward and slightly sideways),
  // otherwise the tail would be clipped by the SVG's bounds.
  const tailExtentX = withTail ? TAIL_W : 0;
  const tailExtentY = withTail ? TAIL_H + 1 : 0;
  const totalHeight = height + tailExtentY;
  const totalWidth = width + tailExtentX;
  const offsetX = side === "left" ? tailExtentX : 0;
  const path = buildPath(width, height, side, withTail);
  return (
    <Svg
      width={totalWidth}
      height={totalHeight}
      viewBox={`${-offsetX} 0 ${totalWidth} ${totalHeight}`}
    >
      <Path
        d={path}
        fill={stroke ? "none" : fill}
        stroke={stroke}
        strokeWidth={stroke ? strokeWidth : 0}
      />
    </Svg>
  );
};

export const BUBBLE_TAIL_WIDTH = TAIL_W;
export const BUBBLE_TAIL_HEIGHT = TAIL_H;
