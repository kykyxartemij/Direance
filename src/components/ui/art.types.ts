export type ArtColor = 'primary' | 'warning' | 'success' | 'danger' | 'neutral';

/** Shared option shape used by ArtComboBox, ArtListbox, and ArtSelect */
export interface ArtOption {
  label: string;
  value: string;
  icon?: string; // ArtIconName — kept as string to avoid circular imports
  color?: ArtColor;
}

export const ART_COLOR_CLASS: Record<ArtColor, string> = {
  primary: 'art-primary',
  warning: 'art-warning',
  success: 'art-success',
  danger:  'art-danger',
  neutral: '',
};
