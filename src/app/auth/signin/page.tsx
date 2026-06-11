import { notFound } from 'next/navigation';

// Vestigial next-auth route — backscoped per BACKLOG-028. Reinstatement blocker: BACKLOG-009.
// Canonical login is /login
export default function AuthSignInPage() {
    notFound();
}
