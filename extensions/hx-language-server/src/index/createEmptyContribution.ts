import { REFERENCE_TYPES } from "@heleonix/hx-language"
import { IIndexContribution } from "./IIndexContribution"

/** Creates an empty {@link IIndexContribution} for sources to populate. */
export function createEmptyContribution(): IIndexContribution {
  const references = {} as IIndexContribution["references"]
  const entryReferrers = {} as IIndexContribution["entryReferrers"]
  const entryDocs = {} as IIndexContribution["entryDocs"]

  for (const kind of REFERENCE_TYPES) {
    references[kind] = {}
    entryReferrers[kind] = {}
    entryDocs[kind] = {}
  }

  return {
    components: [],
    tagProperties: {},
    usedTags: {},
    references,
    entryReferrers,
    componentState: {},
    entryParameters: {},
    namedControls: {},
    componentDocs: {},
    entryDocs,
  }
}
