import { AlertIcon } from '@/components/icons'

const STEPS = [
  'Create a project at supabase.com, then open Project Settings → API.',
  'Copy .env.example to .env.local in the project root.',
  'Paste the Project URL into VITE_SUPABASE_URL and the anon (publishable) key into VITE_SUPABASE_ANON_KEY.',
  'Run the SQL in supabase/migrations, in file order, from the SQL editor.',
  'Restart npm run dev.',
]

export function SetupScreen() {
  return (
    <div className="flex min-h-full items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2 text-p2">
          <AlertIcon size={18} />
          <h1 className="text-base font-semibold text-ink">Supabase isn’t configured</h1>
        </div>
        <ol className="space-y-3 text-sm text-muted">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface2 font-mono text-2xs text-ink">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-faint">
          The anon key is the only key this app should ever see. Keep the service_role
          key out of the client and out of the repo.
        </p>
      </div>
    </div>
  )
}
