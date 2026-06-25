import Link from 'next/link'
import {
  ArrowRight,
  Layers,
  HardDrive,
  Timer,
  KeyRound,
  Cloud,
  Laptop,
  GraduationCap,
  Users,
} from 'lucide-react'
import { Brand, OsIcon } from '@/components/ui'
import { getSession } from '@/lib/auth'

export default async function Home() {
  const session = await getSession()

  return (
    <div className="flex min-h-screen flex-col">
      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#070912]/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
          <Brand />
          <nav className="flex items-center gap-2">
            {session?.role === 'teacher' ? (
              <Link href="/teacher" className="btn-primary btn-sm">
                My classes <ArrowRight className="size-3.5" />
              </Link>
            ) : session?.role === 'student' ? (
              <Link href="/student" className="btn-primary btn-sm">
                My desktop <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/teacher/login" className="btn-ghost btn-sm">
                  Teacher login
                </Link>
                <Link href="/join" className="btn-primary btn-sm">
                  Join a class
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* hero */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-5">
        <section className="grid items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="chip border border-indigo-400/30 bg-indigo-500/10 text-indigo-200">
              <Cloud className="size-3.5" /> Powered by Daytona cloud sandboxes
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              A real computer for every student,{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">
                in any browser.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
              Your students are on Chromebooks, but the class needs Linux or Windows. Remote
              Classroom Desktop spins up a full cloud desktop for each student — opened right in
              their browser tab. Their files live on a personal volume that never disappears.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/teacher/signup" className="btn-primary">
                <GraduationCap className="size-4" /> I&apos;m a teacher — get started
              </Link>
              <Link href="/join" className="btn-ghost">
                <KeyRound className="size-4" /> I&apos;m a student — join with a code
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Free to set up · Teachers sign up in seconds · Students just need a class code.
            </p>
          </div>

          {/* browser mock */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-600/20 to-cyan-500/10 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1120] shadow-2xl shadow-black/50">
              <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                <span className="size-3 rounded-full bg-red-400/80" />
                <span className="size-3 rounded-full bg-amber-400/80" />
                <span className="size-3 rounded-full bg-emerald-400/80" />
                <span className="ml-3 rounded-md bg-black/30 px-2 py-0.5 text-[11px] text-slate-500">
                  student.remoteclassroom.app
                </span>
              </div>
              <div className="relative aspect-video bg-gradient-to-br from-[#1b2a4a] via-[#13203a] to-[#0a1326]">
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-white/10 backdrop-blur">
                      <Laptop className="size-8 text-white/80" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-white/80">Ada&apos;s Linux Desktop</p>
                    <p className="text-xs text-white/40">connected · 58:21 remaining</p>
                  </div>
                </div>
                {/* taskbar */}
                <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
                  <OsIcon os="linux" className="size-4 text-orange-300" />
                  <span className="text-xs text-white/60">Files · Terminal · Firefox · Code</span>
                  <span className="ml-auto chip border border-emerald-400/30 bg-emerald-500/15 text-emerald-200">
                    ● live
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* features */}
        <section className="grid gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={<Layers className="size-5 text-indigo-300" />}
            title="Linux or Windows"
            body="Pick the OS your lesson needs. Each desktop is a fresh, isolated cloud machine — no install, no drivers, no IT tickets."
          />
          <Feature
            icon={<HardDrive className="size-5 text-cyan-300" />}
            title="Files that persist"
            body="Every student gets a personal volume mounted as “My-Files”. Machines come and go; their work stays put."
          />
          <Feature
            icon={<Timer className="size-5 text-amber-300" />}
            title="Built-in time limits"
            body="Set how long desktops run. Students get 5-minute, 1-minute and 30-second warnings, then machines shut down automatically."
          />
          <Feature
            icon={<KeyRound className="size-5 text-violet-300" />}
            title="Class codes"
            body="Just like Google Classroom. Teachers create a class and share a code — students join instantly, no accounts to manage."
          />
        </section>

        {/* how it works */}
        <section className="py-12">
          <h2 className="text-center text-2xl font-bold tracking-tight text-white">
            From Chromebook to full desktop in three steps
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Step
              n={1}
              icon={<GraduationCap className="size-5" />}
              title="Teacher creates a class"
              body="Sign up, name your class, choose Linux or Windows and a time limit. You get a join code to share."
            />
            <Step
              n={2}
              icon={<Users className="size-5" />}
              title="Students join with the code"
              body="Students enter the code and their name — no password, no setup. They each get their own machine."
            />
            <Step
              n={3}
              icon={<Cloud className="size-5" />}
              title="Everyone boots a desktop"
              body="Boot the whole class at once, or let students start their own. The desktop opens right in the browser."
            />
          </div>
        </section>

        {/* problem / solution callout */}
        <section className="mb-16 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/10 to-cyan-500/5 p-8">
          <div className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h3 className="text-xl font-semibold text-white">Why this exists</h3>
              <p className="mt-3 text-slate-400">
                Schools hand out Chromebooks because they&apos;re cheap and easy — but Chromebooks
                can&apos;t run a real Linux or Windows environment. So the moment a class needs a
                terminal, a compiler, or Windows-only software, students are stuck. Buying lab
                machines is expensive and impossible to maintain.
              </p>
              <p className="mt-3 text-slate-400">
                Instead of buying hardware, we rent it by the minute. Daytona provisions a real
                cloud desktop on demand, streams it to the browser over noVNC, and tears it down
                when the timer ends — so a $200 Chromebook becomes a window into any operating
                system.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <CompareRow label="Old way" value="Buy + maintain a computer lab" bad />
              <CompareRow label="Remote Classroom" value="Spin up desktops by the minute" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-5 text-sm text-slate-500 sm:flex-row">
          <Brand />
          <p>Built with Next.js + Daytona · Cloud desktops for the classroom.</p>
        </div>
      </footer>
    </div>
  )
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-5">
      <div className="grid size-10 place-items-center rounded-xl bg-white/5">{icon}</div>
      <h3 className="mt-4 font-semibold text-slate-100">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  )
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="card relative p-6">
      <span className="absolute right-5 top-5 text-5xl font-bold text-white/5">{n}</span>
      <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/80 to-violet-600/80 text-white">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-slate-100">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{body}</p>
    </div>
  )
}

function CompareRow({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        bad ? 'border-white/10 bg-white/[0.02]' : 'border-emerald-500/30 bg-emerald-500/10'
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold ${bad ? 'text-slate-400 line-through' : 'text-emerald-200'}`}>
        {value}
      </p>
    </div>
  )
}
