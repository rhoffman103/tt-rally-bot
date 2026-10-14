import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ADVERTISED_SERVICE,
  NOTIFY_CHARACTERISTIC,
  PRIMARY_SERVICE,
  WRITE_CHARACTERISTIC,
} from '~/lib/robot/protocol';
import { WebBluetoothTransport } from '~/lib/robot/web-bluetooth-transport';

/** Just enough of navigator.bluetooth for the transport, built on EventTarget. */
function fakeBluetooth() {
  const writes: number[][] = [];
  const notifier = Object.assign(new EventTarget(), {
    value: null as DataView | null,
    startNotifications: vi.fn(async () => notifier),
  });
  const writer = {
    writeValue: vi.fn(async (bytes: Uint8Array) => void writes.push([...bytes])),
  };
  const gatt = {
    connected: false,
    connect: vi.fn(async () => {
      gatt.connected = true;
      return gatt;
    }),
    disconnect: vi.fn(() => {
      gatt.connected = false;
      device.dispatchEvent(new Event('gattserverdisconnected'));
    }),
    getPrimaryService: vi.fn(async (uuid: string) => {
      expect(uuid).toBe(PRIMARY_SERVICE);
      return {
        getCharacteristic: async (id: string) => {
          if (id === WRITE_CHARACTERISTIC) return writer;
          if (id === NOTIFY_CHARACTERISTIC) return notifier;
          throw new Error(`Unknown characteristic ${id}`);
        },
      };
    }),
  };
  const device = Object.assign(new EventTarget(), { gatt });
  const bluetooth = { requestDevice: vi.fn(async () => device) };
  vi.stubGlobal('navigator', { bluetooth });

  /** Acts as if the robot sent `bytes`. */
  const notify = (bytes: number[]) => {
    notifier.value = new DataView(Uint8Array.from(bytes).buffer);
    notifier.dispatchEvent(new Event('characteristicvaluechanged'));
  };
  return { bluetooth, gatt, writes, notify };
}

afterEach(() => vi.unstubAllGlobals());

describe('WebBluetoothTransport', () => {
  it('asks for the robot, connects and starts notifications', async () => {
    const fake = fakeBluetooth();
    const transport = new WebBluetoothTransport();
    await transport.connect();
    expect(fake.bluetooth.requestDevice).toHaveBeenCalledWith({
      filters: [{ services: [ADVERTISED_SERVICE] }],
      optionalServices: [PRIMARY_SERVICE],
    });
    expect(fake.gatt.connected).toBe(true);
  });

  it('writes bytes and passes notifications on', async () => {
    const fake = fakeBluetooth();
    const transport = new WebBluetoothTransport();
    const received: number[][] = [];
    transport.onNotify((bytes) => received.push([...bytes]));
    await transport.connect();
    await transport.write(Uint8Array.of(0x80, 1, 0, 2));
    fake.notify([1, 2, 1, 0, 3]);
    expect(fake.writes).toEqual([[0x80, 1, 0, 2]]);
    expect(received).toEqual([[1, 2, 1, 0, 3]]);
  });

  it('reports a disconnect and reconnects without asking again', async () => {
    const fake = fakeBluetooth();
    const transport = new WebBluetoothTransport();
    const onDisconnect = vi.fn();
    transport.onDisconnect(onDisconnect);
    await transport.connect();
    fake.gatt.disconnect(); // the robot was switched off
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    await expect(transport.write(Uint8Array.of(1))).rejects.toThrow();

    await transport.connect();
    expect(fake.bluetooth.requestDevice).toHaveBeenCalledTimes(1);
    expect(fake.gatt.connect).toHaveBeenCalledTimes(2);
  });

  it('fails clearly when the browser has no Web Bluetooth', async () => {
    vi.stubGlobal('navigator', {});
    await expect(new WebBluetoothTransport().connect()).rejects.toThrow(/Web Bluetooth/);
  });
});
