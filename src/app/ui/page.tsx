/* eslint-disable local/require-loading-page */
'use client';

import { useState, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ArtButton from '@/components/ui/ArtButton';
import ArtComboBox, { type ArtComboBoxOption } from '@/components/ui/ArtComboBox';
import ArtIcon from '@/components/ui/ArtIcon';
import ArtIconButton from '@/components/ui/ArtIconButton';
import ArtIconToggle from '@/components/ui/ArtIconToggle';
import ArtInput from '@/components/ui/ArtInput';
import ArtLabel from '@/components/ui/ArtLabel';
import ArtListbox from '@/components/ui/ArtListbox';
import ArtProgress from '@/components/ui/ArtProgress';
import ArtSelect from '@/components/ui/ArtSelect';
import ArtSkeleton from '@/components/ui/ArtSkeleton';
import ArtSlider from '@/components/ui/ArtSlider';
import ArtTextarea from '@/components/ui/ArtTextarea';
import ArtTooltip from '@/components/ui/ArtTooltip';
import ArtUpload from '@/components/ui/ArtUpload';
import ArtBadge from '@/components/ui/ArtBadge';
import ArtSwitch from '@/components/ui/ArtSwitch';
import ArtTabs, { type ArtTab } from '@/components/ui/ArtTabs';
import ArtIconCycle, { type ArtIconCycleOption } from '@/components/ui/ArtIconCycle';
import ArtPopover from '@/components/ui/ArtPopover';
import ArtMenu, { type ArtMenuItemDef } from '@/components/ui/ArtMenu';
import ArtAvatar from '@/components/ui/ArtAvatar';
import ArtEmptyState from '@/components/ui/ArtEmptyState';
import ArtCopyButton from '@/components/ui/ArtCopyButton';
import ArtCopyText from '@/components/ui/ArtCopyText';
import ArtCheckbox from '@/components/ui/ArtCheckbox';
import ArtRadio, { type ArtRadioOption } from '@/components/ui/ArtRadio';
import ArtCollapse from '@/components/ui/ArtCollapse';
import ArtBaseCollapse from '@/components/ui/ArtBaseCollapse';
import ArtPagination from '@/components/ui/ArtPagination';
import ArtDataTable, { type ArtColumn } from '@/components/ui/ArtDataTable';
import ArtData from '@/components/ui/ArtData';
import ArtDataFilters from '@/components/ui/ArtDataFilters';
import { useArtSnackbar } from '@/components/ui/ArtSnackbar';
import { ArtDialog, ArtConfirmDialog, useArtDialog } from '@/components/ui/ArtDialog';
import { type ArtColor } from '@/components/ui/art.types';

// ==== Static data ====

const BUTTON_VARIANTS = [
  { variant: 'default',  label: 'Default'  },
  { variant: 'outlined', label: 'Outlined' },
  { variant: 'ghost',    label: 'Ghost'    },
] as const;

const PALETTE: ArtColor[] = ['primary', 'warning', 'success', 'danger'];

const ICON_NAMES = [
  'Search', 'Play', 'Pause',
  'Like', 'LikeFilled', 'Dislike', 'DislikeFilled',
  'Volume', 'VolumeMuted', 'Fullscreen', 'ExitFullscreen',
  'Upload', 'Close', 'ChevronDown', 'Check', 'Loading'
] as const;

const GENRE_OPTIONS: ArtComboBoxOption[] = [
  { label: 'Action',      value: 'action',      icon: 'Play'    },
  { label: 'Comedy',      value: 'comedy',      icon: 'Like'    },
  { label: 'Drama',       value: 'drama'                        },
  { label: 'Horror',      value: 'horror',      color: 'danger' },
  { label: 'Sci-Fi',      value: 'scifi',       color: 'primary' },
  { label: 'Thriller',    value: 'thriller'                     },
  { label: 'Romance',     value: 'romance',     icon: 'Like'    },
  { label: 'Animation',   value: 'animation'                    },
  { label: 'Documentary', value: 'documentary', icon: 'Volume'  },
  { label: 'Fantasy',     value: 'fantasy',     color: 'warning' },
  { label: 'Mystery',     value: 'mystery'                      },
  { label: 'Crime',       value: 'crime',       color: 'danger' },
  { label: 'Adventure',   value: 'adventure',   icon: 'Play'    },
  { label: 'Musical',     value: 'musical',     icon: 'Volume'  },
  { label: 'Western',     value: 'western'                      },
  { label: 'War',         value: 'war',         color: 'warning' },
  { label: 'Biography',   value: 'biography'                    },
  { label: 'History',     value: 'history',     color: 'primary' },
  { label: 'Sport',       value: 'sport',       icon: 'Like'    },
  { label: 'Family',      value: 'family',      color: 'success' },
];

const VISIBILITY_OPTIONS: ArtComboBoxOption[] = [
  { value: 'public',   label: 'Public',   icon: 'Play',  color: 'success' },
  { value: 'unlisted', label: 'Unlisted', icon: 'Volume', color: 'warning' },
  { value: 'private',  label: 'Private',  icon: 'Close',  color: 'danger'  },
];

type GroupId = 'foundation' | 'form' | 'icons' | 'portal' | 'select' | 'controls' | 'data' | 'providers';

const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'foundation', label: 'Foundation' },
  { id: 'form',       label: 'Form'       },
  { id: 'icons',      label: 'Icons'      },
  { id: 'portal',     label: 'Portal'     },
  { id: 'select',     label: 'Select'     },
  { id: 'controls',   label: 'Controls'   },
  { id: 'data',       label: 'Data'       },
  { id: 'providers',  label: 'Providers'  },
];

const GROUP_SECTIONS: Record<GroupId, { id: string; label: string }[]> = {
  foundation: [
    { id: 'artbutton',  label: 'ArtButton'  },
    { id: 'arttabs',    label: 'ArtTabs'    },
    { id: 'artavatar',  label: 'ArtAvatar'  },
  ],
  form: [
    { id: 'artlabel',    label: 'ArtLabel'    },
    { id: 'artinput',    label: 'ArtInput'    },
    { id: 'artupload',   label: 'ArtUpload'   },
    { id: 'arttextarea', label: 'ArtTextarea' },
    { id: 'artskeleton', label: 'ArtSkeleton' },
  ],
  icons: [
    { id: 'articon',       label: 'ArtIcon'       },
    { id: 'articonbutton', label: 'ArtIconButton' },
    { id: 'articontoggle', label: 'ArtIconToggle' },
    { id: 'articoncycle',  label: 'ArtIconCycle'  },
    { id: 'artcopybutton', label: 'ArtCopyButton' },
    { id: 'artcopytext',   label: 'ArtCopyText'   },
  ],
  portal: [
    { id: 'arttooltip', label: 'ArtTooltip' },
    { id: 'artpopover', label: 'ArtPopover' },
    { id: 'artmenu',    label: 'ArtMenu'    },
  ],
  select: [
    { id: 'artcombobox', label: 'ArtComboBox' },
    { id: 'artlistbox',  label: 'ArtListbox'  },
    { id: 'artbadge',    label: 'ArtBadge'    },
    { id: 'artselect',   label: 'ArtSelect'   },
  ],
  controls: [
    { id: 'artslider',    label: 'ArtSlider'    },
    { id: 'artprogress',  label: 'ArtProgress'  },
    { id: 'artswitch',    label: 'ArtSwitch'    },
    { id: 'artcheckbox',  label: 'ArtCheckbox'  },
    { id: 'artradio',     label: 'ArtRadio'     },
    { id: 'artcollapse',  label: 'ArtCollapse'  },
  ],
  data: [
    { id: 'artdata',        label: 'ArtData'        },
    { id: 'artdatatable',   label: 'ArtDataTable'   },
    { id: 'artdatafilters', label: 'ArtDataFilters' },
    { id: 'artpagination',  label: 'ArtPagination'  },
    { id: 'artemptystate',  label: 'ArtEmptyState'  },
  ],
  providers: [
    { id: 'artdialog',   label: 'ArtDialog'   },
    { id: 'artsnackbar', label: 'ArtSnackbar' },
  ],
};

// ==== Layout helpers ====

const Section = ({ id, title, tip, children }: { id: string; title: string; tip?: string; children: React.ReactNode }) => (
  <section id={id} className="flex flex-col gap-4 scroll-mt-8">
    <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</h2>
    {tip && <p className="text-xs leading-relaxed max-w-lg" style={{ color: 'var(--text-muted)', opacity: 0.65, borderLeft: '2px solid var(--border)', paddingLeft: '0.625rem' }}>{tip}</p>}
    {children}
  </section>
);

const Row = ({ children, label }: { children: React.ReactNode; label?: string }) => (
  <div className="flex flex-col gap-1.5">
    {label && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>}
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </div>
);

const Code = ({ code }: { code: string }) => (
  <SyntaxHighlighter
    language="tsx"
    style={vscDarkPlus}
    customStyle={{ borderRadius: '0.5rem', fontSize: '0.7rem', margin: 0 }}
  >
    {code.trim()}
  </SyntaxHighlighter>
);

// ==== ButtonSection ====

function ButtonSection() {
  const [loading, setLoading] = useState(false);
  return (
    <Section id="artbutton" title="ArtButton">
      <Row label="Variants">
        {BUTTON_VARIANTS.map(({ variant, label }) => (
          <ArtButton key={variant} variant={variant}>{label}</ArtButton>
        ))}
      </Row>
      <Row label="Sizes">
        <ArtButton variant="default" size="sm">Small</ArtButton>
        <ArtButton variant="default" size="md">Medium</ArtButton>
        <ArtButton variant="default" size="lg">Large</ArtButton>
      </Row>
      <Row label="Color palette — default">
        {PALETTE.map((c) => (
          <ArtButton key={c} variant="default" color={c}>{c}</ArtButton>
        ))}
      </Row>
      <Row label="Color palette — outlined">
        {PALETTE.map((c) => (
          <ArtButton key={c} variant="outlined" color={c}>{c}</ArtButton>
        ))}
      </Row>
      <Row label="Color palette — ghost + icon">
        {PALETTE.map((c) => (
          <ArtButton key={c} variant="ghost" icon="Upload" color={c}>{c}</ArtButton>
        ))}
      </Row>
      <Row label="States">
        {BUTTON_VARIANTS.map(({ variant, label }) => (
          <ArtButton key={variant} variant={variant} disabled>{label}</ArtButton>
        ))}
        <ArtButton
          variant="default"
          loading={loading}
          onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2000); }}
        >
          {loading ? 'Saving…' : 'Click to load'}
        </ArtButton>
      </Row>
      <Code code={`
<ArtButton variant="outlined">Outlined</ArtButton>
<ArtButton variant="default" size="lg" icon="Upload">Upload</ArtButton>
<ArtButton variant="default" color="danger">Delete</ArtButton>
<ArtButton variant="ghost" color="warning" icon="Upload">Warning</ArtButton>
<ArtButton variant="default" loading>Saving…</ArtButton>
      `} />
    </Section>
  );
}

// ==== IconButtonSection ====

function IconButtonSection() {
  return (
    <Section id="articonbutton" title="ArtIconButton">
      <Row label="ghost (default) — neutral">
        <ArtIconButton icon="Play"   tooltip="Play"   />
        <ArtIconButton icon="Like"   tooltip="Like"   />
        <ArtIconButton icon="Upload" tooltip="Upload" />
        <ArtIconButton icon="Close"  tooltip="Close"  />
        <ArtIconButton icon="Search" tooltip="Search (disabled)" disabled />
        <ArtIconButton icon="Volume" />
      </Row>
      <Row label="ghost — color palette">
        {PALETTE.map((c) => (
          <ArtIconButton key={c} icon="Upload" tooltip={c} color={c} />
        ))}
      </Row>
      <Row label="outlined — neutral + color">
        <ArtIconButton icon="Play"   variant="outlined" tooltip="Play outlined" />
        <ArtIconButton icon="Upload" variant="outlined" tooltip="Upload outlined" />
        {PALETTE.map((c) => (
          <ArtIconButton key={c} icon="Upload" variant="outlined" tooltip={c} color={c} />
        ))}
      </Row>
      <Row label="default (filled) — neutral + color">
        <ArtIconButton icon="Play"   variant="default" tooltip="Play filled" />
        <ArtIconButton icon="Upload" variant="default" tooltip="Upload filled" />
        {PALETTE.map((c) => (
          <ArtIconButton key={c} icon="Upload" variant="default" tooltip={c} color={c} />
        ))}
      </Row>
      <Row label="Sizes">
        <ArtIconButton icon="Play" size="sm" tooltip="sm" />
        <ArtIconButton icon="Play" size="md" tooltip="md" />
        <ArtIconButton icon="Play" size="lg" tooltip="lg" />
      </Row>
      <Code code={`
<ArtIconButton icon="Play" tooltip="Play" />
<ArtIconButton icon="Close" tooltip="Delete" color="danger" />
<ArtIconButton icon="Upload" variant="outlined" color="primary" tooltip="Upload" />
<ArtIconButton icon="Play" variant="default" color="success" tooltip="Live" />
      `} />
    </Section>
  );
}

// ==== IconToggleSection ====

function IconToggleSection() {
  return (
    <Section id="articontoggle" title="ArtIconToggle"
      tip="Color only appears in the pressed/on state — off state is always neutral. This makes it unambiguous which state the button is in.">
      <Row label="ghost — outline icon off, filled icon + accent on">
        <ArtIconToggle icon="Like"       pressedIcon="LikeFilled"    color="danger"  tooltip="Like"     />
        <ArtIconToggle icon="Dislike"    pressedIcon="DislikeFilled" color="warning" tooltip="Dislike"  />
        <ArtIconToggle icon="Volume"     pressedIcon="VolumeMuted"   color="primary" tooltip="Mute"     />
        <ArtIconToggle icon="Play"       pressedIcon="Pause"         color="success" tooltip="Play"     defaultPressed />
        <ArtIconToggle icon="Like"       disabled tooltip="Disabled off" />
        <ArtIconToggle icon="LikeFilled" disabled pressed color="danger" tooltip="Disabled on" />
      </Row>
      <Row label="outlined — gray border off, accent border+fill on">
        <ArtIconToggle icon="Like"    pressedIcon="LikeFilled"    variant="outlined" color="danger"  tooltip="Like"    />
        <ArtIconToggle icon="Dislike" pressedIcon="DislikeFilled" variant="outlined" color="warning" tooltip="Dislike" defaultPressed />
        <ArtIconToggle icon="Volume"  pressedIcon="VolumeMuted"   variant="outlined" color="primary" tooltip="Mute"    />
      </Row>
      <Row label="default — gray fill off, accent fill on">
        <ArtIconToggle icon="Like"    pressedIcon="LikeFilled"    variant="default" color="danger"  tooltip="Like"    defaultPressed />
        <ArtIconToggle icon="Dislike" pressedIcon="DislikeFilled" variant="default" color="warning" tooltip="Dislike" />
        <ArtIconToggle icon="Volume"  pressedIcon="VolumeMuted"   variant="default" color="primary" tooltip="Mute"    />
      </Row>
      <Row label="Sizes">
        <ArtIconToggle icon="Like" pressedIcon="LikeFilled" size="sm" color="danger" tooltip="sm" />
        <ArtIconToggle icon="Like" pressedIcon="LikeFilled" size="md" color="danger" tooltip="md" defaultPressed />
        <ArtIconToggle icon="Like" pressedIcon="LikeFilled" size="lg" color="danger" tooltip="lg" />
      </Row>
      <Code code={`
{/* Off: neutral icon. On: filled icon + accent color. */}
<ArtIconToggle icon="Like" pressedIcon="LikeFilled" color="danger" tooltip="Like" />

{/* outlined: gray border → accent border+fill */}
<ArtIconToggle variant="outlined" icon="Like" pressedIcon="LikeFilled" color="danger" />

{/* default: gray fill → accent fill */}
<ArtIconToggle variant="default" icon="Like" pressedIcon="LikeFilled" color="danger" />
      `} />
    </Section>
  );
}

// ==== IconCycleSection ====

const VISIBILITY_CYCLE_OPTIONS: ArtIconCycleOption[] = [
  { value: 'public',   icon: 'Play',        tooltip: 'Public',   color: 'success' },
  { value: 'unlisted', icon: 'Volume',      tooltip: 'Unlisted', color: 'warning' },
  { value: 'private',  icon: 'Close',       tooltip: 'Private',  color: 'danger'  },
];

const MUTE_OPTIONS: ArtIconCycleOption[] = [
  { value: 'on',  icon: 'Volume',      tooltip: 'Mute'   },
  { value: 'off', icon: 'VolumeMuted', tooltip: 'Unmute', color: 'danger' },
];

// Same color on every state — button looks identical, only icon/tooltip changes
const PLAY_PAUSE_OPTIONS: ArtIconCycleOption[] = [
  { value: 'playing', icon: 'Pause', tooltip: 'Pause', color: 'primary' },
  { value: 'paused',  icon: 'Play',  tooltip: 'Play',  color: 'primary' },
];

function IconCycleSection() {
  const [visibility, setVisibility] = useState('public');
  const [muted, setMuted] = useState('on');
  return (
    <Section id="articoncycle" title="ArtIconCycle"
      tip="Same button design on every click — only icon, tooltip, and color change per state. Use when you don't want a pressed/selected look but still need to cycle through N states.">
      <Row label="Simple — same color always, only icon changes (vs ArtIconToggle which shows pressed state)">
        <ArtIconCycle options={PLAY_PAUSE_OPTIONS} defaultValue="paused" variant="ghost"    />
        <ArtIconCycle options={PLAY_PAUSE_OPTIONS} defaultValue="paused" variant="outlined" />
        <ArtIconCycle options={PLAY_PAUSE_OPTIONS} defaultValue="paused" variant="default"  />
      </Row>
      <Row label="Advanced — each state has its own color">
        <ArtIconCycle options={MUTE_OPTIONS} value={muted} onChange={setMuted} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{muted === 'off' ? 'muted' : 'sound on'}</span>
        <ArtIconCycle
          options={VISIBILITY_CYCLE_OPTIONS}
          value={visibility}
          onChange={setVisibility}
        />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{visibility}</span>
      </Row>
      <Row label="Sizes">
        <ArtIconCycle options={MUTE_OPTIONS} defaultValue="on" size="sm" />
        <ArtIconCycle options={MUTE_OPTIONS} defaultValue="on" size="md" />
        <ArtIconCycle options={MUTE_OPTIONS} defaultValue="on" size="lg" />
      </Row>
      <Code code={`
// Simple: same color every state — only icon/tooltip changes.
// Button looks identical throughout — no "selected" feel.
const playPauseOptions = [
  { value: 'playing', icon: 'Pause', tooltip: 'Pause', color: 'primary' },
  { value: 'paused',  icon: 'Play',  tooltip: 'Play',  color: 'primary' },
];
<ArtIconCycle options={playPauseOptions} defaultValue="paused" />

// Advanced: each state has its own color.
const muteOptions = [
  { value: 'on',  icon: 'Volume',      tooltip: 'Mute'   },
  { value: 'off', icon: 'VolumeMuted', tooltip: 'Unmute', color: 'danger' },
];
<ArtIconCycle options={muteOptions} value={muted} onChange={setMuted} />
      `} />
    </Section>
  );
}

// ==== CheckboxSection ====

function CheckboxSection() {
  const [checked, setChecked] = useState(false);
  return (
    <Section id="artcheckbox" title="ArtCheckbox"
      tip="Native checkbox semantics (works in forms, supports required/disabled/readOnly). Color class applied only when checked — unchecked is always neutral.">
      <Row label="Uncontrolled">
        <ArtCheckbox label="Agree to terms" defaultChecked />
        <ArtCheckbox label="Unchecked" />
        <ArtCheckbox label="Disabled off" disabled />
        <ArtCheckbox label="Disabled on" disabled defaultChecked />
      </Row>
      <Row label="Controlled">
        <ArtCheckbox label={checked ? 'Checked' : 'Unchecked'} checked={checked} onChange={(e) => setChecked(e.target.checked)} />
      </Row>
      <Row label="Color palette — applied when checked">
        {PALETTE.map((c) => (
          <ArtCheckbox key={c} color={c} label={c} defaultChecked />
        ))}
      </Row>
      <Row label="Sizes">
        <ArtCheckbox size="sm" label="sm" defaultChecked />
        <ArtCheckbox size="md" label="md" defaultChecked />
        <ArtCheckbox size="lg" label="lg" defaultChecked />
      </Row>
      <Code code={`
<ArtCheckbox label="Agree to terms" defaultChecked />
<ArtCheckbox label="Required" required color="primary"
  checked={checked} onChange={(e) => setChecked(e.target.checked)} />
      `} />
    </Section>
  );
}

// ==== RadioSection ====

const RADIO_OPTIONS: ArtRadioOption[] = [
  { value: 'public',   label: 'Public',   description: 'Anyone can watch',        icon: 'Play'  },
  { value: 'unlisted', label: 'Unlisted', description: 'Only people with the link'               },
  { value: 'private',  label: 'Private',  description: 'Only you',                icon: 'Close' },
];

function RadioSection() {
  const [v1, setV1] = useState<string | null>('public');
  const [v2, setV2] = useState<string | null>('public');
  const [v3, setV3] = useState<string | null>('public');
  return (
    <Section id="artradio" title="ArtRadio"
      tip="Custom radio group — no native circle. Indicator dot scales in/out via CSS. hideIndicator removes it entirely, leaving only the background tint to show selection.">
      <Row label="Default — with indicator + description">
        <div className="w-64">
          <ArtRadio options={RADIO_OPTIONS} value={v1} onChange={setV1} />
        </div>
      </Row>
      <Row label="hideIndicator — background tint only">
        <div className="w-64">
          <ArtRadio options={RADIO_OPTIONS} value={v2} onChange={setV2} hideIndicator />
        </div>
      </Row>
      <Row label="Horizontal pills + color">
        <ArtRadio
          options={[
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B' },
            { value: 'c', label: 'Option C' },
          ]}
          value={v3}
          onChange={setV3}
          orientation="horizontal"
          color="primary"
          hideIndicator
        />
      </Row>
      <Code code={`
<ArtRadio
  options={[
    { value: 'public',  label: 'Public',  description: 'Anyone can watch', icon: 'Play' },
    { value: 'private', label: 'Private', description: 'Only you',         icon: 'Close' },
  ]}
  value={visibility}
  onChange={setVisibility}
/>

{/* No dot — pill style */}
<ArtRadio options={options} value={v} onChange={setV}
  orientation="horizontal" hideIndicator color="primary" />
      `} />
    </Section>
  );
}

// ==== InputSection ====

function InputSection() {
  const [inputVal, setInputVal]         = useState('');
  const [debouncedVal, setDebouncedVal] = useState<string | null>(null);
  const [warningVal, setWarningVal]     = useState('');
  const [successVal, setSuccessVal]     = useState('');
  return (
    <Section id="artinput" title="ArtInput">
      <ArtInput
        placeholder="Icon + clearable"
        icon={{ name: 'Search' }}
        clearable
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
      />
      <Row label="Color states">
        <ArtInput placeholder="Default" value={inputVal} onChange={(e) => setInputVal(e.target.value)} />
        <ArtInput placeholder="Warning" color="warning" icon={{ name: 'Search' }}
          value={warningVal} onChange={(e) => setWarningVal(e.target.value)} />
        <ArtInput placeholder="Success" color="success" icon={{ name: 'Upload' }}
          value={successVal} onChange={(e) => setSuccessVal(e.target.value)} />
      </Row>
      <div className="flex flex-col gap-1">
        <ArtInput
          placeholder="Debounce 300 ms — type and stop"
          debounce
          onDebouncedChange={setDebouncedVal}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
        <p className="text-xs h-4" style={{ color: 'var(--text-muted)' }}>
          {debouncedVal === null ? 'waiting for first debounce…' : `last debounced: "${debouncedVal}"`}
        </p>
      </div>
      <ArtInput placeholder="With helper text" helperText="This field is required" />
      <ArtInput placeholder="Disabled" disabled />
      <Code code={`
<ArtInput placeholder="Search" icon={{ name: 'Search' }} clearable
  debounce onDebouncedChange={(v) => search(v)}
  value={value} onChange={(e) => setValue(e.target.value)} />
<ArtInput placeholder="Success state" color="success" />
      `} />
    </Section>
  );
}

// ==== ComboBoxSection ====

function ComboBoxSection() {
  const [comboOpt, setComboOpt]   = useState<ArtComboBoxOption | null>(null);
  const [multiOpts, setMultiOpts] = useState<ArtComboBoxOption[]>([]);
  const [asyncQuery, setAsyncQuery] = useState('');
  const asyncOptions = GENRE_OPTIONS.filter((o) => o.label.toLowerCase().includes(asyncQuery.toLowerCase()));
  return (
    <Section id="artcombobox" title="ArtComboBox">
      <Row label="Uncontrolled — local filter">
        <div className="w-64">
          <ArtComboBox options={GENRE_OPTIONS} placeholder="Pick a genre…" clearable noOptionsMessage="No genres found" />
        </div>
      </Row>
      <Row label="With search icon + defaultSelected">
        <div className="w-64">
          <ArtComboBox options={GENRE_OPTIONS} defaultSelected={GENRE_OPTIONS[0]}
            placeholder="Search genre…" icon={{ name: 'Search' }} clearable noOptionsMessage="No genres found" />
        </div>
      </Row>
      <Row label="Controlled — simulate async (debounce 300 ms)">
        <div className="w-64">
          <ArtComboBox options={asyncOptions} selected={comboOpt} onChange={setComboOpt}
            placeholder="Search genre…" icon={{ name: 'Search' }} clearable
            debounceMs={300} onDebouncedChange={setAsyncQuery} noOptionsMessage="No genres found" />
        </div>
        {comboOpt && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>value: <code>{comboOpt.value}</code></p>
        )}
      </Row>
      <Row label="multiple=true — chips inside the input">
        <div className="w-full max-w-md">
          <ArtComboBox
            multiple
            options={GENRE_OPTIONS}
            selected={multiOpts}
            onChange={setMultiOpts}
            placeholder="Pick genres…"
            noOptionsMessage="No genres found"
          />
        </div>
        {multiOpts.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            selected: {multiOpts.map((o) => o.label).join(', ')}
          </p>
        )}
      </Row>
      <Row label="multiple=true — with default pre-selected chips (Action, Comedy, Horror)">
        <div className="w-full max-w-md">
          <ArtComboBox
            multiple
            options={GENRE_OPTIONS}
            defaultSelected={[GENRE_OPTIONS[0], GENRE_OPTIONS[1], GENRE_OPTIONS[3]]}
            placeholder="Pick genres…"
            noOptionsMessage="No genres found"
          />
        </div>
      </Row>
      <Row label="multiple=true — overflow test (select many to trigger '+N more')">
        <div className="w-full max-w-md">
          <ArtComboBox
            multiple
            options={GENRE_OPTIONS}
            placeholder="Select many genres to test overflow…"
            noOptionsMessage="No genres found"
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>All 20 options available. Select 4+ to see the +N more button.</p>
      </Row>
      <Code code={`
// Single (default)
<ArtComboBox options={options} placeholder="Pick…" clearable />

// Multiple — chips inside input, Backspace removes last chip
<ArtComboBox
  multiple
  options={options}
  selected={selectedOpts}
  onChange={setSelectedOpts}
  placeholder="Pick genres…"
/>
      `} />
    </Section>
  );
}

// ==== ListboxSection ====

function ListboxSection() {
  const [single, setSingle]   = useState<ArtComboBoxOption | null>(null);
  const [multi, setMulti]     = useState<ArtComboBoxOption[]>([]);
  return (
    <Section id="artlistbox" title="ArtListbox">
      <Row label="Inline variant — single select">
        <div className="w-64">
          <ArtListbox
            className="art-listbox--inline"
            options={GENRE_OPTIONS}
            selectedValues={single ? [single.value] : []}
            onSelect={setSingle}
          />
        </div>
      </Row>
      <Row label="Inline — multi select + creatable">
        <div className="w-64">
          <ArtListbox
            className="art-listbox--inline"
            options={GENRE_OPTIONS}
            selectedValues={multi.map((o) => o.value)}
            onSelect={(opt) => setMulti((prev) =>
              prev.some((o) => o.value === opt.value)
                ? prev.filter((o) => o.value !== opt.value)
                : [...prev, opt],
            )}
            query="New genre"
            extraActions={[{
              label: (q) => `Create "${q}"`,
              onAction: (name) => console.log('create', name),
              showOnNoExactMatch: true,
            }]}
          />
        </div>
      </Row>
      <Code code={`
// Inline listbox — used inside dialogs / panels
<ArtListbox
  className="art-listbox--inline"
  options={options}
  selectedValues={selected}
  onSelect={(opt) => toggle(opt.value)}
  query={searchQuery}
  extraActions={[
    { label: (q) => \`Create "\${q}"\`, onAction: createItem, showOnNoExactMatch: true },
    { label: 'Auto-select similar', onAction: autoSelect },
  ]}
  actionsPosition="bottom"   // or "top"
/>
      `} />
    </Section>
  );
}

// ==== SelectSection ====

function SelectSection() {
  const [opt, setOpt] = useState<ArtComboBoxOption | null>(VISIBILITY_OPTIONS[0]);
  return (
    <Section id="artselect" title="ArtSelect">
      <Row label="Pick-only (no search)">
        <div className="w-48">
          <ArtSelect options={VISIBILITY_OPTIONS} selected={opt} onChange={setOpt} placeholder="Visibility…" />
        </div>
      </Row>
      <Row label="Disabled">
        <div className="w-48">
          <ArtSelect options={VISIBILITY_OPTIONS} selected={null} onChange={() => {}} placeholder="Select…" disabled />
        </div>
      </Row>
      <Code code={`
const options = [
  { value: 'public',  label: 'Public',  icon: 'Play',  color: 'success' },
  { value: 'private', label: 'Private', icon: 'Close', color: 'danger'  },
];
<ArtSelect options={options} selected={opt} onChange={setOpt} />
      `} />
    </Section>
  );
}

// ==== LabelSection ====

function LabelSection() {
  const [opt, setOpt] = useState<ArtComboBoxOption | null>(VISIBILITY_OPTIONS[0]);
  return (
    <Section id="artlabel" title="ArtLabel">
      <Row label="Standalone">
        <ArtLabel>Default label</ArtLabel>
        <ArtLabel required>Required label</ArtLabel>
      </Row>
      <Row label="Via label prop on ArtInput / ArtTextarea / ArtSelect">
        <div className="w-64">
          <ArtInput label="Video title" required placeholder="Give your video a title…" />
        </div>
        <div className="w-64">
          <ArtSelect label="Visibility" options={VISIBILITY_OPTIONS} selected={opt} onChange={setOpt} />
        </div>
      </Row>
      <Code code={`
// Standalone
<ArtLabel required>Title</ArtLabel>

// Built-in label prop — generates a stable id and links htmlFor automatically
<ArtInput label="Title" required placeholder="…" />
<ArtTextarea label="Description" placeholder="…" />
<ArtSelect label="Visibility" options={opts} selected={opt} onChange={setOpt} />
<ArtComboBox label="Genre" options={opts} placeholder="Pick…" />
      `} />
    </Section>
  );
}

// ==== TextareaSection ====

function TextareaSection() {
  const [val, setVal] = useState('');
  return (
    <Section id="arttextarea" title="ArtTextarea">
      <ArtTextarea placeholder="Write something…" value={val} onChange={(e) => setVal(e.target.value)} rows={4} maxRows={8} />
      <ArtTextarea placeholder="With helper text" helperText="Max 2000 characters" rows={3} />
      <ArtTextarea placeholder="Disabled" disabled rows={2} />
      <Code code={`
<ArtTextarea placeholder="Write something…"
  helperText="Max 2000 characters" rows={4}
  value={value} onChange={(e) => setValue(e.target.value)} />
      `} />
    </Section>
  );
}

// ==== SliderSection ====

function SliderSection() {
  const [val, setVal] = useState(0.4);
  return (
    <Section id="artslider" title="ArtSlider">
      <Row label="md (default)">
        <div className="w-full flex flex-col gap-1">
          <ArtSlider value={val} onChange={setVal} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{Math.round(val * 100)}%</span>
        </div>
      </Row>
      <Row label="sm">
        <div className="w-full">
          <ArtSlider value={val} onChange={setVal} size="sm" />
        </div>
      </Row>
      <Row label="Color palette">
        {PALETTE.map((c) => (
          <div key={c} className="flex-1 min-w-24">
            <ArtSlider value={0.6} onChange={() => {}} color={c} />
          </div>
        ))}
      </Row>
      <Code code={`
<ArtSlider value={volume} onChange={setVolume} />
<ArtSlider value={volume} onChange={setVolume} size="sm" color="success" />
      `} />
    </Section>
  );
}

// ==== BadgeSection ====

function BadgeSection() {
  const [chips, setChips] = useState(['Action', 'Comedy', 'Drama']);
  return (
    <Section id="artbadge" title="ArtBadge">
      <Row label="Variants (same design language as ArtButton)">
        <ArtBadge variant="outlined">Outlined</ArtBadge>
        <ArtBadge variant="default">Default</ArtBadge>
        <ArtBadge variant="ghost">Ghost</ArtBadge>
      </Row>
      <Row label="Color palette — outlined">
        {PALETTE.map((c) => (
          <ArtBadge key={c} variant="outlined" color={c}>{c}</ArtBadge>
        ))}
      </Row>
      <Row label="Color palette — default (filled)">
        {PALETTE.map((c) => (
          <ArtBadge key={c} variant="default" color={c}>{c}</ArtBadge>
        ))}
      </Row>
      <Row label="With icon">
        <ArtBadge variant="outlined" color="success" icon="Check">Verified</ArtBadge>
        <ArtBadge variant="outlined" color="danger"  icon="Close">Rejected</ArtBadge>
        <ArtBadge variant="default"  color="primary" icon="Play">Live</ArtBadge>
        <ArtBadge variant="ghost"    color="warning" icon="Upload">Uploading</ArtBadge>
      </Row>
      <Row label="Sizes">
        <ArtBadge size="sm" variant="outlined" color="primary">sm</ArtBadge>
        <ArtBadge size="md" variant="outlined" color="primary">md</ArtBadge>
        <ArtBadge size="lg" variant="outlined" color="primary">lg</ArtBadge>
      </Row>
      <Row label="Sizes with icon + chip">
        <ArtBadge size="sm" variant="outlined" icon="Play" onRemove={() => {}}>sm chip</ArtBadge>
        <ArtBadge size="md" variant="outlined" icon="Play" onRemove={() => {}}>md chip</ArtBadge>
        <ArtBadge size="lg" variant="outlined" icon="Play" onRemove={() => {}}>lg chip</ArtBadge>
      </Row>
      <Row label="Chip mode — onRemove adds a dismiss ×">
        {chips.map((label) => (
          <ArtBadge key={label} variant="outlined" onRemove={() => setChips((p) => p.filter((c) => c !== label))}>
            {label}
          </ArtBadge>
        ))}
        {chips.length === 0 && (
          <ArtButton size="sm" variant="ghost" onClick={() => setChips(['Action', 'Comedy', 'Drama'])}>
            Reset
          </ArtButton>
        )}
      </Row>
      <Code code={`
<ArtBadge variant="outlined" color="success" icon="Check">Verified</ArtBadge>
<ArtBadge variant="default"  color="primary">Live</ArtBadge>
<ArtBadge variant="ghost"    color="danger">Removed</ArtBadge>

{/* Chip mode — onRemove renders a × dismiss button */}
<ArtBadge variant="outlined" onRemove={() => removeTag(id)}>Action</ArtBadge>
      `} />
    </Section>
  );
}

// ==== SkeletonSection ====

function SkeletonSection() {
  return (
    <Section id="artskeleton" title="ArtSkeleton">
      <Row label="Bar mode — explicit size via className / style">
        <ArtSkeleton className="w-48 h-6" />
        <ArtSkeleton className="w-24 h-6" />
      </Row>
      <Row label="Bar mode — shapes">
        <ArtSkeleton className="w-10 h-10 rounded-full" />
        <div className="flex flex-col gap-2 flex-1">
          <ArtSkeleton className="w-48 h-4" />
          <ArtSkeleton className="w-32 h-4" />
        </div>
        <ArtSkeleton className="w-full h-24 rounded-xl" />
      </Row>
      <Row label="Wrap mode — 3× checkerboard (real ↔ skeleton, same component)">
        <div className="flex flex-col gap-4 w-full">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Each 2×2 pair uses the same component — shimmer occupies identical space.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'max-content max-content', gap: '10px' }}>
            <ArtBadge variant="outlined" color="success" size="sm">Active</ArtBadge>
            <ArtSkeleton wrap><ArtBadge variant="outlined" color="success" size="sm">Active</ArtBadge></ArtSkeleton>
            <ArtSkeleton wrap><ArtBadge variant="outlined" color="success" size="sm">Active</ArtBadge></ArtSkeleton>
            <ArtBadge variant="outlined" color="success" size="sm">Active</ArtBadge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'max-content max-content', gap: '10px' }}>
            <ArtBadge color="primary">In Progress</ArtBadge>
            <ArtSkeleton wrap><ArtBadge color="primary">In Progress</ArtBadge></ArtSkeleton>
            <ArtSkeleton wrap><ArtBadge color="primary">In Progress</ArtBadge></ArtSkeleton>
            <ArtBadge color="primary">In Progress</ArtBadge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 160px', gap: '10px' }}>
            <ArtSelect options={VISIBILITY_OPTIONS} selected={VISIBILITY_OPTIONS[0]} onChange={() => {}} />
            <ArtSkeleton wrap><ArtSelect options={VISIBILITY_OPTIONS} selected={null} onChange={() => {}} /></ArtSkeleton>
            <ArtSkeleton wrap><ArtSelect options={VISIBILITY_OPTIONS} selected={null} onChange={() => {}} /></ArtSkeleton>
            <ArtSelect options={VISIBILITY_OPTIONS} selected={VISIBILITY_OPTIONS[0]} onChange={() => {}} />
          </div>
        </div>
      </Row>
      <Code code={`
// Bar mode — you control size explicitly:
<ArtSkeleton className="w-full h-32 rounded-xl" />
<ArtSkeleton className="w-10 h-10 rounded-full" />

// Wrap mode — pass the real component, it sizes the shimmer automatically:
<ArtSkeleton wrap>
  <ArtBadge variant="outlined" size="sm">Active</ArtBadge>
</ArtSkeleton>
      `} />
    </Section>
  );
}

// ==== SwitchSection ====

const SWITCH_TABS: ArtTab[] = [
  { value: 'notifications', label: 'Notifications' },
  { value: 'privacy',       label: 'Privacy'       },
  { value: 'appearance',    label: 'Appearance'    },
  { value: 'billing',       label: 'Billing', disabled: true },
];

function SwitchSection() {
  const [on, setOn] = useState(true);
  return (
    <>
      <Row label="Uncontrolled">
        <ArtSwitch label="Notifications" defaultChecked />
        <ArtSwitch label="Dark mode" />
        <ArtSwitch disabled label="Disabled off" />
        <ArtSwitch disabled defaultChecked label="Disabled on" />
      </Row>
      <Row label="Controlled">
        <ArtSwitch label={on ? 'On' : 'Off'} checked={on} onChange={(e) => setOn(e.target.checked)} />
      </Row>
      <Row label="Sizes">
        <ArtSwitch size="sm" label="sm" defaultChecked />
        <ArtSwitch size="md" label="md" defaultChecked />
        <ArtSwitch size="lg" label="lg" defaultChecked />
      </Row>
      <Row label="Color palette">
        {PALETTE.map((c) => (
          <ArtSwitch key={c} color={c} label={c} defaultChecked />
        ))}
      </Row>
      <Code code={`
<ArtSwitch label="Notifications" defaultChecked />
<ArtSwitch label="Dark mode" checked={on} onChange={(e) => setOn(e.target.checked)} />
<ArtSwitch color="success" size="lg" label="Active" />
      `} />
    </>
  );
}

// ==== TabsSection ====

function TabsSection() {
  const [tab, setTab] = useState('notifications');
  return (
    <>
      <Row label="Uncontrolled">
        <div className="w-full">
          <ArtTabs tabs={SWITCH_TABS} defaultValue="notifications" />
        </div>
      </Row>
      <Row label="Controlled — selected tab shown below">
        <div className="w-full flex flex-col gap-3">
          <ArtTabs tabs={SWITCH_TABS} value={tab} onChange={setTab} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>active: {tab}</p>
        </div>
      </Row>
      <Row label="With icons">
        <div className="w-full">
          <ArtTabs
            tabs={[
              { value: 'videos',   label: 'Videos',   icon: 'Play'   },
              { value: 'uploads',  label: 'Uploads',  icon: 'Upload' },
              { value: 'liked',    label: 'Liked',    icon: 'Like'   },
              { value: 'history',  label: 'History',  icon: 'Volume' },
            ]}
            defaultValue="videos"
          />
        </div>
      </Row>
      <Row label="Per-tab color — active indicator uses the tab's accent">
        <div className="w-full">
          <ArtTabs
            tabs={[
              { value: 'all',     label: 'All',     icon: 'Play'    },
              { value: 'errors',  label: 'Errors',  icon: 'Close',  color: 'danger'  },
              { value: 'warns',   label: 'Warnings',icon: 'Volume', color: 'warning' },
              { value: 'ok',      label: 'Success', icon: 'Check',  color: 'success' },
            ]}
            defaultValue="errors"
          />
        </div>
      </Row>
      <Code code={`
<ArtTabs
  tabs={[
    { value: 'all',    label: 'All'      },
    { value: 'errors', label: 'Errors',  color: 'danger'  },
    { value: 'warns',  label: 'Warnings',color: 'warning' },
    { value: 'ok',     label: 'Success', color: 'success' },
  ]}
  value={tab}
  onChange={setTab}
/>
      `} />
    </>
  );
}


// ==== CollapseSection ====

function CollapseSection() {
  const collapseRef = useRef<import('@/components/ui/ArtCollapse').ArtCollapseRef>(null);
  const [controlled, setControlled] = useState(false);
  return (
    <>
      <Row label="Self-contained — title + icon + chevron built in (uncontrolled)">
        <div className="w-full max-w-md flex flex-col gap-2">
          <ArtCollapse title="Advanced settings" icon="Search" defaultOpen>
            <div className="flex flex-col gap-2 pt-2">
              <ArtInput placeholder="Setting A" />
              <ArtComboBox options={GENRE_OPTIONS} placeholder="Pick genre…" />
            </div>
          </ArtCollapse>
        </div>
      </Row>
      <Row label="Variants + colors">
        <div className="w-full flex flex-col gap-2">
          <ArtCollapse title="Default trigger" variant="default">
            <p className="text-sm pt-2" style={{ color: 'var(--text-muted)' }}>Content A</p>
          </ArtCollapse>
          <ArtCollapse title="Ghost trigger" variant="ghost" icon="Play">
            <p className="text-sm pt-2" style={{ color: 'var(--text-muted)' }}>Content B</p>
          </ArtCollapse>
          <ArtCollapse title="Primary color" variant="outlined" color="primary" icon="Upload">
            <p className="text-sm pt-2" style={{ color: 'var(--text-muted)' }}>Content C</p>
          </ArtCollapse>
        </div>
      </Row>
      <Row label="Imperative ref — expand / close from outside">
        <ArtButton variant="outlined" onClick={() => collapseRef.current?.expand()}>expand()</ArtButton>
        <ArtButton variant="outlined" onClick={() => collapseRef.current?.close()}>close()</ArtButton>
        <ArtButton variant="outlined" onClick={() => collapseRef.current?.toggle()}>toggle()</ArtButton>
        <div className="w-full mt-2">
          <ArtCollapse ref={collapseRef} title="Controlled via ref" icon="Volume">
            <p className="text-sm pt-2" style={{ color: 'var(--text-muted)' }}>Opened from outside.</p>
          </ArtCollapse>
        </div>
      </Row>
      <Row label="Pure controlled (no built-in trigger — open prop only)">
        <ArtButton variant="outlined" onClick={() => setControlled((p) => !p)}>
          {controlled ? 'Collapse' : 'Expand'}
        </ArtButton>
        <ArtCollapse open={controlled}>
          <div className="flex flex-col gap-2 pt-1">
            <ArtInput placeholder="Appears when expanded" />
            <ArtSelect options={VISIBILITY_OPTIONS} selected={null} onChange={() => {}} placeholder="Dropdown works inside open collapse" />
          </div>
        </ArtCollapse>
      </Row>
      <Row label="ArtBaseCollapse — raw animation primitive with fully custom trigger">
        <div className="w-full flex flex-col gap-0">
          <button
            type="button"
            className="flex items-center justify-between w-full px-3 py-2 rounded-md text-sm font-medium"
            style={{ background: 'var(--border)', color: 'var(--text)' }}
            onClick={() => setControlled((p) => !p)}
            aria-expanded={controlled}
          >
            Custom trigger — fully yours
            <ArtIcon name="ChevronDown" size={14} style={{ transform: controlled ? 'rotate(180deg)' : undefined, transition: 'transform 0.22s ease' }} />
          </button>
          <ArtBaseCollapse open={controlled}>
            <div className="flex flex-col gap-2 pt-2">
              <ArtInput placeholder="Inside ArtBaseCollapse" />
            </div>
          </ArtBaseCollapse>
        </div>
      </Row>
      <Code code={`
// ArtCollapse — self-contained, trigger built in
<ArtCollapse title="Filters" icon="Search" defaultOpen>
  <ArtInput placeholder="…" />
</ArtCollapse>

// Imperative ref
const ref = useRef<ArtCollapseRef>(null);
<ArtButton onClick={() => ref.current?.expand()}>Open</ArtButton>
<ArtCollapse ref={ref} title="Opened from button">…</ArtCollapse>

// ArtBaseCollapse — fully custom trigger
<button onClick={() => setOpen(o => !o)} aria-expanded={open}>
  My trigger <ChevronIcon />
</button>
<ArtBaseCollapse open={open}>{/* content */}</ArtBaseCollapse>
      `} />
    </>
  );
}

// ==== Data static data + columns ====

interface DemoUser {
  id: string; name: string; email: string; role: string;
  status: 'Active' | 'Inactive' | 'Pending'; videos: number;
}

const DEMO_USERS: DemoUser[] = [
  { id: 'u01', name: 'Alice Johnson',   email: 'alice@example.com',   role: 'Admin',  status: 'Active',   videos: 142 },
  { id: 'u02', name: 'Bob Smith',       email: 'bob@example.com',     role: 'Editor', status: 'Active',   videos: 87  },
  { id: 'u03', name: 'Carol Williams',  email: 'carol@example.com',   role: 'Viewer', status: 'Inactive', videos: 3   },
  { id: 'u04', name: 'David Lee',       email: 'david@example.com',   role: 'Editor', status: 'Active',   videos: 56  },
  { id: 'u05', name: 'Emma Davis',      email: 'emma@example.com',    role: 'Viewer', status: 'Pending',  videos: 0   },
  { id: 'u06', name: 'Frank Miller',    email: 'frank@example.com',   role: 'Admin',  status: 'Active',   videos: 201 },
  { id: 'u07', name: 'Grace Wilson',    email: 'grace@example.com',   role: 'Editor', status: 'Active',   videos: 34  },
  { id: 'u08', name: 'Henry Moore',     email: 'henry@example.com',   role: 'Viewer', status: 'Inactive', videos: 12  },
  { id: 'u09', name: 'Isla Taylor',     email: 'isla@example.com',    role: 'Editor', status: 'Active',   videos: 78  },
  { id: 'u10', name: 'Jack Anderson',   email: 'jack@example.com',    role: 'Viewer', status: 'Active',   videos: 5   },
  { id: 'u11', name: 'Karen Thomas',    email: 'karen@example.com',   role: 'Admin',  status: 'Active',   videos: 99  },
  { id: 'u12', name: 'Liam Jackson',    email: 'liam@example.com',    role: 'Editor', status: 'Pending',  videos: 0   },
  { id: 'u13', name: 'Mia White',       email: 'mia@example.com',     role: 'Viewer', status: 'Active',   videos: 21  },
  { id: 'u14', name: 'Noah Harris',     email: 'noah@example.com',    role: 'Editor', status: 'Active',   videos: 44  },
  { id: 'u15', name: 'Olivia Martin',   email: 'olivia@example.com',  role: 'Viewer', status: 'Inactive', videos: 7   },
  { id: 'u16', name: 'Peter Garcia',    email: 'peter@example.com',   role: 'Admin',  status: 'Active',   videos: 167 },
  { id: 'u17', name: 'Quinn Martinez',  email: 'quinn@example.com',   role: 'Editor', status: 'Active',   videos: 63  },
  { id: 'u18', name: 'Rachel Robinson', email: 'rachel@example.com',  role: 'Viewer', status: 'Active',   videos: 18  },
];

const STATUS_COLOR: Record<DemoUser['status'], ArtColor> = {
  Active: 'success', Inactive: 'danger', Pending: 'warning',
};

const USER_COLUMNS: ArtColumn<DemoUser>[] = [
  { key: 'name',       label: 'Name',        sticky: true, sortable: true, width: 160 },
  { key: 'email',      label: 'Email',       sortable: true, truncate: true, width: 220 },
  { key: 'role',       label: 'Role',        sortable: true, width: 100 },
  { key: 'videos',     label: 'Videos',      sortable: true, width: 90 },
  { key: 'id',         label: 'User ID',     width: 80 },
  {
    key: 'status', label: 'Status', width: 110, renderLoading: true,
    render: (row) => (
      <ArtBadge variant="outlined" color={STATUS_COLOR[row.status]} size="sm">{row.status}</ArtBadge>
    ),
  },
  { key: 'joined',     label: 'Joined',      width: 120,
    render: () => <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>2024-01-15</span> },
  { key: 'lastActive', label: 'Last active', width: 130,
    render: () => <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>3 days ago</span> },
];

const WIDE_COL_COUNT = 40;
const WIDE_ROWS = Array.from({ length: 8 }, (_, r) => {
  const row: Record<string, string> = { id: `wr${r}` };
  for (let c = 1; c <= WIDE_COL_COUNT; c++) row[`c${c}`] = `R${r + 1}·C${c}`;
  row['actions'] = 'Edit';
  return row;
});

function makeWideColumns(): ArtColumn<Record<string, string>>[] {
  const dataCols = Array.from({ length: WIDE_COL_COUNT }, (_, i): ArtColumn<Record<string, string>> => {
    const n = i + 1;
    const sticky: ArtColumn<Record<string, string>>['sticky'] =
      n === 1 ? true : n === 2 ? 'left' : undefined;
    const width = n === 1 ? 120 : n === 2 ? 140 : 100;
    return { key: `c${n}`, label: `Col ${n}`, width, sticky };
  });
  dataCols.push({
    key: 'actions', label: 'Actions', width: 80, sticky: 'right',
    render: () => (
      <button type="button" className="btn-ghost" style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 6 }}>
        Edit
      </button>
    ),
  });
  return dataCols;
}
const WIDE_COLUMNS = makeWideColumns();

const ROLE_OPTIONS    = [{ value: 'Admin', label: 'Admin' }, { value: 'Editor', label: 'Editor' }, { value: 'Viewer', label: 'Viewer' }];
const STATUS_OPTIONS  = [
  { value: 'Active',   label: 'Active',   color: 'success' as ArtColor },
  { value: 'Inactive', label: 'Inactive', color: 'danger'  as ArtColor },
  { value: 'Pending',  label: 'Pending',  color: 'warning' as ArtColor },
];

// ==== DataFullSection ====

function DataFullSection() {
  const [tab, setTab]               = useState('full');
  const [roleFilter, setRoleFilter]     = useState<typeof ROLE_OPTIONS[0] | null>(null);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_OPTIONS[0] | null>(null);
  const activeFilterCount = (roleFilter ? 1 : 0) + (statusFilter ? 1 : 0);
  const filteredByAdvanced = DEMO_USERS.filter((u) =>
    (!roleFilter   || u.role   === roleFilter.value) &&
    (!statusFilter || u.status === statusFilter.value),
  );
  return (
    <>
      <ArtTabs
        tabs={[
          { value: 'full',       label: 'Search + filters + pagination' },
          { value: 'no-filters', label: 'No filters'    },
          { value: 'no-pag',     label: 'No pagination' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'full' && (
        <ArtData
          columns={USER_COLUMNS}
          data={filteredByAdvanced}
          pageSize={6}
          rowKey={(row) => row.id}
          searchPlaceholder="Search users…"
          emptyMessage="No users match"
          activeFilterCount={activeFilterCount}
          advancedFilters={
            <div className="flex flex-wrap gap-3">
              <div className="w-40">
                <ArtSelect options={ROLE_OPTIONS} selected={roleFilter} onChange={(opt) => setRoleFilter(opt ? ROLE_OPTIONS.find(o => o.value === opt.value) ?? null : null)} placeholder="Role…" />
              </div>
              <div className="w-44">
                <ArtSelect options={STATUS_OPTIONS} selected={statusFilter} onChange={(opt) => setStatusFilter(opt ? STATUS_OPTIONS.find(o => o.value === opt.value) ?? null : null)} placeholder="Status…" />
              </div>
              {activeFilterCount > 0 && (
                <ArtButton variant="ghost" size="sm" onClick={() => { setRoleFilter(null); setStatusFilter(null); }}>
                  Clear filters
                </ArtButton>
              )}
            </div>
          }
        />
      )}
      {tab === 'no-filters' && (
        <ArtData columns={USER_COLUMNS} data={DEMO_USERS} pageSize={5} rowKey={(row) => row.id} emptyMessage="No users" />
      )}
      {tab === 'no-pag' && (
        <ArtData columns={USER_COLUMNS} data={DEMO_USERS} rowKey={(row) => row.id} searchPlaceholder="Search users…" emptyMessage="No users match" />
      )}
      <Code code={`
<ArtData
  columns={columns} data={rows} pageSize={6}
  rowKey={(r) => r.id} searchPlaceholder="Search…"
  activeFilterCount={activeFilters}
  advancedFilters={<div>…filter inputs…</div>}
/>
      `} />
    </>
  );
}

// ==== DataTableSection ====

function DataTableSection() {
  const [tab, setTab]               = useState('table');
  const [simLoading, setSimLoading] = useState(false);
  const [simData, setSimData]       = useState(DEMO_USERS);
  const [visMap, setVisMap]         = useState<Record<string, string>>({});
  const simulateQuery = () => {
    setSimLoading(true); setSimData([]);
    setTimeout(() => { setSimData(DEMO_USERS.slice(0, 10)); setSimLoading(false); }, 1500);
  };
  const columnsWithVis: ArtColumn<DemoUser>[] = [
    ...USER_COLUMNS,
    {
      key: 'visibility', label: 'Visibility', renderLoading: true,
      render: (row) => (
        <ArtSelect
          options={VISIBILITY_OPTIONS}
          selected={VISIBILITY_OPTIONS.find((o) => o.value === (visMap[row.id] ?? 'public')) ?? VISIBILITY_OPTIONS[0]}
          onChange={(opt) => opt && setVisMap((prev) => ({ ...prev, [row.id]: opt.value }))}
        />
      ),
    },
  ];
  return (
    <Section id="artdatatable" title="ArtDataTable"
      tip="Raw table with sticky columns, sort, and per-cell loading skeletons. ArtData wraps this — use it directly for custom search/filter wrappers.">
      <ArtTabs
        tabs={[
          { value: 'table',     label: 'With dropdown column + loading sim' },
          { value: 'widetable', label: 'Wide (40 cols, multi sticky)'        },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'table' && (
        <div className="flex flex-col gap-3">
          <ArtDataTable
            columns={columnsWithVis}
            data={simData}
            loading={simLoading}
            pageSize={10}
            rowKey={(row) => row.id}
            onRowClick={(row) => console.log('clicked', row.id)}
          />
          <ArtButton variant="outlined" size="sm" onClick={simulateQuery} loading={simLoading}>
            {simLoading ? 'Loading…' : 'Simulate query'}
          </ArtButton>
        </div>
      )}
      {tab === 'widetable' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            42 columns. <strong>Col 1 + Col 2</strong> pin left. <strong>Actions</strong> pins right.
          </p>
          <ArtDataTable columns={WIDE_COLUMNS} data={WIDE_ROWS} rowKey={(r) => r.id} />
        </div>
      )}
      <Code code={`
<ArtDataTable
  columns={columns} data={rows} loading={isLoading}
  rowKey={(r) => r.id} onRowClick={(r) => navigate(r.id)}
/>
      `} />
    </Section>
  );
}

// ==== DataFiltersSection ====

function DataFiltersSection() {
  const [role, setRole]     = useState<typeof ROLE_OPTIONS[0] | null>(null);
  const [status, setStatus] = useState<typeof STATUS_OPTIONS[0] | null>(null);
  const count = (role ? 1 : 0) + (status ? 1 : 0);
  return (
    <Section id="artdatafilters" title="ArtDataFilters"
      tip="Collapsible filter bar with optional search input. Pass advancedFilters to render a panel below the bar. Used automatically by ArtData, but can be used standalone too.">
      <Row label="Standalone — your filter inputs inside the panel">
        <div className="w-full">
          <ArtDataFilters
            searchPlaceholder="Search…"
            activeFilterCount={count}
            advancedFilters={
              <div className="flex flex-wrap gap-3">
                <div className="w-40">
                  <ArtSelect options={ROLE_OPTIONS} selected={role} onChange={(opt) => setRole(opt ? ROLE_OPTIONS.find(o => o.value === opt.value) ?? null : null)} placeholder="Role…" />
                </div>
                <div className="w-44">
                  <ArtSelect options={STATUS_OPTIONS} selected={status} onChange={(opt) => setStatus(opt ? STATUS_OPTIONS.find(o => o.value === opt.value) ?? null : null)} placeholder="Status…" />
                </div>
                {count > 0 && (
                  <ArtButton variant="ghost" size="sm" onClick={() => { setRole(null); setStatus(null); }}>Clear</ArtButton>
                )}
              </div>
            }
          />
        </div>
      </Row>
      <Code code={`
<ArtDataFilters
  searchPlaceholder="Search…"
  onSearch={setQuery}
  activeFilterCount={count}
  advancedFilters={<div>…your filter inputs…</div>}
/>
      `} />
    </Section>
  );
}

// ==== PaginationSection ====

function PaginationSection() {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  return (
    <Section id="artpagination" title="ArtPagination"
      tip="Standalone pagination bar. Used automatically inside ArtData — wire it manually when you need custom data fetching.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>48 items — rows-per-page resets to page 1.</p>
          <ArtPagination
            page={page} pageSize={size} total={48}
            onChange={setPage}
            pageSizeOptions={[10, 50, 100]}
            onPageSizeChange={(s) => { setSize(s); setPage(1); }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>200 items, no size selector</p>
          <ArtPagination page={page} pageSize={10} total={200} onChange={setPage} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{'total=0 → "0 results", nav disabled'}</p>
          <ArtPagination page={1} pageSize={10} total={0} onChange={() => {}} />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>total=undefined → hidden</p>
          <ArtPagination page={1} pageSize={10} total={undefined} onChange={() => {}} />
        </div>
      </div>
      <Code code={`
<ArtPagination
  page={page} pageSize={pageSize} total={total}
  onChange={setPage}
  pageSizeOptions={[10, 50, 100]}
  onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
/>
      `} />
    </Section>
  );
}

// ==== DialogSection ====

function DialogSection() {
  const { show } = useArtDialog();
  const [open, setOpen]     = useState(false);
  const [saving, setSaving] = useState(false);
  const simulateSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); setOpen(false); }, 1800);
  };
  return (
    <Section id="artdialog" title="ArtDialog">
      <Row label="Anatomy — no icon, no content, no buttons">
        <ArtDialog title="Title only">
          <ArtButton variant="ghost">No footer</ArtButton>
        </ArtDialog>
        <ArtDialog title="Title + cancel" description="A description below the title." cancelButton>
          <ArtButton variant="outlined">+ cancelButton</ArtButton>
        </ArtDialog>
        <ArtDialog title="Title + buttons" description="Footer with cancel and confirm." cancelButton buttons={[{ label: 'Confirm', variant: 'default' }]}>
          <ArtButton variant="default">+ buttons</ArtButton>
        </ArtDialog>
      </Row>
      <Row label="Icon + color">
        {PALETTE.map((c) => (
          <ArtDialog key={c} title={`${c[0].toUpperCase() + c.slice(1)} action`} description="Icon and color applied together." icon={c === 'success' ? 'Check' : c === 'danger' ? 'Close' : c === 'warning' ? 'Upload' : 'Play'} color={c} cancelButton buttons={[{ label: 'OK', variant: 'default', color: c }]}>
            <ArtButton variant="outlined" color={c}>{c}</ArtButton>
          </ArtDialog>
        ))}
      </Row>
      <Row label="Outlined variant">
        {PALETTE.map((c) => (
          <ArtDialog key={c} title={`${c[0].toUpperCase() + c.slice(1)} outlined`} description="Border and background pick up the color." icon="Check" color={c} variant="outlined" cancelButton buttons={[{ label: 'Confirm', variant: 'default', color: c }]}>
            <ArtButton variant="ghost" color={c}>{c}</ArtButton>
          </ArtDialog>
        ))}
      </Row>
      <Row label="With content slot">
        <ArtDialog
          title="Edit video details"
          description="Update the title and description for your video."
          icon="Upload"
          cancelButton
          buttons={[{ label: 'Save changes', variant: 'default' }]}
          content={
            <div className="flex flex-col gap-3">
              <ArtInput placeholder="Video title" />
              <ArtTextarea placeholder="Description…" rows={3} maxRows={6} />
            </div>
          }
        >
          <ArtButton variant="default">With content</ArtButton>
        </ArtDialog>
      </Row>
      <Row label="11 buttons — footer wraps">
        <ArtDialog
          title="Choose an action"
          description="Footer uses flex-wrap so any number of buttons fits."
          buttons={Array.from({ length: 11 }, (_, i) => ({
            label: `Action ${i + 1}`,
            variant: (i === 10 ? 'default' : 'outlined') as 'default' | 'outlined',
            color: (i === 10 ? 'primary' : undefined) as 'primary' | undefined,
          }))}
          cancelButton
        >
          <ArtButton variant="ghost">11 buttons</ArtButton>
        </ArtDialog>
      </Row>
      <Row label="ArtConfirmDialog">
        <ArtConfirmDialog title="Delete comment?" description="This will permanently remove the comment." onConfirm={() => {}}>
          <ArtButton variant="outlined" color="danger">Delete confirm</ArtButton>
        </ArtConfirmDialog>
        <ArtConfirmDialog title="Publish video?" description="The video will become visible to all users." icon="Play" color="success" confirmLabel="Publish" onConfirm={() => {}}>
          <ArtButton variant="outlined" color="success">Publish confirm</ArtButton>
        </ArtConfirmDialog>
      </Row>
      <Row label="Controlled + async (closesDialog: false)">
        <ArtDialog
          open={open}
          onOpenChange={setOpen}
          title="Save changes"
          description="Simulates async save: dialog stays open during loading, closes on success."
          icon="Upload"
          cancelButton
          buttons={[{
            label: saving ? 'Saving…' : 'Save',
            variant: 'default',
            loading: saving,
            closesDialog: false,
            onClick: simulateSave,
          }]}
        >
          <ArtButton variant="default">Async save</ArtButton>
        </ArtDialog>
      </Row>
      <Row label="Imperative via useArtDialog hook">
        <ArtButton variant="outlined" onClick={() => show({ title: 'Opened via hook', description: 'No trigger element needed.', icon: 'Play', color: 'primary', cancelButton: true, buttons: [{ label: 'Nice', variant: 'default', color: 'primary' }] })}>
          show() — primary
        </ArtButton>
        <ArtButton variant="outlined" color="danger" onClick={() => show({ title: 'Delete video?', description: 'Opened programmatically.', icon: 'Close', color: 'danger', cancelButton: true, buttons: [{ label: 'Delete', variant: 'default', color: 'danger' }] })}>
          show() — danger
        </ArtButton>
      </Row>
      <Code code={`
// Wrap once at root
<ArtDialogProvider><App /></ArtDialogProvider>

// Declarative
<ArtDialog title="Delete" color="danger" cancelButton
  buttons={[{ label: 'Delete', variant: 'default', color: 'danger', onClick: () => deleteVideo(id) }]}
>
  <ArtButton color="danger">Delete</ArtButton>
</ArtDialog>

// Imperative
const { show } = useArtDialog();
show({ title: 'Hello', cancelButton: true });
      `} />
    </Section>
  );
}

// ==== SnackbarSection ====

const LONG_DESCRIPTION = 'This is a very long description that keeps going to show how the snackbar wraps text.';

function SnackbarSection() {
  const { enqueue, enqueueError, enqueueSuccess, close } = useArtSnackbar();
  return (
    <Section id="artsnackbar" title="ArtSnackbar">
      <Row label="enqueueSuccess">
        <ArtButton variant="default" color="success" onClick={() => enqueueSuccess('Video uploaded!')}>Video uploaded</ArtButton>
        <ArtButton variant="default" color="success" onClick={() => enqueueSuccess('Comment posted!')}>Comment posted</ArtButton>
        <ArtButton variant="default" color="success" onClick={() => enqueueSuccess('Changes saved!', { duration: 8000 })}>8 s duration</ArtButton>
      </Row>
      <Row label="enqueueError">
        <ArtButton variant="default" color="danger" onClick={() => enqueueError(new Error('Network timeout'))}>Default title</ArtButton>
        <ArtButton variant="default" color="danger" onClick={() => enqueueError(new Error('413 Payload Too Large'), 'Upload failed')}>Custom title</ArtButton>
        <ArtButton variant="default" color="danger" onClick={() => enqueueError('Something went wrong')}>String error</ArtButton>
      </Row>
      <Row label="enqueue — custom color + icon">
        <ArtButton variant="default" color="primary" onClick={() => enqueue('New follower', { color: 'primary', icon: 'Like', description: 'user_123 started following you' })}>primary + Like</ArtButton>
        <ArtButton variant="default" color="warning" onClick={() => enqueue('Low storage', { color: 'warning', icon: 'Upload', description: 'Only 2 GB remaining' })}>warning + Upload</ArtButton>
        <ArtButton variant="outlined" onClick={() => enqueue('No icon, no color')}>plain</ArtButton>
      </Row>
      <Row label="duration: 0 — persists until dismissed">
        <ArtButton variant="outlined" color="warning" onClick={() => enqueue('Unsaved changes', { color: 'warning', icon: 'Upload', description: 'You have unsaved changes.', duration: 0 })}>Persistent warning</ArtButton>
        <ArtButton variant="outlined" color="danger" onClick={() => enqueueError(new Error('Session expired'), 'Auth error', { duration: 0 })}>Persistent error</ArtButton>
      </Row>
      <Row label="Long text">
        <ArtButton variant="outlined" color="primary" onClick={() => enqueue('Long title intentionally to test truncation at 400 px', { color: 'primary', description: LONG_DESCRIPTION, duration: 0 })}>Long text</ArtButton>
      </Row>
      <Row label="Duplicate grouping — spam to see ×N counter">
        <ArtButton variant="outlined" color="danger" onClick={() => enqueueError(new Error('Server error'), 'Upload failed')}>Spam error</ArtButton>
        <ArtButton variant="outlined" color="success" onClick={() => enqueueSuccess('Saved!')}>Spam success</ArtButton>
      </Row>
      <Row label="Dismiss">
        <ArtButton variant="outlined" color="danger" icon="Close" onClick={() => close()}>close() — all</ArtButton>
      </Row>
      <Code code={`
const { enqueue, enqueueError, enqueueSuccess, close } = useArtSnackbar();

enqueueSuccess('Video uploaded!');
enqueueError(err);                           // title='Error', desc=err.message
enqueueError(err, 'Upload failed');          // custom title
enqueue('New follower', {
  color: 'primary', icon: 'Like',
  description: 'user_123 started following you',
  duration: 6000,
});
      `} />
    </Section>
  );
}

// ==== Theme switcher ====

const THEMES = ['dark', 'light', 'contrast'] as const;
type Theme = typeof THEMES[number];

function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');
  const switchTheme = (next: Theme) => {
    setTheme(next);
    document.documentElement.classList.remove('theme-light', 'theme-contrast');
    if (next !== 'dark') document.documentElement.classList.add(`theme-${next}`);
  };
  return { theme, switchTheme };
}

// ==== FoundationGroup ====

function FoundationGroup() {
  return (
    <>
      <ButtonSection />
      <Section id="arttabs" title="ArtTabs"
        tip="Used in this very page for group navigation. Controlled or uncontrolled, supports icons and disabled tabs.">
        <TabsSection />
      </Section>
      <AvatarSection />
    </>
  );
}

// ==== FormGroup ====

function FormGroup() {
  return (
    <>
      <LabelSection />
      <InputSection />
      <Section id="artupload" title="ArtUpload">
        <Row label="Video (required)">
          <div className="w-full max-w-md">
            <ArtUpload label="Video" required accept="video/*" hint="MP4, WebM, MOV · max 500 MB" />
          </div>
        </Row>
        <Row label="Image (optional)">
          <div className="w-52">
            <ArtUpload label="Thumbnail" accept="image/*" hint="JPG, PNG · max 10 MB" />
          </div>
        </Row>
        <Row label="Disabled">
          <div className="w-full max-w-md">
            <ArtUpload label="Video" accept="video/*" hint="MP4, WebM · max 500 MB" disabled />
          </div>
        </Row>
        <Code code={`
<ArtUpload label="Video" required accept="video/*"
  hint="MP4, WebM, MOV · max 500 MB"
  {...register('videoFile')} />
        `} />
      </Section>
      <TextareaSection />
      <SkeletonSection />
    </>
  );
}

// ==== IconsGroup ====

function IconsGroup() {
  return (
    <>
      <Section id="articon" title="ArtIcon">
        <Row>
          {ICON_NAMES.map((name) => (
            <span key={name} className="flex flex-col items-center gap-1">
              <ArtIcon name={name} size={20} />
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{name}</span>
            </span>
          ))}
        </Row>
        <div className="flex items-end gap-4" style={{ opacity: 0.7 }}>
          {([12, 16, 20, 24, 32] as const).map((size) => (
            <span key={size} className="flex flex-col items-center gap-1">
              <ArtIcon name="Play" size={size} />
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{size}px</span>
            </span>
          ))}
        </div>
        <Code code={`<ArtIcon name="ChevronDown" size={20} />`} />
      </Section>
      <IconButtonSection />
      <IconToggleSection />
      <IconCycleSection />
      <Section id="artcopybutton" title="ArtCopyButton"
        tip="Icon button that copies text to clipboard and flashes a checkmark for 1.5 s. Sized like ArtIconButton.">
        <Row>
          <ArtCopyButton text="hello world" size="sm" />
          <ArtCopyButton text="hello world" />
          <ArtCopyButton text="hello world" size="lg" />
        </Row>
        <Code code={`<ArtCopyButton text={apiKey} size="sm" />`} />
      </Section>
      <Section id="artcopytext" title="ArtCopyText"
        tip="Inline text with a copy icon. Use mono for IDs and hashes. Truncate long values with the label prop.">
        <Row>
          <ArtCopyText text="550e8400-e29b-41d4-a716-446655440000" mono label="550e8400…" />
          <ArtCopyText text="https://mepipe.example.com/watch?v=abc123" />
        </Row>
        <Code code={`<ArtCopyText text={userId} mono label={userId.slice(0, 8) + '…'} />`} />
      </Section>
    </>
  );
}

// ==== MenuSection ====

const MENU_ITEMS: ArtMenuItemDef[] = [
  { value: 'edit',      label: 'Edit details', icon: 'Upload'                          },
  { value: 'preview',   label: 'Preview',      icon: 'Play'                            },
  { value: 'duplicate', label: 'Duplicate'                                             },
  { value: 'delete',    label: 'Delete',       icon: 'Close', color: 'danger', separator: true },
];

function MenuSection() {
  return (
    <Section id="artmenu" title="ArtMenu"
      tip="Trigger is any element — cloneElement injects ref + onClick. Items are plain objects; separator: true draws a rule above the entry. Closes on select, outside click, scroll, or Escape.">
      <Row label="Button trigger">
        <ArtMenu items={MENU_ITEMS} onSelect={(item) => console.log(item.value)}>
          <ArtButton variant="outlined" icon="ChevronDown">Actions</ArtButton>
        </ArtMenu>
      </Row>
      <Row label="Icon button trigger">
        <ArtMenu items={MENU_ITEMS} onSelect={(item) => console.log(item.value)}>
          <ArtIconButton icon="ChevronDown" tooltip="More" />
        </ArtMenu>
      </Row>
      <Code code={`
import ArtMenu, { type ArtMenuItemDef } from '@/components/ui/ArtMenu';

const items: ArtMenuItemDef[] = [
  { value: 'edit',   label: 'Edit',   icon: 'Upload'                         },
  { value: 'delete', label: 'Delete', icon: 'Close', color: 'danger', separator: true },
];

<ArtMenu items={items} onSelect={(item) => console.log(item.value)}>
  <ArtButton variant="outlined" icon="ChevronDown">Actions</ArtButton>
</ArtMenu>
      `} />
    </Section>
  );
}

// ==== AvatarSection ====

function AvatarSection() {
  return (
    <Section id="artavatar" title="ArtAvatar"
      tip="Circular avatar — image with initials fallback. Framework-agnostic (plain <img>); wrap with next/image at the call site if you need delivery optimisation.">
      <Row label="Image">
        <ArtAvatar src="https://picsum.photos/seed/mepipe1/64/64" name="Jane Doe" size="sm" />
        <ArtAvatar src="https://picsum.photos/seed/mepipe1/64/64" name="Jane Doe" />
        <ArtAvatar src="https://picsum.photos/seed/mepipe1/64/64" name="Jane Doe" size="lg" />
        <ArtAvatar src="https://picsum.photos/seed/mepipe1/64/64" name="Jane Doe" size="xl" />
      </Row>
      <Row label="Initials fallback">
        <ArtAvatar name="Jane Doe" size="sm" />
        <ArtAvatar name="Jane Doe" />
        <ArtAvatar name="Jane Doe" size="lg" />
        <ArtAvatar name="Jane Doe" size="xl" />
      </Row>
      <Row label="Colors">
        {PALETTE.map((c) => <ArtAvatar key={c} name="JD" color={c} />)}
      </Row>
      <Code code={`
<ArtAvatar src={user.avatarUrl} name={user.name} />   // image + initials fallback
<ArtAvatar name="Jane Doe" color="primary" />          // initials only
<ArtAvatar name="Jane Doe" size="xl" />                // xl / lg / md / sm
      `} />
    </Section>
  );
}

// ==== EmptyStateSection ====

function EmptyStateSection() {
  return (
    <Section id="artemptystate" title="ArtEmptyState"
      tip="Two variants: no-data (zero records total, get-started feel) and no-results (filter/search returned zero). All defaults are overridable via props.">
      <Row label="no-data — default">
        <ArtEmptyState />
      </Row>
      <Row label="no-results — after filtering">
        <ArtEmptyState variant="no-results" />
      </Row>
      <Row label="Custom icon + action">
        <ArtEmptyState
          variant="no-data"
          icon="Like"
          title="No favourites yet"
          description="Like a video to save it here."
          action={<ArtButton size="sm" variant="outlined">Browse videos</ArtButton>}
        />
      </Row>
      <Code code={`
<ArtEmptyState />                            // no-data defaults
<ArtEmptyState variant="no-results" />       // after filtering

<ArtEmptyState
  icon="Like"
  title="No favourites yet"
  description="Like a video to save it here."
  action={<ArtButton size="sm">Browse</ArtButton>}
/>
      `} />
    </Section>
  );
}

// ==== PortalGroup ====

function PortalGroup() {
  return (
    <>
      <Section id="arttooltip" title="ArtTooltip"
        tip="Zero React rerenders on hover — uses imperative DOM updates. Safe to use freely without performance concerns.">
        <Row>
          <ArtTooltip label="I am a tooltip">
            <ArtButton variant="ghost">Hover me</ArtButton>
          </ArtTooltip>
          <ArtTooltip label="Works on any element">
            <span className="underline cursor-default text-sm" style={{ opacity: 0.6 }}>or this text</span>
          </ArtTooltip>
        </Row>
        <Code code={`
<ArtTooltip label="I am a tooltip">
  <ArtButton variant="ghost">Hover me</ArtButton>
</ArtTooltip>
        `} />
      </Section>
      <Section id="artpopover" title="ArtPopover"
        tip="Portal panel anchored to a trigger. Closes on outside click, scroll, resize, or Escape. Use for context menus and inline panels.">
        <Row label="Default — panel width is content-driven">
          <ArtPopover trigger={<ArtButton variant="outlined">Open popover</ArtButton>}>
            <div className="flex flex-col gap-2 p-1">
              <p className="text-sm">Popover content here.</p>
              <ArtButton variant="ghost" size="sm">Action</ArtButton>
            </div>
          </ArtPopover>
          <ArtPopover placement="top" trigger={<ArtButton variant="ghost">Opens above</ArtButton>}>
            <p className="text-sm p-1">Top placement</p>
          </ArtPopover>
        </Row>
        <Row label="trackWidth — panel stretches to trigger width (useful for dropdowns)">
          <div className="w-56">
            <ArtPopover trackWidth trigger={<ArtButton variant="outlined" className="w-full">Same width as trigger</ArtButton>}>
              <div className="flex flex-col p-1">
                <ArtButton variant="ghost" size="sm">Option A</ArtButton>
                <ArtButton variant="ghost" size="sm">Option B</ArtButton>
              </div>
            </ArtPopover>
          </div>
        </Row>
        <Code code={`
{/* default: panel width = content */}
<ArtPopover trigger={<ArtButton>Open</ArtButton>}>
  <div className="p-2">Any content here.</div>
</ArtPopover>

{/* trackWidth: panel matches trigger width */}
<ArtPopover trackWidth trigger={<ArtButton className="w-full">Select…</ArtButton>}>
  <div>…</div>
</ArtPopover>
        `} />
      </Section>
      <MenuSection />
    </>
  );
}

// ==== SelectGroup ====

function SelectGroup() {
  return (
    <>
      <ComboBoxSection />
      <ListboxSection />
      <BadgeSection />
      <SelectSection />
    </>
  );
}

// ==== ControlsGroup ====

function ControlsGroup() {
  return (
    <>
      <SliderSection />
      <Section id="artprogress" title="ArtProgress">
        <Row label="md">
          <div className="w-full"><ArtProgress value={0.65} /></div>
        </Row>
        <Row label="sm">
          <div className="w-full"><ArtProgress value={0.4} size="sm" /></div>
        </Row>
        <Row label="Color palette">
          {PALETTE.map((c) => (
            <div key={c} className="flex-1 min-w-24">
              <ArtProgress value={0.7} color={c} />
            </div>
          ))}
        </Row>
        <Code code={`
<ArtProgress value={0.65} />
<ArtProgress value={uploadProgress} size="sm" color="success" />
        `} />
      </Section>
      <Section id="artswitch" title="ArtSwitch">
        <SwitchSection />
      </Section>
      <CheckboxSection />
      <RadioSection />
      <Section id="artcollapse" title="ArtCollapse">
        <CollapseSection />
      </Section>
    </>
  );
}

// ==== DataGroup ====

function DataGroup() {
  return (
    <>
      <Section id="artdata" title="ArtData"
        tip="Top-level data component — combines search, collapsible filters, table, and pagination. Use ArtDataTable directly for custom wrappers.">
        <DataFullSection />
      </Section>
      <DataTableSection />
      <DataFiltersSection />
      <PaginationSection />
      <EmptyStateSection />
    </>
  );
}

// ==== ProvidersGroup ====

function ProvidersGroup() {
  return (
    <>
      <DialogSection />
      <SnackbarSection />
    </>
  );
}

// ==== Page ====

export default function UiPage() {
  const [group, setGroup] = useState<GroupId>('foundation');
  const { theme, switchTheme } = useTheme();

  return (
    <div className="flex min-h-screen">
      <aside className="w-44 shrink-0 sticky top-0 h-screen flex flex-col py-8 px-4 border-r overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest mb-3 shrink-0" style={{ color: 'var(--text-muted)' }}>
          Art Library
        </span>
        <div className="flex flex-col gap-0.5 mb-4 shrink-0">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroup(g.id)}
              className="text-sm py-1 text-left"
              style={{ color: group === g.id ? 'var(--text)' : 'var(--text-muted)', fontWeight: group === g.id ? 600 : 400 }}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-0.5 border-t pt-3 flex-1 overflow-y-auto min-h-0 art-scrollable" style={{ borderColor: 'var(--border)' }}>
          {GROUP_SECTIONS[group].map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="text-xs py-1 transition-opacity hover:opacity-100"
              style={{ color: 'var(--text-muted)' }}
            >
              {label}
            </a>
          ))}
        </div>
        <div className="pt-6 flex flex-col gap-0.5 shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Theme</span>
          {THEMES.map((t) => (
            <button
              key={t}
              onClick={() => switchTheme(t)}
              className="text-sm py-1 text-left capitalize"
              style={{ color: theme === t ? 'var(--text)' : 'var(--text-muted)', fontWeight: theme === t ? 600 : 400 }}
            >
              {t === 'contrast' ? 'Hi-Contrast' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 px-10 py-10 flex flex-col gap-14 max-w-3xl">
        {group === 'foundation' && <FoundationGroup />}
        {group === 'form'       && <FormGroup />}
        {group === 'icons'      && <IconsGroup />}
        {group === 'portal'     && <PortalGroup />}
        {group === 'select'     && <SelectGroup />}
        {group === 'controls'   && <ControlsGroup />}
        {group === 'data'       && <DataGroup />}
        {group === 'providers'  && <ProvidersGroup />}
      </main>
    </div>
  );
}
