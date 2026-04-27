'use client';

import { useRef, useState } from 'react';
import {
  useGetLightExportSettings,
  useGetExportSettingById,
} from '@/hooks/export-settings.hooks';
import { useGetLogoByExportSettingId } from '@/hooks/logo.hooks';
import { ArtDialog } from '@/components/ui/ArtDialog';
import ArtComboBox from '@/components/ui/ArtComboBox';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtInput from '@/components/ui/ArtInput';
import ArtButton from '@/components/ui/ArtButton';
import ArtLabel from '@/components/ui/ArtLabel';
import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
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

// ==== Component ====

export default function ExportDialog({ onExport }: ExportDialogProps) {
  const { data: lightSettings = [] } = useGetLightExportSettings();

  const [settingId, setSettingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);

  const fileNameRef = useRef<HTMLInputElement>(null);
  const includeOriginalRef = useRef<HTMLInputElement>(null);
  const applyHeaderAllRef = useRef<HTMLInputElement>(null);
  const placeholderRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: fullSetting } = useGetExportSettingById(settingId ?? undefined);
  const logoQuery = useGetLogoByExportSettingId(settingId ?? '');

  const options: ArtComboBoxOption[] = lightSettings.map((s) => ({
    label: s.name,
    value: s.id,
  }));

  const placeholderTags = extractPlaceholders(fullSetting);

  function handleSettingChange(opt: ArtComboBoxOption | null) {
    setSettingId(opt?.value ?? null);
    placeholderRefs.current = {};
  }

  async function handleExport() {
    setExporting(true);
    try {
      let resolved: ExportSettingResolvedModel | null = null;
      let placeholders: Record<string, string> | undefined;

      if (settingId && fullSetting) {
        const logo = await logoQuery.refetch();
        resolved = {
          ...fullSetting,
          logoData: logo.data?.logoData ?? null,
          logoMime: logo.data?.logoMime ?? null,
          logoName: logo.data?.logoName ?? null,
          includeOriginalSheets: includeOriginalRef.current?.checked ?? fullSetting.includeOriginalSheets,
          applyHeaderToAllSheets: applyHeaderAllRef.current?.checked ?? fullSetting.applyHeaderToAllSheets,
        } satisfies ExportSettingResolvedModel;

        if (placeholderTags.length > 0) {
          placeholders = {};
          for (const tag of placeholderTags) {
            const val = placeholderRefs.current[tag]?.value?.trim();
            if (val) placeholders[tag] = val;
          }
        }
      }

      const fileName = fileNameRef.current?.value?.trim() || undefined;
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
        if (next) {
          setSettingId(null);
          placeholderRefs.current = {};
        }
      }}
      cancelButton
      buttons={[
        {
          label: 'Export',
          color: 'primary',
          loading: exporting,
          closesDialog: false,
          onClick: handleExport,
        },
      ]}
      content={
        <div className="flex flex-col gap-4">
          <ArtInput
            key={`fn-${settingId}-${fullSetting?.name ?? ''}`}
            ref={fileNameRef}
            label="File name"
            defaultValue={fullSetting?.name ?? 'combined-report'}
          />

          <ArtComboBox
            label="Export Settings"
            options={options}
            selected={options.find((o) => o.value === settingId) ?? null}
            onChange={handleSettingChange}
            placeholder="None (plain export)"
            clearable
          />

          {settingId && fullSetting && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <ArtCheckbox
                  ref={includeOriginalRef}
                  label="Include original sheets"
                  defaultChecked={fullSetting.includeOriginalSheets}
                  key={`inc-${settingId}`}
                />
                <ArtCheckbox
                  ref={applyHeaderAllRef}
                  label="Apply header to all sheets"
                  defaultChecked={fullSetting.applyHeaderToAllSheets}
                  key={`hdr-${settingId}`}
                />
              </div>

              {placeholderTags.length > 0 && (
                <div className="flex flex-col gap-3">
                  <ArtLabel>Header placeholders</ArtLabel>
                  {placeholderTags.map((tag) => (
                    <ArtInput
                      key={`${settingId}-${tag}`}
                      ref={(el) => { placeholderRefs.current[tag] = el; }}
                      label={tag}
                      placeholder={`Value for <${tag}>`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      }
    >
      <ArtButton>Export Excel</ArtButton>
    </ArtDialog>
  );
}
