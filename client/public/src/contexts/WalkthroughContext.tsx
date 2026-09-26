import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface WalkthroughContextValue {
  isWalkthroughOpen: boolean;
  openWalkthrough: () => void;
  closeWalkthrough: () => void;
}

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

/**
 * The walkthrough intentionally opens on every application startup. Closing it
 * only dismisses it for the mounted app session; a browser refresh or relaunch
 * starts the guide again, as requested.
 */
export function WalkthroughProvider({ children }: { children: ReactNode }) {
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(true);

  const openWalkthrough = useCallback(() => setIsWalkthroughOpen(true), []);
  const closeWalkthrough = useCallback(() => setIsWalkthroughOpen(false), []);

  const value = useMemo(
    () => ({ isWalkthroughOpen, openWalkthrough, closeWalkthrough }),
    [isWalkthroughOpen, openWalkthrough, closeWalkthrough],
  );

  return <WalkthroughContext.Provider value={value}>{children}</WalkthroughContext.Provider>;
}

export function useWalkthrough() {
  const context = useContext(WalkthroughContext);
  if (!context) {
    throw new Error('useWalkthrough must be used inside WalkthroughProvider');
  }
  return context;
}
