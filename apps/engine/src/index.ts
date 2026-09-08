// Entry point for the automation engine service.
// The engine owns discovery runs (LLM observe -> decide -> act), deterministic
// replay of saved capability artifacts, and the pause/cede/resume control
// channel for human handoff. The computer-use stack and the frontend <->
// engine transport are intentionally not chosen yet — see
// context/thought-process.md and context/what-we-are-building.md.
const main = () => {
  console.log("engine: scaffold ready — automation stack not yet selected")
}

main()
