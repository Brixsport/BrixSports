import { notFound } from 'next/navigation';

// BACKLOG-472 item 1: an orphaned public page (no inbound link; the admin logger
// list calls /api/analytics/loggers directly) and "advanced analytics" is out of
// scope per CLAUDE.md. The component and API route are left untouched.
export default function LoggerAnalyticsPage() {
    notFound();
}
