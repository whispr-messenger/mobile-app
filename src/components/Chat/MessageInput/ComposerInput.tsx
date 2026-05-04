import React, { forwardRef } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { formatUsername } from "../../../utils";
import { Avatar } from "../Avatar";

export const MIN_INPUT_HEIGHT = 40;
export const MAX_INPUT_HEIGHT = 120;
export const INPUT_VERTICAL_PADDING = 10;
export const INPUT_LINE_HEIGHT = 20;

export interface MentionMember {
  id: string;
  display_name: string;
  username?: string;
}

interface ComposerInputProps {
  text: string;
  inputHeight: number;
  placeholder: string;
  showMentions: boolean;
  mentionQuery: string;
  members: MentionMember[];
  conversationType: "direct" | "group";
  onChangeText: (text: string) => void;
  onSubmitWeb: () => void;
  onContentSizeChange: (event: {
    nativeEvent: { contentSize: { width: number; height: number } };
  }) => void;
  onMentionSelect: (member: MentionMember) => void;
}

export const ComposerInput = forwardRef<TextInput, ComposerInputProps>(
  (
    {
      text,
      inputHeight,
      placeholder,
      showMentions,
      mentionQuery,
      members,
      conversationType,
      onChangeText,
      onSubmitWeb,
      onContentSizeChange,
      onMentionSelect,
    },
    ref,
  ) => {
    const { getThemeColors } = useTheme();
    const themeColors = getThemeColors();

    return (
      <View
        testID="message-composer-shell"
        style={[
          styles.inputWrapper,
          {
            height: inputHeight,
            backgroundColor: "rgba(11, 17, 36, 0.85)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.2)",
          },
        ]}
      >
        <TextInput
          testID="message-composer-input"
          ref={ref}
          style={[
            styles.input,
            {
              color: themeColors.text.primary,
            },
          ]}
          value={text}
          onChangeText={onChangeText}
          onKeyPress={(event) => {
            if (Platform.OS === "web" && event.nativeEvent.key === "Enter") {
              if (typeof (event as any).preventDefault === "function") {
                (event as any).preventDefault();
              }
              onSubmitWeb();
            }
          }}
          multiline
          scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
          onContentSizeChange={onContentSizeChange}
          placeholder={placeholder}
          placeholderTextColor={themeColors.text.tertiary}
          maxLength={1000}
          textAlignVertical="top"
        />
        {showMentions && conversationType === "group" && members.length > 0 && (
          <View
            style={[
              styles.mentionsList,
              { backgroundColor: "rgba(26, 31, 58, 0.95)" },
            ]}
          >
            <ScrollView style={styles.mentionsScroll} nestedScrollEnabled>
              {members
                .filter((member) => {
                  if (!mentionQuery) return true;
                  const name = (member.display_name || "").toLowerCase();
                  const username = member.username?.toLowerCase() || "";
                  return (
                    name.includes(mentionQuery) ||
                    username.includes(mentionQuery)
                  );
                })
                .slice(0, 5)
                .map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.mentionItem}
                    onPress={() => onMentionSelect(member)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Mentionner ${member.display_name}`}
                  >
                    <Avatar
                      size={32}
                      name={member.display_name}
                      showOnlineBadge={false}
                      isOnline={false}
                    />
                    <View style={styles.mentionInfo}>
                      <Text
                        style={[
                          styles.mentionName,
                          { color: themeColors.text.primary },
                        ]}
                      >
                        {member.display_name}
                      </Text>
                      {member.username && (
                        <Text
                          style={[
                            styles.mentionUsername,
                            { color: themeColors.text.secondary },
                          ]}
                        >
                          {formatUsername(member.username)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  },
);

ComposerInput.displayName = "ComposerInput";

const styles = StyleSheet.create({
  inputWrapper: {
    flex: 1,
    marginRight: 8,
    borderRadius: 20,
    justifyContent: "center",
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: INPUT_VERTICAL_PADDING,
    minHeight: MIN_INPUT_HEIGHT,
    fontSize: 15,
    lineHeight: INPUT_LINE_HEIGHT,
    backgroundColor: "transparent",
  },
  mentionsList: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    right: 0,
    maxHeight: 200,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden",
  },
  mentionsScroll: {
    maxHeight: 200,
  },
  mentionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  mentionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  mentionName: {
    fontSize: 15,
    fontWeight: "600",
  },
  mentionUsername: {
    fontSize: 13,
    marginTop: 2,
  },
});
