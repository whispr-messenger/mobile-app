/**
 * TextFormatter - Simple Markdown parser for message formatting
 * Supports: **bold**, *italic*, `code`
 */

import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';

interface FormattedTextProps {
  text: string;
  style?: TextStyle;
  boldStyle?: TextStyle;
  italicStyle?: TextStyle;
  codeStyle?: TextStyle;
}

interface TextSegment {
  text: string;
  type: 'normal' | 'bold' | 'italic' | 'code';
}

/**
 * Parse markdown text into segments
 */
const parseMarkdown = (text: string): TextSegment[] => {
  const segments: TextSegment[] = [];
  let currentIndex = 0;
  let currentText = '';

  while (currentIndex < text.length) {
    // Check for code blocks (backticks) - highest priority
    const codeMatch = text.substring(currentIndex).match(/^`([^`]+)`/);
    if (codeMatch) {
      if (currentText) {
        segments.push({ text: currentText, type: 'normal' });
        currentText = '';
      }
      segments.push({ text: codeMatch[1], type: 'code' });
      currentIndex += codeMatch[0].length;
      continue;
    }

    // Check for bold (**text**)
    const boldMatch = text.substring(currentIndex).match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      if (currentText) {
        segments.push({ text: currentText, type: 'normal' });
        currentText = '';
      }
      segments.push({ text: boldMatch[1], type: 'bold' });
      currentIndex += boldMatch[0].length;
      continue;
    }

    // Check for italic (*text*)
    const italicMatch = text.substring(currentIndex).match(/^\*([^*]+)\*/);
    if (italicMatch) {
      if (currentText) {
        segments.push({ text: currentText, type: 'normal' });
        currentText = '';
      }
      segments.push({ text: italicMatch[1], type: 'italic' });
      currentIndex += italicMatch[0].length;
      continue;
    }

    // Regular character
    currentText += text[currentIndex];
    currentIndex++;
  }

  if (currentText) {
    segments.push({ text: currentText, type: 'normal' });
  }

  return segments;
};

/**
 * Highlight search query in text
 */
const highlightSearchQuery = (text: string, query?: string): Array<{ text: string; highlighted: boolean }> => {
  if (!query || !text) return [{ text, highlighted: false }];
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQuery, lastIndex);
  
  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, index), highlighted: false });
    }
    parts.push({ text: text.substring(index, index + query.length), highlighted: true });
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
          const baseStyle = part.highlighted ? [style, highlightStyle || styles.highlight] : style;
          
          switch (segment.type) {
            case 'bold':
              return (
                <Text key={partIndex} style={[...baseStyle, styles.bold, boldStyle]}>
                  {part.text}
                </Text>
              );
            case 'italic':
              return (
                <Text key={partIndex} style={[...baseStyle, styles.italic, italicStyle]}>
                  {part.text}
                </Text>
              );
            case 'code':
              return (
                <Text key={partIndex} style={[...baseStyle, styles.code, codeStyle]}>
                  {part.text}
                </Text>
              );
            default:
              return <Text key={partIndex} style={baseStyle}>{part.text}</Text>;
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
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  highlight: {
    backgroundColor: colors.primary.main,
    color: colors.text.light,
    paddingHorizontal: 2,
    borderRadius: 3,
  },
});

