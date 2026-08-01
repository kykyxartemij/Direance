import type { ReactNode, Ref } from 'react';
import type { ArtIconProps } from '../ArtIcon';
import type { ArtOption } from '../art.types';

// ArtComboBoxOption = ArtOption (shared shape). Re-exported for consumers.
export type ArtComboBoxOption = ArtOption;

// ==== Shared base props ====

export interface ArtComboBoxBaseProps {
  ref?: Ref<HTMLInputElement>;
  options: ArtComboBoxOption[];
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  placeholder?: string;
  icon?: ArtIconProps;
  clearable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  debounceMs?: boolean | number;
  /** Fires after debounceMs of inactivity — use for async/server-side option fetching */
  onDebouncedChange?: (inputText: string) => void;
  /** See ArtListbox.noOptionsMessage — false suppresses the empty-state row and keeps the dropdown closed when options are empty */
  noOptionsMessage?: ReactNode | boolean;
  /** Called when the user scrolls near the bottom of the list — wire to fetchNextPage for infinite queries */
  onEndReached?: () => void;
  /** When true, renders a loading skeleton at the bottom (use with hasNextPage) */
  hasMore?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  /** true = text input + filter (default). false = styled button trigger, pick only. */
  searchable?: boolean;
  /** When true, pressing Enter auto-selects the first visible option */
  selectFirstOnEnter?: boolean;
  /** Called with the current input text on Enter — useful for free-text navigation */
  onSubmit?: (inputText: string) => void;
}

// ==== Single-select props ====

export interface ArtComboBoxSingleProps extends ArtComboBoxBaseProps {
  multiple?: false;
  /**
   * Controlled: provide to manage selection yourself.
   * Uncontrolled: omit and the component manages its own state.
   */
  selected?: ArtComboBoxOption | null;
  defaultSelected?: ArtComboBoxOption | null;
  onChange?: (option: ArtComboBoxOption | null) => void;
}

// ==== Multi-select props ====

export interface ArtComboBoxMultiProps extends ArtComboBoxBaseProps {
  multiple: true;
  selected?: ArtComboBoxOption[];
  defaultSelected?: ArtComboBoxOption[];
  onChange?: (options: ArtComboBoxOption[]) => void;
}

export type ArtComboBoxProps = ArtComboBoxSingleProps | ArtComboBoxMultiProps;

export const FIELD_SIZE: Record<NonNullable<ArtComboBoxBaseProps['size']>, string> = {
  sm: 'art-field--sm',
  md: '',
  lg: 'art-field--lg',
};

export const CHIPS_MAX_COLLAPSED = 3;
