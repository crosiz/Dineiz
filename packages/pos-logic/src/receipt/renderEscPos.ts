import { EscPosBuilder } from './escpos';
import type { ReceiptDocument, ReceiptLine } from './types';

function applyLine(builder: EscPosBuilder, line: ReceiptLine): void {
  if (line.bold) builder.bold(true);
  if (line.center) builder.center();
  if (line.doubleHeight) builder.doubleHeight(true);
  if (line.invert) builder.invert(true);

  const indent = line.indent ? ' '.repeat(line.indent) : '';

  switch (line.kind) {
    case 'text':
      builder.println(indent + (line.text ?? ''));
      break;
    case 'two-col':
      builder.twoCol(indent + (line.columns?.[0] ?? ''), line.columns?.[1] ?? '');
      break;
    case 'three-col':
      builder.threeCol(line.columns?.[0] ?? '', indent + (line.columns?.[1] ?? ''), line.columns?.[2] ?? '');
      break;
    case 'four-col':
      builder.fourCol(
        line.columns?.[0] ?? '',
        indent + (line.columns?.[1] ?? ''),
        line.columns?.[2] ?? '',
        line.columns?.[3] ?? '',
      );
      break;
    case 'separator':
      builder.separator();
      break;
    case 'double-separator':
      builder.doubleSeparator();
      break;
    case 'spacer':
      builder.feed(1);
      break;
  }

  if (line.invert) builder.invert(false);
  if (line.doubleHeight) builder.doubleHeight(false);
  if (line.center) builder.left();
  if (line.bold) builder.bold(false);
}

export function renderToEscPos(doc: ReceiptDocument): Uint8Array {
  const builder = new EscPosBuilder();
  builder.init();

  for (const section of doc.sections) {
    for (const line of section.lines) {
      applyLine(builder, line);
    }
  }

  if (doc.cutAfter) {
    builder.cut();
  }

  return builder.build();
}
