/**
 * Panneau complet d'emojis (spec : réactions rapides + « Plus » + grille Unicode).
 */

import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
  useWindowDimensions,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import {
  EMOJI_PICKER_CATEGORIES,
  filterCategoriesBySearch,
  type EmojiCategory,
} from "../../data/emojiPickerData";
import { validateReactionEmoji } from "../../utils/reactionEmoji";

export interface EmojiPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Appelé quand un emoji valide est choisi */
  onSelect: (emoji: string) => void;
  title?: string;
  /** Si false, pas de validation stricte (insertion dans un texte) */
  validateForReaction?: boolean;
  /** Fermer le panneau après sélection (désactiver pour enchaîner plusieurs emojis) */
  closeOnSelect?: boolean;
}

const COLUMN_COUNT = 8;

export const EmojiPickerSheet: React.FC<EmojiPickerSheetProps> = ({
  visible,
  onClose,
  onSelect,
  title = "Choisir un emoji",
  validateForReaction = true,
  closeOnSelect = true,
}) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getThemeColors, getFontSize } = useTheme();
  const themeColors = getThemeColors();
  const [search, setSearch] = useState("");
  const [activeKey, setActiveKey] = useState(
    EMOJI_PICKER_CATEGORIES[0]?.key ?? "recent",
  );

  const filteredCategories = useMemo(
    () => filterCategoriesBySearch(search),
    [search],
  );

  const activeCategory: EmojiCategory | undefined = useMemo(() => {
    if (search.trim()) {
      return undefined;
    }
    return (
      EMOJI_PICKER_CATEGORIES.find((c) => c.key === activeKey) ??
      EMOJI_PICKER_CATEGORIES[0]
    );
  }, [activeKey, search]);

  const gridEmojis = useMemo(() => {
    if (search.trim()) {
      const set = new Set<string>();
      const out: string[] = [];
      for (const c of filteredCategories) {
        for (const e of c.emojis) {
          if (!set.has(e)) {
            set.add(e);
            out.push(e);
          }
        }
      }
      return out;
    }
    return activeCategory?.emojis ?? [];
  }, [search, filteredCategories, activeCategory]);

  const cellSize = Math.floor((width - 32 - 8) / COLUMN_COUNT) - 4;

  const pick = useCallback(
    (emoji: string) => {
      if (validateForReaction) {
        const v = validateReactionEmoji(emoji);
        if (!v.ok) {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          return;
        }
      }
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onSelect(emoji);
      setSearch("");
      if (closeOnSelect) {
        onClose();
      }
    },
    [onSelect, onClose, validateForReaction, closeOnSelect],
  );

  const renderEmoji = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={[styles.emojiCell, { width: cellSize, height: cellSize }]}
        onPress={() => pick(item)}
        activeOpacity={0.65}
      >
        <Text
          style={[
            styles.emojiChar,
            { fontSize: Math.min(28, cellSize * 0.55) },
          ]}
        >
          {item}
        </Text>
      </TouchableOpacity>
    ),
    [cellSize, pick],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              maxHeight: "78%",
              backgroundColor: themeColors.background.secondary,
            },
          ]}
        >
          <View style={styles.handle} />
          <LinearGradient
            colors={["rgba(255, 122, 92, 0.35)", "rgba(79, 70, 229, 0.25)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <Text
              style={[
                styles.title,
                { color: colors.text.light, fontSize: getFontSize("lg") },
              ]}
            >
              {title}
            </Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher une catégorie…"
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.searchInput}
            />
          </LinearGradient>

          {!search.trim() && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={EMOJI_PICKER_CATEGORIES}
              keyExtractor={(c) => c.key}
              contentContainerStyle={styles.tabsRow}
              renderItem={({ item: c }) => {
                const active = c.key === activeKey;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setActiveKey(c.key);
                      if (Platform.OS !== "web") {
                        Haptics.selectionAsync();
                      }
                    }}
                    style={[
                      styles.tabChip,
                      active && styles.tabChipActive,
                      {
                        borderColor: active
                          ? colors.primary.main
                          : "transparent",
                        backgroundColor: active
                          ? "rgba(255,122,92,0.25)"
                          : "rgba(255,255,255,0.08)",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabLabel,
                        {
                          color: active
                            ? colors.text.light
                            : themeColors.text.secondary,
                          fontWeight: active ? "700" : "500",
                        },
                      ]}
                    >
                      {c.labelFr}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {search.trim() && (
            <Text
              style={[
                styles.hint,
                {
                  color: themeColors.text.secondary,
                  fontSize: getFontSize("sm"),
                },
              ]}
            >
              {filteredCategories.length === 0
                ? "Aucune catégorie — essayez un autre mot-clé"
                : `${gridEmojis.length} emojis dans les catégories trouvées`}
            </Text>
          )}

          <FlatList
            data={gridEmojis}
            keyExtractor={(item, i) => `${item}-${i}`}
            numColumns={COLUMN_COUNT}
            renderItem={renderEmoji}
            contentContainerStyle={styles.gridContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text
                style={[styles.empty, { color: themeColors.text.tertiary }]}
              >
                Aucun emoji à afficher
              </Text>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 10, 26, 0.55)",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginTop: 8,
    marginBottom: 4,
  },
  headerGradient: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  title: {
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    color: colors.text.light,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tabsRow: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  tabChipActive: {},
  tabLabel: {
    fontSize: 13,
  },
  hint: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  emojiCell: {
    justifyContent: "center",
    alignItems: "center",
    margin: 2,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  emojiChar: {},
  empty: {
    textAlign: "center",
    padding: 24,
  },
});
