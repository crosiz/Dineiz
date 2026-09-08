import type { PaymentMethod } from '../tax';
import type { RoundingMethod } from '../money';
import type { OrderType } from '../domain';

export interface PrintItem {
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
  variationName?: string;
  addOnNames?: string[];
}

export interface PrintOrder {
  orderNumber: string;
  type: OrderType;
  cashierName?: string;
  terminalName?: string;
  restaurantName: string;
  restaurantAddress?: string;
  restaurantNtn?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  items: PrintItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  taxRatePercent: number;
  total: number;
  /** undefined = not yet paid ("due bill") */
  paymentMethod?: PaymentMethod;
  cashTendered?: number;
  changeGiven?: number;
  notes?: string;
  createdAt: string;
  tableLabel?: string;
}

export interface DualTaxOptions {
  enabled: boolean;
  cashTaxRatePercent: number;
  cardTaxRatePercent: number;
  roundingMethod?: RoundingMethod;
}

export type ReceiptLineKind =
  | 'text'
  | 'two-col'
  | 'three-col'
  | 'four-col'
  | 'separator'
  | 'double-separator'
  | 'spacer';

export interface ReceiptLine {
  kind: ReceiptLineKind;
  columns?: string[];
  text?: string;
  bold?: boolean;
  center?: boolean;
  doubleHeight?: boolean;
  invert?: boolean;
  indent?: number;
}

export interface ReceiptSection {
  name: string;
  lines: ReceiptLine[];
}

export type ReceiptDocumentType = 'RECEIPT' | 'KOT' | 'CANCELLATION_KOT';

export interface ReceiptDocument {
  documentType: ReceiptDocumentType;
  sections: ReceiptSection[];
  cutAfter: boolean;
}
