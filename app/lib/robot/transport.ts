/** A link to the robot: Web Bluetooth, or the simulated robot. Bytes in and out, nothing else. */
export interface RobotTransport {
  /** Opens the link. For Web Bluetooth, call it only from a click handler. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Sends one message. Resolves when the robot has it; the caller waits before sending the next. */
  write(bytes: Uint8Array): Promise<void>;
  /** Listens for notifications from the robot. Returns a function that stops listening. */
  onNotify(listener: (bytes: Uint8Array) => void): () => void;
  /** Listens for the link going down, whoever closed it. Returns a function that stops listening. */
  onDisconnect(listener: () => void): () => void;
}

/** A tiny listener list, shared by the transports. */
export function listeners<T extends unknown[]>() {
  const set = new Set<(...args: T) => void>();
  return {
    add(listener: (...args: T) => void) {
      set.add(listener);
      return () => void set.delete(listener);
    },
    emit(...args: T) {
      for (const listener of [...set]) listener(...args);
    },
  };
}
