'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useArtDialog } from '@/components/ui/ArtDialog';
import { ArtFormInput } from '@/components/form';

// ==== Schema ====

const schema = yup.object({
  name: yup.string().trim().min(1, 'Name is required').required('Name is required'),
});

type FormValues = { name: string };

// ==== Types ====

export interface SaveMappingDialogOptions {
  defaultName: string;
  isUserOwned: boolean;
  isGlobalSelected: boolean;
  onSave: (name: string) => Promise<void>;
}

// ==== Hook ====

// TODO: Check code and redifed
export function useSaveMappingDialog() {
  const dialog = useArtDialog();

  function open({ defaultName, isUserOwned, isGlobalSelected, onSave }: SaveMappingDialogOptions) {
    const title = isGlobalSelected ? 'Save as new mapping' : isUserOwned ? 'Update mapping' : 'Save mapping config';
    const buttonLabel = isUserOwned ? 'Update' : 'Save';

    // Written on every render of DialogContent, read by the button onClick closure
    const submitRef: { current: (() => void) | null } = { current: null };

    function DialogContent() {
      const methods = useForm<FormValues>({
        resolver: yupResolver(schema),
        defaultValues: { name: defaultName },
      });

      submitRef.current = methods.handleSubmit(async (data) => {
        await onSave(data.name);
        dialog.close();
      });

      return (
        <FormProvider {...methods}>
          <div className="flex flex-col gap-3">
            <ArtFormInput name="name" label="Mapping name" placeholder="My mapping" autoFocus />
          </div>
        </FormProvider>
      );
    }

    dialog.show({
      title,
      content: <DialogContent />,
      buttons: [
        {
          label: buttonLabel,
          color: 'primary',
          closesDialog: false,
          onClick: () => submitRef.current?.(),
        },
      ],
      cancelButton: true,
    });
  }

  return { open };
}
