import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';

type SettingsCardProps = {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
};

export function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <Card className="[--card-spacing:--spacing(5)]">
      {title && (
        <CardHeader>
          <CardTitle className="text-[15px] font-semibold">{title}</CardTitle>
          {description && <CardDescription className="max-w-[60ch]">{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  );
}
