/**
 * webusb.ts
 * WebUSB connection manager for ESC/POS thermal printers.
 *
 * WebUSB API is available in Chrome 61+ and Edge 79+.
 * Not supported in Firefox or Safari.
 *
 * Most USB thermal printers enumerate as:
 *   - Class: Printer (0x07) or Vendor Specific (0xFF)
 *   - Interface: 0, alternate 0
 *   - Bulk OUT endpoint: usually endpoint 1 or 2
 *
 * The USB device chooser is shown to the user only on the first call to
 * `requestPrinter()`. Subsequent sessions use `getPersistedPrinter()`.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrinterDevice {
  usbDevice: any;
  endpointNumber: number;
  interfaceNumber: number;
}

// ─── Feature Detection ────────────────────────────────────────────────────────

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

// ─── Device Discovery ─────────────────────────────────────────────────────────

/**
 * Opens the browser's USB device chooser and lets the user select a printer.
 * Returns null if the user cancels or WebUSB is not supported.
 */
export async function requestPrinter(): Promise<PrinterDevice | null> {
  if (!isWebUsbSupported()) return null;
  try {
    const device = await (navigator as any).usb.requestDevice({
      // Accept all USB devices — user picks the correct one
      filters: [],
    });
    return await openPrinter(device);
  } catch (err) {
    // User cancelled the picker
    if ((err as Error).name === 'NotFoundError') return null;
    throw err;
  }
}

/**
 * Checks for previously granted (persisted) printer devices and re-connects
 * to the first one automatically. Returns null if no device was previously
 * paired.
 */
export async function getPersistedPrinter(): Promise<PrinterDevice | null> {
  if (!isWebUsbSupported()) return null;
  try {
    const devices = await (navigator as any).usb.getDevices();
    if (devices.length === 0) return null;
    return await openPrinter(devices[0]);
  } catch {
    return null;
  }
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Opens a USB device, claims the first printer interface,
 * and finds the BULK OUT endpoint to send ESC/POS bytes to.
 */
async function openPrinter(device: any): Promise<PrinterDevice> {
  if (!device.opened) await device.open();
  await device.selectConfiguration(1);

  // Find the first interface with a BULK OUT endpoint
  for (const iface of device.configuration?.interfaces ?? []) {
    const alt = iface.alternates[0];
    for (const endpoint of alt.endpoints) {
      if (endpoint.type === 'bulk' && endpoint.direction === 'out') {
        // Claim this interface and select alternate
        try { 
          await device.claimInterface(iface.interfaceNumber); 
          await device.selectAlternateInterface(iface.interfaceNumber, alt.alternateSetting);
        } catch { /* already claimed */ }
        return {
          usbDevice: device,
          interfaceNumber: iface.interfaceNumber,
          endpointNumber: endpoint.endpointNumber,
        };
      }
    }
  }

  // Fallback: assume interface 0, endpoint 1 (works for most ESC/POS printers)
  try { 
    await device.claimInterface(0); 
    await device.selectAlternateInterface(0, 0);
  } catch { /* already claimed */ }
  return { usbDevice: device, interfaceNumber: 0, endpointNumber: 1 };
}

// ─── Printing ─────────────────────────────────────────────────────────────────

/**
 * Sends a raw byte buffer to the printer via WebUSB.
 * Splits into 64-byte chunks to avoid USB transfer size limits.
 */
export async function sendToPrinter(
  printer: PrinterDevice,
  data: Uint8Array,
): Promise<void> {
  const CHUNK = 64;
  for (let offset = 0; offset < data.length; offset += CHUNK) {
    const chunk = data.slice(offset, offset + CHUNK);
    const result = await printer.usbDevice.transferOut(printer.endpointNumber, chunk);
    if (result.status !== 'ok') {
      throw new Error(`USB transfer failed: ${result.status}`);
    }
  }
}

// ─── Disconnection ────────────────────────────────────────────────────────────

export async function closePrinter(printer: PrinterDevice): Promise<void> {
  try {
    await printer.usbDevice.releaseInterface(printer.interfaceNumber);
    await printer.usbDevice.close();
  } catch {
    // Ignore — device may already be disconnected
  }
}
