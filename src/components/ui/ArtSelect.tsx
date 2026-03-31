'use client';

import ArtComboBox, { type ArtComboBoxSingleProps, type ArtComboBoxOption } from './ArtComboBox';

/** ArtComboBox with searchable=false — styled button trigger, no typing. */
type ArtSelectProps = Omit<ArtComboBoxSingleProps, 'searchable'>;

const ArtSelect = (props: ArtSelectProps) => <ArtComboBox {...props} searchable={false} />;

ArtSelect.displayName = 'ArtSelect';

export default ArtSelect;
export { ArtSelect };
export type { ArtSelectProps, ArtComboBoxOption as ArtSelectOption };
