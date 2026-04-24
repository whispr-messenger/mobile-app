/**
 * TextFormatter - Simple Markdown parser for message formatting
 * Supports: **bold**, *italic*, `code`
 */

import React from "react";
import { Text, TextStyle, StyleSheet, StyleProp } from "react-native";
import { colors } from "../theme/colors";

// Extract color values for StyleSheet.create() to avoid runtime resolution issues
const PRIMARY_MAIN_COLOR = colors.primary.main;
const TEXT_LIGHT_COLOR = colors.text.light;

interface FormattedTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  boldStyle?: TextStyle;
  italicStyle?: TextStyle;
  codeStyle?: TextStyle;
  searchQuery?: string;
  highlightStyle?: TextStyle;
}

interface TextSegment {
  text: string;
  type: "normal" | "bold" | "italic" | "code";
}

// Ordered by priority: code > bold > italic.
const MARKDOWN_MATCHERS: Array<{
  regex: RegExp;
  type: Exclude<TextSegment["type"], "normal">;
}> = [
  { regex: /^`([^`]+)`/, type: "code" },
  { regex: /^\*\*([^*]+)\*\*/, type: "bold" },
  { regex: /^\*([^*]+)\*/, type: "italic" },
];

const matchNextDelimiter = (
  text: string,
  index: number,
): { type: TextSegment["type"]; content: string; length: number } | null => {
  const slice = text.substring(index);
  for (const { regex, type } of MARKDOWN_MATCHERS) {
    const match = slice.match(regex);
    if (match) {
      return { type, content: match[1], length: match[0].length };
    }
  }
  return null;
};

/**
 * Parse markdown text into segments
 */
const parseMarkdown = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  let currentIndex = 0;
  let currentText = "";

  const flushNormal = () => {
    if (currentText) {
      segments.push({ text: currentText, type: "normal" });
      currentText = "";
    }
  };

  while (currentIndex < text.length) {
    const matched = matchNextDelimiter(text, currentIndex);
    if (matched) {
      flushNormal();
      segments.push({ text: matched.content, type: matched.type });
      currentIndex += matched.length;
      continue;
    }
    currentText += text[currentIndex];
    currentIndex++;
  }

  flushNormal();
  return segments;
};

/**
 * Highlight search query in text
 */
const highlightSearchQuery = (
  text: string,
  query?: string,
): Array<{ text: string; highlighted: boolean }> => {
  if (!query || !text) return [{ text, highlighted: false }];

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQuery, lastIndex);

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, index),
        highlighted: false,
      });
    }
    parts.push({
      text: text.substring(index, index + query.length),
      highlighted: true,
    });
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), highlighted: false });
  }

  return parts.length > 0 ? parts : [{ text, highlighted: false }];
};

/**
 * FormattedText component that renders markdown-formatted text
 */
export const FormattedText: React.FC<FormattedTextProps> = ({
  text,
  style,
  boldStyle,
  italicStyle,
  codeStyle,
  searchQuery,
  highlightStyle,
}) => {
  const segments = parseMarkdown(text);

  const renderSegment = (segment: TextSegment, segmentIndex: number) => {
    const highlightedParts = highlightSearchQuery(segment.text, searchQuery);

    return (
      <Text key={segmentIndex}>
        {highlightedParts.map((part, partIndex) => {
          const baseStyles: StyleProp<TextStyle>[] = part.highlighted
            ? ([style, highlightStyle || styles.highlight].filter(
                Boolean,
              ) as StyleProp<TextStyle>[])
            : style
              ? [style]
              : [];

          switch (segment.type) {
            case "bold":
              return (
                <Text
                  key={partIndex}
                  style={[...baseStyles, styles.bold, boldStyle]}
                >
                  {part.text}
                </Text>
              );
            case "italic":
              return (
                <Text
                  key={partIndex}
                  style={[...baseStyles, styles.italic, italicStyle]}
                >
                  {part.text}
                </Text>
              );
            case "code":
              return (
                <Text
                  key={partIndex}
                  style={[...baseStyles, styles.code, codeStyle]}
                >
                  {part.text}
                </Text>
              );
            default:
              return (
                <Text key={partIndex} style={baseStyles}>
                  {part.text}
                </Text>
              );
          }
        })}
      </Text>
    );
  };

  return (
    <Text style={style}>
      {segments.map((segment, index) => renderSegment(segment, index))}
    </Text>
  );
};

const styles = StyleSheet.create({
  bold: {
    fontWeight: "700",
  },
  italic: {
    fontStyle: "italic",
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  highlight: {
    backgroundColor: PRIMARY_MAIN_COLOR,
    color: TEXT_LIGHT_COLOR,
    paddingHorizontal: 2,
    borderRadius: 3,
  },
});
