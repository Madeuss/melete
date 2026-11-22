import { useLiveQuery } from 'dexie-react-hooks'
import { getRepositories } from './repositories'

/*
 * Live views for components. They only call repositories (which parse everything),
 * and re-render when the underlying tables change. `undefined` means still loading.
 */

export function useStories() {
  return useLiveQuery(() => getRepositories().stories.list(), [])
}

export function useStory(id: string | undefined) {
  return useLiveQuery(() => (id ? getRepositories().stories.get(id) : undefined), [id])
}

export function useAllTags() {
  return useLiveQuery(() => getRepositories().stories.allTags(), [])
}

export function useSessions() {
  return useLiveQuery(() => getRepositories().sessions.list(), [])
}

export function useSession(id: string | undefined) {
  return useLiveQuery(() => (id ? getRepositories().sessions.get(id) : undefined), [id])
}

export function useTurns(sessionId: string | undefined) {
  return useLiveQuery(() => (sessionId ? getRepositories().turns.listBySession(sessionId) : []), [sessionId])
}
