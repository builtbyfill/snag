import { describe, expect, it } from 'vitest';
import { applyStarter } from '@/lib/reports/starters';

const chips = ["A button doesn't work", "A page won't load", 'Wrong information shown'];

describe('applyStarter (tapping a suggestion chip above the field)', () => {
  it('starts an empty field with the chip and a colon', () => {
    expect(applyStarter('', chips[0], chips)).toBe("A button doesn't work: ");
    expect(applyStarter('   ', chips[1], chips)).toBe("A page won't load: ");
  });

  it('swaps one chip for another and keeps what the client typed after it', () => {
    expect(applyStarter("A button doesn't work: Save on the appointment", chips[1], chips)).toBe(
      "A page won't load: Save on the appointment",
    );
    expect(applyStarter("A button doesn't work: ", chips[2], chips)).toBe('Wrong information shown: ');
  });

  it('puts the chip in front of a sentence the client wrote without one', () => {
    expect(applyStarter('Save does nothing', chips[0], chips)).toBe("A button doesn't work: Save does nothing");
  });

  it('leaves the text alone when the same chip is tapped again', () => {
    expect(applyStarter("A button doesn't work: Save", chips[0], chips)).toBe("A button doesn't work: Save");
  });
});
