import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { Brand } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { PricingCards } from "@/components/Pricing"

export const metadata = { title: "Pricing — Remote Classroom" }

export default async function PricingPage() {
  const session = await getSession()
  if (session?.role === "student") redirect("/student")

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5">
          <Brand href="/" />
          <nav className="flex items-center gap-2">
            {session?.role === "teacher" ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/teacher">My classes</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/teacher/login">Teacher login</Link>
                </Button>
                <Button asChild variant="ink" size="sm">
                  <Link href="/teacher/signup">Start free</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-16">
        <div className="text-center">
          <h1 className="font-display text-4xl text-foreground sm:text-5xl">
            Simple pricing for teachers
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Start free with one class of up to 30 students. Upgrade to Pro when you&apos;re ready to
            run cloud desktops for every class, all year. Students never pay — and never see pricing.
          </p>
        </div>

        <div className="mt-12">
          <PricingCards variant="public" />
        </div>

        <div className="mt-16">
          <h2 className="font-display text-center text-2xl text-foreground">Common questions</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Faq q="Do students need to pay or sign up?" a="Never. Students join with a class code and a name — no account, no payment, and they never see pricing." />
            <Faq q="What counts as a desktop minute?" a="Time a student's desktop is actually running. When it shuts down, the clock stops. Free includes 200 minutes per student each month." />
            <Faq q="How big can a free class be?" a="Free classes hold up to 30 students. Pro removes the cap along with the class and session limits." />
            <Faq q="Can I cancel anytime?" a="Yes. Manage or cancel from the billing page at any time; you keep Pro until the period ends." />
          </div>
        </div>
      </main>

      <footer className="border-t border-border/70 py-7">
        <div className="mx-auto w-full max-w-6xl px-5 text-center text-sm text-muted-foreground">
          Cloud desktops for the classroom · Powered by Daytona
        </div>
      </footer>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold text-foreground">{q}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a}</p>
    </div>
  )
}
