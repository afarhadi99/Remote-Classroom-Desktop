import Link from "next/link"
import {
  ArrowRight,
  ArrowUpRight,
  Layers,
  HardDrive,
  Timer,
  KeyRound,
  Cloud,
  GraduationCap,
  Users,
  Check,
  Terminal,
  Folder,
  Globe,
} from "lucide-react"
import { Brand, OsIcon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PricingCards } from "@/components/Pricing"
import { getSession } from "@/lib/auth"

export default async function Home() {
  const session = await getSession()
  const isStudent = session?.role === "student"

  return (
    <div className="flex min-h-screen flex-col">
      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
          <Brand />
          <nav className="flex items-center gap-1.5 sm:gap-3">
            {session?.role === "teacher" ? (
              <Button asChild variant="ink" size="sm">
                <Link href="/teacher">
                  My classes <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : isStudent ? (
              <Button asChild variant="ink" size="sm">
                <Link href="/student">
                  My desktop <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <>
                <Link
                  href="/pricing"
                  className="hidden px-2 text-sm text-muted-foreground transition hover:text-foreground sm:block"
                >
                  Pricing
                </Link>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/teacher/login">Teacher login</Link>
                </Button>
                <Button asChild variant="ink" size="sm">
                  <Link href="/join">Join a class</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* hero */}
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="bg-dots pointer-events-none absolute inset-0 text-border [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div>
              <Badge variant="outline" className="gap-1.5 px-3 py-1 text-muted-foreground">
                <Cloud className="size-3.5 text-primary" /> Powered by Daytona cloud sandboxes
              </Badge>
              <h1 className="font-display mt-5 text-5xl leading-[1.04] text-foreground sm:text-6xl">
                A real computer for every student,{" "}
                <span className="italic text-primary">in any browser.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Your students are on Chromebooks, but the lesson needs Linux or Windows. Remote
                Classroom spins up a full cloud desktop for each student — opened right in their
                browser tab — and keeps their files on a personal volume that never disappears.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="ink" size="lg">
                  <Link href="/teacher/signup">
                    <GraduationCap className="size-4" /> Start free as a teacher
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/join">
                    <KeyRound className="size-4" /> Join with a class code
                  </Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> Free to start
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> No student accounts
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> Works on any device
                </span>
              </div>
            </div>

            <HeroMock />
          </div>
        </section>

        {/* problem */}
        <section className="border-b border-border/70">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">The problem</p>
              <h2 className="font-display mt-3 text-3xl text-foreground sm:text-4xl">
                A Chromebook can&apos;t run a real class.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Schools hand out Chromebooks because they&apos;re cheap and easy to manage. But the
                moment a class needs a terminal, a compiler, Docker, or Windows-only software, the
                students are stuck. The traditional fix — a computer lab — is expensive to buy, a
                nightmare to maintain, and never travels home.
              </p>
              <p className="mt-4 text-foreground">
                So instead of <span className="font-medium">owning</span> hardware, we{" "}
                <span className="font-medium">rent it by the minute.</span> Daytona provisions a real
                desktop on demand, streams it to the browser over noVNC, and tears it down when the
                timer ends.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <CompareRow label="The old way" value="Buy & maintain a computer lab" bad />
              <div className="flex justify-center text-muted-foreground">
                <ArrowRight className="size-5 rotate-90" />
              </div>
              <CompareRow label="Remote Classroom" value="Spin up desktops by the minute" />
            </div>
          </div>
        </section>

        {/* features */}
        <section className="border-b border-border/70">
          <div className="mx-auto w-full max-w-6xl px-5 py-16">
            <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              <Feature
                icon={<Layers className="size-5" />}
                title="Linux or Windows"
                body="Pick the OS your lesson needs. Each desktop is a fresh, isolated cloud machine — no install, no drivers, no IT tickets."
              />
              <Feature
                icon={<HardDrive className="size-5" />}
                title="Files that persist"
                body="Every student gets a personal volume mounted as “My-Files”. Machines come and go; their work stays put."
              />
              <Feature
                icon={<Timer className="size-5" />}
                title="Built-in time limits"
                body="Set how long desktops run. Students get 5-minute, 1-minute and 30-second warnings, then machines shut down on their own."
              />
              <Feature
                icon={<KeyRound className="size-5" />}
                title="Class codes"
                body="Just like Google Classroom. Share a code; students join with their name. No accounts to provision or reset."
              />
            </div>
          </div>
        </section>

        {/* how it works */}
        <section className="border-b border-border/70">
          <div className="mx-auto w-full max-w-6xl px-5 py-16">
            <h2 className="font-display text-center text-3xl text-foreground sm:text-4xl">
              Chromebook to full desktop, in three steps
            </h2>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              <Step n="01" icon={<GraduationCap className="size-5" />} title="Create a class" body="Sign up, name your class, choose Linux or Windows and a time limit. You get a join code to share." />
              <Step n="02" icon={<Users className="size-5" />} title="Students join" body="Students enter the code and their name — no password, no setup. Each gets their own machine and storage." />
              <Step n="03" icon={<Cloud className="size-5" />} title="Boot a desktop" body="Boot the whole class at once, or let students start their own. The desktop opens right in the browser." />
            </div>
          </div>
        </section>

        {/* pricing */}
        {!isStudent && (
          <section id="pricing" className="border-b border-border/70 bg-secondary/40">
            <div className="mx-auto w-full max-w-5xl px-5 py-16">
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">Pricing</p>
                <h2 className="font-display mt-3 text-3xl text-foreground sm:text-4xl">
                  Fair pricing for teachers
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                  Start free with one class of up to 30 students. Go Pro for unlimited classes,
                  longer sessions and unlimited time. Students never pay — and never see pricing.
                </p>
              </div>
              <div className="mx-auto mt-10 max-w-3xl">
                <PricingCards variant="public" />
              </div>
            </div>
          </section>
        )}

        {/* final CTA */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20">
          <div className="relative overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center">
            <div className="bg-dots pointer-events-none absolute inset-0 text-white/10" />
            <div className="relative">
              <h2 className="font-display text-3xl text-background sm:text-4xl">
                Give your class a real computer today
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-background/70">
                Set up your first class in under a minute. Free to start, no credit card required.
              </p>
              <Button asChild size="lg" className="mt-8 bg-background text-foreground hover:bg-background/90">
                <Link href="/teacher/signup">
                  Create your free teacher account <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 text-sm text-muted-foreground sm:flex-row">
          <Brand />
          <div className="flex items-center gap-5">
            {!isStudent && (
              <Link href="/pricing" className="transition hover:text-foreground">
                Pricing
              </Link>
            )}
            <span>Built with Next.js + Daytona</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function HeroMock() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-primary/5 blur-2xl" />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-ink/10">
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/60 px-3.5 py-2.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="ml-3 flex items-center gap-1.5 rounded-md bg-card px-2 py-1 text-[11px] text-muted-foreground">
            <Globe className="size-3" /> remoteclassroom.app/student
          </span>
        </div>
        <div className="relative aspect-[4/3] bg-gradient-to-br from-[#27347a] via-[#1e2a63] to-[#141d44]">
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/12 backdrop-blur">
                <OsIcon os="linux" className="size-7 text-white/90" />
              </div>
              <p className="mt-3 text-sm font-medium text-white/90">Ada&apos;s Linux Desktop</p>
            </div>
          </div>
          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
            <Timer className="size-3" /> 44:58 left
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 backdrop-blur">
            <Dock icon={<Folder className="size-4" />} />
            <Dock icon={<Terminal className="size-4" />} />
            <Dock icon={<Globe className="size-4" />} />
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              ● live
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Dock({ icon }: { icon: React.ReactNode }) {
  return <span className="grid size-7 place-items-center rounded-lg bg-white/10 text-white/80">{icon}</span>
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="border-t-2 border-foreground pt-4">
      <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">{icon}</div>
      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function Step({ n, icon, title, body }: { n: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="font-display text-3xl text-primary">{n}</span>
        <span className="flex size-9 items-center justify-center rounded-lg bg-secondary text-foreground">
          {icon}
        </span>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function CompareRow({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        bad ? "border-border bg-card" : "border-emerald-600/40 bg-emerald-50"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-medium ${bad ? "text-muted-foreground line-through" : "text-emerald-800"}`}>
        {value}
      </p>
    </div>
  )
}
