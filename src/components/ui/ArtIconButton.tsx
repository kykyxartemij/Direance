import { forwardRef } from 'react';
import ArtButton, { type ArtButtonProps } from './ArtButton';
import ArtIcon, { ArtIconName, type ArtIconProps } from './ArtIcon';
import ArtTooltip from './ArtTooltip';
import { type ButtonHTMLAttributes } from 'react';
import { type ArtColor } from './art.types';
import { cn } from './art.utils';

type ArtIconDef = ArtIconName | { name: ArtIconName; size?: number; style?: React.CSSProperties };

interface ArtIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ArtIconDef;
  tooltip?: string;
  size?: ArtButtonProps['size'];
  color?: ArtColor;
  variant?: ArtButtonProps['variant'];
}

const ICON_SIZE: Record<NonNullable<ArtIconButtonProps['size']>, number> = {
  sm: 14, md: 16, lg: 20,
};

function resolveIcon(icon: ArtIconDef, buttonSize: NonNullable<ArtIconButtonProps['size']>) {
  if (typeof icon === 'string') return { name: icon, size: ICON_SIZE[buttonSize], style: undefined };
  return { name: icon.name, size: icon.size ?? ICON_SIZE[buttonSize], style: icon.style };
}

const ArtIconButton = forwardRef<HTMLButtonElement, ArtIconButtonProps>(
  ({ icon, tooltip, size = 'md', color, variant = 'ghost', className = '', ...rest }, ref) => {
    const { name, size: iconSize, style: iconStyle } = resolveIcon(icon, size);
    const button = (
      <ArtButton
        ref={ref}
        variant={variant}
        size={size}
        color={color}
        aria-label={tooltip}
        className={cn('art-icon-btn', className)}
        {...rest}
      >
        <ArtIcon name={name} size={iconSize} style={iconStyle} />
      </ArtButton>
    );

    if (!tooltip) return button;

    return <ArtTooltip label={tooltip}>{button}</ArtTooltip>;
  },
);

ArtIconButton.displayName = 'ArtIconButton';

export default ArtIconButton;
export { ArtIconButton };
export type { ArtIconButtonProps };
