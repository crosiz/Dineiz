import { describe, expect, it } from 'vitest';
import { PLAIN_TEXT_COLS, renderToPlainTextLines } from './renderPlainText';
import type { ReceiptDocument } from './types';

describe('renderToPlainTextLines', () => {
  it('renders a two-col line as separate left/right text, not one padded string', () => {
    // Deliberately NOT character-padded to PLAIN_TEXT_COLS the way three-col/
    // four-col are — see PlainTextLine.rightText's doc comment for why: a
    // padded string only aligns correctly if every line shares one font
    // size, which a bold+doubleHeight line (the grand total, KOT item rows)
    // doesn't. The PDF renderer positions `rightText` at the real right
    // margin instead.
    const doc: ReceiptDocument = {
      documentType: 'RECEIPT',
      cutAfter: true,
      sections: [{ name: 'totals', lines: [{ kind: 'two-col', columns: ['Subtotal', 'PKR 100'] }] }],
    };
    const [line] = renderToPlainTextLines(doc);
    expect(line.text).toBe('Subtotal');
    expect(line.rightText).toBe('PKR 100');
  });

  it('a doubleHeight two-col line still keeps left/right apart (the grand total, KOT item rows)', () => {
    const doc: ReceiptDocument = {
      documentType: 'RECEIPT',
      cutAfter: true,
      sections: [
        { name: 'totals', lines: [{ kind: 'two-col', columns: ['TOTAL', 'PKR 1,365'], bold: true, doubleHeight: true }] },
      ],
    };
    const [line] = renderToPlainTextLines(doc);
    expect(line.text).toBe('TOTAL');
    expect(line.rightText).toBe('PKR 1,365');
    expect(line.doubleHeight).toBe(true);
  });

  it('renders four-col lines at exactly the column width, preserving qty/name/amount', () => {
    const doc: ReceiptDocument = {
      documentType: 'RECEIPT',
      cutAfter: true,
      sections: [
        { name: 'items', lines: [{ kind: 'four-col', columns: ['2', 'Biryani', '500', '1000'] }] },
      ],
    };
    const [line] = renderToPlainTextLines(doc);
    expect(line.text.length).toBe(PLAIN_TEXT_COLS);
    expect(line.text.startsWith('2')).toBe(true);
    expect(line.text.trim().endsWith('1000')).toBe(true);
  });

  it('renders separator and double-separator at the full column width', () => {
    const doc: ReceiptDocument = {
      documentType: 'RECEIPT',
      cutAfter: true,
      sections: [{ name: 's', lines: [{ kind: 'separator' }, { kind: 'double-separator' }] }],
    };
    const [sep, dsep] = renderToPlainTextLines(doc);
    expect(sep.text).toBe('-'.repeat(PLAIN_TEXT_COLS));
    expect(dsep.text).toBe('='.repeat(PLAIN_TEXT_COLS));
  });

  it('preserves bold/center/doubleHeight/invert flags per line for the PDF renderer to apply', () => {
    const doc: ReceiptDocument = {
      documentType: 'RECEIPT',
      cutAfter: true,
      sections: [
        {
          name: 's',
          lines: [{ kind: 'text', text: 'DUE BILL', bold: true, center: true, doubleHeight: true, invert: true }],
        },
      ],
    };
    const [line] = renderToPlainTextLines(doc);
    expect(line).toMatchObject({ text: 'DUE BILL', bold: true, center: true, doubleHeight: true, invert: true });
  });

  it('applies indent to text lines (used for variation/add-on/notes sub-lines)', () => {
    const doc: ReceiptDocument = {
      documentType: 'RECEIPT',
      cutAfter: true,
      sections: [{ name: 's', lines: [{ kind: 'text', text: 'Extra Cheese', indent: 2 }] }],
    };
    const [line] = renderToPlainTextLines(doc);
    expect(line.text).toBe('  Extra Cheese');
  });

  it('truncates an over-long item name with an ellipsis rather than overflowing the width', () => {
    const doc: ReceiptDocument = {
      documentType: 'RECEIPT',
      cutAfter: true,
      sections: [
        { name: 'items', lines: [{ kind: 'four-col', columns: ['1', 'A'.repeat(60), '10', '10'] }] },
      ],
    };
    const [line] = renderToPlainTextLines(doc);
    expect(line.text.length).toBe(PLAIN_TEXT_COLS);
    expect(line.text).toContain('…');
  });

  it('flattens every section into one ordered line list', () => {
    const doc: ReceiptDocument = {
      documentType: 'KOT',
      cutAfter: true,
      sections: [
        { name: 'a', lines: [{ kind: 'text', text: 'first' }] },
        { name: 'b', lines: [{ kind: 'text', text: 'second' }] },
      ],
    };
    const lines = renderToPlainTextLines(doc);
    expect(lines.map((l) => l.text)).toEqual(['first', 'second']);
  });
});
