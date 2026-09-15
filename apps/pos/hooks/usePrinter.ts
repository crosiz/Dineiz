'use client';

/**
 * usePrinter.ts
 * React hook that manages the printer connection lifecycle over either
 * transport — USB (WebUSB) or Bluetooth (Web Bluetooth) — used by the
 * Settings → This Terminal → Printing screen to actually pair a device.
 *
 * Usage:
 *   const { status, transport, connectUSB, connectBluetooth, printReceipt } = usePrinter();
 *
 * Flow:
 *   1. On mount: auto-reconnect using whichever transport is saved in
 *      terminal-settings (printerTransport), via the transport's own
 *      "reconnect to an already-paired device" call — no picker shown.
 *   2. connectUSB() / connectBluetooth(): opens that browser's device
 *      picker → user selects the printer → saves the choice as the
 *      terminal's printerTransport so future auto-reconnects use it.
 *   3. printReceipt(order) / printKOT(order): builds bytes and sends over
 *      whichever transport is currently connected.
 *   4. Disconnection events (USB unplug / Bluetooth radio drop) are handled
 *      automatically, resetting to 'disconnected'.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isWebUsbSupported,
  requestPrinter as requestUsbPrinter,
  getPersistedPrinter as getPersistedUsbPrinter,
  sendToPrinter as sendToUsbPrinter,
  closePrinter as closeUsbPrinter,
  type PrinterDevice,
} from '@/lib/printer/webusb';
import {
  isWebBluetoothSupported,
  requestBluetoothPrinter,
  getPersistedBluetoothPrinter,
  sendToBluetoothPrinter,
  closeBluetoothPrinter,
  type BluetoothPrinterDevice,
} from '@/lib/printer/webbluetooth';
import { buildReceipt, buildKOT, type PrintOrder } from '@/lib/printer/templates';
import { useTerminalSettings } from '@/lib/terminal-settings';

// ─── State ────────────────────────────────────────────────────────────────────

export type PrinterStatus = 'disconnected' | 'connecting' | 'ready' | 'printing' | 'error';
export type PrinterTransport = 'usb' | 'bluetooth';

export interface UsePrinterReturn {
  /** Whether WebUSB is available in this browser */
  isUsbSupported: boolean;
  /** Whether Web Bluetooth is available in this browser */
  isBluetoothSupported: boolean;
  /** Current printer connection status */
  status: PrinterStatus;
  /** Which transport is currently connected, if any */
  transport: PrinterTransport | null;
  /** Device name, if connected */
  deviceName: string | null;
  /** Last error message */
  error: string | null;
  /** Open the USB device picker and pair a printer */
  connectUSB: () => Promise<void>;
  /** Open the Bluetooth device picker and pair a printer */
  connectBluetooth: () => Promise<void>;
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
  const usbRef = useRef<PrinterDevice | null>(null);
  const bleRef = useRef<BluetoothPrinterDevice | null>(null);
  const [status, setStatus] = useState<PrinterStatus>('disconnected');
  const [transport, setTransport] = useState<PrinterTransport | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isUsbSupported = isWebUsbSupported();
  const isBluetoothSupported = isWebBluetoothSupported();

  // ── Auto-reconnect on mount — whichever transport is saved ─────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus('connecting');
      const saved = await useTerminalSettings.getState().load().then(
        () => useTerminalSettings.getState().settings.printerTransport
      );

      if (saved === 'BLUETOOTH' && isBluetoothSupported) {
        const device = await getPersistedBluetoothPrinter();
        if (cancelled) return;
        if (device) {
          bleRef.current = device;
          setTransport('bluetooth');
          setDeviceName(device.device.name ?? 'Bluetooth Printer');
          setStatus('ready');
          return;
        }
      } else if (saved === 'USB' && isUsbSupported) {
        const device = await getPersistedUsbPrinter();
        if (cancelled) return;
        if (device) {
          usbRef.current = device;
          setTransport('usb');
          setDeviceName(device.usbDevice.productName ?? 'USB Printer');
          setStatus('ready');
          return;
        }
      }
      if (!cancelled) setStatus('disconnected');
    })();

    // Listen for USB disconnect events
    const handleUsbDisconnect = (event: any) => {
      if (usbRef.current?.usbDevice === event.device) {
        usbRef.current = null;
        setTransport(null);
        setDeviceName(null);
        setStatus('disconnected');
        setError('Printer disconnected');
      }
    };
    (navigator as any).usb?.addEventListener?.('disconnect', handleUsbDisconnect);

    return () => {
      cancelled = true;
      (navigator as any).usb?.removeEventListener?.('disconnect', handleUsbDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bluetooth disconnect events are per-device, not global — wire the
  // listener up whenever a BLE device is actually connected.
  useEffect(() => {
    const dev = bleRef.current?.device;
    if (!dev) return;
    const onDisconnect = () => {
      bleRef.current = null;
      setTransport(null);
      setDeviceName(null);
      setStatus('disconnected');
      setError('Printer disconnected');
    };
    dev.addEventListener?.('gattserverdisconnected', onDisconnect);
    return () => dev.removeEventListener?.('gattserverdisconnected', onDisconnect);
  }, [transport, deviceName]);

  // ── Connect USB ─────────────────────────────────────────────────────────
  const connectUSB = useCallback(async () => {
    if (!isUsbSupported) { setError('USB printing is not supported in this browser.'); return; }
    setStatus('connecting');
    setError(null);
    try {
      const device = await requestUsbPrinter();
      if (!device) { setStatus(transport ? 'ready' : 'disconnected'); return; } // User cancelled
      if (bleRef.current) { await closeBluetoothPrinter(bleRef.current); bleRef.current = null; }
      usbRef.current = device;
      setTransport('usb');
      setDeviceName(device.usbDevice.productName ?? 'USB Printer');
      setStatus('ready');
      await useTerminalSettings.getState().set('printerTransport', 'USB');
    } catch (err) {
      setStatus('error');
      setError((err as Error).message ?? 'Failed to connect to printer');
    }
  }, [isUsbSupported, transport]);

  // ── Connect Bluetooth ───────────────────────────────────────────────────
  const connectBluetooth = useCallback(async () => {
    if (!isBluetoothSupported) { setError('Bluetooth printing is not supported in this browser.'); return; }
    setStatus('connecting');
    setError(null);
    try {
      const device = await requestBluetoothPrinter();
      if (!device) { setStatus(transport ? 'ready' : 'disconnected'); return; } // User cancelled
      if (usbRef.current) { await closeUsbPrinter(usbRef.current); usbRef.current = null; }
      bleRef.current = device;
      setTransport('bluetooth');
      setDeviceName(device.device.name ?? 'Bluetooth Printer');
      setStatus('ready');
      await useTerminalSettings.getState().set('printerTransport', 'BLUETOOTH');
    } catch (err) {
      setStatus('error');
      setError((err as Error).message ?? 'Failed to connect to printer');
    }
  }, [isBluetoothSupported, transport]);

  // ── Disconnect ──────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (usbRef.current) { await closeUsbPrinter(usbRef.current); usbRef.current = null; }
    if (bleRef.current) { await closeBluetoothPrinter(bleRef.current); bleRef.current = null; }
    setTransport(null);
    setDeviceName(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  // ── Print raw bytes ─────────────────────────────────────────────────────
  const printRaw = useCallback(async (bytes: Uint8Array) => {
    if (!usbRef.current && !bleRef.current) throw new Error('No printer connected');
    setStatus('printing');
    setError(null);
    try {
      if (usbRef.current) await sendToUsbPrinter(usbRef.current, bytes);
      else if (bleRef.current) await sendToBluetoothPrinter(bleRef.current, bytes);
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
    isUsbSupported,
    isBluetoothSupported,
    status,
    transport,
    deviceName,
    error,
    connectUSB,
    connectBluetooth,
    disconnect,
    printReceipt,
    printKOT,
    printRaw,
    openDrawer,
  };
}
