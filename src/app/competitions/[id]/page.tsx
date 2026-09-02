import { redirect } from 'next/navigation'
import { db } from '@/db'
import { competitions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default async function CompetitionPage({
  params,
}: {
  params: { id: string }
}) {
  let name: string | null = null
  try {
    const [competition] = await db
      .select({ name: competitions.name })
      .from(competitions)
      .where(eq(competitions.id, params.id))
    name = competition?.name ?? null
  } catch (error) {
    console.error('Error resolving competition for redirect:', error)
  }

  redirect(name ? `/competitions?competition=${encodeURIComponent(name)}` : '/competitions')
}
