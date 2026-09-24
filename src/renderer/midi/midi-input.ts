// Web MIDI inputs (SPEC 8). No React, no store: the app layer subscribes. Every input is listened
// to, including inputs plugged in later, which is what restores mappings after a reconnection.

export type MidiMessage =
  | { kind: 'cc'; device: string; channel: number; controller: number; value: number }
  | { kind: 'noteon'; device: string; channel: number; note: number; velocity: number }
  | { kind: 'noteoff'; device: string; channel: number; note: number }

/** Decodes the messages Motif uses; channels are 1 to 16. */
export function decodeMidi(device: string, data: ArrayLike<number>): MidiMessage | null {
  const status = data[0] ?? 0
  const type = status & 0xf0
  const channel = (status & 0x0f) + 1
  const a = data[1] ?? 0
  const b = data[2] ?? 0
  if (type === 0xb0) return { kind: 'cc', device, channel, controller: a, value: b }
  if (type === 0x90 && b > 0) return { kind: 'noteon', device, channel, note: a, velocity: b }
  if (type === 0x80 || type === 0x90) return { kind: 'noteoff', device, channel, note: a }
  return null
}

export interface MidiInputs {
  stop: () => void
}

/**
 * Listens to every MIDI input. `onDevices` gets the connected input names each time the list
 * changes. Resolves to null when Web MIDI is unavailable.
 */
export async function listenToMidi(handlers: {
  onMessage: (message: MidiMessage) => void
  onDevices: (connected: string[]) => void
}): Promise<MidiInputs | null> {
  if (typeof navigator.requestMIDIAccess !== 'function') return null
  let access: MIDIAccess
  try {
    access = await navigator.requestMIDIAccess({ sysex: false })
  } catch {
    return null
  }
  const attached = new Set<MIDIInput>()
  const scan = () => {
    const connected: string[] = []
    for (const input of access.inputs.values()) {
      if (input.state !== 'connected') continue
      connected.push(input.name ?? input.id)
      if (attached.has(input)) continue
      attached.add(input)
      input.onmidimessage = (event) => {
        if (!event.data) return
        const message = decodeMidi(input.name ?? input.id, event.data)
        if (message) handlers.onMessage(message)
      }
    }
    handlers.onDevices(connected)
  }
  access.onstatechange = scan
  scan()
  return {
    stop: () => {
      access.onstatechange = null
      for (const input of attached) input.onmidimessage = null
    },
  }
}
