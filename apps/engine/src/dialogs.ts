/**
 * Browser-native dialog handling (window.confirm / alert / prompt).
 *
 * Legacy back-office applications gate risky submits on a native confirm
 * dialog (assignment §3.4: the engine must handle these deliberately). A
 * Playwright page with no dialog listener DISMISSES dialogs by default,
 * which silently cancels the submit — so both discovery and replay attach
 * this handler and answer per operator policy (`policy.dialogHandling`).
 *
 * Every handled dialog is logged to the run evidence as a `dialog` step so
 * the graded run log shows the dialog was seen and how it was answered.
 */
import type { Page } from "playwright"
import type { Policy } from "./policy.js"
import type { EvidenceWriter } from "./evidence.js"

/**
 * Attach the policy-driven dialog handler to a page. Returns immediately;
 * the handler lives for the page's lifetime.
 */
export const attachDialogHandler = (
  page: Page,
  policy: Policy,
  evidence: EvidenceWriter,
  runId: string
): void => {
  page.on("dialog", (dialog) => {
    const accepted = policy.dialogHandling === "accept"
    const at = new Date().toISOString()
    // Handle first, then log — a slow disk write must not hold the dialog open.
    const handled = accepted ? dialog.accept() : dialog.dismiss()
    void handled
      .then(() => {
        evidence.logStep({
          runId,
          stepIndex: -1,
          at,
          action: "dialog",
          target: dialog.type(),
          reason: `native ${dialog.type()} dialog ${accepted ? "accepted" : "dismissed"} per policy: "${dialog.message()}"`,
          durationMs: 0,
          result: "ok",
        })
      })
      .catch(() => undefined)
  })
}
