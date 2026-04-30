import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../Chat/Avatar";
import { colors, spacing, typography } from "../../theme";

interface ProfilePictureBlockProps {
  uri?: string;
  name: string;
  editable?: boolean;
  onPress?: () => void;
  label?: string;
  scaleAnim?: Animated.Value;
}

export const ProfilePictureBlock: React.FC<ProfilePictureBlockProps> = ({
  uri,
  name,
  editable = false,
  onPress,
  label,
  scaleAnim,
}) => {
  const content = (
    <>
      <TouchableOpacity
        onPress={onPress}
        style={styles.container}
        disabled={!editable}
        activeOpacity={editable ? 0.7 : 1}
      >
        <Avatar uri={uri} name={name} size={120} />

        {editable && (
          <View style={styles.editOverlay}>
            <Ionicons name="camera" size={18} color="#333" />
          </View>
        )}
      </TouchableOpacity>

      {label && <Text style={styles.label}>{label}</Text>}
    </>
  );

  if (scaleAnim) {
    return (
      <Animated.View
        style={[styles.section, { transform: [{ scale: scaleAnim }] }]}
      >
        {content}
      </Animated.View>
    );
  }

  return <View style={styles.section}>{content}</View>;
};

const styles = StyleSheet.create({
  section: {
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  container: {
    position: "relative",
    marginBottom: spacing.md,
  },
  editOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.main,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.text.light,
    textAlign: "center",
    opacity: 0.9,
  },
});
