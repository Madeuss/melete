import { Suspense, lazy, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AppLayout } from './AppLayout'
import { SettingsProvider } from './SettingsProvider'
import { useSettings } from './settingsContext'

const SettingsPage = lazy(() => import('../features/settings/SettingsPage'))
const StoriesPage = lazy(() => import('../features/stories/StoriesPage'))
const StoryEditorPage = lazy(() => import('../features/stories/StoryEditorPage'))
const NewInterviewPage = lazy(() => import('../features/new-interview/NewInterviewPage'))
const InterviewRoomPage = lazy(() => import('../features/interview-room/InterviewRoomPage'))
const ReportPage = lazy(() => import('../features/report/ReportPage'))
const HistoryPage = lazy(() => import('../features/history/HistoryPage'))
const PitchPage = lazy(() => import('../features/pitch/PitchPage'))
const ProfilePage = lazy(() => import('../features/profile/ProfilePage'))
// Dev-only: behind import.meta.env.DEV so production builds drop it.
const StyleguidePage = import.meta.env.DEV ? lazy(() => import('../features/styleguide/StyleguidePage')) : null

function Loading() {
  const { t } = useTranslation()
  return (
    <p className="p-8 text-sm text-text-subtle" role="status">
      {t('app.loading')}
    </p>
  )
}

/** Without a configured provider the app opens on Settings. */
function RequireProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  return settings.llm ? children : <Navigate to="/settings" replace />
}

export function App() {
  return (
    <SettingsProvider fallback={<Loading />}>
      <HashRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            {StyleguidePage && <Route path="/styleguide" element={<StyleguidePage />} />}
            <Route
              path="/interview/:sessionId"
              element={
                <RequireProvider>
                  <InterviewRoomPage />
                </RequireProvider>
              }
            />
            <Route element={<AppLayout />}>
              <Route
                index
                element={
                  <RequireProvider>
                    <Navigate to="/new" replace />
                  </RequireProvider>
                }
              />
              <Route
                path="/new"
                element={
                  <RequireProvider>
                    <NewInterviewPage />
                  </RequireProvider>
                }
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/stories" element={<StoriesPage />} />
              <Route path="/stories/new" element={<StoryEditorPage />} />
              <Route path="/stories/:storyId" element={<StoryEditorPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/pitch" element={<PitchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/report/:sessionId" element={<ReportPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </SettingsProvider>
  )
}
