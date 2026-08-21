import { redirect } from 'next/navigation'

export default function CompetitionPage({
  params,
}: {
  params: { id: string }
}) {
  redirect(`/competitions/${params.id}/standings`)
}
