import { useEffect, useRef, useState } from 'react';

export interface UseWakeWordOptions {
  onWakeWordDetected: (detectedWord: string) => void;
  enabled?: boolean;
  wakeWords?: string[];
}

/**
 * Custom React hook for continuous background wake-word detection ("Yui", "Hey Yui", "Yui Activate").
 * Automatically uses Web Speech API when available.
 */
export function useWakeWord({
  onWakeWordDetected,
  enabled = true,
  wakeWords = ['yui', 'hey yui', 'yui activate', 'oui', 'youi', 'yuy'],
}: UseWakeWordOptions) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const isEnabledRef = useRef<boolean>(enabled);

  isEnabledRef.current = enabled;

  useEffect(() => {
    // Check SpeechRecognition support in browser / WebView
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API is not supported in this environment for Wake-Word listener.');
      return;
    }

    if (!enabled) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0]?.transcript?.toLowerCase().trim() || '';
          
          for (const word of wakeWords) {
            if (transcript.includes(word.toLowerCase())) {
              console.log(`[WakeWord] Trigger word detected: "${word}" in transcript: "${transcript}"`);
              onWakeWordDetected(word);
              // Pause recognition briefly after wake-word match
              try {
                recognition.stop();
              } catch (_) {}
              break;
            }
          }
        }
      };

      recognition.onerror = (err: any) => {
        // Ignore aborted error on user stop
        if (err.error !== 'no-speech' && err.error !== 'aborted') {
          console.warn('[WakeWord] Listener error:', err.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // Restart automatically if still enabled
        if (isEnabledRef.current) {
          setTimeout(() => {
            if (isEnabledRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (_) {}
            }
          }, 1000);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('[WakeWord] Failed to initialize recognition:', err);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
        recognitionRef.current = null;
      }
      setIsListening(false);
    };
  }, [enabled, wakeWords, onWakeWordDetected]);

  return { isListening };
}
