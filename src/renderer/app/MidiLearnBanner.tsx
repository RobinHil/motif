import { targetSpec } from '../midi/targets'
import { midiStore, useMidi } from '../store/midi-store'
import { useProject } from '../store/project-store'

/** MIDI learn mode (SPEC 6.2, mockup 2-mixer.png): explanation, detected device, Done. */
export function MidiLearnBanner() {
  const learning = useMidi((s) => s.learning)
  const target = useMidi((s) => s.learnTarget)
  const lastDevice = useMidi((s) => s.lastDevice)
  const connected = useMidi((s) =>
    s.devices
      .filter((d) => d.connected)
      .map((d) => d.name)
      .join(', '),
  )
  const selected = useProject((s) => (target ? targetSpec(s.project, target)?.label : undefined))
  if (!learning) return null
  const device = lastDevice ?? (connected || null)
  return (
    <div
      role="status"
      aria-label="MIDI learn"
      className="flex items-center gap-4 border-b border-line bg-accent/10 px-6 py-2.5 text-body-lg"
    >
      <span className="font-medium text-accent">MIDI learn on</span>
      <span className="text-text">
        {selected
          ? `Now turn a knob or move a fader on your controller to control ${selected}.`
          : 'Click a dashed control, then turn a knob on your controller.'}{' '}
        {device ? `Detected device: ${device}` : 'No MIDI device detected yet.'}
      </span>
      <button
        type="button"
        onClick={() => midiStore.getState().stopLearning()}
        className="ml-auto h-8 rounded-control border border-accent px-4 text-body text-accent hover:bg-raised"
      >
        Done
      </button>
    </div>
  )
}
