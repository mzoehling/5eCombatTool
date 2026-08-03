/**
 * The drawer's navigation stack.
 *
 * Everything the DM looks up shares one surface, and looking something up from
 * inside something else is normal: a monster's attack references a spell, the
 * spell references a condition, the condition's text references a rule. That
 * used to be a pile of modals — `Modal` over `Modal` over `Modal`, each with its
 * own backdrop, where a tap outside closed an unpredictable number of them and
 * the thing you came from was hidden behind the thing you opened.
 *
 * A stack instead: pushing goes deeper, `‹` comes back out one step, and the
 * drawer shows the top of it.
 *
 * The stack holds only what was *pushed*. The statblock of whoever is selected
 * or acting is the floor beneath it, recomputed from battle state rather than
 * stored — otherwise coming back out would land on a statblock from two turns
 * ago.
 */
export type ReferenceView =
  | { kind: 'compendium' }
  | { kind: 'spell'; name: string }
  | { kind: 'item'; name: string }
  | { kind: 'rule'; name: string }
  | { kind: 'creature'; name: string }
  | { kind: 'condition'; name: string }

/**
 * Depth cap. Reference text cross-links in cycles — two spells that mention each
 * other are two taps apart forever — so the stack has to be bounded. Twelve is
 * far past any real trail and still cheap to hold.
 */
export const REFERENCE_DEPTH_LIMIT = 12

export function sameReference(a: ReferenceView, b: ReferenceView): boolean {
  if (a.kind !== b.kind) return false
  return a.kind === 'compendium' || b.kind === 'compendium' || a.name === b.name
}

/**
 * Pushes a view onto the stack.
 *
 * Re-opening what is already on top is a no-op: tag text repeats the same
 * reference in a paragraph, and tapping "Prone" twice should not need two taps
 * of `‹` to undo. At the depth limit the oldest step is dropped rather than the
 * push refused — being unable to follow a link would be the worse failure.
 */
export function pushReference(stack: readonly ReferenceView[], view: ReferenceView): ReferenceView[] {
  const top = stack.at(-1)
  if (top && sameReference(top, view)) return [...stack]
  const next = [...stack, view]
  return next.length > REFERENCE_DEPTH_LIMIT ? next.slice(next.length - REFERENCE_DEPTH_LIMIT) : next
}

/** Steps back out one level. Popping an empty stack is not an error — the caller
 *  is then already at the floor. */
export function popReference(stack: readonly ReferenceView[]): ReferenceView[] {
  return stack.slice(0, -1)
}

/** What the drawer's header calls this view. */
export function referenceTitle(view: ReferenceView): string {
  return view.kind === 'compendium' ? 'Compendium' : view.name
}
