# TODO: Migrate Form Pages to RHF + Yup

Current form pages use raw refs + manual Yup validation. This works but requires manual error wiring per field. Migrating to RHF + Yup eliminates that boilerplate while keeping the same performance (zero re-renders while typing when using default `onSubmit` mode).

## Pages to migrate

- [ ] `ExportSettingsFormPage` — currently uses ~5 refs + manual `setErrors` + manual `helperText` per field

## What the migration looks like

### Before

```tsx
const nameRef = useRef<HTMLInputElement>(null);
const [errors, setErrors] = useState<Record<string, string>>({});

async function handleSubmit() {
  try {
    setErrors({});
    await MySchema.validate({ name: nameRef.current?.value }, { abortEarly: false });
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      const fieldErrors: Record<string, string> = {};
      for (const e of err.inner) {
        if (e.path) fieldErrors[e.path] = e.message;
      }
      setErrors(fieldErrors);
    }
  }
}

<ArtInput ref={nameRef} helperText={errors.name} />
```

### After

```tsx
const schema = yup.object({
  name: yup.string().required('Name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: yupResolver(schema),
  defaultValues: { name: existing?.name ?? '', email: existing?.email ?? '' },
});

<form onSubmit={handleSubmit(onSave)}>
  <ArtInput {...register('name')} helperText={errors.name?.message} />
  <ArtInput {...register('email')} helperText={errors.email?.message} />
</form>
```

No catch block. No `setErrors`. No manual wiring. Yup message flows straight to `helperText`.

## Key concepts

### Validation modes

```ts
useForm({
  resolver: yupResolver(schema),
  mode: 'onSubmit',        // default — validate on submit only. Zero re-renders while typing.
  // mode: 'onBlur',       // validate when user leaves the field. User finishes typing first.
  // mode: 'onChange',     // validate every keystroke. Shows "invalid email" while still typing — bad UX + most re-renders.
  reValidateMode: 'onChange', // kicks in AFTER first failed submit — errors then clear in real-time as user fixes them
})
```

The default combo (`onSubmit` + `reValidateMode: 'onChange'`) is almost always correct:
- Silent while typing
- All errors shown at once on submit
- Errors clear immediately as user corrects them

### Common Yup validators

```ts
yup.string().required('Required')
yup.string().min(3, 'Too short').max(100)
yup.string().email('Invalid email')
yup.string().url('Invalid URL')
yup.number().min(0).max(100).integer()
yup.array().of(yup.string()).min(1, 'At least one required')
```

### `.test()` — custom validation

```ts
// test(id, errorMessage, validatorFn)
// validatorFn: (value) => boolean — return true = valid, false = invalid
yup.string().test('no-spaces', 'Cannot contain spaces', (v) => !v?.includes(' '))

// cross-field validation — read sibling fields via context.parent
const schema = yup.object({
  website: yup.string().test('one-required', 'Website or email required', (value, ctx) => {
    return !!(value?.trim()) || !!(ctx.parent.email?.trim());
  }),
  email: yup.string().email().test('one-required', 'Website or email required', (value, ctx) => {
    return !!(value?.trim()) || !!(ctx.parent.website?.trim());
  }),
});
```

### What stays as raw refs

Table rows (`HeaderItemRow`) should stay as raw refs — they can't be inside a `FormProvider` efficiently when there are many of them. Only the top-level form fields migrate.
