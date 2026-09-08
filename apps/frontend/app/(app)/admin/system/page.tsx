import type { Metadata } from "next"
import fs from "node:fs"
import path from "node:path"

export const metadata: Metadata = { title: "System" }

export const dynamic = "force-dynamic"

const monoEyebrow =
  "font-mono text-xs font-medium uppercase tracking-[0.14em] text-emerald-300/80"

const Row = ({
  label,
  value,
}: {
  label: React.ReactNode
  value: React.ReactNode
}) => (
  <div className="flex items-start justify-between gap-6 border-b border-white/6 px-4 py-3 last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-right font-mono text-xs">{value}</span>
  </div>
)

const EnvStatus = ({ present }: { present: boolean }) =>
  present ? (
    <span className="text-emerald-300">set</span>
  ) : (
    <span className="text-amber-300">missing</span>
  )

// Operator-facing config status: which env keys exist (never values), where
// the database lives, and what is wired up. Values are never rendered.
export default function SystemPage() {
  const databasePath =
    process.env.DATABASE_URL ?? path.join(process.cwd(), "data", "app.sqlite")
  const databaseExists = fs.existsSync(databasePath)

  const env = [
    {
      key: "BETTER_AUTH_SECRET",
      present: Boolean(process.env.BETTER_AUTH_SECRET),
      required: true,
    },
    {
      key: "BETTER_AUTH_URL",
      present: Boolean(process.env.BETTER_AUTH_URL),
      required: false,
    },
    {
      key: "OPENROUTER_API_KEY",
      present: Boolean(process.env.OPENROUTER_API_KEY),
      required: true,
    },
    {
      key: "DATABASE_URL",
      present: Boolean(process.env.DATABASE_URL),
      required: false,
    },
    {
      key: "NEXT_PUBLIC_SITE_URL",
      present: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
      required: false,
    },
  ]

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Configuration status. Env values are never shown — only whether they
          are set.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <span className={monoEyebrow}>Environment</span>
        <div className="rounded-2xl border border-white/8">
          {env.map((item) => (
            <Row
              key={item.key}
              label={
                <>
                  {item.key}
                  {item.required && (
                    <span className="ml-1.5 text-xs text-muted-foreground/60">
                      required
                    </span>
                  )}
                </>
              }
              value={<EnvStatus present={item.present} />}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className={monoEyebrow}>Database</span>
        <div className="rounded-2xl border border-white/8">
          <Row label="Engine" value="SQLite (better-sqlite3)" />
          <Row
            label="Path"
            value={
              <span className="break-all text-muted-foreground">
                {databasePath}
              </span>
            }
          />
          <Row label="File" value={<EnvStatus present={databaseExists} />} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className={monoEyebrow}>Processes</span>
        <div className="rounded-2xl border border-white/8">
          <Row label="Frontend (Next.js)" value="this process" />
          <Row
            label="Automation engine"
            value={
              <span className="text-muted-foreground/70">
                apps/engine — not started from the console
              </span>
            }
          />
        </div>
      </section>
    </div>
  )
}
