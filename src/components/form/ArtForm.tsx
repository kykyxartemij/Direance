'use client';

import { type ReactNode } from 'react';
import { FormProvider, type UseFormReturn, type FieldValues } from 'react-hook-form';
import { ArtButtonRow, type ArtButtonRowItem } from '@/components/ui/ArtButtonRow';

// ==== Types ====

export type ArtFormButtonProps = ArtButtonRowItem;

export interface ArtFormProps<T extends FieldValues> {
  methods: UseFormReturn<T, any, any>;
  onSubmit: Parameters<UseFormReturn<T, any, any>['handleSubmit']>[0];
  buttons?: ArtFormButtonProps[];
  children: ReactNode;
  className?: string;
}

// ==== Component ====

export function ArtForm<T extends FieldValues>({ methods, onSubmit, buttons = [], children, className }: ArtFormProps<T>) {
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className={className}>
        <div className="flex flex-col gap-4">{children}</div>
        {buttons.length > 0 && (
          <ArtButtonRow buttons={buttons} className="art-dialog-footer mt-6" />
        )}
      </form>
    </FormProvider>
  );
}

ArtForm.displayName = 'ArtForm';
export default ArtForm;
