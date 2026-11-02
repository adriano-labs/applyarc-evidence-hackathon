// @vitest-environment jsdom
// The breakpoints and layout tokens behind the brief (checked in the browser at 375, 1024 and 1440 too).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromRoot } from '../../server/paths.js';

const css = (...p) => readFileSync(fromRoot('client', 'src', ...p), 'utf8');

describe('R1 layout', () => {
  it('uses three columns only from 1440px, two from 768px, one below', () => {
    const layout = css('styles', 'layout.css');
    expect(layout).toMatch(/@media \(min-width: 1440px\)/);
    expect(layout).toMatch(/@media \(max-width: 767px\)/);
    expect(layout).toMatch(/grid-template-areas:\s*"brief evidence"\s*"doc evidence"/);
    expect(layout).not.toMatch(/1240px|860px/);
  });

  it('defines the brief, rail and sheet padding tokens', () => {
    const tokens = css('styles', 'tokens.css');
    expect(tokens).toMatch(/--brief: 280px;/);
    expect(tokens).toMatch(/--rail-right: clamp\(280px, 26vw, 380px\);/);
    expect(tokens).toMatch(/--sheet-pad: clamp\(24px, 3vw, 48px\);/);
  });

  it('keeps the top bar to one row', () => {
    const top = css('components', 'TopBar.css');
    expect(top).toMatch(/white-space: nowrap/);
  });
});
