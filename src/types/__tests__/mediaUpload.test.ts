import {
  getMediaUploadOverlayState,
  type MediaSendClientMetadata,
} from "../mediaUpload";

describe("getMediaUploadOverlayState", () => {
  it("hides overlay when message is not sending", () => {
    expect(getMediaUploadOverlayState("sent", { uploadProgress: 50 })).toEqual({
      visible: false,
      indeterminate: false,
    });
  });

  it("shows percent during uploading phase", () => {
    const meta: MediaSendClientMetadata = {
      uploadPhase: "uploading",
      uploadProgress: 42,
    };
    expect(getMediaUploadOverlayState("sending", meta)).toEqual({
      visible: true,
      progress: 42,
      label: "42 %",
      indeterminate: false,
    });
  });

  it("shows indeterminate label during sharing", () => {
    expect(
      getMediaUploadOverlayState("sending", { uploadPhase: "sharing" }),
    ).toMatchObject({
      visible: true,
      label: "Partage…",
      indeterminate: true,
    });
  });
});
