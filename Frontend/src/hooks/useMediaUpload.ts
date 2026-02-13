/**
 * useMediaUpload - Hook pour gérer la progression des uploads de médias
 * WHISPR-267: Envoi de médias avec progression et gestion d'erreurs
 */

import { useState, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

export interface UploadProgress {
  messageId: string;
  progress: number; // 0-100
  status: 'uploading' | 'success' | 'error' | 'cancelled';
  error?: string;
  cancelToken?: AbortController;
}

interface UseMediaUploadReturn {
  uploads: Record<string, UploadProgress>;
  startUpload: (messageId: string, uploadFn: (onProgress: (progress: number) => void, signal: AbortSignal) => Promise<any>) => Promise<void>;
  cancelUpload: (messageId: string) => void;
  retryUpload: (messageId: string, uploadFn: (onProgress: (progress: number) => void, signal: AbortSignal) => Promise<any>) => Promise<void>;
  getUploadProgress: (messageId: string) => UploadProgress | undefined;
  clearUpload: (messageId: string) => void;
  transferUpload: (oldMessageId: string, newMessageId: string) => void;
  markAsSuccess: (messageId: string) => void;
}

export const useMediaUpload = (): UseMediaUploadReturn => {
  // Use object instead of Map for better React reactivity
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});
  const uploadControllersRef = useRef<Map<string, AbortController>>(new Map());

  const startUpload = useCallback(
    async (
      messageId: string,
      uploadFn: (onProgress: (progress: number) => void, signal: AbortSignal) => Promise<any>
    ) => {
      // Cancel any existing upload for this message
      const existingController = uploadControllersRef.current[messageId];
      if (existingController) {
        existingController.abort();
      }

      // Create new abort controller
      const controller = new AbortController();
      uploadControllersRef.current = {
        ...uploadControllersRef.current,
        [messageId]: controller,
      };

      // Initialize upload state
      setUploads(prev => ({
        ...prev,
        [messageId]: {
          messageId,
          progress: 0,
          status: 'uploading',
          cancelToken: controller,
        },
      }));
      console.log('[useMediaUpload] Starting upload for message:', messageId);

      try {
        // Simulate progress updates (fallback if uploadFn doesn't call onProgress)
        const progressInterval = setInterval(() => {
          setUploads(prev => {
            const upload = prev[messageId];
            if (!upload || upload.status !== 'uploading') {
              clearInterval(progressInterval);
              return prev;
            }

            // Simulate progress (will be replaced by real progress from uploadFn)
            const newProgress = Math.min(upload.progress + Math.random() * 10, 95);
            return {
              ...prev,
              [messageId]: {
                ...upload,
                progress: newProgress,
              },
            };
          });
        }, 200);

        // Call upload function with progress callback
        const onProgress = (progress: number) => {
          console.log('[useMediaUpload] Upload progress:', messageId, progress + '%');
          setUploads(prev => {
            const upload = prev[messageId];
            if (!upload) {
              console.warn('[useMediaUpload] Upload not found for progress update:', messageId);
              return prev;
            }

            return {
              ...prev,
              [messageId]: {
                ...upload,
                progress: Math.min(progress, 100),
              },
            };
          });
        };

        // Execute upload
        await uploadFn(onProgress, controller.signal);

        // Clear interval
        clearInterval(progressInterval);

        // Mark as success - but only if upload still exists (might have been transferred)
        setUploads(prev => {
          const upload = prev[messageId];
          if (!upload) {
            // Upload was transferred, don't update
            return prev;
          }
          return {
            ...prev,
            [messageId]: {
              ...upload,
              progress: 100,
              status: 'success',
            },
          };
        });

        // Clean up after 8 seconds (keep visible longer so user can see it)
        // Use a ref to track the actual messageId in case it was transferred
        const finalMessageId = messageId;
        setTimeout(() => {
          clearUpload(finalMessageId);
        }, 8000);
      } catch (error: any) {
        // Check if upload was cancelled
        if (error.name === 'AbortError' || controller.signal.aborted) {
          setUploads(prev => {
            const upload = prev[messageId];
            if (!upload) return prev;
            return {
              ...prev,
              [messageId]: {
                ...upload,
                status: 'cancelled',
              },
            };
          });
        } else {
          // Mark as error
          setUploads(prev => {
            const upload = prev[messageId];
            if (!upload) return prev;
            return {
              ...prev,
              [messageId]: {
                ...upload,
                status: 'error',
                error: error.message || 'Erreur lors de l\'envoi',
              },
            };
          });
          logger.error('useMediaUpload', 'Upload error', error);
        }
      } finally {
        // Clean up controller
        const newControllers = { ...uploadControllersRef.current };
        delete newControllers[messageId];
        uploadControllersRef.current = newControllers;
      }
    },
    []
  );

  const cancelUpload = useCallback((messageId: string) => {
    const controller = uploadControllersRef.current[messageId];
    if (controller) {
      controller.abort();
      const newControllers = { ...uploadControllersRef.current };
      delete newControllers[messageId];
      uploadControllersRef.current = newControllers;
    }

    setUploads(prev => {
      const upload = prev[messageId];
      if (!upload) return prev;
      return {
        ...prev,
        [messageId]: {
          ...upload,
          status: 'cancelled',
        },
      };
    });
  }, []);

  const retryUpload = useCallback(
    async (
      messageId: string,
      uploadFn: (onProgress: (progress: number) => void, signal: AbortSignal) => Promise<any>
    ) => {
      // Clear previous error state
      setUploads(prev => {
        const upload = prev[messageId];
        if (!upload) return prev;
        return {
          ...prev,
          [messageId]: {
            ...upload,
            progress: 0,
            status: 'uploading',
            error: undefined,
          },
        };
      });

      // Start new upload
      await startUpload(messageId, uploadFn);
    },
    [startUpload]
  );

  const getUploadProgress = useCallback(
    (messageId: string): UploadProgress | undefined => {
      return uploads[messageId];
    },
    [uploads]
  );

  const clearUpload = useCallback((messageId: string) => {
    const newControllers = { ...uploadControllersRef.current };
    delete newControllers[messageId];
    uploadControllersRef.current = newControllers;
    setUploads(prev => {
      const { [messageId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const transferUpload = useCallback((oldMessageId: string, newMessageId: string) => {
    setUploads(prev => {
      const upload = prev[oldMessageId];
      if (!upload) return prev;

      // Transfer controller if it exists
      const controller = uploadControllersRef.current[oldMessageId];
      if (controller) {
        const newControllers = { ...uploadControllersRef.current };
        newControllers[newMessageId] = controller;
        delete newControllers[oldMessageId];
        uploadControllersRef.current = newControllers;
      }

      // Transfer upload state
      // If progress is 100%, mark as success
      const { [oldMessageId]: removed, ...rest } = prev;
      return {
        ...rest,
        [newMessageId]: {
          ...upload,
          messageId: newMessageId,
          progress: upload.progress >= 100 ? 100 : upload.progress,
          status: upload.progress >= 100 ? 'success' : upload.status,
        },
      };
    });
    console.log('[useMediaUpload] Transferred upload from', oldMessageId, 'to', newMessageId);
  }, []);

  const markAsSuccess = useCallback((messageId: string) => {
    setUploads(prev => {
      const upload = prev[messageId];
      if (!upload) return prev;
      return {
        ...prev,
        [messageId]: {
          ...upload,
          progress: 100,
          status: 'success',
        },
      };
    });
    console.log('[useMediaUpload] Marked upload as success for:', messageId);
  }, []);

  return {
    uploads,
    startUpload,
    cancelUpload,
    retryUpload,
    getUploadProgress,
    clearUpload,
    transferUpload,
    markAsSuccess,
  };
};
