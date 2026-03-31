'use client';

import React from 'react';
import * as Icons from '../icons';
import { cn } from './art.utils';

type IconMap = typeof Icons;
export type ArtIconName = keyof IconMap;

const ICON_SIZE_MAP = { sm: 16, md: 20, lg: 24 } as const;

export interface ArtIconProps extends React.SVGProps<SVGSVGElement> {
  name: ArtIconName;
  size?: 'sm' | 'md' | 'lg' | number;
}

const ArtIcon = React.memo<ArtIconProps>(({ name, size = 'sm', className, ...rest }) => {
  const Icon = (Icons as IconMap)[name] as React.FC<React.SVGProps<SVGSVGElement>> | undefined;
  if (!Icon) return null;

  const px = typeof size === 'number' ? size : ICON_SIZE_MAP[size];

  return (
    <Icon
      width={px}
      height={px}
      className={cn(className)}
      role="presentation"
      aria-hidden={true}
      {...rest}
    />
  );
});

ArtIcon.displayName = 'ArtIcon';

export default ArtIcon;
export { ArtIcon };
