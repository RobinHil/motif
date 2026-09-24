// A stand-in for Web MIDI, injected by tests only: CI runners have no MIDI hardware.
import type { Page } from '@playwright/test'

declare global {
  interface Window {
    fakeMidi: {
      plug: (name: string) => void
      unplug: (name: string) => void
      send: (name: string, data: number[]) => void
    }
  }
}

/** Replaces navigator.requestMIDIAccess, then reloads the app with `devices` plugged in. */
export async function useFakeMidi(page: Page, devices: string[]): Promise<void> {
  await page.addInitScript((initial: string[]) => {
    type Port = { id: string; name: string; state: string; type: string; onmidimessage: ((e: unknown) => void) | null }
    const inputs = new Map<string, Port>()
    const access = {
      inputs,
      outputs: new Map(),
      sysexEnabled: false,
      onstatechange: null as ((e: unknown) => void) | null,
    }
    let count = 0
    window.fakeMidi = {
      plug: (name) => {
        const port: Port = {
          id: `input-${String(count++)}`,
          name,
          state: 'connected',
          type: 'input',
          onmidimessage: null,
        }
        inputs.set(port.id, port)
        access.onstatechange?.({ port })
      },
      unplug: (name) => {
        for (const [id, port] of inputs)
          if (port.name === name) {
            port.state = 'disconnected'
            inputs.delete(id)
            access.onstatechange?.({ port })
          }
      },
      send: (name, data) => {
        for (const port of inputs.values())
          if (port.name === name && port.state === 'connected') port.onmidimessage?.({ data: new Uint8Array(data) })
      },
    }
    for (const name of initial) window.fakeMidi.plug(name)
    Object.defineProperty(navigator, 'requestMIDIAccess', { value: () => Promise.resolve(access), configurable: true })
  }, devices)
  await page.reload()
  await page.waitForLoadState('domcontentloaded')
  // A reload is not a first launch: leave the home screen for the Studio.
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('button', { name: 'Studio' }).click()
}

export const cc = (page: Page, device: string, controller: number, value: number, channel = 1) =>
  page.evaluate(([d, c, v, ch]) => window.fakeMidi.send(d, [0xb0 + ch - 1, c, v]), [
    device,
    controller,
    value,
    channel,
  ] as const)

export const note = (page: Page, device: string, pitch: number, on: boolean) =>
  page.evaluate(([d, p, o]) => window.fakeMidi.send(d, o ? [0x90, p, 100] : [0x80, p, 0]), [device, pitch, on] as const)
