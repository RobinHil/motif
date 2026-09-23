// Project data model (docs/SPEC.md, section 3). The schemas validate projects read from disk;
// the TypeScript types are inferred from them so both never drift apart.
//
// Every string that codegen writes into Strudel code is constrained here, because generated code
// is executed: a crafted project must not be able to break out of a mini-notation string.
import { z } from 'zod'

export const PROJECT_VERSION = 1
export const STEPS_PER_CYCLE = 16

/** Sample or sound name inside mini-notation: `bd`, `gm_piano`, `RolandTR909_bd`. */
export const SOUND_NAME = /^[A-Za-z0-9_-]+$/
/** Note name: `c3`, `eb3`, `f#4`, `C-1`. */
export const NOTE_NAME = /^[a-gA-G](?:#|b|s)*-?\d{0,2}$/
/** Scale for `.scale()`: `C:minor`, `D4:major:pentatonic`. */
export const SCALE_NAME = /^[A-Ga-g][#b]?\d?:[a-z0-9]+(?::[a-z0-9]+)*$/
export const VOWEL = /^[a-z]{1,2}$/

const id = z.string().min(1).max(64)
const unit = z.number().min(0).max(1)
// zod 4 numbers reject Infinity and NaN.
const finite = z.number()
const soundName = z.string().regex(SOUND_NAME)

export const TRACK_COLORS = ['track-1', 'track-2', 'track-3', 'track-4'] as const
export const TrackColorSchema = z.enum(TRACK_COLORS)

export const SIGNAL_SHAPES = ['sine', 'tri', 'saw', 'isaw', 'square', 'perlin', 'rand'] as const

export const ModulationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('signal'),
    shape: z.enum(SIGNAL_SHAPES),
    min: finite,
    max: finite,
    cycles: z.number().positive().max(1024),
  }),
  z.object({ kind: z.literal('sequence'), values: z.array(finite).min(1).max(64) }),
])

export const ParamValueSchema = z.union([finite, ModulationSchema])

/** Keys in the order codegen writes them (SPEC 4, rule 4). */
export const PARAM_ORDER = [
  'gain',
  'pan',
  'lpf',
  'lpq',
  'hpf',
  'room',
  'size',
  'delay',
  'delaytime',
  'delayfeedback',
  'shape',
  'crush',
  'coarse',
  'speed',
  'vowel',
  'attack',
  'decay',
  'sustain',
  'release',
  'begin',
  'end',
] as const

export const TrackParamsSchema = z.object({
  gain: ParamValueSchema,
  pan: ParamValueSchema,
  lpf: ParamValueSchema.optional(),
  lpq: ParamValueSchema.optional(),
  hpf: ParamValueSchema.optional(),
  room: ParamValueSchema.optional(),
  size: ParamValueSchema.optional(),
  delay: ParamValueSchema.optional(),
  delaytime: ParamValueSchema.optional(),
  delayfeedback: ParamValueSchema.optional(),
  shape: ParamValueSchema.optional(),
  crush: ParamValueSchema.optional(),
  coarse: ParamValueSchema.optional(),
  speed: ParamValueSchema.optional(),
  vowel: z.string().regex(VOWEL).optional(),
  attack: ParamValueSchema.optional(),
  decay: ParamValueSchema.optional(),
  sustain: ParamValueSchema.optional(),
  release: ParamValueSchema.optional(),
  begin: ParamValueSchema.optional(),
  end: ParamValueSchema.optional(),
})

export const SoundSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bank'), bank: soundName }),
  z.object({ type: z.literal('synth'), name: soundName }),
  z.object({ type: z.literal('sample'), name: soundName }),
  z.object({ type: z.literal('soundfont'), name: soundName }),
])

export const TRANSFORM_TYPES = [
  'fast',
  'slow',
  'rev',
  'jux',
  'ply',
  'degradeBy',
  'sometimes',
  'lastOf',
  'chop',
  'striate',
  'slice',
  'loopAt',
  'custom',
] as const

export const TransformInstanceSchema = z.object({
  id,
  type: z.enum(TRANSFORM_TYPES),
  args: z.record(z.string(), z.union([finite, z.string().max(4000)])),
  enabled: z.boolean(),
})

export const StepSchema = z.object({ velocity: unit, probability: unit })

export const StepRowSchema = z.object({
  id,
  sound: soundName,
  variant: z.number().int().min(0).max(999).optional(),
  steps: z.array(StepSchema.nullable()).length(STEPS_PER_CYCLE),
})

export const StepContentSchema = z.object({
  stepsPerCycle: z.literal(STEPS_PER_CYCLE),
  rows: z.array(StepRowSchema).max(64),
})

const pitch = z.union([z.string().regex(NOTE_NAME), z.number().int().min(-128).max(128)])

export const NoteSchema = z
  .object({
    id,
    step: z
      .number()
      .int()
      .min(0)
      .max(STEPS_PER_CYCLE - 1),
    length: z.number().int().min(1).max(STEPS_PER_CYCLE),
    pitch,
    velocity: unit,
    probability: unit,
    alternatives: z.array(pitch).max(16).optional(),
  })
  .refine((note) => note.step + note.length <= STEPS_PER_CYCLE, { message: 'Note extends past the cycle' })

export const NoteContentSchema = z
  .object({
    mode: z.enum(['note', 'degree']),
    scale: z.string().regex(SCALE_NAME).optional(),
    stepsPerCycle: z.literal(STEPS_PER_CYCLE),
    notes: z.array(NoteSchema).max(512),
  })
  .refine((content) => content.mode === 'note' || content.scale !== undefined, {
    message: 'A scale is required in degree mode',
  })

export const TrackSchema = z.object({
  id,
  name: z.string().max(100),
  color: TrackColorSchema,
  orbit: z.number().int().min(1).max(64),
  kind: z.enum(['steps', 'notes', 'code']),
  mute: z.boolean(),
  solo: z.boolean(),
  source: SoundSourceSchema,
  params: TrackParamsSchema,
  transforms: z.array(TransformInstanceSchema).max(32),
  steps: StepContentSchema.optional(),
  notes: NoteContentSchema.optional(),
  code: z.string().max(100_000).optional(),
})

export const SceneSchema = z.object({
  id,
  name: z.string().max(100),
  lengthCycles: z.number().int().min(1).max(4096),
  activeTrackIds: z.array(id),
})

export const ArrangementBlockSchema = z.object({ id, sceneId: id, startCycle: z.number().int().min(0) })

export const AutomationSchema = z.object({
  id,
  target: z.object({
    trackId: z.union([id, z.literal('master')]),
    param: z.enum(PARAM_ORDER).exclude(['vowel']),
  }),
  points: z.array(z.object({ cycle: z.number().min(0), value: finite })).max(4096),
})

export const MasterSettingsSchema = z.object({
  gain: z.number().min(0).max(2),
  compressor: z.boolean(),
  limiter: z.boolean(),
})

export const SampleEntrySchema = z.object({
  name: soundName,
  files: z.array(z.string().max(1024)).max(1000),
  origin: z.enum(['bundled', 'user']),
  folder: z.string().max(1024).optional(),
})

export const MidiMappingSchema = z.object({
  deviceName: z.string().max(200),
  channel: z.number().int().min(0).max(16),
  cc: z.number().int().min(0).max(127),
  target: z.object({ trackId: z.union([id, z.literal('master')]), param: z.string().max(64) }),
})

export const ProjectSchema = z
  .object({
    version: z.literal(PROJECT_VERSION),
    meta: z.object({ name: z.string().max(200), createdAt: z.string(), updatedAt: z.string() }),
    transport: z.object({
      bpm: z.number().min(20).max(400),
      beatsPerCycle: z.number().int().min(1).max(32),
    }),
    tracks: z.array(TrackSchema).max(128),
    scenes: z.array(SceneSchema),
    arrangement: z.array(ArrangementBlockSchema),
    automations: z.array(AutomationSchema),
    master: MasterSettingsSchema,
    sampleLibrary: z.array(SampleEntrySchema),
    midiMappings: z.array(MidiMappingSchema),
  })
  .superRefine((project, ctx) => {
    const ids = new Set<string>()
    const orbits = new Set<number>()
    project.tracks.forEach((track, index) => {
      if (ids.has(track.id)) ctx.addIssue({ code: 'custom', message: 'Duplicate track id', path: ['tracks', index] })
      if (orbits.has(track.orbit))
        ctx.addIssue({ code: 'custom', message: 'Orbit used by two tracks', path: ['tracks', index, 'orbit'] })
      ids.add(track.id)
      orbits.add(track.orbit)
      const content = { steps: track.steps, notes: track.notes, code: track.code }[track.kind]
      if (content === undefined)
        ctx.addIssue({ code: 'custom', message: `Missing ${track.kind} content`, path: ['tracks', index] })
    })
  })

export type ID = string
export type TrackColor = z.infer<typeof TrackColorSchema>
export type Modulation = z.infer<typeof ModulationSchema>
export type SignalShape = (typeof SIGNAL_SHAPES)[number]
export type ParamValue = z.infer<typeof ParamValueSchema>
export type TrackParams = z.infer<typeof TrackParamsSchema>
export type ParamKey = (typeof PARAM_ORDER)[number]
export type SoundSource = z.infer<typeof SoundSourceSchema>
export type TransformType = (typeof TRANSFORM_TYPES)[number]
export type TransformInstance = z.infer<typeof TransformInstanceSchema>
export type Step = z.infer<typeof StepSchema>
export type StepRow = z.infer<typeof StepRowSchema>
export type StepContent = z.infer<typeof StepContentSchema>
export type Note = z.infer<typeof NoteSchema>
export type NoteContent = z.infer<typeof NoteContentSchema>
export type Track = z.infer<typeof TrackSchema>
export type TrackKind = Track['kind']
export type Scene = z.infer<typeof SceneSchema>
export type ArrangementBlock = z.infer<typeof ArrangementBlockSchema>
export type Automation = z.infer<typeof AutomationSchema>
export type MasterSettings = z.infer<typeof MasterSettingsSchema>
export type SampleEntry = z.infer<typeof SampleEntrySchema>
export type MidiMapping = z.infer<typeof MidiMappingSchema>
export type Project = z.infer<typeof ProjectSchema>
