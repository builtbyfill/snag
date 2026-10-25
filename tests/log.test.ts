import { describe, expect, it } from 'vitest';
import { describeError } from '@/lib/log';

describe('describeError', () => {
  it('keeps the name, the driver code and the first line only, never the query parameters', () => {
    const error = new Error('Failed query: insert into "tickets" ...\nparams: NIx7Cq5JQqcSN6IrvmbFQ,The page is blank.', { cause: { code: '23505' } });
    const line = describeError(error);
    expect(line).toBe('Error (23505): Failed query: insert into "tickets" ...');
    expect(line).not.toContain('NIx7Cq5');
  });

  it('handles non-errors', () => {
    expect(describeError('boom')).toBe('boom');
  });
});
