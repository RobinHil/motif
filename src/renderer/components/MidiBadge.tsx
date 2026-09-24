/** "CC 21" next to a control mapped to a hardware controller (mockup 2-mixer.png). */
export function MidiBadge({ cc }: { cc: number | null }) {
  if (cc === null) return null
  return (
    <span
      title={`Controlled by CC ${String(cc)} of a MIDI controller`}
      className="rounded-xs bg-raised px-1.5 py-0.5 font-mono text-knob-value leading-tight text-accent"
    >
      CC {cc}
    </span>
  )
}
