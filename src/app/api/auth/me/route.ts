import { getSession } from '@/lib/auth'
import { json } from '@/lib/api'

export async function GET() {
  const session = await getSession()
  return json({ user: session })
}
