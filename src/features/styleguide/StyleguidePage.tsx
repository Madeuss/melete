/*
 * Dev-only visual review page (route #/styleguide, not in production builds).
 * Text here is intentionally hardcoded in English: it's a tool for reviewing the design,
 * not user-facing UI, so it stays out of the translation files.
 */
import { Download, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Chip,
  Dialog,
  Field,
  Input,
  Logo,
  Notice,
  Progress,
  RecordButton,
  SegmentedControl,
  Select,
  Textarea,
  Toggle,
  ToggleChip,
  iconPropsSm,
} from '../../ui'

const colorTokens = [
  'bg',
  'surface-subtle',
  'surface-sunken',
  'border',
  'border-strong',
  'text',
  'text-muted',
  'text-subtle',
  'brand',
  'brand-strong',
  'brand-hover',
  'brand-text',
  'brand-soft',
  'success',
  'warning',
  'danger',
] as const

function Swatch({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-[12px] border border-border" style={{ background: `var(--${name})` }} />
      <code className="text-caption text-text-muted">{name}</code>
    </div>
  )
}

function useFakeMicLevel(active: boolean) {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!active) return
    let t = 0
    const id = setInterval(() => {
      t += 1
      setLevel(Math.abs(Math.sin(t / 3)) * (0.4 + Math.random() * 0.6))
    }, 120)
    return () => clearInterval(id)
  }, [active])
  return active ? level : 0
}

function ThemeColumn({ theme }: { theme: 'light' | 'dark' }) {
  const [recording, setRecording] = useState(false)
  const level = useFakeMicLevel(recording)
  const [type, setType] = useState<'behavioral' | 'technical' | 'mixed'>('behavioral')
  const [followUps, setFollowUps] = useState(true)
  const [tags, setTags] = useState({ conflict: true, leadership: false, failure: false })
  const [dialog, setDialog] = useState(false)

  return (
    <section data-theme={theme} className="flex flex-col gap-12 bg-bg p-8 text-text sm:p-12">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="text-caption text-text-subtle">{theme}</span>
      </header>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl">Colors</h2>
        <div className="grid grid-cols-2 gap-3">
          {colorTokens.map((n) => (
            <Swatch key={n} name={n} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl">Type</h2>
        <p className="text-2xl font-semibold">Title 32 / 600</p>
        <p className="text-xl font-semibold">Title 24 / 600</p>
        <p className="text-lg font-semibold">Title 20 / 600</p>
        <p className="text-base">Base 16 / 400 — the quick brown fox jumps over the lazy dog.</p>
        <p className="text-sm text-text-muted">Secondary 14 / 400 in text-muted</p>
        <p className="text-caption text-text-subtle">Caption 13 in text-subtle · 10:42</p>
        <p className="text-reading">
          Reading 18 / 1.6 — In my last role, our checkout had a 4% error rate. I owned the investigation,
          traced it to a race condition in the payment retry and shipped a fix in two days.
        </p>
        <p className="text-base">
          Tabular numbers: <span className="font-medium">0123456789 · 3 of 6 · 142 wpm</span>
        </p>
        <a href="#/styleguide" className="text-base text-brand-text underline underline-offset-4">
          A link in brand-text
        </a>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary">Start interview</Button>
          <Button variant="secondary" icon={<Plus {...iconPropsSm} />}>
            New story
          </Button>
          <Button variant="ghost" icon={<Download {...iconPropsSm} />}>
            Export
          </Button>
          <Button variant="danger" icon={<Trash2 {...iconPropsSm} />} onClick={() => setDialog(true)}>
            Delete
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" size="sm">
            Small primary
          </Button>
          <Button size="sm">Small secondary</Button>
          <Button variant="primary" loading>
            Testing
          </Button>
          <Button disabled>Disabled</Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <h2 className="text-xl">Fields</h2>
        <Field id={`${theme}-role`} label="Role" hint="As written in the job post.">
          <Input id={`${theme}-role`} placeholder="Frontend engineer" />
        </Field>
        <Field id={`${theme}-key`} label="API key" error="The provider rejected this key. Check it and try again.">
          <Input id={`${theme}-key`} type="password" defaultValue="sk-not-a-real-key" aria-invalid />
        </Field>
        <Field id={`${theme}-sen`} label="Seniority">
          <Select id={`${theme}-sen`} defaultValue="senior">
            <option value="junior">Junior</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
          </Select>
        </Field>
        <Field id={`${theme}-jd`} label="Job description">
          <Textarea id={`${theme}-jd`} placeholder="Paste it here (optional)" />
        </Field>
        <Input size="sm" placeholder="Small input" aria-label="Small input" />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl">Choices</h2>
        <SegmentedControl
          aria-label="Interview type"
          value={type}
          onChange={setType}
          options={[
            { value: 'behavioral', label: 'Behavioral' },
            { value: 'technical', label: 'Technical' },
            { value: 'mixed', label: 'Mixed' },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(tags) as Array<keyof typeof tags>).map((t) => (
            <ToggleChip key={t} selected={tags[t]} onSelectedChange={(s) => setTags({ ...tags, [t]: s })}>
              {t}
            </ToggleChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip>ownership</Chip>
          <Chip onRemove={() => {}} removeLabel="Remove tag">
            removable
          </Chip>
        </div>
        <Toggle
          checked={followUps}
          onChange={setFollowUps}
          label="Follow-up questions"
          description="At most one per question, only when part of the answer is missing."
        />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl">Notices</h2>
        <Notice tone="info" title="Your key stays in this browser">
          It's stored in IndexedDB and sent only to the provider you picked.
        </Notice>
        <Notice tone="success" title="Connection works" />
        <Notice tone="warning" title="Chrome sends your voice to Google">
          Speech recognition in Chrome runs on Google servers. Type your answers if you prefer.
        </Notice>
        <Notice tone="danger" title="Couldn't reach Ollama">
          Allow this origin in OLLAMA_ORIGINS and restart Ollama.
        </Notice>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-xl">Cards</h2>
        <Card>
          <p className="font-medium">Plain card</p>
          <p className="text-sm text-text-muted">Border, no shadow.</p>
        </Card>
        <Card tone="subtle">
          <p className="font-medium">Subtle panel</p>
          <p className="text-sm text-text-muted">Separated by tone.</p>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-6">
        <h2 className="self-start text-xl">Record button</h2>
        <div className="flex w-full flex-col gap-2">
          <p className="text-caption text-text-subtle">Question 3 of 6</p>
          <Progress value={3} max={6} label="Question 3 of 6" />
        </div>
        <RecordButton
          recording={recording}
          level={level}
          onClick={() => setRecording((r) => !r)}
          label={recording ? 'Stop recording' : 'Start recording'}
        />
        <p className="text-sm text-text-muted">{recording ? 'Listening… (fake mic level)' : 'Tap to answer'}</p>
      </div>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Delete this story?"
        actions={
          <>
            <Button onClick={() => setDialog(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setDialog(false)}>
              Delete
            </Button>
          </>
        }
      >
        Sessions that used it keep their transcripts.
      </Dialog>
    </section>
  )
}

export default function StyleguidePage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <ThemeColumn theme="light" />
      <ThemeColumn theme="dark" />
    </main>
  )
}
