import { describe, expect, it } from 'vitest';
import { extractionFormat, parseExtractionText } from '@/lib/extraction/schema';

// A complete, valid model answer. Tests override one part at a time.
function answer(overrides: Record<string, unknown> = {}) {
  return {
    observed: {
      title: 'Consent label hidden behind sticky buttons on details step',
      location: 'Booking dialog, step "Podaci"',
      actualResult: 'Consent checkbox text is cut off behind the Nazad/Nastavi buttons.',
      priority: 'medium',
      tags: ['form', 'layout'],
    },
    inferred: {
      expectedResult: {
        value: 'The full consent text is readable above the buttons.',
        evidence: 'Checkbox label at the bottom is clipped by the button bar.',
      },
      stepsToReproduce: null,
    },
    confidence: 0.8,
    language: 'bs',
    ...overrides,
  };
}

const text = (value: unknown) => JSON.stringify(value);

describe('parseExtractionText', () => {
  it('accepts a valid answer', () => {
    const result = parseExtractionText(text(answer()));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output.observed.priority).toBe('medium');
  });

  it('lowercases priority and language before validating', () => {
    const a = answer({ language: 'BS' });
    (a.observed as Record<string, unknown>).priority = 'High';
    const result = parseExtractionText(text(a));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.observed.priority).toBe('high');
      expect(result.output.language).toBe('bs');
    }
  });

  it('trims every string, including nested evidence and steps', () => {
    const a = answer();
    a.observed.title = '  Save does nothing  ';
    a.inferred.stepsToReproduce = { value: ['  Open booking  ', 'Tap Nastavi '], evidence: '  The step header reads Podaci. ' } as never;
    const result = parseExtractionText(text(a));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.observed.title).toBe('Save does nothing');
      expect(result.output.inferred.stepsToReproduce).toEqual({
        value: ['Open booking', 'Tap Nastavi'],
        evidence: 'The step header reads Podaci.',
      });
    }
  });

  it('drops empty tags', () => {
    const a = answer();
    a.observed.tags = ['form', '', '  ', 'layout'];
    const result = parseExtractionText(text(a));
    expect(result.ok && result.output.observed.tags).toEqual(['form', 'layout']);
  });

  it('stores "unknown" location in lowercase whatever the casing', () => {
    const a = answer();
    a.observed.location = ' Unknown ';
    const result = parseExtractionText(text(a));
    expect(result.ok && result.output.observed.location).toBe('unknown');
  });

  it('rejects an inferred field that has a value but no evidence', () => {
    const a = answer();
    a.inferred.expectedResult = { value: 'It should save.' } as never;
    const result = parseExtractionText(text(a));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe('validation');
      expect(result.issues.join('\n')).toMatch(/inferred\.expectedResult\.evidence/);
    }
  });

  it('rejects constraints the API cannot enforce, such as confidence above 1', () => {
    const result = parseExtractionText(text(answer({ confidence: 1.4 })));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toEqual([expect.stringMatching(/^confidence: /)]);
  });

  it('reports text that is not JSON as invalid_json', () => {
    const result = parseExtractionText('{"observed": ');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('invalid_json');
  });
});

describe('extractionFormat', () => {
  it('is a json_schema format that requires every top-level field and allows no extras', () => {
    expect(extractionFormat.type).toBe('json_schema');
    const schema = extractionFormat.schema as { required: string[]; additionalProperties: boolean };
    expect(schema.required.sort()).toEqual(['confidence', 'inferred', 'language', 'observed']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('constrains priority with a real enum, not only a description hint', () => {
    const schema = extractionFormat.schema as {
      properties: { observed: { properties: { priority: { enum?: string[] } } } };
    };
    expect(schema.properties.observed.properties.priority.enum).toEqual(['low', 'medium', 'high']);
  });
});
