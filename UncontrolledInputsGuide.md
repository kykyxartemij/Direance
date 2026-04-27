# Uncontrolled Inputs Guide / Fix Re-renders in Submitting Forms

## The problem

Controlled inputs (`value` + `onChange`) cause a React re-render on every keystroke. In dense forms — like row mapping tables with 50+ rows — this re-renders the entire component tree and is visually slow.

## The rule

> Use **uncontrolled** inputs whenever the value is only needed at submit time.  
> Use **controlled** inputs only when the value must affect other UI in real time.

| Scenario | Pattern |
|----------|---------|
| Text typed by user, read on submit | Uncontrolled (`ref` + `defaultValue`) |
| Search/filter input that updates a list | Controlled (`useState`) |
| Checkbox or radio that gates other fields | Controlled (`useState`) |
| Color picker, select, combobox | Controlled (`useState`) — these have no natural DOM value |
| Input that feeds a live preview | Controlled (`useState`) |

---

## Two ways to go uncontrolled

Both solve the same problem. Pick based on whether you need validation and error messages.

> Prefer RHF for forms. `useRef` is general purpose — use for table rows, non-form value collection, anything that can't have `FormProvider`.

| | Raw refs | React Hook Form |
|---|---|---|
| Re-renders while typing | Zero | Zero |
| Built-in validation | No — manual | Yes — Yup |
| Error messages | Manual | Built-in |
| Best for | Simple forms, tables with many rows | Complex forms with validation |

**RHF without `watch()`** behaves exactly like raw refs — uncontrolled under the hood, zero re-renders while typing.  
**RHF with `watch('field')`** — only the component calling `watch` re-renders when that field changes. Rest of form stays frozen. Think: one room reacts, whole house stays quiet.

---

## If responsive UX validation required -> use RHF + Yup

Do not use `useState` for form errors. Manually catching Yup errors, mapping to a state object, and passing `helperText` to every field by hand is tedious wiring that RHF + Yup eliminates entirely. When a form needs validation, migrate to RHF — don't patch the raw refs approach.

```tsx
// ❌ raw refs + manual errors — avoid when validation is needed
const [errors, setErrors] = useState<Record<string, string>>({});
// catch yup error, build fieldErrors, setErrors(fieldErrors)
<ArtInput ref={nameRef} helperText={errors.name} />

// ✅ RHF + Yup — errors wire automatically to fields
const schema = yup.object({ name: yup.string().required('Name is required') });
const { register, handleSubmit, formState: { errors } } = useForm({ resolver: yupResolver(schema) });
<ArtInput {...register('name')} helperText={errors.name?.message} />
```

**Yup validators for helperText:**

```ts
const schema = yup.object({
  name: yup.string().required('Name is required'),         // simple — use .required()
  website: yup.string().test(                              // complex/cross-field — use .test()
    'one-required',
    'Website or email required',
    (value, ctx) => !!(value?.trim()) || !!(ctx.parent.email?.trim())
  ),
  // note: async .test() with onChange mode can be slow — keep .test() sync
});

// In component — just name, error appears automatically (once ArtFormInput exists)
<ArtInput {...register('name')} helperText={errors.name?.message} />
<ArtInput {...register('website')} helperText={errors.website?.message} />
// ↑ Direance: manual for now until ArtFormInput is created (see TODO-RHF-Migration.md)
```

**Validation modes:**

| Mode | Re-renders while typing | Use when |
|------|------------------------|----------|
| `onSubmit` | Zero | Regular forms — settings pages, create/edit forms |
| `onBlur` | Zero | Long forms where early feedback helps |
| `onChange` | Every keystroke | Live feedback IS the feature — e.g. password strength |

`onBlur` triggers after user finishes typing and clicks away from the field — not mid-typing.

```ts
// Regular form — recommended default
useForm({
  resolver: yupResolver(schema),
  mode: 'onSubmit',          // silent while typing, validate on Save
  reValidateMode: 'onBlur',  // after submit errors shown, clear when user leaves fixed field
})

// Password strength — onChange justified here
useForm({
  mode: 'onChange',  // shows "too short", "needs number" in real time while typing
})
```

See `TODO-RHF-Migration.md` for which pages in this project should be migrated.

---

## Pattern A — single uncontrolled input

### With refs

```tsx
function MyForm() {
  const nameRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const name = nameRef.current?.value.trim() ?? '';
  }

  return <ArtInput ref={nameRef} defaultValue={existing?.name ?? ''} />;
}
```

### With RHF

```tsx
function MyForm() {
  const { register, handleSubmit } = useForm({ defaultValues: { name: existing?.name ?? '' } });

  return (
    <form onSubmit={handleSubmit((data) => console.log(data.name))}>
      <ArtInput {...register('name')} />
      {/* or: <ArtFormInput name="name" label="Name" /> — same thing, ArtFormInput is a helper that wraps {...register} + auto error display */}
    </form>
  );
}
```

Key points (both):
- `defaultValue` sets the initial value (renders once, never again)
- Value is read at submit time — zero re-renders while typing
- `{...register('name')}` wires up onChange/onBlur/ref — same field tracking as `<ArtFormInput name="name" />`; ArtFormInput just wraps this pattern and adds automatic error display

---

## Pattern B — many rows, collect all on submit (`forwardRef` + `useImperativeHandle`)

Each row owns its own refs; the parent calls `sectionRef.current.getRows()` once on submit.

```tsx
interface RowItemRef { getData(): Partial<RowData> }

const RowItem = forwardRef<RowItemRef, { row: RowData }>(({ row }, ref) => {
  const displayNameRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [color, setColor] = useState(row.color); // controlled — no DOM value to read

  useImperativeHandle(ref, () => ({
    getData: () => ({
      displayName: displayNameRef.current?.value || undefined,
      hidden: hiddenRef.current?.checked ?? false,
      color,
    }),
  }), [color]);

  return (
    <tr>
      <td><ArtInput ref={displayNameRef} defaultValue={row.displayName ?? ''} /></td>
      <td><input ref={hiddenRef} type="checkbox" defaultChecked={row.hidden} /></td>
      <td><ColorSelect value={color} onChange={setColor} /></td>
    </tr>
  );
});

const RowSection = forwardRef<{ getRows(): Partial<RowData>[] }, { rows: RowData[] }>(({ rows }, ref) => {
  const rowRefs = useRef<(RowItemRef | null)[]>([]);
  useImperativeHandle(ref, () => ({
    getRows: () => rowRefs.current.map((r) => r?.getData() ?? {}),
  }));
  return (
    <table>
      {rows.map((row, i) => (
        <RowItem key={row.id} ref={(el) => { rowRefs.current[i] = el; }} row={row} />
      ))}
    </table>
  );
});

function MappingStep() {
  const sectionRef = useRef<{ getRows(): Partial<RowData>[] }>(null);
  return (
    <>
      <RowSection ref={sectionRef} rows={rows} />
      <ArtButton onClick={() => sectionRef.current?.getRows()}>Save</ArtButton>
    </>
  );
}
```

### With RHF — triggering submit from outside the form

RHF doesn't require a `<form>` element. Call `handleSubmit` manually from a ref, a button outside the form, a wizard step — anywhere.

```tsx
// Child exposes getFormData via ref
formRef.current.getFormData = () =>
  new Promise((resolve) => {
    methods.handleSubmit(
      (data) => resolve(data),       // validation passed
      (errors) => resolve(undefined) // validation failed
    )(); // called manually — no DOM submit event needed
  });

// Parent collects on Save button click
const data = await formRef.current.getFormData();
```

---

## What stays controlled

These always need `useState` — or `watch()` in RHF — because there is no DOM property to read back:

- `ArtComboBox` — value lives in JS, not a real `<select>`
- `ArtCheckbox` inside complex components — when its checked state gates other fields
- Any input whose value determines what OTHER elements render (e.g., filter → list, toggle → show/hide section)

---

## Resetting after submit

Uncontrolled inputs don't reset automatically — RHF does via `methods.reset()`. Two options for raw refs:

```tsx
// Option A — key prop forces remount (simplest)
<ArtInput key={submitCount} ref={nameRef} defaultValue="" />

// Option B — direct DOM reset
function handleSubmit() {
  // ... do work
  if (nameRef.current) nameRef.current.value = '';
}
```
