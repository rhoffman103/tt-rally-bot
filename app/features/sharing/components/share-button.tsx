import { Copy, Share2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { QrCode } from '~/features/sharing/components/qr-code';
import {
  makeShareLink,
  type ShareableDrill,
  type ShareLinkResult,
} from '~/features/sharing/utils/share-link';

type ShareButtonProps = {
  drill: ShareableDrill;
};

// On phones the dialog sits at the bottom of the screen, as in the mockup.
const sheet =
  'max-[35rem]:top-auto max-[35rem]:bottom-0 max-[35rem]:max-w-none max-[35rem]:translate-y-0 max-[35rem]:rounded-b-none';

/** The Share button and its dialog: a QR code and a link that open the drill in TT Rally Bot on a phone. */
export function ShareButton({ drill }: ShareButtonProps) {
  const [share, setShare] = useState<ShareLinkResult | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const linkId = useId();

  // The link is made when the dialog opens, so it holds the drill as it is at that moment.
  const onOpenChange = (open: boolean) => {
    if (!open) return;
    setShare(null);
    void makeShareLink(drill).then(setShare);
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied');
    } catch {
      linkInput.current?.select();
      toast.error('TT Rally Bot can’t copy the link here. Press ⌘C or Ctrl+C to copy it.');
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger
        aria-label="Share"
        render={<Button variant="outline" size="lg" className="px-3.5 max-wide:px-2.5" />}
      >
        <Share2 aria-hidden="true" />
        <span className="max-wide:hidden">Share</span>
      </DialogTrigger>
      <DialogContent className={`gap-0 bg-background p-6 sm:max-w-[440px] ${sheet}`}>
        <DialogHeader className="gap-1.5 pr-6">
          <DialogTitle className="text-lg/snug font-semibold">Share “{drill.name}”</DialogTitle>
          <DialogDescription className="text-sm">
            Scan the code with your phone’s camera to open this drill in TT Rally Bot.
          </DialogDescription>
        </DialogHeader>

        <div className="mx-auto my-4 grid aspect-square w-55 place-items-center rounded-lg border bg-white p-2">
          {share?.ok ? (
            <QrCode text={share.link} label={`QR code for “${drill.name}”`} />
          ) : (
            <p className="p-4 text-center text-[13px] text-neutral-500" role="status">
              {share ? share.error : 'Making the code…'}
            </p>
          )}
        </div>

        <Label htmlFor={linkId} className="mb-1.5">
          Or send the link
        </Label>
        <div className="flex gap-2">
          <Input
            ref={linkInput}
            id={linkId}
            readOnly
            value={share?.ok ? share.link : ''}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 font-mono text-[12.5px]"
          />
          <Button
            variant="outline"
            disabled={!share?.ok}
            onClick={() => share?.ok && void copy(share.link)}
          >
            <Copy aria-hidden="true" />
            Copy link
          </Button>
        </div>
        <p className="mt-2.5 text-[13px] text-muted-foreground">
          The link opens on a phone that has the TT Rally Bot app.
        </p>
      </DialogContent>
    </Dialog>
  );
}
