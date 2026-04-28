// 'use client';

// import { useRouter } from 'next/navigation';
// import { useForm, type Resolver } from 'react-hook-form';
// import { yupResolver } from '@hookform/resolvers/yup';
// import * as yup from 'yup';
// import { useGetMappingById, useUpdateMapping } from '@/hooks/mapping.hooks';
// import { useGetLightExportSettings } from '@/hooks/export-settings.hooks';
// import type { MappingModel, ReportType } from '@/models/mapping.models';
// import type { ArtComboBoxOption } from '@/components/ui/ArtComboBox';
// import { ArtForm, ArtFormInput, ArtFormSelect, ArtFormComboBox } from '@/components/form';

// // ==== Constants ====

// const REPORT_TYPE_OPTIONS = [
//   { label: 'Profit & Loss', value: 'pnl' },
//   { label: 'Financial Position', value: 'financial_position' },
// ];

// // ==== Schema ====

// const schema = yup.object({
//   name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
//   reportType: yup.string().oneOf(['pnl', 'financial_position'], 'Invalid report type').required('Report type is required'),
//   exportSettingId: yup.string().nullable().optional(),
// });

// type FormValues = {
//   name: string;
//   reportType: string;
//   exportSettingId?: string | null;
// };

// const defaultValues = (mapping: MappingModel): FormValues => ({
//   name: mapping.name,
//   reportType: mapping.reportType,
//   exportSettingId: mapping.exportSetting?.id ?? null,
// });

// // ==== Inner form ====

// function MappingEditForm({ id, mapping }: { id: string; mapping: MappingModel }) {
//   const router = useRouter();
//   const { data: exportSettingsList = [] } = useGetLightExportSettings();
//   const updateMutation = useUpdateMapping();

//   const methods = useForm<FormValues>({
//     resolver: yupResolver(schema) as Resolver<FormValues>,
//     defaultValues: defaultValues(mapping),
//   });

//   const exportOptions: ArtComboBoxOption[] = exportSettingsList.map((s) => ({
//     label: s.name,
//     value: s.id,
//   }));

//   async function onSave(data: FormValues) {
//     await updateMutation.mutateAsync({ id, body: { ...data, reportType: data.reportType as ReportType } });
//     router.push('/mappings');
//   }

//   return (
//     <div className="mx-auto max-w-2xl py-8">
//       <h1 className="text-2xl font-semibold mb-8" style={{ color: 'var(--text)' }}>Edit Mapping</h1>
//       <ArtForm
//         methods={methods}
//         onSubmit={onSave}
//         buttons={[
//           { label: 'Cancel', variant: 'ghost', type: 'button', onClick: () => router.push('/mappings') },
//           { label: 'Save', color: 'primary', type: 'submit', loading: updateMutation.isPending },
//         ]}
//       >
//         <ArtFormInput name="name" label="Name" required />
//         <ArtFormSelect name="reportType" label="Report Type" options={REPORT_TYPE_OPTIONS} />
//         <ArtFormComboBox
//           name="exportSettingId"
//           label="Export Settings"
//           options={exportOptions}
//           placeholder="Link export settings…"
//           clearable
//         />
//       </ArtForm>
//     </div>
//   );
// }

// // ==== Component ====

// export default function MappingEditPage({ id }: { id: string }) {
//   const { data: mapping, isLoading } = useGetMappingById(id);
//   if (isLoading || !mapping) return null;
//   return <MappingEditForm id={id} mapping={mapping} />;
// }
