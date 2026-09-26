import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  FileText,
  GitBranch,
  Rocket,
  Sparkles,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import {
  STARTUP_WALKTHROUGH_STEPS,
  type WalkthroughIconKey,
} from '@/lib/walkthrough';

const ICONS: Record<WalkthroughIconKey, LucideIcon> = {
  sparkles: Sparkles,
  database: Database,
  table: Table2,
  relationship: GitBranch,
  form: FileText,
  rocket: Rocket,
};

export default function StartupWalkthrough() {
  const { isWalkthroughOpen, closeWalkthrough } = useWalkthrough();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STARTUP_WALKTHROUGH_STEPS[stepIndex];
  const Icon = ICONS[step.icon];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STARTUP_WALKTHROUGH_STEPS.length - 1;

  useEffect(() => {
    if (isWalkthroughOpen) setStepIndex(0);
  }, [isWalkthroughOpen]);

  const close = () => closeWalkthrough();

  return (
    <Dialog
      open={isWalkthroughOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-[min(680px,calc(100%-1.5rem))] max-w-none gap-0 overflow-hidden border-0 p-0 shadow-2xl"
        style={{
          background: 'var(--neo-inset)',
          color: 'var(--foreground)',
          border: '1px solid oklch(1 0 0 / 0.1)',
          boxShadow: '0 28px 90px rgba(0,0,0,0.58), 0 0 42px rgba(245,166,35,0.12)',
        }}
      >
        <div
          className="relative overflow-hidden px-6 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-8"
          style={{
            background: `radial-gradient(circle at 88% 12%, ${step.color}2d 0, transparent 29%), linear-gradient(135deg, oklch(0.195 0.014 270), oklch(0.16 0.012 270))`,
            borderBottom: '1px solid oklch(1 0 0 / 0.07)',
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <DialogHeader className="gap-2 text-left">
              <div
                className="mb-2 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[0.64rem] font-bold tracking-[0.16em]"
                style={{
                  color: step.color,
                  background: `${step.color}19`,
                  border: `1px solid ${step.color}42`,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                <Sparkles size={11} />
                {step.eyebrow}
              </div>
              <DialogTitle
                className="max-w-[500px] text-2xl font-bold leading-tight sm:text-3xl"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--foreground)', letterSpacing: '-0.035em' }}
              >
                {step.title}
              </DialogTitle>
              <DialogDescription
                className="max-w-[540px] text-sm leading-relaxed sm:text-[0.95rem]"
                style={{ color: 'var(--muted-foreground)', fontFamily: 'Inter, sans-serif' }}
              >
                {step.description}
              </DialogDescription>
            </DialogHeader>

            <button
              type="button"
              onClick={close}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150 hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-amber-400"
              style={{
                color: 'var(--muted-foreground)',
                background: 'oklch(1 0 0 / 0.055)',
                border: '1px solid oklch(1 0 0 / 0.09)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Skip tour
            </button>
          </div>

          <div
            className="absolute -bottom-10 -right-6 flex h-28 w-28 items-center justify-center rounded-[2rem] sm:h-32 sm:w-32"
            style={{ background: `${step.color}18`, border: `1px solid ${step.color}35`, transform: 'rotate(-12deg)' }}
            aria-hidden="true"
          >
            <Icon size={42} strokeWidth={1.35} style={{ color: step.color, transform: 'rotate(12deg)' }} />
          </div>
        </div>

        <div className="px-6 py-5 sm:px-8 sm:py-6">
          <ul className="space-y-3" aria-label="Walkthrough highlights">
            {step.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${step.color}20`, color: step.color, border: `1px solid ${step.color}36` }}
                >
                  <Check size={12} strokeWidth={2.8} />
                </span>
                <span className="text-sm leading-relaxed" style={{ color: 'var(--foreground)', fontFamily: 'Inter, sans-serif' }}>
                  {highlight}
                </span>
              </li>
            ))}
          </ul>

          <div
            className="mt-5 rounded-xl px-4 py-3 text-xs leading-relaxed"
            style={{
              color: 'var(--muted-foreground)',
              background: 'oklch(1 0 0 / 0.035)',
              border: '1px solid oklch(1 0 0 / 0.07)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <span className="mr-1.5 font-semibold" style={{ color: step.color }}>Tip:</span>
            {step.hint}
          </div>
        </div>

        <div
          className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8"
          style={{ background: 'oklch(0 0 0 / 0.1)', borderTop: '1px solid oklch(1 0 0 / 0.07)' }}
        >
          <div className="flex items-center gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STARTUP_WALKTHROUGH_STEPS.length} aria-valuenow={stepIndex + 1} aria-label={`Walkthrough step ${stepIndex + 1} of ${STARTUP_WALKTHROUGH_STEPS.length}`}>
            {STARTUP_WALKTHROUGH_STEPS.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setStepIndex(index)}
                className="h-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                style={{
                  width: index === stepIndex ? '24px' : '8px',
                  background: index === stepIndex ? step.color : 'oklch(1 0 0 / 0.16)',
                }}
                aria-label={`Go to step ${index + 1}: ${item.title}`}
                aria-current={index === stepIndex ? 'step' : undefined}
              />
            ))}
            <span className="ml-2 text-[0.65rem] font-medium" style={{ color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
              {stepIndex + 1} / {STARTUP_WALKTHROUGH_STEPS.length}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={() => setStepIndex((index) => index - 1)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 hover:brightness-125 focus:outline-none focus:ring-2 focus:ring-amber-400"
                style={{ color: 'var(--muted-foreground)', border: '1px solid oklch(1 0 0 / 0.1)', fontFamily: 'Space Grotesk, sans-serif' }}
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLastStep ? close() : setStepIndex((index) => index + 1))}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-150 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-200"
              style={{
                color: '#1e1e2e',
                background: isLastStep ? '#10b981' : 'var(--amber)',
                boxShadow: isLastStep ? '0 6px 16px rgba(16,185,129,0.2)' : '0 6px 16px rgba(245,166,35,0.22)',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              {isLastStep ? <>Finish <Check size={15} /></> : <>Next <ArrowRight size={15} /></>}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
