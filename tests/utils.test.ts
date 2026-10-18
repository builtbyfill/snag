import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn knows the type scale', () => {
  it('treats text-title, text-body and text-meta as font sizes, not colors', () => {
    // A font size must replace text-sm and leave the text color alone.
    expect(cn('text-sm text-primary-foreground', 'text-body')).toBe('text-primary-foreground text-body');
    expect(cn('text-sm text-ink', 'text-meta')).toBe('text-ink text-meta');
    expect(cn('text-base', 'text-title')).toBe('text-title');
  });

  it('still lets a later color replace an earlier color', () => {
    expect(cn('text-ink', 'text-ink-muted')).toBe('text-ink-muted');
  });
});

describe('components use the configured cn', () => {
  it('no component imports cn straight from the "cn" package', () => {
    const files = readdirSync('components', { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => path.join('components', f));
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter((f) => /from ["']cn["']/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
