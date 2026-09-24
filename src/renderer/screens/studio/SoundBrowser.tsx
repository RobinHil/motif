import { useMemo, useState, type DragEvent } from 'react'
import type { ImportResult } from '@shared/ipc'
import { dragBank, dragSound } from '../../app/drag-data'
import { finishImport } from '../../app/sample-library'
import { CATEGORIES, previewValue, useCatalog, type CatalogSound, type Category } from '../../app/sound-catalog'
import { previewSound } from '../../engine/engine'
import { dropOnTrack } from '../../store/actions'
import { projectStore } from '../../store/project-store'
import { uiStore } from '../../store/ui-store'
import { ContextMenu, type MenuPosition } from '../../components/ContextMenu'

function applyToSelectedTrack(dropped: Parameters<typeof dropOnTrack>[1]) {
  const trackId = uiStore.getState().selectedTrackId
  if (trackId === null) {
    uiStore.getState().setNotice('Select a track first.')
    return
  }
  projectStore.getState().update(dropOnTrack(trackId, dropped))
}

function SoundRow({ sound }: { sound: CatalogSound }) {
  return (
    <li
      draggable
      onDragStart={(event) => dragSound(event, sound)}
      className="group flex items-center gap-3 rounded-control px-2 py-1.5 hover:bg-raised-2"
    >
      <button
        type="button"
        aria-label={`Preview ${sound.name}`}
        title={`Preview s("${sound.name}")`}
        onClick={() => void previewSound(previewValue(sound))}
        className="grid size-7 shrink-0 place-items-center rounded-pill border border-line-strong text-text hover:border-text-2"
      >
        <svg aria-hidden="true" viewBox="0 0 10 10" className="ml-0.5 size-2.5 fill-current">
          <path d="M2 1 L9 5 L2 9 Z" />
        </svg>
      </button>
      <span className="flex-1 font-mono text-body text-text">
        {sound.name}
        {sound.category === 'My samples' && sound.variants !== undefined && sound.variants > 1 && (
          <span className="ml-2 font-sans text-small text-text-2">{sound.variants} variants</span>
        )}
      </span>
      <button
        type="button"
        onClick={() => applyToSelectedTrack({ kind: 'sound', name: sound.name, category: sound.category })}
        title="Use on the selected track (or drag it onto a track)"
        className="hidden rounded-xs px-1.5 text-small text-accent group-focus-within:inline group-hover:inline"
      >
        Use
      </button>
      <span className="text-small text-text-2 group-focus-within:hidden group-hover:hidden">{sound.category}</span>
    </li>
  )
}

const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files')

/** Left panel: search, categories, drum banks and sounds with one-click preview (SPEC 6.1). */
export function SoundBrowser() {
  const catalog = useCatalog()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>('All')
  const [importMenu, setImportMenu] = useState<MenuPosition | null>(null)
  const [busy, setBusy] = useState(false)
  const [dropping, setDropping] = useState(false)

  const runImport = async (pending: Promise<ImportResult | null>) => {
    setBusy(true)
    try {
      const done = await finishImport(await pending)
      if (done === null) return
      uiStore.getState().setNotice(done.message)
      if (done.added.length > 0) {
        setCategory('My samples')
        setQuery('')
      }
    } catch (error) {
      uiStore.getState().setNotice(`Import failed: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  const sounds = useMemo(() => {
    const q = query.trim().toLowerCase()
    return catalog.sounds.filter(
      (s) => (category === 'All' || s.category === category) && (q === '' || s.name.toLowerCase().includes(q)),
    )
  }, [catalog, query, category])
  const banks = catalog.banks.filter(
    (b) => (category === 'All' || category === 'Drums') && b.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const folders = category === 'My samples' ? [...new Set(sounds.map((s) => s.folder ?? ''))] : null

  return (
    <aside
      aria-labelledby="browser-title"
      aria-busy={busy}
      onDragOver={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropping(false)
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        setDropping(false)
        void runImport(window.motif.samples.importFiles([...event.dataTransfer.files]))
      }}
      className={`flex min-h-0 flex-col gap-5 overflow-y-auto border-r bg-panel p-5 ${dropping ? 'border-accent' : 'border-line'}`}
    >
      <div className="flex items-center justify-between">
        <h2 id="browser-title" className="text-section font-medium uppercase tracking-[0.14em] text-label">
          Sound browser
        </h2>
        <button
          type="button"
          aria-haspopup="menu"
          disabled={busy}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            setImportMenu({ x: rect.left, y: rect.bottom + 4 })
          }}
          className="rounded-pill border border-line-strong px-3 py-1 text-body text-text-2 hover:text-text disabled:opacity-40"
        >
          {busy ? 'Importing...' : 'Import'}
        </button>
        {importMenu && (
          <ContextMenu
            label="Import samples"
            position={importMenu}
            onClose={() => setImportMenu(null)}
            items={[
              { label: 'Sample files...', onSelect: () => void runImport(window.motif.samples.importDialog('files')) },
              {
                label: 'A folder (one sound, one variant per file)...',
                onSelect: () => void runImport(window.motif.samples.importDialog('folder')),
              },
            ]}
          />
        )}
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-body text-text-2">Search sounds</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="kick, synth, wind..."
          className="h-10 rounded-input border border-line bg-bg-code px-3 text-body text-text outline-none placeholder:text-text-3 focus-visible:border-line-strong"
        />
      </label>
      <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={`rounded-pill border px-3 py-1 text-body ${category === c ? 'border-transparent bg-pill-active text-text' : 'border-line-strong text-text-2 hover:text-text'}`}
          >
            {c}
          </button>
        ))}
      </div>
      {banks.length > 0 && (
        <section aria-labelledby="banks-title" className="flex flex-col gap-2">
          <h3 id="banks-title" className="text-body text-text-2">
            Drum banks
          </h3>
          <ul className="flex flex-col gap-1.5">
            {banks.map((bank) => (
              <li
                key={bank}
                draggable
                onDragStart={(event) => dragBank(event, bank)}
                className="group flex items-center justify-between rounded-control bg-raised-2 px-3 py-2"
              >
                <span className="font-mono text-body text-text">{bank}</span>
                <button
                  type="button"
                  onClick={() => applyToSelectedTrack({ kind: 'bank', bank })}
                  title={`Use .bank("${bank}") on the selected rhythm track`}
                  className="text-small text-text-2 hover:text-accent"
                >
                  bank
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="sounds-title" className="flex flex-col gap-2">
        <h3 id="sounds-title" className="text-body text-text-2">
          Sounds
        </h3>
        <ul className="flex flex-col">
          {folders
            ? folders.map((folder) => (
                <li key={folder} className="flex flex-col">
                  <span className="px-2 pt-2 pb-1 text-small text-text-3">{folder || 'Imported'}</span>
                  <ul className="flex flex-col">
                    {sounds
                      .filter((s) => (s.folder ?? '') === folder)
                      .map((sound) => (
                        <SoundRow key={`${sound.category}-${sound.name}`} sound={sound} />
                      ))}
                  </ul>
                </li>
              ))
            : sounds.map((sound) => <SoundRow key={`${sound.category}-${sound.name}`} sound={sound} />)}
          {sounds.length === 0 && (
            <li className="px-2 py-1.5 text-body text-text-3">
              {category === 'My samples'
                ? 'Your imported samples will appear here. Drop files or a folder, or use Import.'
                : 'No sound matches this search.'}
            </li>
          )}
        </ul>
      </section>
      <div
        className={`mt-auto rounded-panel border border-dashed px-4 py-4 text-center text-body ${dropping ? 'border-accent text-text' : 'border-line-strong text-text-2'}`}
      >
        {busy ? 'Importing...' : 'Drop a sample folder here to add it to your library'}
      </div>
    </aside>
  )
}
