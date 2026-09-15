/**
 * Renders a ReceiptDocument to fixed-width monospace text lines, for
 * consumption by the PDF renderer only (the real-printer path renders the
 * same ReceiptDocument independently via escpos.ts/renderEscPos.ts — neither
 * of them sees this module's output). 'three-col'/'four-col'/separator lines
 * share escpos.ts's 48-column convention, on the assumption the PDF is drawn
 * at a font size where that many Courier characters actually fit the page
 * (see pdfRenderer.ts's FONT_SIZE_PT). 'two-col' lines are deliberately not
 * part of that character-padding scheme — see PlainTextLine.rightText.
 * Deliberately a separate, small column-math implementation rather than
 * sharing escpos.ts's — that one returns bytes via a stateful builder, this
 * returns plain strings; forcing them through one shared abstraction would
 * cost more than the duplication it would save.
 */
import type { ReceiptDocument, ReceiptLine } from './types';

export const PLAIN_TEXT_COLS = 48;

export interface PlainTextLine {
  text: string;
  /**
   * Set only for a 'two-col' source line — the right column, kept apart from
   * `text` rather than folded into one character-padded string. A PDF
   * renderer needs to right-align this independently at the page's actual
   * right margin (real coordinates), not by counting characters: character
   * padding only lands in the right place if every line is drawn at the
   * exact same font size, which breaks the moment a line is bold+doubleHeight
   * (e.g. the grand total, or a KOT's item rows) — see pdfRenderer.ts.
   */
  rightText?: string;
  bold?: boolean;
  center?: boolean;
  doubleHeight?: boolean;
  invert?: boolean;
}

function padThreeCol(qty: string, name: string, price: string): string {
  const safeName = name || 'Unknown Item';
  const qtyW = 4;
  const priceW = price.length + 1;
  const nameW = PLAIN_TEXT_COLS - qtyW - priceW;
  const qtyStr = qty.padEnd(qtyW);
  const nameStr = safeName.length > nameW ? safeName.substring(0, nameW - 1) + '…' : safeName.padEnd(nameW);
  const priceStr = price.padStart(priceW);
  return `${qtyStr}${nameStr}${priceStr}`;
}

function padFourCol(qty: string, name: string, up: string, amt: string): string {
  const safeName = name || 'Unknown Item';
  const qtyW = 4;
  const amtW = Math.max(amt.length + 1, 9);
  const upW = Math.max(up.length + 1, 8);
  const nameW = PLAIN_TEXT_COLS - qtyW - upW - amtW;
  const qtyStr = qty.padEnd(qtyW);
  const nameStr = safeName.length > nameW ? safeName.substring(0, nameW - 1) + '…' : safeName.padEnd(nameW);
  const upStr = up.padStart(upW);
  const amtStr = amt.padStart(amtW);
  return `${qtyStr}${nameStr}${upStr}${amtStr}`;
}

function lineToPlainText(line: ReceiptLine): PlainTextLine {
  const indent = line.indent ? ' '.repeat(line.indent) : '';
  const { bold, center, doubleHeight, invert } = line;

  if (line.kind === 'two-col') {
    // Unlike every other line kind, this one is never rendered as a single
    // character-padded string (that's `escpos.ts`'s `twoCol`, a completely
    // separate implementation for the real-printer path — this module only
    // ever feeds the PDF renderer). Keeping the two columns apart lets that
    // renderer position `rightText` at the page's actual right margin, which
    // stays correct at any font size — padding-to-48-columns only lines up
    // if every line shares one exact font size, which breaks the moment a
    // line is bold+doubleHeight (the grand total, every KOT item row).
    return {
      text: indent + (line.columns?.[0] ?? ''),
      rightText: line.columns?.[1] ?? '',
      bold,
      center,
      doubleHeight,
      invert,
    };
  }

  let text: string;
  switch (line.kind) {
    case 'three-col':
      text = padThreeCol(line.columns?.[0] ?? '', indent + (line.columns?.[1] ?? ''), line.columns?.[2] ?? '');
      break;
    case 'four-col':
      text = padFourCol(
        line.columns?.[0] ?? '',
        indent + (line.columns?.[1] ?? ''),
        line.columns?.[2] ?? '',
        line.columns?.[3] ?? '',
      );
      break;
    case 'separator':
      text = '-'.repeat(PLAIN_TEXT_COLS);
      break;
    case 'double-separator':
      text = '='.repeat(PLAIN_TEXT_COLS);
      break;
    case 'spacer':
      text = '';
      break;
    case 'text':
    default:
      text = indent + (line.text ?? '');
      break;
  }

  return { text, bold, center, doubleHeight, invert };
}

export function renderToPlainTextLines(doc: ReceiptDocument): PlainTextLine[] {
  const lines: PlainTextLine[] = [];
  for (const section of doc.sections) {
    for (const line of section.lines) {
      lines.push(lineToPlainText(line));
    }
  }
  return lines;
}
