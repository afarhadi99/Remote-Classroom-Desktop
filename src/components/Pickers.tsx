'use client'

import { OS_LIST, type OsType } from '@/lib/os'
import { OsIcon } from '@/components/ui'
import { formatDurationLabel } from '@/lib/client'
import { cn } from '@/lib/utils'

export function OsPicker({
  value,
  onChange,
}: {
  value: OsType
  onChange: (os: OsType) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {OS_LIST.map((os) => {
        const active = value === os.id
        return (
          <button
            type="button"
            key={os.id}
            onClick={() => onChange(os.id)}
            className={cn(
              'group relative overflow-hidden rounded-xl border p-3.5 text-left transition',
              active
                ? 'border-indigo-400/60 bg-indigo-500/10'
                : 'border-white/10 bg-white/[0.03] hover:border-white/20',
            )}
          >
            <div
              className={cn(
                'grid size-9 place-items-center rounded-lg bg-gradient-to-br text-white',
                os.accent,
              )}
            >
              <OsIcon os={os.id} className="size-5" />
            </div>
            <p className="mt-2.5 text-sm font-semibold text-slate-100">{os.short}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
              {os.id === 'windows' ? 'Needs Windows enabled on your plan' : 'Ready to boot'}
            </p>
            {active && (
              <span className="absolute right-2 top-2 size-2 rounded-full bg-indigo-400" />
            )}
          </button>
        )
      })}
    </div>
  )
}

const DURATIONS = [15, 30, 45, 60, 90, 120]

export function DurationPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (min: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DURATIONS.map((d) => (
        <button
          type="button"
          key={d}
          onClick={() => onChange(d)}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
            value === d
              ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100'
              : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20',
          )}
        >
          {formatDurationLabel(d)}
        </button>
      ))}
    </div>
  )
}
