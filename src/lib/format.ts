/** "XPHB p. 364", or just "XPHB" when the page is unknown (e.g. homebrew). */
export function sourceLabel(source: string, page?: number): string {
  return page ? `${source} p. ${page}` : source
}
