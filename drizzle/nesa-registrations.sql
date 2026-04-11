-- NESA Festival Registrations table
CREATE TABLE IF NOT EXISTS nesa_registrations (
    id TEXT PRIMARY KEY,
    player_id TEXT REFERENCES players(id),
    university_id TEXT REFERENCES organizations(id),
    economics_dept_id TEXT REFERENCES organizations(id),
    
    -- Registration details
    registration_type TEXT NOT NULL DEFAULT 'individual',
    sports TEXT NOT NULL, -- JSON array of sports
    
    -- Verification status
    is_economics_verified INTEGER DEFAULT 0,
    verification_document TEXT, -- Path to student ID/economics proof
    verified_by TEXT,
    verified_at INTEGER,
    
    -- Registration status
    status TEXT DEFAULT 'pending', -- 'pending' | 'verified' | 'approved' | 'rejected'
    rejection_reason TEXT,
    
    -- Sport-specific data
    sport_details TEXT, -- JSON: {football: {...}, basketball: {...}, tracks: [...]}
    
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- NESA Track Event Entries (for 1-per-school rule)
CREATE TABLE IF NOT EXISTS nesa_track_entries (
    id TEXT PRIMARY KEY,
    registration_id TEXT REFERENCES nesa_registrations(id),
    player_id TEXT REFERENCES players(id),
    university_id TEXT REFERENCES organizations(id),
    
    event TEXT NOT NULL, -- '100m' | '200m' | '400m'
    personal_best TEXT, -- Optional PB time
    
    -- School-level tracking (1 per school per event)
    is_school_representative INTEGER DEFAULT 0,
    
    status TEXT DEFAULT 'registered', -- 'registered' | 'confirmed' | 'withdrawn'
    
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    
    -- Unique constraint: 1 player per university per event
    UNIQUE(university_id, event)
);

-- NESA Esports Entries
CREATE TABLE IF NOT EXISTS nesa_esports_entries (
    id TEXT PRIMARY KEY,
    registration_id TEXT REFERENCES nesa_registrations(id),
    player_id TEXT REFERENCES players(id),
    university_id TEXT REFERENCES organizations(id),
    
    game TEXT NOT NULL, -- 'FC26' | 'Call_of_Duty' | 'eFootball'
    category TEXT NOT NULL, -- 'singles' | 'doubles' | 'team'
    gamer_tag TEXT NOT NULL,
    platform TEXT NOT NULL, -- 'PS5' | 'Mobile'
    
    -- For doubles/team events
    teammates TEXT, -- JSON array of teammate IDs
    
    status TEXT DEFAULT 'registered',
    
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- NESA Team Registrations (for football/basketball)
CREATE TABLE IF NOT EXISTS nesa_team_registrations (
    id TEXT PRIMARY KEY,
    university_id TEXT REFERENCES organizations(id),
    sport TEXT NOT NULL, -- 'Football_Male' | 'Football_Female' | 'Basketball_Male'
    
    -- Team details
    team_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    
    -- Player roster
    registered_players TEXT, -- JSON array of player IDs
    
    -- Status
    status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
    approval_notes TEXT,
    approved_by TEXT,
    approved_at INTEGER,
    
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
