import { type ReactElement, type ReactNode, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '~/components/ui/alert-dialog';

type DeleteButtonProps = {
  /** The button that opens the dialog, without its content. Set `disabled` and `aria-label` on it. */
  trigger: ReactElement;
  /** The trigger's content: an icon, a label or both. */
  children: ReactNode;
  title: string;
  description: string;
  /** The label of the button that closes the dialog without deleting, like "Keep plan". */
  keepLabel: string;
  onDelete(): void;
};

/** A button that asks before it deletes something. */
export function DeleteButton({
  trigger,
  children,
  title,
  description,
  keepLabel,
  onDelete,
}: DeleteButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger}>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{keepLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
