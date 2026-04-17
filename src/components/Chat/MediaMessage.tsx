/**
 * MediaMessage - Display media content (images, videos, files)
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../context/ThemeContext";
import { colors, withOpacity } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { TokenService } from "../../services/TokenService";

/**
 * Resolve a media-service blob/thumbnail URL to a fresh presigned URL.
 * The blob/thumbnail endpoints now return 200 JSON `{ url, expiresAt }`
 * (previously a 302 redirect). We fetch with Bearer, extract `url`, and
 * reject any URL pointing at internal cluster hostnames — the browser
 * cannot resolve those and they trigger Mixed Content on https pages.
 */
function useResolvedMediaUrl(uri: string | undefined): {
  resolvedUri: string;
  loading: boolean;
  error: boolean;
} {
  const [resolvedUri, setResolvedUri] = useState(uri || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uri) {
      setResolvedUri("");
      return;
    }

    // Only resolve blob/thumbnail endpoints that need auth
    const needsAuth =
      uri.includes("/media/v1/") &&
      (uri.includes("/blob") || uri.includes("/thumbnail"));

    if (!needsAuth) {
      setResolvedUri(uri);
      return;
    }

    let cancelled = false;
    // Clear while resolving — the raw /blob or /thumbnail URL needs an auth
    // header that <Image> can't send, so leaving it would break the fallback.
    setResolvedUri("");
    setLoading(true);
    setError(false);

    (async () => {
      try {
        const token = await TokenService.getAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const response = await fetch(uri, {
          headers,
          redirect: "follow",
        });

        if (cancelled) return;

        if (!response.ok) {
          console.warn(
            `[MediaMessage] Failed to resolve media URL: HTTP ${response.status}`,
          );
          setError(true);
          setResolvedUri("");
          return;
        }

        // New contract (media-service deploy/preprod ≥ cedf7f9b):
        // `/blob` and `/thumbnail` return `{ url, expiresAt }` JSON, not a
        // 302 redirect. Parse JSON first; fall back to response.url for the
        // legacy 302 redirect contract.
        let presigned: string | null = null;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          try {
            const body = (await response.json()) as { url?: string | null };
            presigned = body?.url ?? null;
          } catch {
            presigned = null;
          }
        } else if (response.url && response.url !== uri) {
          // Legacy: fetch followed a 302 — response.url is the presigned URL
          presigned = response.url;
        }

        // Reject internal cluster URLs — the browser cannot resolve
        // minio.minio.svc.cluster.local and http:// on https pages breaks
        // under Mixed Content. Better to surface an error than a broken img.
        const isReachable =
          typeof presigned === "string" &&
          presigned.length > 0 &&
          !presigned.includes(".svc.cluster.local") &&
          !presigned.includes("minio.minio") &&
          !/^http:\/\/(minio|[\d.]+:)/i.test(presigned);

        if (isReachable) {
          setResolvedUri(presigned as string);
        } else {
          if (presigned) {
            console.warn(
              "[MediaMessage] Rejected unreachable media URL (cluster-internal):",
              presigned,
            );
          }
          setError(true);
          setResolvedUri("");
        }
      } catch (err) {
        if (cancelled) return;
        console.warn("[MediaMessage] Error resolving media URL:", err);
        setError(true);
        setResolvedUri("");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return { resolvedUri, loading, error };
}

// Import expo-av avec gestion d'erreur
let Video: any = null;
let ResizeMode: any = null;
try {
  const expoAv = require("expo-av");
  Video = expoAv.Video;
  ResizeMode = expoAv.ResizeMode;
} catch (error) {
  console.warn("[MediaMessage] expo-av not available, using fallback:", error);
}

interface MediaMessageProps {
  uri: string;
  type: "image" | "video" | "file";
  filename?: string;
  size?: number;
  thumbnailUri?: string;
}

export const MediaMessage: React.FC<MediaMessageProps> = ({
  uri,
  type,
  filename,
  size,
  thumbnailUri,
}) => {
  const { getThemeColors } = useTheme();
  const themeColors = getThemeColors();
  const [showFullImage, setShowFullImage] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const thumbnailVideoRef = useRef<any>(null); // Ref for thumbnail video
  const playerVideoRef = useRef<any>(null); // Ref for full-screen player
  const [videoStatus, setVideoStatus] = useState<any>({});
  const [thumbnailError, setThumbnailError] = useState(false);

  // Resolve blob/thumbnail URLs to fresh presigned URLs
  const { resolvedUri: resolvedMainUri, loading: mainLoading } =
    useResolvedMediaUrl(uri);
  const { resolvedUri: resolvedThumbUri } = useResolvedMediaUrl(
    thumbnailUri || uri,
  );

  // Cleanup video refs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      thumbnailVideoRef.current?.unloadAsync?.().catch(() => {});
      playerVideoRef.current?.unloadAsync?.().catch(() => {});
    };
  }, []);

  // Preload and auto-play video when modal opens
  useEffect(() => {
    if (
      showVideoPlayer &&
      Video &&
      playerVideoRef.current &&
      type === "video"
    ) {
      const playVideo = async () => {
        try {
          // Load video first
          try {
            const loadResult = await playerVideoRef.current.loadAsync({
              uri: resolvedMainUri,
            });
            console.log(
              "[MediaMessage] Video preloaded",
              loadResult ? "with status" : "no status",
            );

            // Play immediately after load
            const playResult = await playerVideoRef.current.playAsync();
            console.log(
              "[MediaMessage] Video playing",
              playResult ? "with status" : "no status",
            );
          } catch (loadError: any) {
            console.error(
              "[MediaMessage] Error in loadAsync/playAsync:",
              loadError?.message || loadError,
            );
            // Don't rethrow, let the component handle it
          }
        } catch (error: any) {
          console.error(
            "[MediaMessage] Error loading/playing video:",
            error?.message || error,
          );
          // Don't show alert here, let onError handle it
        }
      };

      // Start loading immediately
      playVideo();
    }
  }, [showVideoPlayer, uri, type]);

  if (type === "image") {
    return (
      <>
        <TouchableOpacity
          onPress={() => setShowFullImage(true)}
          activeOpacity={0.9}
          style={styles.imageContainer}
        >
          {mainLoading ? (
            <View
              style={[
                styles.image,
                {
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "rgba(26, 31, 58, 0.4)",
                },
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary.main} />
            </View>
          ) : (
            <Image
              source={{ uri: resolvedThumbUri || resolvedMainUri }}
              style={styles.image}
              resizeMode="cover"
            />
          )}
        </TouchableOpacity>

        <Modal
          visible={showFullImage}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFullImage(false)}
        >
          <TouchableOpacity
            style={styles.fullImageOverlay}
            activeOpacity={1}
            onPress={() => setShowFullImage(false)}
          >
            <View style={styles.fullImageContainer}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowFullImage(false)}
              >
                <Ionicons name="close" size={28} color={colors.text.light} />
              </TouchableOpacity>
              <Image
                source={{ uri: resolvedMainUri }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  if (type === "file") {
    return (
      <View
        style={[
          styles.fileContainer,
          { backgroundColor: themeColors.background.secondary },
        ]}
      >
        <Ionicons
          name="document"
          size={32}
          color={themeColors.primary}
          style={styles.fileIcon}
        />
        <View style={styles.fileInfo}>
          <Text
            style={[styles.fileName, { color: themeColors.text.primary }]}
            numberOfLines={1}
          >
            {filename || "Fichier"}
          </Text>
          {size && (
            <Text
              style={[styles.fileSize, { color: themeColors.text.secondary }]}
            >
              {(size / 1024).toFixed(1)} KB
            </Text>
          )}
        </View>
      </View>
    );
  }

  // Video with thumbnail and player
  const handleVideoPress = async () => {
    console.log("[MediaMessage] Video pressed, opening player");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!Video) {
      // Fallback: ouvrir dans le lecteur natif
      console.log("[MediaMessage] expo-av not available, opening with Linking");
      try {
        const supported = await Linking.canOpenURL(uri);
        if (supported) {
          await Linking.openURL(uri);
        } else {
          Alert.alert("Erreur", "Impossible d'ouvrir la vidéo.");
        }
      } catch (error) {
        console.error("[MediaMessage] Error opening video:", error);
        Alert.alert("Erreur", "Impossible d'ouvrir la vidéo.");
      }
      return;
    }

    setShowVideoPlayer(true);
  };

  const handleCloseVideo = () => {
    console.log("[MediaMessage] Closing video player");
    if (playerVideoRef.current && Video) {
      try {
        playerVideoRef.current
          .pauseAsync()
          .then(() => playerVideoRef.current?.unloadAsync?.())
          .catch((error: any) => {
            console.error("[MediaMessage] Error stopping video:", error);
          });
      } catch (error) {
        console.error("[MediaMessage] Error pausing video:", error);
      }
    }
    setShowVideoPlayer(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleVideoPress}
        activeOpacity={0.9}
        style={styles.videoContainer}
      >
        {/* Video preview - use Video component for thumbnail to show actual video frame */}
        {Video && resolvedMainUri && !thumbnailError ? (
          <Video
            ref={thumbnailVideoRef}
            source={{ uri: resolvedMainUri }}
            style={styles.videoThumbnail}
            resizeMode={ResizeMode?.COVER || "cover"}
            shouldPlay={false}
            isMuted={true}
            useNativeControls={false}
            onLoad={(status: any) => {
              // Silently ignore null or invalid status to prevent crashes
              if (!status || typeof status !== "object" || status === null) {
                console.log(
                  "[MediaMessage] Video thumbnail loaded (null status, ignoring)",
                );
                return;
              }
              try {
                console.log(
                  "[MediaMessage] Video thumbnail loaded successfully",
                );
                setThumbnailError(false);
              } catch (error: any) {
                // Silently ignore errors
                console.log(
                  "[MediaMessage] Thumbnail load completed (status may be null, ignoring)",
                );
              }
            }}
            onError={(error: any) => {
              console.error(
                "[MediaMessage] Video thumbnail error, using placeholder:",
                error?.message || error,
              );
              setThumbnailError(true);
            }}
            onPlaybackStatusUpdate={(status: any) => {
              // Silently ignore null status updates to prevent crashes
              if (!status || typeof status !== "object" || status === null) {
                return;
              }
              // Do nothing, just prevent errors
            }}
          />
        ) : (
          // Fallback placeholder if Video component not available or error
          <View
            style={[
              styles.videoThumbnail,
              {
                backgroundColor: colors.palette.darkViolet,
                justifyContent: "center",
                alignItems: "center",
              },
            ]}
          >
            <Ionicons name="videocam" size={48} color={colors.text.light} />
          </View>
        )}

        {/* Subtle dark overlay for better contrast */}
        <View style={styles.videoOverlay} />

        {/* Play button only */}
        <View style={styles.videoIconWrapper}>
          <LinearGradient
            colors={[colors.primary.main, colors.palette.violet]}
            style={styles.videoPlayButton}
          >
            <Ionicons name="play" size={32} color={colors.text.light} />
          </LinearGradient>
        </View>
      </TouchableOpacity>

      {/* Video Player Modal */}
      <Modal
        visible={showVideoPlayer}
        transparent
        animationType="fade"
        onRequestClose={handleCloseVideo}
        statusBarTranslucent
      >
        <View style={styles.videoPlayerOverlay}>
          <TouchableOpacity
            style={styles.videoCloseButton}
            onPress={handleCloseVideo}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[
                withOpacity(colors.ui.error, 0.8),
                withOpacity(colors.ui.error, 0.6),
              ]}
              style={styles.videoCloseButtonGradient}
            >
              <Ionicons name="close" size={24} color={colors.text.light} />
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.videoPlayerContainer}>
            {Video ? (
              <>
                {videoStatus && videoStatus.isLoaded ? null : (
                  <ActivityIndicator
                    size="large"
                    color={colors.primary.main}
                    style={styles.videoLoading}
                  />
                )}
                <Video
                  ref={playerVideoRef}
                  source={{ uri: resolvedMainUri }}
                  style={styles.videoPlayer}
                  useNativeControls={true}
                  resizeMode={ResizeMode?.CONTAIN || "contain"}
                  isLooping={false}
                  shouldPlay={true}
                  isMuted={false}
                  onPlaybackStatusUpdate={(status: any) => {
                    // Completely ignore null/undefined status to prevent crashes
                    if (status == null || typeof status !== "object") {
                      return;
                    }
                    try {
                      // Safely access properties with optional chaining
                      const isLoaded = status?.isLoaded === true;
                      const isPlaying = status?.isPlaying === true;
                      if (status) {
                        setVideoStatus(status);
                      }
                      if (isLoaded && !isPlaying && playerVideoRef.current) {
                        // Auto-play if loaded but not playing
                        playerVideoRef.current.playAsync().catch((err: any) => {
                          console.error(
                            "[MediaMessage] Error auto-playing:",
                            err?.message || err,
                          );
                        });
                      }
                    } catch (error: any) {
                      // Silently catch all errors to prevent crashes
                      console.error(
                        "[MediaMessage] Error in onPlaybackStatusUpdate:",
                        error?.message || error,
                      );
                    }
                  }}
                  onLoadStart={() => {
                    console.log("[MediaMessage] Video load started");
                  }}
                  onLoad={(status: any) => {
                    // Completely ignore null/undefined status to prevent crashes
                    if (status == null || typeof status !== "object") {
                      console.log(
                        "[MediaMessage] Video loaded (null/undefined status, ignoring)",
                      );
                      return;
                    }
                    try {
                      // Safely access properties with optional chaining
                      const isLoaded = status?.isLoaded === true;
                      console.log(
                        "[MediaMessage] Video loaded, auto-playing",
                        isLoaded,
                      );
                      if (status) {
                        setVideoStatus(status);
                      }
                      // Auto-play immediately when loaded
                      if (playerVideoRef.current && isLoaded) {
                        playerVideoRef.current.playAsync().catch((err: any) => {
                          console.error(
                            "[MediaMessage] Error playing after load:",
                            err?.message || err,
                          );
                        });
                      }
                    } catch (error: any) {
                      // Silently catch all errors to prevent crashes
                      console.error(
                        "[MediaMessage] Error in onLoad:",
                        error?.message || error,
                      );
                    }
                  }}
                  onError={(error: any) => {
                    // Catch error but don't show alert to avoid interrupting user
                    console.error(
                      "[MediaMessage] Video error:",
                      error?.message || error,
                    );
                  }}
                />
              </>
            ) : (
              <View style={styles.videoFallback}>
                <Ionicons
                  name="videocam"
                  size={64}
                  color={colors.primary.main}
                />
                <Text style={styles.videoFallbackText}>
                  Lecteur vidéo non disponible
                </Text>
                <TouchableOpacity
                  style={styles.videoFallbackButton}
                  onPress={async () => {
                    try {
                      const supported = await Linking.canOpenURL(uri);
                      if (supported) {
                        await Linking.openURL(uri);
                        setShowVideoPlayer(false);
                      } else {
                        Alert.alert("Erreur", "Impossible d'ouvrir la vidéo.");
                      }
                    } catch (error) {
                      console.error("[MediaMessage] Error:", error);
                      Alert.alert("Erreur", "Impossible d'ouvrir la vidéo.");
                    }
                  }}
                >
                  <Text style={styles.videoFallbackButtonText}>
                    Ouvrir dans le lecteur natif
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  imageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    maxWidth: 300,
    maxHeight: 400,
  },
  image: {
    width: "100%",
    minHeight: 150,
    aspectRatio: 4 / 3,
    borderRadius: 12,
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
  },
  fileContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    maxWidth: 250,
  },
  fileIcon: {
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 12,
  },
  videoContainer: {
    width: 250,
    height: 200,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  videoThumbnail: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    zIndex: 1,
  },
  videoIconWrapper: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  videoPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: withOpacity(colors.text.light, 0.3),
  },
  videoPlayerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoCloseButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    borderRadius: 20,
    overflow: "hidden",
  },
  videoCloseButtonGradient: {
    padding: 10,
    borderRadius: 20,
  },
  videoPlayerContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  videoPlayer: {
    width: "100%",
    height: "100%",
  },
  videoLoading: {
    position: "absolute",
    zIndex: 5,
  },
  videoFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  videoFallbackText: {
    marginTop: 16,
    color: colors.text.light,
    fontSize: 16,
    textAlign: "center",
  },
  videoFallbackButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary.main,
  },
  videoFallbackButtonText: {
    color: colors.text.light,
    fontSize: 14,
    fontWeight: "600",
  },
});
