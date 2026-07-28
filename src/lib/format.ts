/** "XPHB p. 364", or just "XPHB" when the page is unknown (e.g. homebrew). */
export function sourceLabel(source: string, page?: number): string {
  return page ? `${source} p. ${page}` : source
}

/**
 * "SRD 5.2.1 · XPHB p. 364" — where the entry came from, then where it is
 * printed. The bundled SRD and a purchased pack both cite the same book, so
 * the provenance is what tells them apart. Takes the already-formatted origin
 * text to keep lib/ independent of data/. The citation is dropped when it adds
 * nothing: homebrew always carries the placeholder source "HB".
 */
export function provenanceLabel(originText: string, source: string, page?: number): string {
  if (!source || source === 'HB') return originText
  return `${originText} · ${sourceLabel(source, page)}`
}
