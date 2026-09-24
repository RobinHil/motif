import { sameTarget, type MidiTarget } from '../midi/targets'
import { midiStore, useMidi } from '../store/midi-store'
import { useProject } from '../store/project-store'

export interface MidiBinding {
  /** MIDI learn is on and this control can be mapped: it is outlined. */
  learning: boolean
  /** This control is the one the next moved hardware control maps to. */
  selected: boolean
  /** The CC mapped to this control, if any. */
  cc: number | null
  /** In learn mode: makes this control the next one to map. */
  pick: () => void
  /** Starts MIDI learn with this control selected (knob menu). */
  learn: () => void
}

/** MIDI learn state of one control (SPEC 6.2, "MIDI learn mode"). */
export function useMidiBinding(target: MidiTarget | undefined): MidiBinding {
  const learning = useMidi((s) => s.learning)
  const selected = useMidi((s) => target !== undefined && s.learnTarget !== null && sameTarget(s.learnTarget, target))
  const cc = useProject((s) =>
    target === undefined ? null : (s.project.midiMappings.find((m) => sameTarget(m.target, target))?.cc ?? null),
  )
  return {
    learning: learning && target !== undefined,
    selected,
    cc,
    pick: () => {
      if (target) midiStore.getState().pickTarget(target)
    },
    learn: () => {
      if (target) midiStore.getState().startLearning(target)
    },
  }
}

/** Outline of a mappable control in learn mode: dashed, solid when selected. */
export function learnOutline(binding: MidiBinding): string {
  if (!binding.learning) return ''
  return binding.selected
    ? 'rounded-control outline-2 outline-offset-1 outline-accent'
    : 'rounded-control outline-1 outline-offset-1 outline-dashed outline-accent'
}
