import { describe, expect, it } from 'vitest';
import { FEATURES, filterHelpSearchSuggestions, HELP_SEARCH_SUGGESTIONS, HOW_TO, matchesHelpSearch, QUICK_START, splitHighlightSegments } from './HelpPage';

describe('Help page content', () => {
  it('provides a concise four-step workflow for new users', () => {
    expect(QUICK_START).toHaveLength(4);
    expect(QUICK_START.map((item) => item.number)).toEqual(['01', '02', '03', '04']);
  });

  it('keeps feature cards scannable with actionable bullets', () => {
    expect(FEATURES.length).toBeGreaterThanOrEqual(10);
    expect(FEATURES.every((feature) => feature.summary.length > 0 && feature.bullets.length >= 2)).toBe(true);
  });

  it('keeps every FAQ answer structured as a short explanation and ordered actions', () => {
    expect(HOW_TO.every((item) => item.intro.length > 0 && item.steps.length >= 2)).toBe(true);
  });

  it('matches Help search terms across feature and FAQ guidance', () => {
    const backupFeature = FEATURES.find((feature) => feature.title === 'Backup & Restore');
    const backupFaq = HOW_TO.find((item) => item.q.includes('back up and restore'));

    expect(backupFeature).toBeDefined();
    expect(backupFaq).toBeDefined();
    expect(matchesHelpSearch('backup', [backupFeature!.title, backupFeature!.summary, ...backupFeature!.bullets])).toBe(true);
    expect(matchesHelpSearch('backup', [backupFaq!.q, backupFaq!.intro, ...backupFaq!.steps])).toBe(true);
  });

  it('gives every feature card a direct destination', () => {
    expect(FEATURES.every((feature) => Boolean(feature.target))).toBe(true);
  });

  it('splits case-insensitive search matches into safe highlight segments', () => {
    expect(splitHighlightSegments('Publish a standalone app, then publish updates.', 'PUBLISH')).toEqual([
      { text: 'Publish', isMatch: true },
      { text: ' a standalone app, then ', isMatch: false },
      { text: 'publish', isMatch: true },
      { text: ' updates.', isMatch: false },
    ]);
  });

  it('leaves text intact when Help search is empty', () => {
    expect(splitHighlightSegments('Backup guidance', '   ')).toEqual([
      { text: 'Backup guidance', isMatch: false },
    ]);
  });

  it('offers common Help topics when the search field is focused', () => {
    expect(filterHelpSearchSuggestions('')).toEqual(HELP_SEARCH_SUGGESTIONS);
    expect(HELP_SEARCH_SUGGESTIONS.map((suggestion) => suggestion.query)).toEqual(
      expect.arrayContaining(['backup', 'lov', 'template', 'publish', 'form', 'ai']),
    );
  });

  it('filters suggestions by label, search term, or description', () => {
    expect(filterHelpSearchSuggestions('look')).toEqual([
      expect.objectContaining({ query: 'lov' }),
    ]);
    expect(filterHelpSearchSuggestions('HTML')).toEqual([
      expect.objectContaining({ query: 'publish' }),
    ]);
  });
});
