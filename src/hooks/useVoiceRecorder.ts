import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";

let AudioModule: any = null;
let triedLoadingAudioModule = false;

function getAudioModule(): any | null {
  if (AudioModule) return AudioModule;
  if (triedLoadingAudioModule) return null;
  triedLoadingAudioModule = true;
  try {
    const expoAv = require("expo-av");
    AudioModule = expoAv.Audio;
    return AudioModule;
  } catch (error) {
    console.warn(
      "[useVoiceRecorder] expo-av not available for recording:",
      error,
    );
    return null;
  }
}

// Derive a Safari-compatible MIME on web; keep HIGH_QUALITY preset on native.
// expo-av's HIGH_QUALITY preset forces `audio/webm` on web, which iOS Safari
// refuses with NotSupportedError. Safari (iOS + macOS) supports `audio/mp4`.
export const buildRecordingOptions = () => {
  const audioModule = getAudioModule();
  const base = audioModule?.RecordingOptionsPresets?.HIGH_QUALITY ?? {};
  if (Platform.OS === "ios" || Platform.OS === "android") {
    return {
      ...base,
      android: {
        ...(base?.android ?? {}),
        extension: ".m4a",
        outputFormat:
          audioModule?.AndroidOutputFormat?.MPEG_4 ??
          base?.android?.outputFormat,
        audioEncoder:
          audioModule?.AndroidAudioEncoder?.AAC ?? base?.android?.audioEncoder,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        ...(base?.ios ?? {}),
        extension: ".m4a",
        outputFormat:
          audioModule?.IOSOutputFormat?.MPEG4AAC ?? base?.ios?.outputFormat,
        audioQuality:
          audioModule?.IOSAudioQuality?.MAX ?? base?.ios?.audioQuality,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
    };
  }
  const webMime =
    typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "audio/webm";
  return {
    ...base,
    web: { mimeType: webMime, bitsPerSecond: 128000 },
  };
};

function inferAudioMimeFromFilename(filename?: string | null): string {
  const extension = filename?.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "m4a":
    case "mp4":
      return "audio/mp4";
    case "mp3":
      return "audio/mpeg";
    case "aac":
      return "audio/aac";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "caf":
      return "audio/x-caf";
    default:
      return "audio/mp4";
  }
}

function canonicalizeAudioMime(mime?: string | null): string {
  const normalized = mime?.split(";")[0]?.trim().toLowerCase();
  switch (normalized) {
    case "audio/x-m4a":
    case "audio/m4a":
      return "audio/mp4";
    default:
      return normalized || "audio/mp4";
  }
}

function forceAudioUploadFilename(filename: string, mimeType: string): string {
  if (canonicalizeAudioMime(mimeType) !== "audio/mp4") {
    return filename;
  }
  const baseName = filename.replace(/\.[^/.]+$/, "") || `voice-${Date.now()}`;
  return `${baseName}.mp4`;
}

async function remapAudioUploadUri(
  uri: string,
  filename: string,
  mimeType: string,
): Promise<string> {
  if (Platform.OS === "web") {
    return uri;
  }
  if (canonicalizeAudioMime(mimeType) !== "audio/mp4") {
    return uri;
  }
  if (!uri.startsWith("file://")) {
    return uri;
  }
  if (/\.mp4$/i.test(uri)) {
    return uri;
  }

  const cacheRoot =
    (FileSystem as any).cacheDirectory ||
    (FileSystem as any).documentDirectory ||
    "";
  if (!cacheRoot) {
    return uri;
  }

  const targetUri = `${cacheRoot}${filename}`;
  try {
    await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(
      () => {},
    );
    await FileSystem.copyAsync({ from: uri, to: targetUri });
    return targetUri;
  } catch (error) {
    console.warn("[useVoiceRecorder] Failed to remap audio upload URI:", error);
    return uri;
  }
}

export interface RecordedAudio {
  uri: string;
  filename: string;
  mimeType: string;
  duration: number;
}

export interface UseVoiceRecorderOptions {
  onRecorded: (audio: RecordedAudio) => void;
}

export interface UseVoiceRecorderResult {
  isRecording: boolean;
  duration: number;
  wavePhase: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
}

export function useVoiceRecorder({
  onRecorded,
}: UseVoiceRecorderOptions): UseVoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [wavePhase, setWavePhase] = useState(0);
  const recordingRef = useRef<any>(null);
  const recordingMimeRef = useRef<string | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onRecordedRef = useRef(onRecorded);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
  }, [onRecorded]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      setWavePhase(0);
      return;
    }
    const waveformTimer = setInterval(() => {
      setWavePhase((prev) => prev + 1);
    }, 140);
    return () => clearInterval(waveformTimer);
  }, [isRecording]);

  // Pre-warm mic permission on web so the long-press doesn't trigger the
  // browser permission prompt synchronously (which freezes the tap UI).
  // On web getUserMedia permission is sticky per-origin once granted.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const audioModule = getAudioModule();
    if (!audioModule?.requestPermissionsAsync) return;
    audioModule.requestPermissionsAsync().catch(() => {});
  }, []);

  const start = useCallback(async () => {
    const audioModule = getAudioModule();
    if (!audioModule) {
      Alert.alert("Erreur", "L'enregistrement audio n'est pas disponible.");
      return;
    }

    // Flip UI to "Recording" immediately so the user gets instant feedback.
    // Reverted in the catch block on failure.
    setIsRecording(true);
    setDuration(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const permission = await audioModule.requestPermissionsAsync();
      if (permission.status !== "granted") {
        setIsRecording(false);
        Alert.alert(
          "Permission requise",
          "Nous avons besoin de votre permission pour enregistrer des messages vocaux.",
        );
        return;
      }

      await audioModule.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const options = buildRecordingOptions();
      recordingMimeRef.current =
        Platform.OS === "web" ? (options?.web?.mimeType ?? null) : null;
      const { recording } = await audioModule.Recording.createAsync(options);
      recordingRef.current = recording;

      // Start duration timer
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } catch (error: any) {
      console.error("[useVoiceRecorder] Error starting recording:", error);
      setIsRecording(false);
      setDuration(0);
      Alert.alert("Erreur", "Impossible de démarrer l'enregistrement.");
    }
  }, []);

  const stop = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      const activeRecording = recordingRef.current;
      const displayedDuration = duration;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      const stopResult = await activeRecording.stopAndUnloadAsync();
      const stopStatus =
        typeof stopResult === "object" && stopResult !== null
          ? stopResult
          : null;
      const audioModule = getAudioModule();
      if (audioModule) {
        await audioModule.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      }

      const uri = activeRecording.getURI();
      const status =
        typeof activeRecording.getStatusAsync === "function"
          ? await activeRecording.getStatusAsync()
          : null;
      recordingRef.current = null;
      setIsRecording(false);
      setDuration(0);

      if (!uri) {
        console.error("[useVoiceRecorder] No URI from recording");
        return;
      }

      // Only send if recording is at least 1 second
      const durationMs =
        Number(
          (status as { durationMillis?: number } | null)?.durationMillis,
        ) ||
        Number(
          (stopStatus as { durationMillis?: number } | null)?.durationMillis,
        ) ||
        displayedDuration * 1000;
      const durationSec = durationMs / 1000;
      if (durationSec < 1) {
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // On web the URI is a `blob:...uuid` with no extension; backends derive
      // filenames from the URL path and reject blobs. Rewrap with a proper
      // File so the resulting object URL carries a real name + MIME.
      let finalUri = uri;
      let finalFilename = uri.split("/").pop() || `voice-${Date.now()}.m4a`;
      if (!/\.[a-z0-9]+$/i.test(finalFilename)) {
        finalFilename = `${finalFilename}.m4a`;
      }
      let finalMimeType = canonicalizeAudioMime(
        recordingMimeRef.current || inferAudioMimeFromFilename(finalFilename),
      );
      finalFilename = forceAudioUploadFilename(finalFilename, finalMimeType);
      finalUri = await remapAudioUploadUri(
        finalUri,
        finalFilename,
        finalMimeType,
      );
      if (Platform.OS === "web" && uri.startsWith("blob:")) {
        try {
          const mime = recordingMimeRef.current || "audio/webm";
          const ext = mime === "audio/mp4" ? "m4a" : "webm";
          const fileName = `voice-${Date.now()}.${ext}`;
          const response = await fetch(uri);
          const blob = await response.blob();
          const file = new File([blob], fileName, { type: mime });
          finalUri = URL.createObjectURL(file);
          finalFilename = fileName;
          finalMimeType = mime;
        } catch (rewrapError) {
          console.warn(
            "[useVoiceRecorder] Failed to rewrap blob, sending raw URI:",
            rewrapError,
          );
        }
      }
      recordingMimeRef.current = null;

      onRecordedRef.current({
        uri: finalUri,
        filename: finalFilename,
        mimeType: finalMimeType,
        duration: Math.max(1, Math.round(durationSec)),
      });
    } catch (error: any) {
      console.error("[useVoiceRecorder] Error stopping recording:", error);
      setIsRecording(false);
      setDuration(0);
      recordingRef.current = null;
    }
  }, [duration]);

  const cancel = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      recordingMimeRef.current = null;
      setIsRecording(false);
      setDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("[useVoiceRecorder] Error cancelling recording:", error);
      setIsRecording(false);
      setDuration(0);
      recordingRef.current = null;
      recordingMimeRef.current = null;
    }
  }, []);

  return {
    isRecording,
    duration,
    wavePhase,
    start,
    stop,
    cancel,
  };
}
