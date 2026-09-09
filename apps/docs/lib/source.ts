import { loader } from "fumadocs-core/source"
import { defineDocs } from "fumadocs-mdx/macro"

// Macro API: the bundler compiles this call into imports of the content
// files — no codegen step and no generated `.source` folder.
const docs = defineDocs({
  dir: "content/docs",
})

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
})
