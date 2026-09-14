/**
 * webbluetooth.ts
 * Web Bluetooth (BLE) connection manager for ESC/POS thermal printers.
 *
 * This is the genuinely-wireless counterpart to webusb.ts: Bluetooth is a
 * direct radio link between this device and the printer, so it works from a
 * pure browser tab with no server/network involved at all — unlike a WiFi/LAN
 * "network" printer, which needs a raw TCP socket on port 9100 that no
 * browser API can open (see print.service.ts's executeSystemPrint for how
 * that case is actually handled).
 *
 * Real constraints, not bugs:
 *  - Web Bluetooth is Chrome/Edge/Opera only. Not Safari, not any browser on
 *    iOS (WebKit doesn't implement it there at all, Chrome-on-iOS included).
 *  - It only reaches BLE (Bluetooth Low Energy) GATT devices. Many budget
 *    "Bluetooth thermal printers" are actually Bluetooth Classic / SPP
 *    (serial port profile), which no Web API — this one or any other — can
 *    reach from a browser. Those need System Print (OS-level pairing) or USB.
 *  - The browser's security model requires every GATT service you'll touch
 *    to be declared up front in `optionalServices` at pairing time — you
 *    cannot discover an arbitrary vendor's custom UUID after the fact. There
 *    is no universal "any BLE printer" service UUID; KNOWN_PRINTER_SERVICES
 *    below covers the handful of generic UART/printer service UUIDs that
 *    most cheap ESC/POS BLE boards (and the BLE-serial bridge chips several
 *    of them are built on) actually use. A printer using a still-different
 *    custom UUID won't be reachable this way — that's a real hardware
 *    limitation, not something more code here can fix.
 */

// ─── Known GATT service UUIDs ──────────────────────────────────────────────
//
// Collected from the handful of patterns generic/OEM ESC/POS BLE printers
// (and the BLE-serial bridge chips several of them are built on) actually
// expose. Declaring all of them in `optionalServices` costs nothing for a
// printer that only has one — the browser just won't find the others.
const KNOWN_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // common generic ESC/POS "Printer Service"
  '0000ff00-0000-1000-8000-00805f9b34fb', // common generic OEM transparent-serial service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10/CC254x style BLE-serial module service
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip/ISSC transparent-UART service
];

// ─── Types ────────────────────────────────────────────────────────────────

export interface BluetoothPrinterDevice {
  device: any; // BluetoothDevice
  server: any; // BluetoothRemoteGATTServer
  characteristic: any; // BluetoothRemoteGATTCharacteristic (writable)
}

// ─── Feature Detection ──────────────────────────────────────────────────────

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/** Whether this browser can silently re-list previously-paired devices
 *  (Chrome's persistent-permissions `getDevices()`). Without it, every
 *  session needs a fresh pairing tap — still fine, just less seamless. */
function supportsPersistedDevices(): boolean {
  return isWebBluetoothSupported() && typeof (navigator as any).bluetooth.getDevices === 'function';
}

// ─── Connection ─────────────────────────────────────────────────────────────

/** Scans the connected device's known services for the first writable
 *  characteristic. Returns null if none of KNOWN_PRINTER_SERVICES are
 *  present on this device. */
async function findWritableCharacteristic(server: any): Promise<any | null> {
  for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find(
        (c: any) => c.properties?.write || c.properties?.writeWithoutResponse
      );
      if (writable) return writable;
    } catch {
      // This device doesn't expose that service — try the next one.
    }
  }
  return null;
}

async function connectAndFind(device: any): Promise<BluetoothPrinterDevice> {
  const server = await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);
  if (!characteristic) {
    server.disconnect?.();
    throw new Error(
      "This printer's Bluetooth service isn't one Web Bluetooth recognizes. Try USB, or print via System Dialog instead."
    );
  }
  return { device, server, characteristic };
}

/**
 * Opens the browser's Bluetooth device chooser. Must be called from a direct
 * user gesture (a click handler) — same requirement as WebUSB's
 * requestDevice(), and for the same reason (browser anti-abuse policy).
 * Returns null if the user cancels the picker or Bluetooth isn't supported.
 */
export async function requestBluetoothPrinter(): Promise<BluetoothPrinterDevice | null> {
  if (!isWebBluetoothSupported()) return null;
  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_PRINTER_SERVICES,
    });
    return await connectAndFind(device);
  } catch (err) {
    // User cancelled the picker, or no matching device was in range.
    if ((err as Error).name === 'NotFoundError') return null;
    throw err;
  }
}

/**
 * Reconnects to a previously-paired printer without showing the picker
 * again. Only works in browsers implementing the persistent-permissions
 * `getDevices()` API (Chrome); returns null everywhere else, including when
 * nothing was ever paired.
 */
export async function getPersistedBluetoothPrinter(): Promise<BluetoothPrinterDevice | null> {
  if (!supportsPersistedDevices()) return null;
  try {
    const devices = await (navigator as any).bluetooth.getDevices();
    if (!devices?.length) return null;
    // Bluetooth radios drop out of range far more often than a plugged-in
    // USB cable does — try each remembered device instead of only the first.
    for (const device of devices) {
      try {
        return await connectAndFind(device);
      } catch {
        continue;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Printing ─────────────────────────────────────────────────────────────

/**
 * Sends a raw byte buffer to the printer over its GATT characteristic.
 * Chunked conservatively (most BLE links negotiate well under 512 bytes of
 * usable payload per write even when the stack reports a larger MTU) with a
 * short pause between writes so a slow printer's internal buffer isn't
 * flooded — WebUSB's bulk transfer has no equivalent backpressure risk, but
 * BLE writes queued faster than the printer can drain them are a common
 * source of dropped/garbled output on cheap boards.
 */
export async function sendToBluetoothPrinter(
  printer: BluetoothPrinterDevice,
  data: Uint8Array,
): Promise<void> {
  const CHUNK = 100;
  const canWriteWithoutResponse = !!printer.characteristic.properties?.writeWithoutResponse;
  for (let offset = 0; offset < data.length; offset += CHUNK) {
    const chunk = data.slice(offset, offset + CHUNK);
    if (canWriteWithoutResponse) {
      await printer.characteristic.writeValueWithoutResponse(chunk);
    } else {
      await printer.characteristic.writeValue(chunk);
    }
    if (offset + CHUNK < data.length) {
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
  }
}

// ─── Disconnection ────────────────────────────────────────────────────────

export async function closeBluetoothPrinter(printer: BluetoothPrinterDevice): Promise<void> {
  try {
    printer.device.gatt?.disconnect();
  } catch {
    // Ignore — device may already be disconnected / out of range.
  }
}
