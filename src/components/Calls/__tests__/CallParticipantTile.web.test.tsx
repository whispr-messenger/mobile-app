/**
 * @jest-environment jsdom
 */
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

jest.mock("livekit-client", () => ({
  Track: { Source: { Camera: "camera", Microphone: "microphone" } },
}));

// Map react-native imports to react-native-web so <View>/<Text> render to the
// DOM. Raw <video>/<audio> JSX tags in the component then become real DOM
// elements and the useRef refs populate as expected.
jest.mock("react-native", () => require("react-native-web"));

import { CallParticipantTile } from "../CallParticipantTile.web";

type MockTrack = {
  attach: jest.Mock;
  detach: jest.Mock;
};

const makeParticipant = (opts: {
  identity: string;
  name?: string;
  isLocal?: boolean;
  videoTrack?: MockTrack;
  audioTrack?: MockTrack;
}) => {
  const videoPublication = opts.videoTrack
    ? { videoTrack: opts.videoTrack }
    : undefined;
  const audioPublication = opts.audioTrack
    ? { audioTrack: opts.audioTrack }
    : undefined;
  return {
    identity: opts.identity,
    name: opts.name,
    isLocal: opts.isLocal ?? false,
    getTrackPublication: jest.fn((source: string) => {
      if (source === "camera") return videoPublication;
      if (source === "microphone") return audioPublication;
      return undefined;
    }),
  };
};

const renderInDom = (ui: React.ReactElement) => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(ui);
  });
  return {
    container,
    rerender: (next: React.ReactElement) => {
      act(() => {
        root.render(next);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

describe("CallParticipantTile (web)", () => {
  it("renders the placeholder with the initial letter when no video track", () => {
    const p = makeParticipant({ identity: "alice" });
    const { container, unmount } = renderInDom(
      <CallParticipantTile participant={p as any} />,
    );
    expect(container.textContent).toContain("A");
    unmount();
  });

  it("attaches the video track on mount and detaches on unmount", () => {
    const videoTrack: MockTrack = { attach: jest.fn(), detach: jest.fn() };
    const p = makeParticipant({ identity: "bob", videoTrack });
    const { unmount } = renderInDom(
      <CallParticipantTile participant={p as any} />,
    );
    expect(videoTrack.attach).toHaveBeenCalledTimes(1);
    unmount();
    expect(videoTrack.detach).toHaveBeenCalledTimes(1);
  });

  it("attaches remote audio for a non-local participant and detaches on unmount", () => {
    const audioTrack: MockTrack = { attach: jest.fn(), detach: jest.fn() };
    const p = makeParticipant({
      identity: "carol",
      isLocal: false,
      audioTrack,
    });
    const { unmount } = renderInDom(
      <CallParticipantTile participant={p as any} />,
    );
    expect(audioTrack.attach).toHaveBeenCalledTimes(1);
    unmount();
    expect(audioTrack.detach).toHaveBeenCalledTimes(1);
  });

  it("never attaches audio for the local participant (echo prevention)", () => {
    const audioTrack: MockTrack = { attach: jest.fn(), detach: jest.fn() };
    const p = makeParticipant({
      identity: "me",
      isLocal: true,
      audioTrack,
    });
    const { unmount } = renderInDom(
      <CallParticipantTile participant={p as any} />,
    );
    expect(audioTrack.attach).not.toHaveBeenCalled();
    unmount();
    expect(audioTrack.detach).not.toHaveBeenCalled();
  });

  it("attaches audio on rerender when the track appears after mount", () => {
    const pWithoutTrack = makeParticipant({
      identity: "dave",
      isLocal: false,
    });
    const audioTrack: MockTrack = { attach: jest.fn(), detach: jest.fn() };
    const pWithTrack = makeParticipant({
      identity: "dave",
      isLocal: false,
      audioTrack,
    });

    const { rerender, unmount } = renderInDom(
      <CallParticipantTile participant={pWithoutTrack as any} />,
    );
    expect(audioTrack.attach).not.toHaveBeenCalled();

    rerender(<CallParticipantTile participant={pWithTrack as any} />);
    expect(audioTrack.attach).toHaveBeenCalledTimes(1);

    unmount();
  });
});
