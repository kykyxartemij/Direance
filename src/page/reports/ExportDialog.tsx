'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, FormProvider } from 'react-hook-form';
import {
  useGetLightExportSettings,
  useGetExportSettingById,
} from '@/hooks/export-settings.hooks';
import { useGetLogoById } from '@/hooks/logo.hooks';
import { ArtDialog } from '@/components/ui/ArtDialog';
import ArtButton from '@/components/ui/ArtButton';
import ArtLabel from '@/components/ui/ArtLabel';
import { ArtFormInput, ArtFormCheckbox, ArtFormComboBox } from '@/components/form';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox/types';
import type { ExportSettingModel, ExportSettingResolvedModel } from '@/models/export-settings.models';

// ==== Helpers ====

const PLACEHOLDER_RE = /<([^>]+)>/g;

/** Extract unique placeholder tag names from header items */
function extractPlaceholders(setting: ExportSettingModel | undefined): string[] {
  if (!setting?.headerLayout?.items?.length) return [];
  const tags = new Set<string>();
  for (const item of setting.headerLayout.items) {
    let m: RegExpExecArray | null;
    PLACEHOLDER_RE.lastIndex = 0;
    while ((m = PLACEHOLDER_RE.exec(item.content)) !== null) {
      tags.add(m[1]);
    }
  }
  return Array.from(tags);
}

// ==== Props ====

interface ExportDialogProps {
  onExport: (setting: ExportSettingResolvedModel | null, placeholders?: Record<string, string>, fileName?: string) => Promise<void>;
}

// ==== Form values ====

type FormValues = {
  settingId: string | null;
  fileName: string;
  includeOriginalSheets: boolean;
  applyHeaderToAllSheets: boolean;
  placeholders: Record<string, string>;
};

const DEFAULT_VALUES: FormValues = {
  settingId: null,
  fileName: 'combined-report',
  includeOriginalSheets: false,
  applyHeaderToAllSheets: false,
  placeholders: {},
};

// ==== Component ====

export default function ExportDialog({ onExport }: ExportDialogProps) {
  const { data: lightSettings = [] } = useGetLightExportSettings();

  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);

  const methods = useForm<FormValues>({ defaultValues: DEFAULT_VALUES });
  const { reset, handleSubmit, control } = methods;
  const settingId = useWatch({ control, name: 'settingId' });

  const { data: fullSetting } = useGetExportSettingById(settingId ?? undefined, {
    meta: { withGlobalLoaderBlur: true },
  });
  // enabled: false — logo bytes are expensive to fetch, only pull them right before
  // export (handleExport calls refetch()), never speculatively on setting selection.
  const logoQuery = useGetLogoById(fullSetting?.logo?.id ?? '', { enabled: false });

  const options: ArtComboBoxOption[] = lightSettings.map((s) => ({
    label: s.name,
    value: s.id,
  }));

  const placeholderTags = extractPlaceholders(fullSetting);

  // Setting selection changes fullSetting async — reset form defaults (name,
  // checkboxes, placeholders) to match once it lands, since defaultValues only apply on mount.
  // settingId is preserved as-is; only the setting-derived fields are re-synced here.
  useEffect(() => {
    reset({
      settingId,
      fileName: fullSetting?.name ?? 'combined-report',
      includeOriginalSheets: fullSetting?.includeOriginalSheets ?? false,
      applyHeaderToAllSheets: fullSetting?.applyHeaderToAllSheets ?? false,
      placeholders: {},
    });
  }, [fullSetting, settingId, reset]);

  async function submit(data: FormValues) {
    setExporting(true);
    try {
      let resolved: ExportSettingResolvedModel | null = null;
      let placeholders: Record<string, string> | undefined;

      if (settingId && fullSetting) {
        const logo = await logoQuery.refetch();
        resolved = {
          ...fullSetting,
          logoData: logo.data?.data ?? null,
          logoMime: logo.data?.mime ?? null,
          logoName: logo.data?.name ?? null,
          includeOriginalSheets: data.includeOriginalSheets,
          applyHeaderToAllSheets: data.applyHeaderToAllSheets,
        } satisfies ExportSettingResolvedModel;

        if (placeholderTags.length > 0) {
          placeholders = {};
          for (const tag of placeholderTags) {
            const val = data.placeholders[tag]?.trim();
            if (val) placeholders[tag] = val;
          }
        }
      }

      const fileName = data.fileName.trim() || undefined;
      await onExport(resolved, placeholders, fileName);
      setOpen(false);
    } finally {
      setExporting(false);
    }
  }

  return (
    <ArtDialog
      title="Export to Excel"
      size="md"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset(DEFAULT_VALUES);
      }}
      cancelButton
      buttons={[
        {
          label: 'Export',
          color: 'primary',
          loading: exporting,
          closesDialog: false,
          onClick: () => handleSubmit(submit)(),
        },
      ]}
      content={
        <FormProvider {...methods}>
          <div className="flex flex-col gap-4">
            <ArtFormInput name="fileName" label="File name" />

            <ArtFormComboBox
              name="settingId"
              label="Export Settings"
              options={options}
              placeholder="None (plain export)"
              clearable
            />

            {settingId && fullSetting && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <ArtFormCheckbox name="includeOriginalSheets" label="Include original sheets" />
                  <ArtFormCheckbox name="applyHeaderToAllSheets" label="Apply header to all sheets" />
                </div>

                {placeholderTags.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <ArtLabel>Header placeholders</ArtLabel>
                    {placeholderTags.map((tag) => (
                      <ArtFormInput
                        key={tag}
                        name={`placeholders.${tag}`}
                        label={tag}
                        placeholder={`Value for <${tag}>`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </FormProvider>
      }
    >
      <ArtButton>Export Excel</ArtButton>
    </ArtDialog>
  );
}
