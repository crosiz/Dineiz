import { jsPDF } from 'jspdf'
import { renderToPlainTextLines, type PlainTextLine, type ReceiptDocument } from '@dineiz/pos-logic'
import { RECEIPT_LOGO_HEIGHT_PX, RECEIPT_LOGO_PNG_BASE64, RECEIPT_LOGO_WIDTH_PX } from './assets/receiptLogo'

const MM_TO_PT = 2.8346456693
const MARGIN_MM = 3
// Courier's fixed advance is 0.6x its font size — at the old 9pt, a 48-char
// line (`PLAIN_TEXT_COLS` in renderPlainText.ts, matching escpos.ts's real
// 80mm/48-col printer convention) measures 48*9*0.6 = 259.2pt, but an 80mm
// page with 3mm margins only has ~209.8pt of content width. Every 'text' /
// 'three-col' / 'four-col' / separator line was silently overflowing the
// page's right edge — confirmed by rendering an actual receipt and reading
// it back, not assumed: the TOTAL amount, every item's price, and the
// change due were all being clipped off completely. 7pt (48*7*0.6=201.6pt)
// is the largest size that keeps the full 48-column budget on the page.
const FONT_SIZE_PT = 7
const LINE_HEIGHT_FACTOR = 1.25
const DOUBLE_HEIGHT_FACTOR = 1.4
// A small "powered by" mark under the footer text, not a masthead — the
// restaurant's own name is the thing a customer should see first on their
// receipt. An earlier pass sized this at 110pt (~half an 80mm receipt's
// width, bigger than the restaurant name itself) and put it above the
// header; real POS receipts (this project's own apps/pos included) put
// platform branding small and last, under a "Powered by" line, never above
// the merchant's identity.
const LOGO_WIDTH_PT = 40
const LOGO_HEIGHT_PT = LOGO_WIDTH_PT * (RECEIPT_LOGO_HEIGHT_PX / RECEIPT_LOGO_WIDTH_PX)
const LOGO_TOP_MARGIN_PT = 3
// Where a wrapped right-column continuation starts (a KOT item name too long
// to fit next to its qty on one line) — matches apps/pos's own KOT template,
// which draws qty at the margin and the (possibly multi-line) name starting
// 10pt in from it.
const WRAP_INDENT_PT = 10

function fontSizeFor(line: Pick<PlainTextLine, 'doubleHeight'>): number {
  return line.doubleHeight ? FONT_SIZE_PT * DOUBLE_HEIGHT_FACTOR : FONT_SIZE_PT
}

/** One physical, single-line row ready to draw — after wrapping, a single PlainTextLine can expand into several of these. */
interface Row {
  left?: string
  right?: string
  /** A wrapped continuation of `right` that no longer fits net to `left` — drawn left-aligned at WRAP_INDENT_PT instead of right-aligned at the page edge. */
  indented?: string
  center?: string
  bold?: boolean
  invert?: boolean
  fontSize: number
}

/**
 * Expands every PlainTextLine into one or more single-line Rows, wrapping
 * whatever doesn't fit `contentWidthPt` at that line's own font size —
 * nothing in this renderer silently ran text past the page edge before this
 * (confirmed by actually rendering a receipt with a long item name and
 * reading the output: the name ran off the *left* edge, right-aligned past
 * where it started). `pdf` is used only for text-width measurement here; it
 * does not need its final page size yet.
 */
function expandToRows(pdf: jsPDF, lines: PlainTextLine[], contentWidthPt: number): Row[] {
  const rows: Row[] = []

  for (const line of lines) {
    const fontSize = fontSizeFor(line)
    pdf.setFont('courier', line.bold ? 'bold' : 'normal')
    pdf.setFontSize(fontSize)

    if (line.rightText !== undefined) {
      const rightWidth = pdf.getTextWidth(line.rightText)
      // A generous fixed reserve for the left column (qty, or a short label)
      // rather than measuring it too — every real left column in this app
      // (order labels, "Cash Tendered", a KOT qty) is well under this.
      const leftReservePt = 90
      if (rightWidth <= contentWidthPt - leftReservePt) {
        rows.push({ left: line.text, right: line.rightText, bold: line.bold, invert: line.invert, fontSize })
        continue
      }
      const wrapped: string[] = pdf.splitTextToSize(line.rightText, contentWidthPt - WRAP_INDENT_PT)
      rows.push({ left: line.text, indented: wrapped[0], bold: line.bold, invert: line.invert, fontSize })
      for (const piece of wrapped.slice(1)) {
        rows.push({ indented: piece, bold: line.bold, invert: line.invert, fontSize })
      }
      continue
    }

    const width = pdf.getTextWidth(line.text)
    if (width <= contentWidthPt) {
      rows.push(
        line.center
          ? { center: line.text, bold: line.bold, invert: line.invert, fontSize }
          : { left: line.text, bold: line.bold, invert: line.invert, fontSize },
      )
      continue
    }
    const wrapped: string[] = pdf.splitTextToSize(line.text, contentWidthPt)
    for (const piece of wrapped) {
      rows.push(
        line.center
          ? { center: piece, bold: line.bold, invert: line.invert, fontSize }
          : { left: piece, bold: line.bold, invert: line.invert, fontSize },
      )
    }
  }

  return rows
}

/**
 * Renders a ReceiptDocument to an actual PDF file's bytes, for printing via
 * an OS-registered Windows printer (pdf-to-printer, see printerTransport.ts)
 * or for saving/emailing a copy. Courier is one of PDF's 14 standard fonts —
 * no font file needs embedding, so this has no asset-bundling concerns.
 * Page height is computed from content (a receipt has no fixed page size),
 * matching how the real thermal printer itself has no fixed page length.
 */
export function renderReceiptToPdf(doc: ReceiptDocument, paperWidthMm = 80): Buffer {
  const lines = renderToPlainTextLines(doc)
  const pageWidthPt = paperWidthMm * MM_TO_PT
  const marginPt = MARGIN_MM * MM_TO_PT
  const contentWidthPt = pageWidthPt - marginPt * 2

  // The brand mark closes customer-facing receipts only — a KOT is a
  // functional kitchen ticket, not a brand moment, and printing it faster
  // (less to spool) matters more there than printing it pretty. It sits
  // below the "Powered by Dineiz" text line that buildBill.ts's
  // footerSection always adds last, on both this PDF path and the real
  // ESC/POS path — this image is purely a PDF-only enhancement of that same
  // text line, not a replacement for it (a thermal printer gets the text
  // alone, which is exactly what a receipt footer credit is supposed to be).
  const showLogo = doc.documentType === 'RECEIPT'
  const logoBlockHeightPt = showLogo ? LOGO_HEIGHT_PT + LOGO_TOP_MARGIN_PT : 0

  // A throwaway doc purely for text measurement (font metrics don't depend
  // on page size) — expandToRows needs real getTextWidth()/splitTextToSize()
  // answers before the actual page height is knowable.
  const measurer = new jsPDF({ unit: 'pt' })
  const rows = expandToRows(measurer, lines, contentWidthPt)

  const contentHeightPt = rows.reduce((sum, row) => sum + row.fontSize * LINE_HEIGHT_FACTOR, 0)
  const pageHeightPt = Math.max(contentHeightPt + logoBlockHeightPt + marginPt * 2, 40)

  // jsPDF enforces its `orientation` regardless of the literal order of a
  // given `format: [w, h]` array — 'portrait' (the default, and what every
  // receipt/KOT here was hardcoded to) silently swaps the two dimensions
  // whenever width > height, which is the *common* case for a short KOT or
  // receipt on wide paper (a handful of lines rarely add up to more than
  // 226.77pt/80mm of height). Confirmed directly against jsPDF itself, not
  // assumed: `new jsPDF({format:[226.77,90], orientation:'portrait'})`
  // reports its own actual page as 90x226.77, not the 226.77x90 requested —
  // every downstream `pageWidthPt`-relative position (centering, right
  // alignment, the footer logo) was then computed for a page that didn't
  // exist, landing most content outside the real, transposed page bounds.
  // Passing the orientation that already matches the computed dimensions
  // makes jsPDF's swap a no-op instead.
  const orientation = pageWidthPt >= pageHeightPt ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ unit: 'pt', format: [pageWidthPt, pageHeightPt], orientation })

  let y = marginPt + FONT_SIZE_PT * 0.9
  for (const row of rows) {
    const height = row.fontSize * LINE_HEIGHT_FACTOR
    pdf.setFont('courier', row.bold ? 'bold' : 'normal')
    pdf.setFontSize(row.fontSize)

    if (row.invert) {
      pdf.setFillColor(0, 0, 0)
      pdf.rect(marginPt, y - row.fontSize * 0.8, contentWidthPt, height, 'F')
      pdf.setTextColor(255, 255, 255)
    } else {
      pdf.setTextColor(0, 0, 0)
    }

    if (row.center !== undefined) {
      pdf.text(row.center, pageWidthPt / 2, y, { align: 'center' })
    } else {
      if (row.left !== undefined) pdf.text(row.left, marginPt, y, { align: 'left' })
      if (row.right !== undefined) pdf.text(row.right, pageWidthPt - marginPt, y, { align: 'right' })
      if (row.indented !== undefined) pdf.text(row.indented, marginPt + WRAP_INDENT_PT, y, { align: 'left' })
    }

    y += height
  }

  if (showLogo) {
    y += LOGO_TOP_MARGIN_PT
    const logoX = (pageWidthPt - LOGO_WIDTH_PT) / 2
    pdf.addImage(`data:image/png;base64,${RECEIPT_LOGO_PNG_BASE64}`, 'PNG', logoX, y, LOGO_WIDTH_PT, LOGO_HEIGHT_PT)
  }

  return Buffer.from(pdf.output('arraybuffer'))
}
