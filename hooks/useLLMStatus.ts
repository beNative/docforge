import { useState, useEffect } from 'react';
import type { LLMStatus } from '../types';

export const useLLMStatus = (providerUrl: string): LLMStatus => {
  const [status, setStatus] = useState<LLMStatus>('checking');

  useEffect(() => {
    let isMounted = true;
    let checkUrl: string;

    try {
      // Use the origin of the provided URL for a general health check
      // e.g., http://localhost:11434/api/generate -> http://localhost:11434
      checkUrl = new URL(providerUrl).origin;
    } catch {
      // If the URL is invalid, we can't check it.
      setStatus('error');
      return;
    }

    const checkStatus = async () => {
      if (!isMounted) return;

      try {
        // A simple fetch to the base URL. Most providers (like Ollama) respond to this.
        const response = await fetch(checkUrl, {
          method: 'GET',
          mode: 'cors', // Required for cross-origin requests from browser
        });

        if (isMounted) {
          setStatus(response.ok ? 'connected' : 'error');
        }
      } catch {
        if (isMounted) {
          setStatus('error');
        }
      }
    };

    // Initial check
    setStatus('checking');
    checkStatus();

    // Periodically check every 15 seconds
    const intervalId = setInterval(checkStatus, 15000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [providerUrl]);

  return status;
};