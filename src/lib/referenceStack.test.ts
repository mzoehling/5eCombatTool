import { describe, expect, it } from 'vitest'
import {
  popReference,
  pushReference,
  REFERENCE_DEPTH_LIMIT,
  referenceTitle,
  sameReference,
  type ReferenceView,
} from './referenceStack'

const spell = (name: string): ReferenceView => ({ kind: 'spell', name })
const item = (name: string): ReferenceView => ({ kind: 'item', name })
const compendium: ReferenceView = { kind: 'compendium' }

describe('pushReference', () => {
  it('goes deeper', () => {
    expect(pushReference([], spell('Fireball'))).toEqual([spell('Fireball')])
    expect(pushReference([spell('Fireball')], item('Wand'))).toEqual([spell('Fireball'), item('Wand')])
  })

  it('ignores re-opening what is already on top', () => {
    // Tag text repeats the same reference within a paragraph; tapping it twice
    // must not cost two taps of back.
    const stack = [spell('Fireball')]
    expect(pushReference(stack, spell('Fireball'))).toEqual(stack)
  })

  it('allows the same entry again deeper in the trail', () => {
    // Two spells that mention each other are a legitimate there-and-back.
    const stack = pushReference(pushReference([spell('Fireball')], spell('Fire Shield')), spell('Fireball'))
    expect(stack).toEqual([spell('Fireball'), spell('Fire Shield'), spell('Fireball')])
  })

  it('tells two kinds with the same name apart', () => {
    const stack = pushReference([spell('Shield')], item('Shield'))
    expect(stack).toHaveLength(2)
  })

  it('drops the oldest step at the depth limit rather than refusing the push', () => {
    // Reference text cross-links in cycles, so the stack must be bounded — but
    // being unable to follow a link is the worse failure.
    let stack: ReferenceView[] = []
    for (let i = 0; i < REFERENCE_DEPTH_LIMIT + 5; i++) stack = pushReference(stack, spell(`S${i}`))
    expect(stack).toHaveLength(REFERENCE_DEPTH_LIMIT)
    expect(stack.at(-1)).toEqual(spell(`S${REFERENCE_DEPTH_LIMIT + 4}`))
    expect(stack[0]).toEqual(spell('S5'))
  })

  it('does not mutate the stack it was given', () => {
    const stack = [spell('Fireball')]
    pushReference(stack, item('Wand'))
    expect(stack).toEqual([spell('Fireball')])
  })
})

describe('popReference', () => {
  it('steps back out one level', () => {
    expect(popReference([spell('Fireball'), item('Wand')])).toEqual([spell('Fireball')])
  })

  it('empties to the floor, where the selected combatant statblock lives', () => {
    expect(popReference([spell('Fireball')])).toEqual([])
  })

  it('treats popping an empty stack as already being at the floor', () => {
    expect(popReference([])).toEqual([])
  })
})

describe('sameReference', () => {
  it('matches on kind and name', () => {
    expect(sameReference(spell('Fireball'), spell('Fireball'))).toBe(true)
    expect(sameReference(spell('Fireball'), spell('Ice Knife'))).toBe(false)
    expect(sameReference(spell('Shield'), item('Shield'))).toBe(false)
  })

  it('treats the compendium as one place, since it has no name', () => {
    expect(sameReference(compendium, compendium)).toBe(true)
    expect(sameReference(compendium, spell('Fireball'))).toBe(false)
  })
})

describe('referenceTitle', () => {
  it('names an entry by its own name', () => {
    expect(referenceTitle(spell('Fireball'))).toBe('Fireball')
  })

  it('names the compendium', () => {
    expect(referenceTitle(compendium)).toBe('Compendium')
  })
})
