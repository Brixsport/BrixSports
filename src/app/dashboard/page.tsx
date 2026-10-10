import { notFound } from 'next/navigation';

// BACKLOG-472 item 1: this page rendered hard-coded mock data (a fake "Alex Johnson"
// user) to anyone who typed the URL, and was never wired to an API. No inbound
// link existed. Same treatment as /fpl and /predictions.
export default function DashboardPage() {
    notFound();
}
