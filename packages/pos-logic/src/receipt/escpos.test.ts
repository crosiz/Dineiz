import { describe, expect, it } from 'vitest';
import { EscPosBuilder } from './escpos';

const decoder = new TextDecoder();

describe('EscPosBuilder — exact byte output', () => {
  it('init() emits ESC @', () => {
    expect(new EscPosBuilder().init().build()).toEqual(new Uint8Array([0x1b, 0x40]));
  });

  it('bold(true)/bold(false) emit the documented ESC/POS bytes', () => {
    expect(new EscPosBuilder().bold(true).build()).toEqual(new Uint8Array([0x1b, 0x45, 0x01]));
    expect(new EscPosBuilder().bold(false).build()).toEqual(new Uint8Array([0x1b, 0x45, 0x00]));
  });

  it('cut() feeds 6 lines then partial-cuts', () => {
    expect(new EscPosBuilder().cut().build()).toEqual(
      new Uint8Array([0x1b, 0x64, 0x06, 0x1d, 0x56, 0x01]),
    );
  });

  it('openDrawer() emits the documented pulse command', () => {
    expect(new EscPosBuilder().openDrawer().build()).toEqual(
      new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0x19]),
    );
  });

  it('println() encodes text then a line feed byte', () => {
    expect(new EscPosBuilder().println('Hi').build()).toEqual(
      new Uint8Array([0x48, 0x69, 0x0a]),
    );
  });

  it('chains commands in call order, concatenated', () => {
    const bytes = new EscPosBuilder().init().bold(true).build();
    expect(bytes).toEqual(new Uint8Array([0x1b, 0x40, 0x1b, 0x45, 0x01]));
  });
});

describe('EscPosBuilder — column formatting (verified by decoding back to text)', () => {
  it('twoCol left-pads to fill the 48-column width', () => {
    const text = decoder.decode(new EscPosBuilder().twoCol('Subtotal', 'PKR 100').build());
    const expectedLine = 'Subtotal'.padEnd(48 - 'PKR 100'.length - 1) + ' ' + 'PKR 100';
    expect(text).toBe(expectedLine + '\n');
  });

  it('separator() repeats the character to the column width', () => {
    const text = decoder.decode(new EscPosBuilder().separator().build());
    expect(text).toBe('-'.repeat(48) + '\n');
  });

  it('doubleSeparator() uses "=" to the column width', () => {
    const text = decoder.decode(new EscPosBuilder().doubleSeparator().build());
    expect(text).toBe('='.repeat(48) + '\n');
  });

  it('fourCol lays out qty/name/unitPrice/amount within 48 columns', () => {
    const text = decoder.decode(new EscPosBuilder().fourCol('2', 'Biryani', '500', '1000').build());
    const line = text.replace('\n', '');
    expect(line.length).toBe(48);
    expect(line.startsWith('2')).toBe(true);
    expect(line.trim().endsWith('1000')).toBe(true);
  });

  it('truncates an over-long item name with an ellipsis rather than overflowing the width', () => {
    const text = decoder.decode(
      new EscPosBuilder().fourCol('1', 'A'.repeat(60), '10', '10').build(),
    );
    const line = text.replace('\n', '');
    expect(line.length).toBe(48);
    expect(line).toContain('…');
  });
});
