/** 7500 → "7,500". */
export const formatRpm = (rpm: number) => rpm.toLocaleString('en-US');

/** −3 with a real minus sign, as the sliders show it. */
export const formatSigned = (value: number) => (value < 0 ? `−${-value}` : String(value));
