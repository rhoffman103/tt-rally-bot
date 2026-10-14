import { useMemo } from 'react';
import { encode } from 'uqr';

import { cn } from '~/lib/utils';

type QrCodeProps = {
  text: string;
  /** What the code holds, for screen readers. */
  label: string;
  className?: string;
};

/** A QR code drawn as one SVG path. Always black on white, so phone cameras read it in dark mode too. */
export function QrCode({ text, label, className }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    const qr = encode(text, { ecc: 'M', border: 0 });
    let d = '';
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { size: qr.size, path: d };
  }, [text]);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={cn('block size-full', className)}
    >
      <path d={path} className="fill-black" />
    </svg>
  );
}
