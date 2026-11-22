import { useLiveQuery } from 'dexie-react-hooks'
import { sessionAverage } from '../interview/stats'
import { getRepositories } from './repositories'

/*
 * Live views for components. They only call repositories (which parse everything),
 * and re-render when the underlying tables change. `undefined` means still loading;
 * single-item hooks return `null` when the item doesn't exist.
 */

export function useStories() {
  return useLiveQuery(() => getRepositories().stories.list(), [])
}

export function useStory(id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await getRepositories().stories.get(id)) ?? null) : null), [id])
}

export function useAllTags() {
  return useLiveQuery(() => getRepositories().stories.allTags(), [])
}

export function useSessions() {
  return useLiveQuery(() => getRepositories().sessions.list(), [])
}

export function useSession(id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await getRepositories().sessions.get(id)) ?? null) : null), [id])
}

export function useTurns(sessionId: string | undefined) {
  return useLiveQuery(() => (sessionId ? getRepositories().turns.listBySession(sessionId) : []), [sessionId])
}

/** Sessions with answer count and average score, newest first. */
export function useHistory() {
  return useLiveQuery(async () => {
    const repos = getRepositories()
    const sessions = await repos.sessions.list()
    return Promise.all(
      sessions.map(async (session) => {
        const turns = await repos.turns.listBySession(session.id)
        return { session, answers: turns.length, average: sessionAverage(turns) }
      }),
    )
  }, [])
}
