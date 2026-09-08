import { ConstructionIcon } from "lucide-react"

type PageStubProps = {
  title: string
  description: string
  planned: readonly string[]
}

// Placeholder for admin surfaces that exist as routes but whose features
// depend on the automation engine (apps/engine). Documents what is planned
// so the console navigation is complete while the engine is built.
export const PageStub = ({ title, description, planned }: PageStubProps) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/12 bg-card/40 p-6">
      <div className="flex items-center gap-2">
        <ConstructionIcon className="size-4 text-emerald-300" />
        <span className="font-mono text-xs font-medium tracking-[0.14em] text-emerald-300/80 uppercase">
          Planned
        </span>
      </div>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
        {planned.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground/70">
        Lands with the automation engine (apps/engine) — see
        context/what-we-are-building.md.
      </p>
    </div>
  </div>
)
