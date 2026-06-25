import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Brand } from '@/components/ui'
import { PricingCards } from '@/components/Pricing'

export const metadata = { title: 'Pricing — Remote Classroom Desktop' }

export default async function PricingPage() {
  const session = await getSession()
  // Students never see pricing.
  if (session?.role === 'student') redirect('/student')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#070912]/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
          <Brand href="/" />
          <nav className="flex items-center gap-2">
            {session?.role === 'teacher' ? (
              <Link href="/teacher" className="btn-ghost btn-sm">
                My classes
              </Link>
            ) : (
              <>
                <Link href="/teacher/login" className="btn-ghost btn-sm">
                  Teacher login
                </Link>
                <Link href="/teacher/signup" className="btn-primary btn-sm">
                  Start free
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">Simple pricing for teachers</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            Start free with one class. Upgrade to Pro when you&apos;re ready to run cloud desktops for
            every class, all year. Students never pay — and never see pricing.
          </p>
        </div>

        <div className="mt-12">
          <PricingCards variant="public" />
        </div>

        <div className="mt-16">
          <h2 className="text-center text-xl font-semibold text-white">Questions</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Faq q="Do students need to pay or sign up?" a="Never. Students join with a class code and a name — no account, no payment, and they never see pricing." />
            <Faq q="What counts as a desktop minute?" a="Time a student's desktop is actually running. When it shuts down (or the timer ends), the clock stops. Free includes 200 minutes per student each month." />
            <Faq q="What happens at the session limit?" a="On Free, sessions are capped at 45 minutes and shut down automatically. Pro extends sessions up to 4 hours." />
            <Faq q="Can I cancel anytime?" a="Yes. Manage or cancel your subscription from the billing page at any time; you keep Pro until the period ends." />
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-6">
        <div className="mx-auto w-full max-w-6xl px-5 text-center text-sm text-slate-500">
          Cloud desktops for the classroom · Powered by Daytona
        </div>
      </footer>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-slate-100">{q}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{a}</p>
    </div>
  )
}
