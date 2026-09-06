import { describe, expect, it } from 'vitest'
import { createCoSourceApplication } from './cosource-application'

function fixture() {
  let nextId = 0
  return createCoSourceApplication({
    market: { country: 'GB', currency: 'GBP', language: 'en-GB' },
    makeId: () => `id-${++nextId}`,
    catalog: {
      search: async () => ({ products: [], messages: [], pagination: { hasMore: false } }),
      product: async () => { throw new Error('unused') },
    },
  })
}

describe('application resource requirement projection', () => {
  it('has no second requirement before human commitment', () => {
    const application = fixture()
    application.editGoal({ summary: 'Draft only', searchFocus: 'equipment' })
    expect(application.getActiveResourceRequirement()).toMatchObject({
      ok: false,
      code: 'invalid_state',
    })
  })

  it('tracks only committed goal identity and revision across edits and commits', () => {
    const application = fixture()
    application.editGoal({ summary: 'Initial requirement', searchFocus: 'equipment' })
    application.commitGoalDraft()
    const initial = application.getActiveResourceRequirement()
    expect(initial.ok).toBe(true)
    if (!initial.ok) return

    application.editGoal({ summary: 'Uncommitted change' })
    expect(application.getActiveResourceRequirement()).toEqual(initial)

    application.editGoal({ summary: 'Initial requirement' })
    application.commitGoalDraft()
    expect(application.getActiveResourceRequirement()).toEqual(initial)

    application.editGoal({ summary: 'Meaningfully changed requirement' })
    application.commitGoalDraft()
    const changed = application.getActiveResourceRequirement()
    expect(changed).toMatchObject({
      ok: true,
      value: { id: initial.value.id, revision: initial.value.revision + 1 },
    })
  })
})
