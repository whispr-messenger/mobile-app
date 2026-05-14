import { useToastStore } from "./src/store/toastStore";

beforeEach(() => {
  useToastStore.setState({ visible: false, message: "", type: "info" });
});

describe("toastStore", () => {
  it("show() sets visible=true with the given message and type", () => {
    useToastStore.getState().show("Nouveau message", "info");
    const { visible, message, type } = useToastStore.getState();
    expect(visible).toBe(true);
    expect(message).toBe("Nouveau message");
    expect(type).toBe("info");
  });

  it("show() defaults type to 'info' when omitted", () => {
    useToastStore.getState().show("test");
    expect(useToastStore.getState().type).toBe("info");
  });

  it("hide() sets visible=false", () => {
    useToastStore.getState().show("msg", "success");
    useToastStore.getState().hide();
    expect(useToastStore.getState().visible).toBe(false);
  });

  it("supports all toast types", () => {
    const types = ["success", "error", "info", "warning"] as const;
    for (const t of types) {
      useToastStore.getState().show("x", t);
      expect(useToastStore.getState().type).toBe(t);
    }
  });
});
