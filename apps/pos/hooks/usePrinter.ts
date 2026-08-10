'use client';

/**
 * usePrinter.ts
 * React hook that manages the WebUSB printer lifecycle.
 *
 * Usage:
 *   const { printer, isSupported, connect, printReceipt, printKOT } = usePrinter();
 *
 * Flow:
 *   1. On mount: auto-reconnect to any previously paired USB printer.
 *   2. connect(): opens browser USB chooser → user picks the printer.
 *   3. printReceipt(order) / printKOT(order): builds bytes and sends via USB.
 *   4. Disconnection events are handled automatically.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isWebUsbSupported,
  requestPrinter,
  getPersistedPrinter,
  sendToPrinter,
  closePrinter,
  type PrinterDevice,
} from '@/lib/printer/webusb';
import { buildReceipt, buildKOT, type PrintOrder } from '@/lib/printer/templates';

// ─── State ────────────────────────────────────────────────────────────────────

export type PrinterStatus = 'disconnected' | 'connecting' | 'ready' | 'printing' | 'error';

export interface UsePrinterReturn {
  /** Whether WebUSB is available in this browser */
  isSupported: boolean;
  /** Current printer connection status */
  status: PrinterStatus;
  /** USB device name, if connected */
  deviceName: string | null;
  /** Last error message */
  error: string | null;
  /** Open USB device picker and pair a printer */
  connect: () => Promise<void>;
  /** Disconnect from the current printer */
  disconnect: () => Promise<void>;
  /** Print a customer receipt */
  printReceipt: (order: PrintOrder) => Promise<void>;
  /** Print a KOT (Kitchen Order Ticket) */
  printKOT: (order: PrintOrder) => Promise<void>;
  /** Print raw bytes (advanced use) */
  printRaw: (bytes: Uint8Array) => Promise<void>;
  /** Open the cash drawer (if printer supports it) */
  openDrawer: () => Promise<void>;
}

// ─── ESC/POS cash-drawer command bytes ───────────────────────────────────────
const OPEN_DRAWER_BYTES = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0x19]);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePrinter(): UsePrinterReturn {
  const printerRef = useRef<PrinterDevice | null>(null);
  const [status, setStatus] = useState<PrinterStatus>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSupported = isWebUsbSupported();

  // ── Auto-reconnect on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!isSupported) return;
    let cancelled = false;

    (async () => {
      setStatus('connecting');
      const device = await getPersistedPrinter();
      if (cancelled) return;
      if (device) {
        printerRef.current = device;
        setDeviceName(device.usbDevice.productName ?? 'Thermal Printer');
        setStatus('ready');
      } else {
        setStatus('disconnected');
      }
    })();

    // Listen for USB disconnect events
    const handleDisconnect = (event: any) => {
      if (printerRef.current?.usbDevice === event.device) {
        printerRef.current = null;
        setDeviceName(null);
        setStatus('disconnected');
        setError('Printer disconnected');
      }
    };
    (navigator as any).usb?.addEventListener('disconnect', handleDisconnect);

    return () => {
      cancelled = true;
      (navigator as any).usb?.removeEventListener('disconnect', handleDisconnect);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Connect ─────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!isSupported) { setError('WebUSB is not supported in this browser.'); return; }
    setStatus('connecting');
    setError(null);
    try {
      const device = await requestPrinter();
      if (!device) { setStatus('disconnected'); return; } // User cancelled
      printerRef.current = device;
      setDeviceName(device.usbDevice.productName ?? 'Thermal Printer');
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError((err as Error).message ?? 'Failed to connect to printer');
    }
  }, [isSupported]);

  // ── Disconnect ──────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (!printerRef.current) return;
    await closePrinter(printerRef.current);
    printerRef.current = null;
    setDeviceName(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  // ── Print raw bytes ─────────────────────────────────────────────────────
  const printRaw = useCallback(async (bytes: Uint8Array) => {
    if (!printerRef.current) throw new Error('No printer connected');
    setStatus('printing');
    setError(null);
    try {
      await sendToPrinter(printerRef.current, bytes);
      setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError((err as Error).message ?? 'Print failed');
      throw err;
    }
  }, []);

  // ── Print Receipt ───────────────────────────────────────────────────────
  const printReceipt = useCallback(async (order: PrintOrder) => {
    const bytes = buildReceipt(order);
    await printRaw(bytes);
  }, [printRaw]);

  // ── Print KOT ───────────────────────────────────────────────────────────
  const printKOT = useCallback(async (order: PrintOrder) => {
    const bytes = buildKOT(order);
    await printRaw(bytes);
  }, [printRaw]);

  // ── Open cash drawer ────────────────────────────────────────────────────
  const openDrawer = useCallback(async () => {
    await printRaw(OPEN_DRAWER_BYTES);
  }, [printRaw]);

  return {
    isSupported,
    status,
    deviceName,
    error,
    connect,
    disconnect,
    printReceipt,
    printKOT,
    printRaw,
    openDrawer,
  };
}
