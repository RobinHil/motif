import { APP_NAME, APP_TAGLINE } from '@shared/app-info'

export function App() {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-2 bg-bg-app">
      <h1 className="text-screen-title font-medium tracking-tight">
        {APP_NAME.toLowerCase()}
        <span className="text-accent">.</span>
      </h1>
      <p className="text-small text-label">{APP_TAGLINE}</p>
    </main>
  )
}
