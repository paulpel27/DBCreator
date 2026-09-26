/**
 * InstallBanner — polished PWA install prompt for the DBCreator home screen.
 *
 * Three states:
 *  1. canInstall (Chrome/Edge/Android) → amber CTA with native prompt
 *  2. isIOS (Safari) → step-by-step manual instructions
 *  3. isInstalled → subtle "already installed" badge
 */
import { useState } from 'react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import {
  Download,
  Smartphone,
  Share,
  Plus,
  CheckCircle2,
  X,
  Monitor,
} from 'lucide-react';

export function InstallBanner() {
  const { canInstall, isInstalled, isIOS, promptInstall, dismissed, dismiss } =
    usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  // Already installed — show a subtle badge only
  if (isInstalled) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm w-fit">
        <CheckCircle2 size={14} />
        <span>DBCreator is installed on this device</span>
      </div>
    );
  }

  // User dismissed this session
  if (dismissed) return null;

  // ── iOS Safari — no beforeinstallprompt, show manual steps ──────────
  if (isIOS) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Smartphone size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Install on iPhone / iPad</p>
              <p className="text-xs text-muted-foreground">Add to your Home Screen for the best experience</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        {!showIOSSteps ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            onClick={() => setShowIOSSteps(true)}
          >
            <Share size={14} className="mr-2" />
            Show me how
          </Button>
        ) : (
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center flex-shrink-0 font-bold">1</span>
              Tap the <Share size={13} className="inline mx-1 text-amber-400" /> <strong className="text-foreground">Share</strong> button in Safari's toolbar
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center flex-shrink-0 font-bold">2</span>
              Scroll down and tap <Plus size={13} className="inline mx-1 text-amber-400" /> <strong className="text-foreground">Add to Home Screen</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center flex-shrink-0 font-bold">3</span>
              Tap <strong className="text-foreground">Add</strong> — DBCreator will appear on your Home Screen
            </li>
          </ol>
        )}
      </div>
    );
  }

  // ── Chrome / Edge / Android — native beforeinstallprompt available ──
  if (canInstall) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/8 to-amber-600/5 p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: icon + text */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
              <Monitor size={18} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">Install DBCreator</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5 truncate">
                Works offline · No browser chrome · Faster launch
              </p>
            </div>
          </div>

          {/* Right: buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold shadow-lg shadow-amber-500/25 active:scale-95 transition-transform"
              disabled={installing}
              onClick={async () => {
                setInstalling(true);
                await promptInstall();
                setInstalling(false);
              }}
            >
              {installing ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  Installing…
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Download size={13} />
                  Install App
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not installable and not iOS — render nothing
  return null;
}
