'use client';

interface ArtHelperTextProps {
  errorText?: string;
  helperText?: string;
}

function ArtHelperText({ errorText, helperText }: ArtHelperTextProps) {
  if (!errorText && !helperText) return null;
  return (
    <>
      {errorText && <p className="art-field-error">{errorText}</p>}
      {helperText && <p className="art-field-helper">{helperText}</p>}
    </>
  );
}

ArtHelperText.displayName = 'ArtHelperText';

export default ArtHelperText;
export { ArtHelperText };
export type { ArtHelperTextProps };
