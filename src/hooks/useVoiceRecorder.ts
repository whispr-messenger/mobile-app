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
  isPaused: boolean;
  isLocked: boolean;
  duration: number;
  wavePhase: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  lock: () => void;
}

export function useVoiceRecorder({
  onRecorded,
}: UseVoiceRecorderOptions): UseVoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [wavePhase, setWavePhase] = useState(0);
  const recordingRef = useRef<any>(null);
  const recordingMimeRef = useRef<string | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Tracks accumulated milliseconds across pause/resume cycles.
  const accumulatedMsRef = useRef(0);
  // Wall-clock at which the current running segment started.
  const segmentStartRef = useRef<number | null>(null);
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

  const startTimer = useCallback(() => {
    segmentStartRef.current = Date.now();
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    recordingTimerRef.current = setInterval(() => {
      if (segmentStartRef.current === null) return;
      const elapsedMs =
        accumulatedMsRef.current + (Date.now() - segmentStartRef.current);
      setDuration(Math.floor(elapsedMs / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (segmentStartRef.current !== null) {
      accumulatedMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }
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
    setIsPaused(false);
    setIsLocked(false);
    setDuration(0);
    accumulatedMsRef.current = 0;
    segmentStartRef.current = null;
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

      startTimer();
    } catch (error: any) {
      console.error("[useVoiceRecorder] Error starting recording:", error);
      setIsRecording(false);
      setDuration(0);
      Alert.alert("Erreur", "Impossible de démarrer l'enregistrement.");
    }
  }, [startTimer]);

  const pause = useCallback(async () => {
    if (!recordingRef.current || isPaused) return;
    try {
      if (typeof recordingRef.current.pauseAsync === "function") {
        await recordingRef.current.pauseAsync();
      }
      stopTimer();
      setIsPaused(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // pauseAsync can be unstable on some Android devices — log and keep going.
      console.warn("[useVoiceRecorder] pauseAsync failed:", error);
      stopTimer();
      setIsPaused(true);
    }
  }, [isPaused, stopTimer]);

  const resume = useCallback(async () => {
    if (!recordingRef.current || !isPaused) return;
    try {
      if (typeof recordingRef.current.startAsync === "function") {
        await recordingRef.current.startAsync();
      }
      setIsPaused(false);
      startTimer();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn("[useVoiceRecorder] resume startAsync failed:", error);
      setIsPaused(false);
      startTimer();
    }
  }, [isPaused, startTimer]);

  const lock = useCallback(() => {
    if (!isRecording || isLocked) return;
    setIsLocked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [isRecording, isLocked]);

  const stop = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      const activeRecording = recordingRef.current;
      const displayedDuration = duration;
      stopTimer();
      const totalAccumulatedMs = accumulatedMsRef.current;

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
      setIsPaused(false);
      setIsLocked(false);
      setDuration(0);
      accumulatedMsRef.current = 0;

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
        totalAccumulatedMs ||
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
        // timeout de garde meme sur un blob: local pour eviter de bloquer
        // l'UI si jamais le navigateur ne resout pas la lecture
        const blobFetchController = new AbortController();
        const blobFetchTimer = setTimeout(
          () => blobFetchController.abort(),
          10_000,
        );
        try {
          const mime = recordingMimeRef.current || "audio/webm";
          const ext = mime === "audio/mp4" ? "m4a" : "webm";
          const fileName = `voice-${Date.now()}.${ext}`;
          const response = await fetch(uri, {
            signal: blobFetchController.signal,
          });
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
        } finally {
          clearTimeout(blobFetchTimer);
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
      setIsPaused(false);
      setIsLocked(false);
      setDuration(0);
      accumulatedMsRef.current = 0;
      recordingRef.current = null;
    }
  }, [duration, stopTimer]);

  const cancel = useCallback(async () => {
    if (!recordingRef.current) return;

    try {
      stopTimer();
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      recordingMimeRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      setIsLocked(false);
      setDuration(0);
      accumulatedMsRef.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("[useVoiceRecorder] Error cancelling recording:", error);
      setIsRecording(false);
      setIsPaused(false);
      setIsLocked(false);
      setDuration(0);
      accumulatedMsRef.current = 0;
      recordingRef.current = null;
      recordingMimeRef.current = null;
    }
  }, [stopTimer]);

  return {
    isRecording,
    isPaused,
    isLocked,
    duration,
    wavePhase,
    start,
    stop,
    cancel,
    pause,
    resume,
    lock,
  };
}
