import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { formatDate, formatNumber } from '../../app/format'
import { listeningSummary, sessionAverage } from '../../interview/stats'
import type { Turn } from '../../schemas'
import { useLlmCalls, useSession, useTurns } from '../../storage/hooks'
import { getRepositories } from '../../storage/repositories'
import { Button, Card, Dialog, Notice, buttonClasses, iconPropsSm } from '../../ui'
import { FeedbackView } from './FeedbackView'
import { UsageSection } from './UsageSection'

function groupTurns(turns: Turn[]): Array<{ main: Turn; followUps: Turn[] }> {
  const groups: Array<{ main: Turn; followUps: Turn[] }> = []
  for (const t of turns) {
    if (t.kind === 'main') groups.push({ main: t, followUps: [] })
    else {
      const parent = groups.find((g) => g.main.id === t.parentTurnId) ?? groups.at(-1)
      parent?.followUps.push(t)
    }
  }
  return groups
}

/** "Read the text · heard it again 2×" under a question, when help was used. */
function AidsLine({ turn }: { turn: Turn }) {
  const { t } = useTranslation()
  const parts = [
    turn.aids?.textShown ? t('report.aids.readText') : undefined,
    turn.aids?.repeats ? t('report.aids.repeated', { count: turn.aids.repeats }) : undefined,
  ].filter(Boolean)
  if (!parts.length) return null
  return <p className="text-caption text-text-subtle">{parts.join(' · ')}</p>
}

/** Hard sessions: how close the candidate got to answering by ear alone, as in a real interview. */
function ListeningCard({ turns }: { turns: Turn[] }) {
  const { t } = useTranslation()
  const { questions, textShown, repeats } = listeningSummary(turns)
  if (questions === 0) return null
  const usedHelp = textShown > 0 || repeats > 0
  return (
    <Notice tone={usedHelp ? 'info' : 'success'} title={t('report.listening.title')}>
      <p>
        {usedHelp
          ? [
              t('report.listening.textShown', { count: textShown, total: questions }),
              t('report.listening.repeats', { count: repeats }),
            ].join(' ')
          : t('report.listening.noHelp')}
      </p>
      {usedHelp && <p className="mt-1">{t('report.listening.tip')}</p>}
    </Notice>
  )
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-text-muted marker:text-text-subtle">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  )
}

export default function ReportPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const session = useSession(sessionId)
  const turns = useTurns(sessionId)
  const llmCalls = useLlmCalls(sessionId)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (session === undefined || turns === undefined) return null
  if (session === null)
    return (
      <Notice
        tone="warning"
        title={t('report.notFound')}
        action={
          <Link to="/history" className={buttonClasses('secondary', 'sm')}>
            {t('nav.history')}
          </Link>
        }
      />
    )

  const { config, summary } = session
  const average = sessionAverage(turns)
  const groups = groupTurns(turns)

  async function onDelete() {
    await getRepositories().sessions.remove(session!.id)
    navigate('/history', { replace: true })
  }

  return (
    <>
      <Link to="/history" className={buttonClasses('ghost', 'sm', '-ml-4 mb-6')}>
        <ArrowLeft {...iconPropsSm} />
        {t('report.back')}
      </Link>

      <header className="mb-10 flex flex-col gap-2">
        <h1 className="text-2xl">{t('report.title')}</h1>
        <p className="text-base text-text-muted">
          {t('report.meta', {
            type: t(`newInterview.types.${config.type}`),
            role: config.role,
            seniority: t(`newInterview.seniorities.${config.seniority}`),
          })}
          {config.difficulty === 'hard' && ` · ${t('newInterview.difficulties.hard')}`}
        </p>
        <p className="text-sm text-text-subtle">
          {t('report.metaModel', { date: formatDate(session.createdAt, i18n.language, true), model: session.model })}
        </p>
      </header>

      <div className="flex flex-col gap-12">
        {session.status === 'in-progress' && (
          <Notice
            title={t('report.inProgress')}
            action={
              <Link to={`/interview/${session.id}`} className={buttonClasses('primary', 'sm')}>
                {t('report.continue')}
              </Link>
            }
          />
        )}
        {session.status === 'abandoned' && !summary && <Notice title={t('report.noSummaryAbandoned')} />}

        {summary && (
          <Card tone="subtle" size="panel" className="flex flex-col gap-8">
            <div className="flex items-end gap-4">
              <div className="flex flex-col">
                <span className="text-sm text-text-muted">{t('report.overall')}</span>
                <span className="text-[56px] font-semibold leading-none tracking-[-0.02em]">
                  {summary.overall}
                  <span className="text-xl text-text-subtle">/5</span>
                </span>
              </div>
              {average !== undefined && (
                <span className="pb-1 text-sm text-text-muted">
                  {t('report.average', { avg: formatNumber(average, i18n.language) })}
                </span>
              )}
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              <SummaryList title={t('report.topStrengths')} items={summary.topStrengths} />
              <SummaryList title={t('report.focusNext')} items={summary.focusNext} />
            </div>
          </Card>
        )}

        {config.difficulty === 'hard' && <ListeningCard turns={turns} />}

        {groups.length === 0 && <p className="text-text-muted">{t('report.noAnswers')}</p>}

        {groups.map((g, i) => (
          <section key={g.main.id} className="flex flex-col gap-6 border-t border-border pt-10 first:border-t-0 first:pt-0">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-text-muted">{t('report.question', { n: i + 1 })}</p>
              <h2 className="text-xl">{g.main.question}</h2>
              <AidsLine turn={g.main} />
            </div>
            <FeedbackView turn={g.main} feedback={g.main.feedback} showAnswer />
            {g.followUps.map((f) => (
              <div key={f.id} className="flex flex-col gap-6 rounded-card border border-border p-6">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-text-muted">{t('room.followUp')}</p>
                  <h3 className="text-lg">{f.question}</h3>
                  <AidsLine turn={f} />
                </div>
                <FeedbackView turn={f} feedback={f.feedback} showAnswer />
              </div>
            ))}
          </section>
        ))}

        {llmCalls && <UsageSection calls={llmCalls} />}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-8">
          {session.status !== 'in-progress' && (
            <Link to="/new" className={buttonClasses('primary')}>
              {t('report.practiceAgain')}
            </Link>
          )}
          <Button
            variant="danger"
            className="sm:ml-auto"
            icon={<Trash2 {...iconPropsSm} />}
            onClick={() => setConfirmDelete(true)}
          >
            {t('report.delete')}
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('report.deleteTitle')}
        actions={
          <>
            <Button onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={onDelete}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        {t('report.deleteBody')}
      </Dialog>
    </>
  )
}
