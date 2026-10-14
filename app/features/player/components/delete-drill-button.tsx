import type { ReactElement, ReactNode } from 'react';

import { DeleteButton } from '~/components/delete-button';

type DeleteDrillButtonProps = {
  name: string;
  /** The button that opens the dialog, without its content. */
  trigger: ReactElement;
  children: ReactNode;
  onDelete(): void;
};

/** Asks before it deletes a custom drill. */
export function DeleteDrillButton({ name, trigger, children, onDelete }: DeleteDrillButtonProps) {
  return (
    <DeleteButton
      trigger={trigger}
      title={`Delete “${name}”?`}
      description="This deletes the drill from My drills. Plans that use it will show it as missing. You can’t undo this."
      keepLabel="Keep drill"
      onDelete={onDelete}
    >
      {children}
    </DeleteButton>
  );
}
