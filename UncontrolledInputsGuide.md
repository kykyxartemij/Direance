# Uncontrolled Inputs Guide

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

## Pattern A — single uncontrolled input

```tsx
function MyForm() {
  const nameRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const name = nameRef.current?.value.trim() ?? '';
  }

  return <ArtInput ref={nameRef} defaultValue={existing?.name ?? ''} />;
}
```

Key points:
- `defaultValue` sets the initial value (renders once, never again)
- `ref.current.value` reads the live DOM value at submit time
- Zero re-renders while typing

---

## Pattern B — many rows, collect all on submit (`forwardRef` + `useImperativeHandle`)

This is the RowMappingsSection pattern. Each row owns its own refs; the parent calls `sectionRef.current.getRowMappings()` once on submit.

```tsx
// ==== Row item ====

interface RowItemRef {
  getData(): Partial<RowData>;
}

const RowItem = forwardRef<RowItemRef, { row: RowData }>(({ row }, ref) => {
  // Uncontrolled text inputs — no state, no re-renders
  const displayNameRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  // Controlled only for things without a DOM value
  const [color, setColor] = useState(row.color);

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

// ==== Section ====

interface SectionRef {
  getRows(): Partial<RowData>[];
}

const RowSection = forwardRef<SectionRef, { rows: RowData[] }>(({ rows }, ref) => {
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

// ==== Parent — collect on submit ====

function MappingStep() {
  const sectionRef = useRef<SectionRef>(null);

  function handleSave() {
    const rowMappings = sectionRef.current?.getRows() ?? [];
    // use rowMappings
  }

  return (
    <>
      <RowSection ref={sectionRef} rows={rows} />
      <button onClick={handleSave}>Save</button>
    </>
  );
}
```

---

## What stays controlled

These always need `useState` because there is no DOM property to read back:

- `ArtSelect`, `ArtComboBox` — value lives in JS, not a real `<select>`
- `ArtCheckbox` inside complex components — when its checked state gates other fields
- Any input whose value determines what OTHER elements render (e.g., filter → list, toggle → show/hide section)

---

## Resetting after submit

Uncontrolled inputs don't reset automatically. Two options:

```tsx
// Option A — key prop forces remount (simplest)
<ArtInput key={submitCount} ref={nameRef} defaultValue="" />

// Option B — direct DOM reset
function handleSubmit() {
  // ... do work
  if (nameRef.current) nameRef.current.value = '';
}
```
