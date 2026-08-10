/**
 * escpos.ts
 * Low-level ESC/POS byte builder for 80mm thermal printers (48-char width).
 *
 * ESC/POS is the de-facto command language for thermal receipt/KOT printers.
 * Commands are byte sequences prefixed with ESC (0x1B) or GS (0x1D).
 *
 * Designed for: Epson TM-T20, TM-T82, Generic 80mm USB thermal printers.
 * Column width: 48 chars at normal size, 24 chars at double width.
 */

// ─── ESC/POS Command Constants ────────────────────────────────────────────────

const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;
const CR  = 0x0d;

export const CMD = {
  INIT:            [ESC, 0x40],                 // Initialize / reset printer
  LF:              [LF],                        // Line feed
  CR:              [CR],
  FEED_1:          [ESC, 0x64, 0x01],           // Feed 1 line
  FEED_3:          [ESC, 0x64, 0x03],           // Feed 3 lines
  FEED_6:          [ESC, 0x64, 0x06],           // Feed 6 lines (before cut)
  CUT_FULL:        [GS, 0x56, 0x00],            // Full cut
  CUT_PARTIAL:     [GS, 0x56, 0x01],            // Partial cut (preferred)
  ALIGN_LEFT:      [ESC, 0x61, 0x00],
  ALIGN_CENTER:    [ESC, 0x61, 0x01],
  ALIGN_RIGHT:     [ESC, 0x61, 0x02],
  BOLD_ON:         [ESC, 0x45, 0x01],
  BOLD_OFF:        [ESC, 0x45, 0x00],
  UNDERLINE_ON:    [ESC, 0x2d, 0x01],
  UNDERLINE_OFF:   [ESC, 0x2d, 0x00],
  DOUBLE_HEIGHT:   [ESC, 0x21, 0x10],           // Double height text
  DOUBLE_SIZE:     [ESC, 0x21, 0x30],           // Double width + height
  NORMAL_SIZE:     [ESC, 0x21, 0x00],           // Normal size
  INVERT_ON:       [GS, 0x42, 0x01],            // White text on black bg
  INVERT_OFF:      [GS, 0x42, 0x00],
  BEEP:            [ESC, 0x42, 0x03, 0x02],     // Beep 3 times
  OPEN_DRAWER:     [ESC, 0x70, 0x00, 0x19, 0x19], // Open cash drawer
};

// ─── Encoder ──────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

// ─── Builder Class ────────────────────────────────────────────────────────────

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];
  readonly COLS = 48; // 80mm printer at normal size

  private push(...cmds: number[][]): this {
    this.chunks.push(new Uint8Array(cmds.flat()));
    return this;
  }

  private text(str: string): this {
    this.chunks.push(encoder.encode(str));
    return this;
  }

  // ── Control ──────────────────────────────────────────────────────────────

  init(): this      { return this.push(CMD.INIT as any); }
  feed(n = 1): this { return this.push([ESC, 0x64, n]); }
  cut(): this       { return this.push(CMD.FEED_6 as any, CMD.CUT_PARTIAL as any); }

  openDrawer(): this { return this.push(CMD.OPEN_DRAWER as any); }
  beep(): this       { return this.push(CMD.BEEP as any); }

  // ── Style ─────────────────────────────────────────────────────────────────

  bold(on = true): this       { return this.push(on ? CMD.BOLD_ON : CMD.BOLD_OFF); }
  underline(on = true): this  { return this.push(on ? CMD.UNDERLINE_ON : CMD.UNDERLINE_OFF); }
  invert(on = true): this     { return this.push(on ? CMD.INVERT_ON : CMD.INVERT_OFF); }
  doubleSize(on = true): this { return this.push(on ? CMD.DOUBLE_SIZE : CMD.NORMAL_SIZE); }
  doubleHeight(on = true): this { return this.push(on ? CMD.DOUBLE_HEIGHT : CMD.NORMAL_SIZE); }
  normal(): this { return this.push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT); }

  // ── Alignment ─────────────────────────────────────────────────────────────

  left(): this    { return this.push(CMD.ALIGN_LEFT); }
  center(): this  { return this.push(CMD.ALIGN_CENTER); }
  right(): this   { return this.push(CMD.ALIGN_RIGHT); }

  // ── Text helpers ──────────────────────────────────────────────────────────

  println(str = ''): this {
    this.text(str);
    return this.push(CMD.LF);
  }

  /** Separator line */
  separator(char = '-'): this {
    return this.println(char.repeat(this.COLS));
  }

  /** Double separator */
  doubleSeparator(): this {
    return this.println('='.repeat(this.COLS));
  }

  /**
   * Two-column row: left text and right text on the same line.
   * Pads / truncates so the combined width fits COLS.
   */
  twoCol(left: string, right: string): this {
    const rightPad = right.length;
    const maxLeft  = this.COLS - rightPad - 1;
    const leftStr  = left.length > maxLeft ? left.substring(0, maxLeft) : left.padEnd(maxLeft);
    return this.println(`${leftStr} ${right}`);
  }

  /**
   * Three-column row: qty, name, price.
   */
  threeCol(qty: string, name: string, price: string): this {
    const safeName = name || 'Unknown Item';
    const qtyW   = 4;
    const priceW = price.length + 1;
    const nameW  = this.COLS - qtyW - priceW;
    const qtyStr   = qty.padEnd(qtyW);
    const nameStr  = safeName.length > nameW ? safeName.substring(0, nameW - 1) + '…' : safeName.padEnd(nameW);
    const priceStr = price.padStart(priceW);
    return this.println(`${qtyStr}${nameStr}${priceStr}`);
  }

  /**
   * Four-column row: qty, name, unitPrice, amount.
   */
  fourCol(qty: string, name: string, up: string, amt: string): this {
    const safeName = name || 'Unknown Item';
    const qtyW   = 4;
    const amtW   = Math.max(amt.length + 1, 9);
    const upW    = Math.max(up.length + 1, 8);
    const nameW  = this.COLS - qtyW - upW - amtW;
    const qtyStr   = qty.padEnd(qtyW);
    const nameStr  = safeName.length > nameW ? safeName.substring(0, nameW - 1) + '…' : safeName.padEnd(nameW);
    const upStr    = up.padStart(upW);
    const amtStr   = amt.padStart(amtW);
    return this.println(`${qtyStr}${nameStr}${upStr}${amtStr}`);
  }

  // ── Finalise ──────────────────────────────────────────────────────────────

  build(): Uint8Array {
    const total = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  }
}
