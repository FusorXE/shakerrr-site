// Display cleanup for imported references only. Personal and social entries
// must keep the words the user saved, including apologies and informal notes.
export function publishedNote(value) {
  if (typeof value !== "string") return "";
  const note = value.replace(/[\u00ad\u200b-\u200d\ufeff]/g, "").trim();
  if (!note) return "";

  // These are extraction/provenance failures, not information about the drink.
  if (
    /\b(?:apolog(?:y|ies|ize)|sorry)\b[\s\S]*\b(?:cannot|can['’]t|could not)\s+(?:recall|remember|extract|read|identify)\b/i.test(note) ||
    /^(?:as an ai\b|(?:sorry[, ]+)?i (?:cannot|can['’]t|am unable to) (?:extract|read|access|view)\b)/i.test(note) ||
    /^\[?(?:ocr|text extraction) (?:failed|error|unavailable)\]?\.?$/i.test(note)
  ) return "";

  // Known scrambled column extraction in the movie book. Do not reconstruct
  // the history or splice the fragments into an invented account.
  if (/^eparting slightly from the facts of history in \+ the name\b/i.test(note))
    return "";

  return note
    .replace(/\|(['’](?:ve|m|d|ll)\b)/g, "I$1")
    .replace(/\s*Bourbon became the preferred spirit only aft$/, "")
    .trim();
}
