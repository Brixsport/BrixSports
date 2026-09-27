// BACKLOG-433: no route-level loading boundary existed here. page.tsx does a
// live DB read (getMatchSeoData) before rendering anything, and MatchDetailClient
// does its own client-side fetch after mount -- with neither Suspense boundary
// nor this file, a click on a match card had zero visual feedback for the full
// server round-trip ("looks unresponsive for a while until it now goes
// itself"). Reuses MatchDetailClient's own existing loading spinner markup
// (same classes) so this reads as a continuation, not a different loading state.
export default function MatchDetailLoading() {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
    );
}
