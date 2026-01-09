// COMPLETE MOBILE-OPTIMIZED UNIFIED EVENT PANEL
// Replace lines 1170-1322 in FootballLogger.tsx with this code
// ALL 24 EVENTS INCLUDED

<div className="space-y-3 sm:space-y-4">
    {/* Team Toggle - Mobile Optimized */}
    <div className="grid grid-cols-2 gap-2 sm:gap-0 sm:flex sm:bg-white/5 sm:p-1 sm:rounded-xl sm:border sm:border-white/10">
        <button
            onClick={() => setSelectedTeam('home')}
            className={`flex items-center justify-center gap-2 py-3 sm:py-3 px-4 rounded-lg sm:rounded-lg transition-all ${selectedTeam === 'home'
                    ? 'bg-primary text-black scale-105'
                    : 'bg-white/5 sm:bg-transparent text-white/40 border border-white/10 sm:border-0'
                }`}
        >
            {homeTeam?.logo ? (
                <img src={homeTeam.logo} alt={homeTeam.name} className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
            ) : (
                <span className="text-xl sm:text-2xl">⚽</span>
            )}
            <span className="font-black uppercase tracking-widest text-xs sm:text-base">{homeTeam?.shortName}</span>
        </button>
        <button
            onClick={() => setSelectedTeam('away')}
            className={`flex items-center justify-center gap-2 py-3 sm:py-3 px-4 rounded-lg sm:rounded-lg transition-all ${selectedTeam === 'away'
                    ? 'bg-primary text-black scale-105'
                    : 'bg-white/5 sm:bg-transparent text-white/40 border border-white/10 sm:border-0'
                }`}
        >
            {awayTeam?.logo ? (
                <img src={awayTeam.logo} alt={awayTeam.name} className="w-6 h-6 sm:w-8 sm:h-8 object-contain" />
            ) : (
                <span className="text-xl sm:text-2xl">⚽</span>
            )}
            <span className="font-black uppercase tracking-widest text-xs sm:text-base">{awayTeam?.shortName}</span>
        </button>
    </div>

    {/* UNIFIED EVENT PANEL - ALL 24 EVENTS */}
    <div className="bg-white/5 border border-white/10 rounded-xl sm:rounded-[24px] p-3 sm:p-6">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-white/60 mb-3 sm:mb-4">
            UNIFIED EVENT PANEL
        </h3>

        {/* Event Grid - Responsive columns */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
            {/* SCORING (3) */}
            {/* Goal */}
            <button
                onClick={() => handleEventClick('Goal', true)}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-green-500/10 hover:border-green-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">⚽</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Goal</span>
            </button>

            {/* Penalty */}
            <button
                onClick={() => handleEventClick('Penalty', true)}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-orange-500/10 hover:border-orange-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🎯</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Penalty</span>
            </button>

            {/* Own Goal */}
            <button
                onClick={() => handleEventClick('Own Goal', true)}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-red-500/10 hover:border-red-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">⚽</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Own Goal</span>
            </button>

            {/* GOALKEEPER (2) */}
            {/* Save */}
            <button
                onClick={() => handleEventClick('Save')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🧤</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Save</span>
            </button>

            {/* Catch */}
            <button
                onClick={() => handleEventClick('Catch')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🤲</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Catch</span>
            </button>

            {/* DEFENSE (4) */}
            {/* Block */}
            <button
                onClick={() => handleEventClick('Block')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🚫</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Block</span>
            </button>

            {/* Interception */}
            <button
                onClick={() => handleEventClick('Interception')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🛡️</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Intercept</span>
            </button>

            {/* Clearance */}
            <button
                onClick={() => handleEventClick('Clearance')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🦶</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Clear</span>
            </button>

            {/* Tackle */}
            <button
                onClick={() => handleEventClick('Tackle')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">💪</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Tackle</span>
            </button>

            {/* SHOOTING (3) */}
            {/* Shot */}
            <button
                onClick={() => handleEventClick('Shot')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">⚡</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Shot</span>
            </button>

            {/* Shot On Target */}
            <button
                onClick={() => handleEventClick('Shot on Target')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🎯</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Shot On</span>
            </button>

            {/* Shot Off Target */}
            <button
                onClick={() => handleEventClick('Shot off Target')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">❌</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Shot Off</span>
            </button>

            {/* SET PIECES (5) */}
            {/* Corner */}
            <button
                onClick={() => handleEventClick('Corner')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🚩</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Corner</span>
            </button>

            {/* Free Kick */}
            <button
                onClick={() => handleEventClick('Free Kick')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🦶</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Free Kick</span>
            </button>

            {/* Throw In */}
            <button
                onClick={() => handleEventClick('Throw In')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">👐</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Throw-in</span>
            </button>

            {/* Goal Kick */}
            <button
                onClick={() => handleEventClick('Goal Kick')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🥅</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Goal Kick</span>
            </button>

            {/* Offside */}
            <button
                onClick={() => handleEventClick('Offside')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🚩</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Offside</span>
            </button>

            {/* DISCIPLINE (5) */}
            {/* Foul */}
            <button
                onClick={() => handleEventClick('Foul')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">⚠️</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Foul</span>
            </button>

            {/* Push */}
            <button
                onClick={() => handleEventClick('Push')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🤚</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Push</span>
            </button>

            {/* Handball */}
            <button
                onClick={() => handleEventClick('Handball')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">✋</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Handball</span>
            </button>

            {/* Yellow Card */}
            <button
                onClick={() => handleEventClick('Yellow Card')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-yellow-500/10 hover:border-yellow-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🟨</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Yellow</span>
            </button>

            {/* Red Card */}
            <button
                onClick={() => handleEventClick('Red Card')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-red-500/10 hover:border-red-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🟥</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Red</span>
            </button>

            {/* TEAM ACTIONS (2) */}
            {/* Substitution */}
            <button
                onClick={() => handleEventClick('Substitution')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🔄</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Sub</span>
            </button>

            {/* Assist */}
            <button
                onClick={() => handleEventClick('Assist')}
                disabled={!matchStarted || matchEnded}
                className="aspect-square bg-white/5 border border-white/10 rounded-lg sm:rounded-xl hover:bg-white/10 hover:border-primary/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 flex flex-col items-center justify-center p-2 sm:p-3"
            >
                <span className="text-2xl sm:text-3xl mb-1">🤝</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-white/80 text-center leading-tight">Assist</span>
            </button>
        </div>
    </div>
</div>
