/**
 * AppealStatusScreen - Timeline de suivi d'une contestation
 * Shows appeal progress with timeline steps and pull-to-refresh
 */

import React, { useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { colors } from "../../theme/colors";
import { useModerationStore } from "../../store/moderationStore";
import type { Appeal, AppealStatus } from "../../types/moderation";

type RouteParams = {
  AppealStatus: { sanctionId: string };
};

interface TimelineStep {
  key: AppealStatus;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const TIMELINE_STEPS: TimelineStep[] = [
  {
    key: "pending",
    label: "Soumise",
    icon: "document-text",
    description: "Votre contestation a été enregistrée",
  },
  {
    key: "under_review",
    label: "En cours d'examen",
    icon: "eye",
    description: "Un modérateur examine votre dossier",
  },
];

const STATUS_ORDER: AppealStatus[] = [
  "pending",
  "under_review",
  "accepted",
  "rejected",
];

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const AppealStatusScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "AppealStatus">>();
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const { myAppeals, loading, fetchMyAppeals } = useModerationStore();
  const { sanctionId } = route.params;

  useEffect(() => {
    fetchMyAppeals();
  }, [fetchMyAppeals]);

  const onRefresh = useCallback(() => {
    fetchMyAppeals();
  }, [fetchMyAppeals]);

  const appeal = useMemo(
    () => myAppeals.find((a) => a.sanctionId === sanctionId),
    [myAppeals, sanctionId],
  );

  const currentStepIndex = useMemo(() => {
    if (!appeal) return 0;
    return STATUS_ORDER.indexOf(appeal.status);
  }, [appeal]);

  const isAccepted = appeal?.status === "accepted";
  const isRejected = appeal?.status === "rejected";
  const isFinal = isAccepted || isRejected;

  if (loading && !appeal) {
    return (
      <LinearGradient
        colors={colors.background.gradient.app}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        <SafeAreaView style={styles.container} edges={["top"]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
            <Text
              style={[
                styles.loadingText,
                { color: themeColors.text.secondary },
              ]}
            >
              Chargement...
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={colors.background.gradient.app}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientContainer}
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: "transparent" }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={themeColors.text.primary}
            />
          </TouchableOpacity>
          <Text
            style={[styles.headerTitle, { color: themeColors.text.primary }]}
          >
            Suivi de la contestation
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor={colors.primary.main}
            />
          }
        >
          {!appeal ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="help-circle-outline"
                size={64}
                color={themeColors.text.tertiary}
              />
              <Text
                style={[
                  styles.emptyText,
                  { color: themeColors.text.secondary },
                ]}
              >
                Contestation introuvable
              </Text>
            </View>
          ) : (
            <>
              {/* Appeal Summary */}
              <View
                style={[
                  styles.summaryCard,
                  { backgroundColor: themeColors.background.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: themeColors.text.tertiary },
                  ]}
                >
                  Votre motif
                </Text>
                <Text
                  style={[
                    styles.summaryText,
                    { color: themeColors.text.primary },
                  ]}
                >
                  {appeal.reason}
                </Text>
                <Text
                  style={[
                    styles.summaryDate,
                    { color: themeColors.text.tertiary },
                  ]}
                >
                  Soumise le {formatDate(appeal.createdAt)}
                </Text>
              </View>

              {/* Timeline */}
              <View
                style={[
                  styles.timelineCard,
                  { backgroundColor: themeColors.background.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.timelineTitle,
                    { color: themeColors.text.primary },
                  ]}
                >
                  Progression
                </Text>

                {TIMELINE_STEPS.map((step, index) => {
                  const stepIndex = STATUS_ORDER.indexOf(step.key);
                  const isReached = currentStepIndex >= stepIndex;
                  const isCurrent = currentStepIndex === stepIndex && !isFinal;
                  const stepColor = isReached
                    ? colors.primary.main
                    : themeColors.text.tertiary + "40";

                  return (
                    <View key={step.key} style={styles.timelineStep}>
                      {/* Connector line */}
                      {index > 0 && (
                        <View
                          style={[
                            styles.connectorLine,
                            {
                              backgroundColor: isReached
                                ? colors.primary.main
                                : themeColors.text.tertiary + "20",
                            },
                          ]}
                        />
                      )}

                      <View style={styles.timelineStepContent}>
                        {/* Circle */}
                        <View
                          style={[
                            styles.stepCircle,
                            { backgroundColor: stepColor },
                          ]}
                        >
                          {isReached ? (
                            <Ionicons
                              name={isCurrent ? step.icon : "checkmark"}
                              size={16}
                              color="#FFFFFF"
                            />
                          ) : (
                            <View style={styles.stepCircleInner} />
                          )}
                        </View>

                        {/* Step Info */}
                        <View style={styles.stepInfo}>
                          <Text
                            style={[
                              styles.stepLabel,
                              {
                                color: isReached
                                  ? themeColors.text.primary
                                  : themeColors.text.tertiary,
                              },
                            ]}
                          >
                            {step.label}
                          </Text>
                          <Text
                            style={[
                              styles.stepDescription,
                              {
                                color: isReached
                                  ? themeColors.text.secondary
                                  : themeColors.text.tertiary,
                              },
                            ]}
                          >
                            {step.description}
                          </Text>
                          {isReached && step.key === "pending" && (
                            <Text
                              style={[
                                styles.stepDate,
                                { color: themeColors.text.tertiary },
                              ]}
                            >
                              {formatDate(appeal.createdAt)}
                            </Text>
                          )}
                          {isReached &&
                            step.key === "under_review" &&
                            appeal.updatedAt !== appeal.createdAt && (
                              <Text
                                style={[
                                  styles.stepDate,
                                  { color: themeColors.text.tertiary },
                                ]}
                              >
                                {formatDate(appeal.updatedAt)}
                              </Text>
                            )}
                        </View>
                      </View>
                    </View>
                  );
                })}

                {/* Final Step: Accepted or Rejected */}
                {isFinal && (
                  <View style={styles.timelineStep}>
                    <View
                      style={[
                        styles.connectorLine,
                        { backgroundColor: isAccepted ? "#4CD964" : "#FF3B30" },
                      ]}
                    />
                    <View style={styles.timelineStepContent}>
                      <View
                        style={[
                          styles.stepCircle,
                          {
                            backgroundColor: isAccepted ? "#4CD964" : "#FF3B30",
                          },
                        ]}
                      >
                        <Ionicons
                          name={
                            isAccepted ? "checkmark-circle" : "close-circle"
                          }
                          size={16}
                          color="#FFFFFF"
                        />
                      </View>
                      <View style={styles.stepInfo}>
                        <Text
                          style={[
                            styles.stepLabel,
                            { color: isAccepted ? "#4CD964" : "#FF3B30" },
                          ]}
                        >
                          {isAccepted ? "Acceptée" : "Rejetée"}
                        </Text>
                        <Text
                          style={[
                            styles.stepDescription,
                            { color: themeColors.text.secondary },
                          ]}
                        >
                          {isAccepted
                            ? "Votre sanction a été levée"
                            : "Votre contestation a été rejetée"}
                        </Text>
                        {appeal.resolvedAt && (
                          <Text
                            style={[
                              styles.stepDate,
                              { color: themeColors.text.tertiary },
                            ]}
                          >
                            {formatDate(appeal.resolvedAt)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Reviewer Notes (if rejected) */}
              {isRejected && appeal.reviewerNotes && (
                <View
                  style={[
                    styles.notesCard,
                    { backgroundColor: themeColors.background.secondary },
                  ]}
                >
                  <View style={styles.notesHeader}>
                    <Ionicons
                      name="chatbox-ellipses-outline"
                      size={18}
                      color={themeColors.text.tertiary}
                    />
                    <Text
                      style={[
                        styles.notesTitle,
                        { color: themeColors.text.primary },
                      ]}
                    >
                      Notes du modérateur
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.notesText,
                      { color: themeColors.text.secondary },
                    ]}
                  >
                    {appeal.reviewerNotes}
                  </Text>
                </View>
              )}

              {/* Success Card (if accepted) */}
              {isAccepted && (
                <View
                  style={[
                    styles.successCard,
                    { backgroundColor: "rgba(76, 217, 100, 0.1)" },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={32} color="#4CD964" />
                  <Text style={styles.successText}>
                    Votre sanction a été levée. Vous pouvez reprendre
                    l'utilisation normale de l'application.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
  },
  placeholder: {
    width: 36,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  summaryDate: {
    fontSize: 12,
  },
  timelineCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 20,
  },
  timelineStep: {
    position: "relative",
    marginBottom: 4,
  },
  connectorLine: {
    position: "absolute",
    left: 15,
    top: -16,
    width: 2,
    height: 16,
  },
  timelineStepContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  stepCircleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  stepInfo: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 20,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  stepDate: {
    fontSize: 11,
    marginTop: 4,
  },
  notesCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  notesTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  successCard: {
    borderRadius: 12,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#4CD964",
    fontWeight: "500",
  },
});
