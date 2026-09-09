import Link from "next/link"

const cards = [
  {
    step: "01 — Discovery",
    title: "The model drives once",
    body: "An LLM drives a real browser through a back-office flow — observing the accessibility tree, one structured model call per step — until it reaches the goal.",
  },
  {
    step: "02 — Artifact",
    title: "The run becomes a contract",
    body: "The successful run is distilled into a typed, versioned capability artifact: inputs, outputs, locator fallbacks, checkpoints, expected business outcomes. A human reviews it before risky use.",
  },
  {
    step: "03 — Replay",
    title: "Zero model calls",
    body: "A calling agent invokes the capability with typed inputs and gets back typed outputs, a known business outcome, or a debuggable failure — deterministically.",
  },
] as const

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-col items-center px-6 pt-24 pb-16 text-center sm:pt-32">
        <p className="font-mono text-xs font-medium tracking-[0.14em] text-[#34D399] uppercase">
          <span className="mr-2 text-[#10B981]">●</span>
          BankGPT — computer-use automation
        </p>
        <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
          Give an AI agent <span className="text-brand-gradient">hands</span>{" "}
          inside apps with no API.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-fd-muted-foreground">
          Discover a back-office UI flow once with an LLM, distill it into a
          typed capability artifact, then replay it deterministically — with
          human approval for risky actions and live-session handoff when
          automation gets stuck.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/docs"
            className="inline-flex items-center rounded-full bg-gradient-to-b from-[#10B981] to-[#059669] px-6 py-3 text-sm font-semibold text-[#042F23] shadow-[0_6px_24px_#10B98147] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_#10B98161]"
          >
            Read the docs
          </Link>
          <Link
            href="/docs/running-locally"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/3 px-6 py-3 text-sm font-medium text-fd-foreground transition hover:border-[#6366F173] hover:bg-[#6366F114] hover:text-[#818CF8]"
          >
            Run it locally
          </Link>
        </div>
      </section>
      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.step}
            className="rounded-2xl border border-fd-border bg-fd-card p-6 text-left shadow-[0_18px_50px_-24px_#000000A6] transition hover:border-white/12 hover:shadow-[0_24px_60px_-20px_#10B9811F,0_18px_50px_-24px_#0000008C]"
          >
            <p className="font-mono text-xs font-medium tracking-[0.14em] text-[#34D399] uppercase">
              {card.step}
            </p>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">
              {card.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
              {card.body}
            </p>
          </div>
        ))}
      </section>
    </main>
  )
}
