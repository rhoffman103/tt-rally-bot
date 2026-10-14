# Nova S Pro Bluetooth protocol

What we know about how the Pongbot Nova S Pro talks over Bluetooth LE.

Items marked **(verify)** are inferred from compiled code and should be confirmed against the robot with logging on.

All multi-byte numbers are **little-endian**.

## GATT

| Thing                                           | Value                                  |
| ----------------------------------------------- | -------------------------------------- |
| Advertised service (for `requestDevice` filter) | `0xfeff` (65279)                       |
| Primary service                                 | `02f00000-0000-0000-0000-00000000fe00` |
| Write characteristic                            | `02f00000-0000-0000-0000-00000000ff01` |
| Notify characteristic                           | `02f00000-0000-0000-0000-00000000ff02` |

```ts
navigator.bluetooth.requestDevice({
  filters: [{ services: [0xfeff] }],
  optionalServices: ['02f00000-0000-0000-0000-00000000fe00'],
});
```

Writes must be serialized: wait for each `writeValue()` promise before sending the next message.

## Connection handshake

Each step waits for one notification before sending the next message.

| #   | Send                                            | Then wait for                 |
| --- | ----------------------------------------------- | ----------------------------- |
| 1   | `07 00 00 00` (request challenge)               | challenge notification        |
| 2   | `08 20 00` + 32 ASCII bytes of the hash (below) | 1 notification                |
| 3   | `01 00 00`                                      | 1 notification                |
| 4   | `02 00 00`                                      | 1 notification                |
| 5   | `80 01 00 00` (wake up)                         | 2 notifications → **standby** |

When connected the robot's blue lights stop blinking and stay on.

### Challenge response

From the challenge notification:

- `serial` = bytes 6–17 decoded as ASCII (12 chars)
- `code` = bytes 18–end decoded as ASCII

```ts
const KEY = 'Mjgx1jAwXDBaMFcxCz3JBgNVBAYT4kJF7Rkw'; // 36 chars
const salt = [...serial].map((ch) => KEY[ch.charCodeAt(0) % 36]).join('');
const hash = md5(serial + salt + code); // lowercase hex, 32 chars
// send: [0x08, 0x20, 0x00, ...asciiBytes(hash)]   (0x20 = 32 = payload length)
```

Use a small md5 package (e.g. `spark-md5`); Web Crypto has no MD5.

## Control commands

| Command | Bytes         |
| ------- | ------------- |
| Wake up | `80 01 00 00` |
| Stop    | `80 01 00 01` |
| Pause   | `80 01 00 02` |
| Resume  | `80 01 00 03` |

## Ball (24 bytes)

| Offset | Type | Field                   | User range        | Encoded as                          |
| ------ | ---- | ----------------------- | ----------------- | ----------------------------------- |
| 0      | u32  | upper wheel rpm         | 400–7500, integer | as-is                               |
| 4      | u32  | lower wheel rpm         | 400–7500, integer | as-is                               |
| 8      | f32  | ball height             | −50…100, integer  | `(h + 50) / 150 * 50 - 20` → −20…30 |
| 12     | f32  | drop point (left/right) | −10…10, step 0.5  | `(d + 10) / 20 * 44 - 22` → −22…22  |
| 16     | f32  | frequency               | 0…100, step 10    | `f / 100 + 0.5` → 0.5…1.5           |
| 20     | u32  | repetitions             | 1–200             | as-is                               |

v1 used 500–7274 rpm; v3 widened it to 400–7500. Speed and spin are not separate fields: speed comes from both
wheels together, spin from the difference between them (upper faster = topspin, lower faster = backspin).
The official app's 0–10 speed/spin sliders do not map 1:1 to wheel rpm.

## New drill — `0x81`

```
81 | u16 len = 4 + 24·n | u8 mode | u16 amount | u8 random | n × ball(24)
```

- 1 ≤ n ≤ 9 balls.
- `random` = 1 lets the robot pick balls at random instead of in order.
- `mode` / `amount` **(verify)**: v3 sends mode `3` + amount `0` for endless, mode `0` for "play N minutes" and
  mode `1` for "play N combos", with N in `amount`. v1 instead wrote combos in byte 3 and minutes in bytes 4–5
  (v1 always sent `3`, `0`, which is v3's endless). Log what the robot accepts before relying on either.
- `amount` holds whole minutes. The app lets you pick minutes in steps of 30 seconds, so it sends 1.5 minutes as
  2 and stops the drill itself after 1.5 minutes.
- The robot holds about 130 balls. That is about 2 minutes at frequency 50.
- A notification `01 81 00 00` means the drill was rejected (v1).

## Replace balls mid-drill — `0x84` **(verify)**

```
84 | u16 len = 1 + 24·n | n × ball(24)
```

v3 uses this to stream drills longer than 9 balls and "one of these at random" lines: it plays one line, watches
drill-status until the ball count is reached, then sends the next line with `0x84` without stopping. If the next
line has a different ball count, it stops and restarts with `0x81` instead.

## Notifications

```
byte 0: 1 = ok | byte 1: type | bytes 2–3: u16 payload length | bytes 4+: payload
```

| Type byte                | Meaning                                                                                              | Payload                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 7                        | challenge                                                                                            | serial at 6–17, code at 18+                                                                          |
| 2                        | device status                                                                                        | u8 state at 4 (0–5); `5` seen when a drill ends → standby; `3` seen after stop **(verify meanings)** |
| 5                        | drill status                                                                                         | u16 at 4, u16 at 6, u16 at 8 (balls shot in current set), u8 at 10 **(verify)**                      |
| 1, 8, 128, 129, 131, 132 | responses to the matching commands; one of them carries version info (three length-prefixed strings) |                                                                                                      |

v3 gives these names **(verify)**:

- Types: 1 version-info, 2 device-status, 5 drill-status, 7 request-challenge (carries the challenge), 8 request-answer,
  128 drill-control, 129 new-drill, 131 heartbeat, 132 change-drill.
- Device states: 0 uninitialized, 1 unknown, 2 initializing, 3 free, 4 running, 5 stopping.
- Drill status: u16 runtime at 4, u16 drills (sets) at 6, u16 balls at 8, u8 ball index at 10.
- Version info: u8 lengths at 4, 5 and 6, then the serial, hardware version and firmware version from byte 7.

Log every notification in hex during development; that is how the **(verify)** items get settled.
