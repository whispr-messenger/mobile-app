import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { primary: "#000", secondary: "#222" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

import { MessageSearch } from "../src/components/Chat/MessageSearch";

describe("MessageSearch", () => {
  it("returns null when not visible", () => {
    const { toJSON } = render(
      <MessageSearch
        visible={false}
        onClose={() => {}}
        onSearch={() => {}}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the search input when visible", () => {
    const { getByPlaceholderText } = render(
      <MessageSearch
        visible={true}
        onClose={() => {}}
        onSearch={() => {}}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    expect(getByPlaceholderText("Rechercher dans les messages")).toBeTruthy();
  });

  it("calls onSearch when typing", () => {
    const onSearch = jest.fn();
    const { getByPlaceholderText } = render(
      <MessageSearch
        visible={true}
        onClose={() => {}}
        onSearch={onSearch}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    fireEvent.changeText(
      getByPlaceholderText("Rechercher dans les messages"),
      "hello",
    );
    expect(onSearch).toHaveBeenCalledWith("hello");
  });

  it("shows the results counter when results exist", () => {
    const { getByText } = render(
      <MessageSearch
        visible={true}
        onClose={() => {}}
        onSearch={() => {}}
        resultsCount={5}
        currentIndex={2}
      />,
    );
    expect(getByText("3 / 5")).toBeTruthy();
  });

  it("shows 'no results' when query is set but resultsCount is 0", () => {
    const { getByPlaceholderText, getByText } = render(
      <MessageSearch
        visible={true}
        onClose={() => {}}
        onSearch={() => {}}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    fireEvent.changeText(
      getByPlaceholderText("Rechercher dans les messages"),
      "x",
    );
    expect(getByText("Aucun résultat trouvé")).toBeTruthy();
  });

  it("clears the query when clear button is tapped", () => {
    const onSearch = jest.fn();
    const { getByPlaceholderText, UNSAFE_getAllByType } = render(
      <MessageSearch
        visible={true}
        onClose={() => {}}
        onSearch={onSearch}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    fireEvent.changeText(
      getByPlaceholderText("Rechercher dans les messages"),
      "abc",
    );
    onSearch.mockClear();

    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    // ts[0] = close (back), ts[1] = clear (only present when query is non-empty)
    fireEvent.press(ts[1]);
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("calls onClose when back button is pressed", () => {
    const onClose = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <MessageSearch
        visible={true}
        onClose={onClose}
        onSearch={() => {}}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("invokes onPrevious and onNext when navigation buttons are pressed", () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <MessageSearch
        visible={true}
        onClose={() => {}}
        onSearch={() => {}}
        resultsCount={3}
        currentIndex={1}
        onPrevious={onPrev}
        onNext={onNext}
      />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    // [close, prev, next]
    fireEvent.press(ts[1]);
    fireEvent.press(ts[2]);
    expect(onPrev).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });
});
