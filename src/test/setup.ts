import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library can't register its auto-cleanup.
afterEach(() => cleanup())
