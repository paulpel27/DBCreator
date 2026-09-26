import { describe, expect, it } from 'vitest';
import { STARTUP_WALKTHROUGH_STEPS } from './walkthrough';

describe('startup walkthrough content', () => {
  it('covers the essential DBCreator workflow in order', () => {
    expect(STARTUP_WALKTHROUGH_STEPS.map((step) => step.id)).toEqual([
      'welcome',
      'start',
      'model',
      'connect',
      'build',
      'publish',
    ]);
  });

  it('keeps concrete guidance for forms, reports, publishing, and backups', () => {
    const guide = STARTUP_WALKTHROUGH_STEPS.map((step) => `${step.description} ${step.hint}`).join(' ');
    expect(guide).toContain('form');
    expect(guide).toContain('report');
    expect(guide).toContain('Publish App');
    expect(guide).toContain('Export Backup');
  });
});
