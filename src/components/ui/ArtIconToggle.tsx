'use client';

import { forwardRef, useState } from 'react';
import ArtButton, { type ArtButtonProps } from './ArtButton';
import ArtIcon, { type ArtIconName } from './ArtIcon';
import ArtTooltip from './ArtTooltip';
import { type ButtonHTMLAttributes } from 'react';
import { type ArtColor, ART_COLOR_CLASS } from './art.types';
import { cn } from './art.utils';

interface ArtIconToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  icon: ArtIconName;
  /** Icon to show when pressed — swap for filled/alternate variant (e.g. Volume → VolumeMuted) */
  pressedIcon?: ArtIconName;
  tooltip?: string;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  size?: ArtButtonProps['size'];
  color?: ArtColor;
  variant?: ArtButtonProps['variant'];
}

const ICON_SIZE: Record<NonNullable<ArtIconToggleProps['size']>, number> = {
  sm: 14, md: 16, lg: 20,
};

const ArtIconToggle = forwardRef<HTMLButtonElement, ArtIconToggleProps>(
  ({ icon, pressedIcon, tooltip, pressed: pressedProp, defaultPressed = false, onPressedChange, size = 'md', color, variant = 'ghost', className = '', onClick, ...rest }, ref) => {
    const [internalPressed, setInternalPressed] = useState(defaultPressed);
    const isControlled = pressedProp !== undefined;
    const isPressed = isControlled ? pressedProp : internalPressed;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const next = !isPressed;
      if (!isControlled) setInternalPressed(next);
      onPressedChange?.(next);
      onClick?.(e);
    };

    const button = (
      <ArtButton
        ref={ref}
        variant={variant}
        size={size}
        aria-label={tooltip}
        aria-pressed={isPressed}
        className={cn('art-icon-btn', isPressed && 'art-icon-toggle--on', isPressed && color && ART_COLOR_CLASS[color], className)}
        onClick={handleClick}
        {...rest}
      >
        <ArtIcon size={ICON_SIZE[size]} name={isPressed && pressedIcon ? pressedIcon : icon} />
      </ArtButton>
    );

    if (!tooltip) return button;
    return <ArtTooltip label={tooltip}>{button}</ArtTooltip>;
  },
);

ArtIconToggle.displayName = 'ArtIconToggle';
export default ArtIconToggle;
export { ArtIconToggle };
export type { ArtIconToggleProps };
