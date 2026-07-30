import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { FIXTURE_FILES } from '../../scripts/env'

export const fixturesDir = resolve(import.meta.dirname, '..', '..', 'fixtures')

export const missingFixtures = FIXTURE_FILES.filter((f) => !existsSync(resolve(fixturesDir, f)))

/**
 * True only when every fixture the suites read is on disk.
 *
 * This used to be a check for the bestiary alone, so a half-populated
 * `fixtures/` — an interrupted fetch, or the list growing after someone last
 * ran it — read as "present", and the suites then died on the first missing
 * file with a raw ENOENT during collection. A local `npm test` that always
 * shows two failures teaches you to ignore failures, which is the opposite of
 * what it is for.
 *
 * Checking the same list `fetch-fixtures` downloads means the two cannot drift.
 */
export const hasFixtures = missingFixtures.length === 0

/** Optional locally, required in CI — the deploy is gated on these suites. */
export function assertFixturesInCI(): void {
  if (!hasFixtures && process.env.CI) {
    throw new Error(
      `Fixtures are required in CI — run \`npm run fetch-fixtures\` first. Missing: ${missingFixtures.join(', ')}`,
    )
  }
}

/** One-line reason, for the skipped suites to name themselves. */
export const skipReason = `fixtures missing (${missingFixtures.length} of ${FIXTURE_FILES.length}) — run \`npm run fetch-fixtures\``
