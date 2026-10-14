// The robot over Web Bluetooth. docs/robot-protocol.md "GATT".
import {
  ADVERTISED_SERVICE,
  NOTIFY_CHARACTERISTIC,
  PRIMARY_SERVICE,
  WRITE_CHARACTERISTIC,
} from '~/lib/robot/protocol';
import { listeners, type RobotTransport } from '~/lib/robot/transport';

export class WebBluetoothTransport implements RobotTransport {
  private device: BluetoothDevice | null = null;
  private writer: BluetoothRemoteGATTCharacteristic | null = null;
  private notifier: BluetoothRemoteGATTCharacteristic | null = null;
  private readonly notify = listeners<[Uint8Array]>();
  private readonly disconnected = listeners<[]>();

  /**
   * Asks the user to pick the robot the first time, then reconnects to the same robot without asking. Call it
   * from a click handler: `requestDevice` needs a user gesture.
   */
  async connect(): Promise<void> {
    if (!navigator.bluetooth) throw new Error('This browser has no Web Bluetooth.');
    if (!this.device) {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [ADVERTISED_SERVICE] }],
        optionalServices: [PRIMARY_SERVICE],
      });
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnected);
    }
    const gatt = this.device.gatt;
    if (!gatt) throw new Error('The robot has no GATT server.');
    try {
      const server = await gatt.connect();
      const service = await server.getPrimaryService(PRIMARY_SERVICE);
      this.writer = await service.getCharacteristic(WRITE_CHARACTERISTIC);
      this.notifier = await service.getCharacteristic(NOTIFY_CHARACTERISTIC);
      this.notifier.addEventListener('characteristicvaluechanged', this.handleValue);
      await this.notifier.startNotifications();
    } catch (error) {
      this.cleanUp();
      if (gatt.connected) gatt.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    else this.cleanUp();
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error('Not connected to the robot.');
    // writeValue picks "with response" when the characteristic supports it.
    await this.writer.writeValue(new Uint8Array(bytes));
  }

  onNotify(listener: (bytes: Uint8Array) => void) {
    return this.notify.add(listener);
  }

  onDisconnect(listener: () => void) {
    return this.disconnected.add(listener);
  }

  private readonly handleValue = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) this.notify.emit(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  };

  // Fires when the robot is switched off or out of range, and after disconnect().
  private readonly handleDisconnected = () => {
    this.cleanUp();
    this.disconnected.emit();
  };

  private cleanUp() {
    this.notifier?.removeEventListener('characteristicvaluechanged', this.handleValue);
    this.notifier = null;
    this.writer = null;
  }
}
