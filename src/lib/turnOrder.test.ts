import { describe, expect, it } from 'vitest'
import { upNext } from './turnOrder'

const order = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('upNext', () => {
  it('drops whoever is acting and everyone before them', () => {
    expect(upNext(order, 'b')).toEqual([{ id: 'c' }])
  })

  it('is empty on the last turn of the round', () => {
    expect(upNext(order, 'c')).toEqual([])
  })

  it('shows the whole order before the battle starts', () => {
    expect(upNext(order, null)).toEqual(order)
  })

  it('shows the whole order when the active id is stale', () => {
    expect(upNext(order, 'gone')).toEqual(order)
  })
})
