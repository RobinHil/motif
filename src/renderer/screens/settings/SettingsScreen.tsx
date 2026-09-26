import { APP_NAME } from '@shared/app-info'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { LATENCIES, ZOOMS, type Settings } from '@shared/ipc'
import { loadLibrary, userSounds, subscribeUserSounds } from '../../app/sample-library'
import { changeSettings } from '../../app/settings-session'
import { outputLatency } from '../../engine/engine'
import { removeMapping, targetSpec } from '../../midi/targets'
import { midiStore, useMidi } from '../../store/midi-store'
import { projectStore, useProject } from '../../store/project-store'
import { useSettings } from '../../store/settings-store'
import { uiStore } from '../../store/ui-store'

const LATENCY_LABELS: Record<Settings['latency'], string> = {
  interactive: 'Low (interactive)',
  balanced: 'Balanced',
  playback: 'Safe, fewer dropouts (playback)',
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <section aria-label={props.title} className="flex flex-col gap-4 rounded-panel border border-line bg-panel p-6">
      <h2 className="text-section font-medium uppercase tracking-[0.14em] text-label">{props.title}</h2>
      {props.children}
    </section>
  )
}

function Row(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] items-start gap-6">
      <div className="flex flex-col gap-1 pt-1.5">
        <span className="text-body-lg">{props.label}</span>
        {props.hint && <span className="text-small text-text-2">{props.hint}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">{props.children}</div>
    </div>
  )
}

const select =
  'h-9 min-w-64 rounded-input border border-line-strong bg-bg-code px-3 text-body text-text outline-none focus-visible:border-text-2 disabled:text-text-3'
const button = 'h-9 rounded-pill border border-line-strong px-4 text-body text-text-2 hover:text-text'

function AudioOutputs({ settings }: { settings: Settings }) {
  const [outputs, setOutputs] = useState<{ id: string; label: string }[]>([])
  useEffect(() => {
    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) =>
        setOutputs(
          devices
            .filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'default' && d.deviceId !== '')
            .map((d, i) => ({ id: d.deviceId, label: d.label || `Output ${String(i + 1)}` })),
        ),
      )
      .catch(() => setOutputs([]))
  }, [])
  const latency = outputLatency()
  return (
    <>
      <Row label="Output device" hint="Where Motif plays">
        <select
          aria-label="Output device"
          value={settings.audioOutput ?? ''}
          onChange={(event) => void changeSettings({ audioOutput: event.target.value || null })}
          className={select}
        >
          <option value="">System default</option>
          {outputs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
          {settings.audioOutput !== null && !outputs.some((o) => o.id === settings.audioOutput) && (
            <option value={settings.audioOutput}>Unavailable device</option>
          )}
        </select>
      </Row>
      <Row label="Latency" hint="Applies the next time Motif starts">
        <select
          aria-label="Latency"
          value={settings.latency}
          onChange={(event) => void changeSettings({ latency: event.target.value as Settings['latency'] })}
          className={select}
        >
          {LATENCIES.map((l) => (
            <option key={l} value={l}>
              {LATENCY_LABELS[l]}
            </option>
          ))}
        </select>
        <span className="text-small text-text-2">
          {latency === null ? 'Measured once the sound starts.' : `Output latency now: ${String(latency)} ms`}
        </span>
      </Row>
    </>
  )
}

function MidiSettings({ settings }: { settings: Settings }) {
  const supported = useMidi((s) => s.supported)
  const devices = useMidi((s) => s.devices)
  const mappings = useProject((s) => s.project.midiMappings)
  const tracks = useProject((s) => s.project.tracks)
  const toggle = (name: string, on: boolean) =>
    void changeSettings({
      midiDisabled: on ? settings.midiDisabled.filter((d) => d !== name) : [...settings.midiDisabled, name],
    })
  return (
    <>
      <Row label="Devices" hint="Reconnected automatically when plugged back in">
        {supported === false && <span className="text-body text-text-2">MIDI is not available on this computer.</span>}
        {supported !== false && devices.length === 0 && (
          <span className="text-body text-text-2">No MIDI device detected. Plug one in: it appears here.</span>
        )}
        {devices.length > 0 && (
          <ul aria-label="MIDI devices" className="flex w-full flex-col gap-1.5">
            {devices.map((device) => (
              <li key={device.name} className="flex items-center gap-3 rounded-input bg-raised px-3 py-2 text-body">
                <span className={`size-2 rounded-pill ${device.connected ? 'bg-success' : 'bg-text-3'}`} />
                <span className="flex-1">{device.name}</span>
                <span className="text-small text-text-2">{device.connected ? 'Connected' : 'Unplugged'}</span>
                <label className="flex items-center gap-2 text-small text-text-2">
                  <input
                    type="checkbox"
                    checked={!settings.midiDisabled.includes(device.name)}
                    onChange={(event) => toggle(device.name, event.target.checked)}
                    className="size-4 accent-accent"
                  />
                  Use
                </label>
              </li>
            ))}
          </ul>
        )}
      </Row>
      <Row label="Mappings" hint="Saved with the project">
        <button
          type="button"
          onClick={() => {
            midiStore.getState().startLearning()
            uiStore.getState().setScreen('mixer')
          }}
          className={button}
        >
          Start MIDI learn
        </button>
        {mappings.length === 0 ? (
          <span className="text-body text-text-2">Right-click a knob and choose MIDI learn, or start it here.</span>
        ) : (
          <ul aria-label="MIDI mappings" className="flex w-full flex-col gap-1.5">
            {mappings.map((m) => (
              <li
                key={`${m.target.trackId}-${m.target.param}`}
                className="flex items-center gap-3 rounded-input bg-raised px-3 py-2 text-body"
              >
                <span className="font-mono text-knob-value text-accent">CC {m.cc}</span>
                <span className="text-small text-text-2">
                  {m.deviceName}, channel {m.channel}
                </span>
                <span className="flex-1 text-right">
                  {targetSpec({ tracks }, m.target)?.label ?? 'Removed control'}
                </span>
                <button
                  type="button"
                  aria-label={`Remove the mapping of CC ${String(m.cc)}`}
                  onClick={() => projectStore.getState().update(removeMapping(m.target))}
                  className="text-small text-text-2 hover:text-text"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Row>
    </>
  )
}

function SampleLibrarySettings() {
  const [folder, setFolder] = useState<string | null>(null)
  const sounds = useSyncExternalStore(subscribeUserSounds, userSounds)
  const [library, setLibrary] = useState<string[]>([])
  useEffect(() => {
    void window.motif.samples.folder().then(setFolder)
    void window.motif.samples.library().then((list) => setLibrary(list.map((s) => s.name)))
  }, [sounds])
  return (
    <>
      <Row label="Library folder" hint="Where imported samples are kept">
        <code className="max-w-full truncate rounded-input bg-bg-code px-3 py-2 font-mono text-knob-value text-text-2">
          {folder ?? '...'}
        </code>
        <button
          type="button"
          onClick={() =>
            void window.motif.samples.moveFolder().then(async (moved) => {
              if (moved === null) return
              setFolder(moved)
              await loadLibrary()
              uiStore.getState().setNotice(`The sample library is now in ${moved}.`)
            })
          }
          className={button}
        >
          Change folder...
        </button>
        <button type="button" onClick={() => void window.motif.samples.showFolder()} className={button}>
          Show in folder
        </button>
      </Row>
      <Row label="Imported sounds" hint="Removing one keeps the copies inside saved projects">
        {library.length === 0 ? (
          <span className="text-body text-text-2">Nothing imported yet.</span>
        ) : (
          <ul aria-label="Imported sounds" className="flex w-full flex-col gap-1.5">
            {sounds
              .filter((s) => library.includes(s.name))
              .map((sound) => (
                <li key={sound.name} className="flex items-center gap-3 rounded-input bg-raised px-3 py-2 text-body">
                  <span className="flex-1 font-mono">{sound.name}</span>
                  <span className="text-small text-text-2">
                    {sound.files.length} {sound.files.length === 1 ? 'file' : 'files'} · {sound.folder}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${sound.name} from the library`}
                    onClick={() =>
                      void window.motif.samples.remove(sound.name).then(async () => {
                        await loadLibrary()
                      })
                    }
                    className="text-small text-text-2 hover:text-text"
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Row>
    </>
  )
}

/** Settings of this computer (SPEC 10): audio, MIDI, samples, display, language. */
export function SettingsScreen() {
  const settings = useSettings((s) => s.settings)
  if (!settings) return <main className="flex-1 bg-bg-app" />
  return (
    <main
      aria-label="Settings"
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto bg-bg-app px-8 py-6 [&>*]:shrink-0"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-screen-title font-medium">Settings</h1>
        <button type="button" onClick={() => uiStore.getState().setAboutOpen(true)} className={button}>
          About {APP_NAME}
        </button>
      </div>
      <Section title="Audio">
        <AudioOutputs settings={settings} />
      </Section>
      <Section title="MIDI">
        <MidiSettings settings={settings} />
      </Section>
      <Section title="Samples">
        <SampleLibrarySettings />
      </Section>
      <Section title="Display">
        <Row label="Interface scale">
          <select
            aria-label="Interface scale"
            value={settings.zoom}
            onChange={(event) => void changeSettings({ zoom: Number(event.target.value) as Settings['zoom'] })}
            className={select}
          >
            {ZOOMS.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
        </Row>
        <Row label="Language" hint="More languages later">
          <select aria-label="Language" value={settings.language} disabled className={select}>
            <option value="en">English</option>
          </select>
        </Row>
      </Section>
    </main>
  )
}
