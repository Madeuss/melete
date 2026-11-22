import { expect, it } from 'vitest'
import type { Story } from '../../schemas'
import { COMPETENCIES, coverage } from './coverage'

const story = (id: string, tags: string[]): Story => ({
  id,
  title: id,
  situation: '',
  task: '',
  action: '',
  result: '',
  tags,
  createdAt: '',
  updatedAt: '',
})

it('counts the stories per competency and lists the ones with none', () => {
  const c = coverage([
    story('outage', ['ownership', 'deadline', 'incident']),
    story('refactor', ['ownership', 'technical']),
  ])
  expect(c.counts.find((x) => x.competency === 'ownership')?.count).toBe(2)
  expect(c.counts.find((x) => x.competency === 'technical')?.count).toBe(1)
  expect(c.missing).toEqual(COMPETENCIES.filter((x) => !['ownership', 'deadline', 'technical'].includes(x)))
  // Custom tags like "incident" aren't competencies on the map.
  expect([...c.rows[0].covers]).toEqual(['ownership', 'deadline'])
})

it('marks every competency missing without stories', () => {
  expect(coverage([]).missing).toEqual([...COMPETENCIES])
})
