/**
 * usePWAInstall — captures the beforeinstallprompt event for custom install UI.
 *
 * Returns:
 *  - canInstall:     true when the native install prompt is available (Chrome/Edge/Android)
 *  - isInstalled:    true when already running as a standalone PWA
 *  - isIOS:          true on iOS Safari (no beforeinstallprompt — show manual instructions)
 *  - promptInstall:  call this from a button click to show the native prompt
 *  - dismissed:      user has dismissed the banner this session
 *  - dismiss:        call to hide the banner
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismissed: boolean;
  dismiss: () => void;
}

export function usePWAInstall(): PWAInstallState {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('pwa-install-dismissed') === '1'; } catch { return false; }
  });

  const isInstalled =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true);

  const isIOS =
    typeof window !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window.navigator as any).standalone;

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // If already installed, clear the flag
    const mq = window.matchMedia('(display-mode: standalone)');
    const onStandaloneChange = () => { if (mq.matches) setCanInstall(false); };
    mq.addEventListener('change', onStandaloneChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      mq.removeEventListener('change', onStandaloneChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt.current) return 'unavailable';
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setCanInstall(false);
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { sessionStorage.setItem('pwa-install-dismissed', '1'); } catch { /* ignore */ }
  }, []);

  return { canInstall, isInstalled, isIOS, promptInstall, dismissed, dismiss };
}
