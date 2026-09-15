/**
 * Low-level ESC/POS byte builder for 80mm thermal printers (48-char width).
 * Ported near-verbatim from apps/pos/lib/printer/escpos.ts — it was already
 * a pure byte-builder with no I/O, just typed strictly here (no `as any`).
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const CR = 0x0d;

export const CMD: Record<string, number[]> = {
  INIT: [ESC, 0x40],
  LF: [LF],
  CR: [CR],
  FEED_1: [ESC, 0x64, 0x01],
  FEED_3: [ESC, 0x64, 0x03],
  FEED_6: [ESC, 0x64, 0x06],
  CUT_FULL: [GS, 0x56, 0x00],
  CUT_PARTIAL: [GS, 0x56, 0x01],
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  UNDERLINE_ON: [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  DOUBLE_SIZE: [ESC, 0x21, 0x30],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  INVERT_ON: [GS, 0x42, 0x01],
  INVERT_OFF: [GS, 0x42, 0x00],
  BEEP: [ESC, 0x42, 0x03, 0x02],
  OPEN_DRAWER: [ESC, 0x70, 0x00, 0x19, 0x19],
};

const encoder = new TextEncoder();

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];
  readonly COLS = 48;

  private push(...cmds: number[][]): this {
    this.chunks.push(new Uint8Array(cmds.flat()));
    return this;
  }

  private text(str: string): this {
    this.chunks.push(encoder.encode(str));
    return this;
  }

  init(): this {
    return this.push(CMD.INIT);
  }

  feed(n = 1): this {
    return this.push([ESC, 0x64, n]);
  }

  cut(): this {
    return this.push(CMD.FEED_6, CMD.CUT_PARTIAL);
  }

  openDrawer(): this {
    return this.push(CMD.OPEN_DRAWER);
  }

  beep(): this {
    return this.push(CMD.BEEP);
  }

  bold(on = true): this {
    return this.push(on ? CMD.BOLD_ON : CMD.BOLD_OFF);
  }

  underline(on = true): this {
    return this.push(on ? CMD.UNDERLINE_ON : CMD.UNDERLINE_OFF);
  }

  invert(on = true): this {
    return this.push(on ? CMD.INVERT_ON : CMD.INVERT_OFF);
  }

  doubleSize(on = true): this {
    return this.push(on ? CMD.DOUBLE_SIZE : CMD.NORMAL_SIZE);
  }

  doubleHeight(on = true): this {
    return this.push(on ? CMD.DOUBLE_HEIGHT : CMD.NORMAL_SIZE);
  }

  normal(): this {
    return this.push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }

  left(): this {
    return this.push(CMD.ALIGN_LEFT);
  }

  center(): this {
    return this.push(CMD.ALIGN_CENTER);
  }

  right(): this {
    return this.push(CMD.ALIGN_RIGHT);
  }

  println(str = ''): this {
    this.text(str);
    return this.push(CMD.LF);
  }

  separator(char = '-'): this {
    return this.println(char.repeat(this.COLS));
  }

  doubleSeparator(): this {
    return this.println('='.repeat(this.COLS));
  }

  twoCol(left: string, right: string): this {
    const rightPad = right.length;
    const maxLeft = this.COLS - rightPad - 1;
    const leftStr = left.length > maxLeft ? left.substring(0, maxLeft) : left.padEnd(maxLeft);
    return this.println(`${leftStr} ${right}`);
  }

  threeCol(qty: string, name: string, price: string): this {
    const safeName = name || 'Unknown Item';
    const qtyW = 4;
    const priceW = price.length + 1;
    const nameW = this.COLS - qtyW - priceW;
    const qtyStr = qty.padEnd(qtyW);
    const nameStr = safeName.length > nameW ? safeName.substring(0, nameW - 1) + '…' : safeName.padEnd(nameW);
    const priceStr = price.padStart(priceW);
    return this.println(`${qtyStr}${nameStr}${priceStr}`);
  }

  fourCol(qty: string, name: string, up: string, amt: string): this {
    const safeName = name || 'Unknown Item';
    const qtyW = 4;
    const amtW = Math.max(amt.length + 1, 9);
    const upW = Math.max(up.length + 1, 8);
    const nameW = this.COLS - qtyW - upW - amtW;
    const qtyStr = qty.padEnd(qtyW);
    const nameStr = safeName.length > nameW ? safeName.substring(0, nameW - 1) + '…' : safeName.padEnd(nameW);
    const upStr = up.padStart(upW);
    const amtStr = amt.padStart(amtW);
    return this.println(`${qtyStr}${nameStr}${upStr}${amtStr}`);
  }

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
