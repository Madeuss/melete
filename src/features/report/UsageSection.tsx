import { useTranslation } from 'react-i18next'
import { formatNumber } from '../../app/format'
import { aggregateUsage } from '../../interview/usage'
import type { LlmCall } from '../../schemas'
import { Card } from '../../ui'

/** Tokens the session used, in total and per step, as reported by the provider. */
export function UsageSection({ calls }: { calls: LlmCall[] }) {
  const { t, i18n } = useTranslation()
  const n = (value: number) => formatNumber(value, i18n.language, 0)
  const { total, byKind } = aggregateUsage(calls)
  const reported = total.calls - total.callsWithoutUsage

  return (
    <Card tone="subtle" className="flex flex-col gap-4">
      <h2 className="text-lg">{t('report.usage.title')}</h2>

      {total.calls === 0 ? (
        <p className="text-sm text-text-muted">{t('report.usage.none')}</p>
      ) : (
        <>
          <p className="text-base">
            {reported > 0
              ? t('report.usage.totals', { input: n(total.promptTokens), output: n(total.completionTokens) })
              : t('report.usage.notReportedTotal')}
            <span className="text-sm text-text-muted"> · {t('report.usage.calls', { count: total.calls })}</span>
          </p>
          {reported > 0 && total.callsWithoutUsage > 0 && (
            <p className="text-sm text-text-muted">{t('report.usage.partial', { count: total.callsWithoutUsage })}</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="text-text-muted">
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 pr-4 font-medium">{t('report.usage.columns.step')}</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">{t('report.usage.columns.calls')}</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">{t('report.usage.columns.input')}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t('report.usage.columns.output')}</th>
                </tr>
              </thead>
              <tbody>
                {byKind.map((k) => {
                  const none = k.callsWithoutUsage === k.calls
                  return (
                    <tr key={k.kind} className="border-b border-border last:border-b-0">
                      <th scope="row" className="py-2 pr-4 font-normal">{t(`report.usage.kinds.${k.kind}`)}</th>
                      <td className="py-2 pr-4 text-right">{n(k.calls)}</td>
                      {none ? (
                        <td colSpan={2} className="py-2 text-right text-text-subtle">
                          {t('report.usage.notReported')}
                        </td>
                      ) : (
                        <>
                          <td className="py-2 pr-4 text-right">{n(k.promptTokens)}</td>
                          <td className="py-2 text-right">{n(k.completionTokens)}</td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-caption text-text-subtle">{t('report.usage.hint')}</p>
        </>
      )}
    </Card>
  )
}
