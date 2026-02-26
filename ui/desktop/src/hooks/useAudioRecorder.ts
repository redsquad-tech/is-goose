import { useCallback } from 'react';

interface UseAudioRecorderOptions {
  onTranscription: (text: string) => void;
  onError: (message: string) => void;
}

export const useAudioRecorder = ({ onTranscription, onError }: UseAudioRecorderOptions) => {
  const startRecording = useCallback(async () => {
    void onTranscription;
    onError('Voice dictation is currently unavailable.');
  }, [onError, onTranscription]);

  const stopRecording = useCallback(() => {}, []);

  return {
    isEnabled: false,
    dictationProvider: null,
    isRecording: false,
    isTranscribing: false,
    startRecording,
    stopRecording,
  };
};
