-- Fix script to merge duplicate Bells University entries
-- Run this directly on Turso

-- Step 1: Check what Bells variations exist
-- SELECT id, name, slug FROM organizations WHERE name LIKE '%Bells%';

-- Step 2: Update teams by university name
UPDATE teams 
SET university = 'Bells University of Technology'
WHERE university IN ('Bells University', 'Bells University of Technolgy');

-- Step 3: Update teams by owner organization ID
UPDATE teams 
SET owner_organization_id = 'org_bells-university-of-technology'
WHERE owner_organization_id IN (
    SELECT id FROM organizations 
    WHERE name LIKE '%Bells%' 
    AND name != 'Bells University of Technology'
);

-- Step 4: Update player organization affiliations
UPDATE player_organization_affiliations 
SET organization_id = 'org_bells-university-of-technology'
WHERE organization_id IN (
    SELECT id FROM organizations 
    WHERE name LIKE '%Bells%' 
    AND name != 'Bells University of Technology'
);

-- Step 5: Update child organizations' parent
UPDATE organizations 
SET parent_organization_id = 'org_bells-university-of-technology'
WHERE parent_organization_id IN (
    SELECT id FROM organizations 
    WHERE name LIKE '%Bells%' 
    AND name != 'Bells University of Technology'
);

-- Step 6: Update competitions host
UPDATE competitions 
SET host_organization_id = 'org_bells-university-of-technology'
WHERE host_organization_id IN (
    SELECT id FROM organizations 
    WHERE name LIKE '%Bells%' 
    AND name != 'Bells University of Technology'
);

-- Step 7: Update competitions governing
UPDATE competitions 
SET governing_organization_id = 'org_bells-university-of-technology'
WHERE governing_organization_id IN (
    SELECT id FROM organizations 
    WHERE name LIKE '%Bells%' 
    AND name != 'Bells University of Technology'
);

-- Step 8: Delete duplicate Bells University organizations
-- (Must run after all FK updates above)
DELETE FROM organizations 
WHERE name LIKE '%Bells%' 
AND name != 'Bells University of Technology';

-- Verification queries:
-- SELECT id, name FROM organizations WHERE name LIKE '%Bells%';
-- SELECT COUNT(*) as team_count FROM teams WHERE university = 'Bells University of Technology';
-- SELECT COUNT(*) as teams_by_owner FROM teams WHERE owner_organization_id = 'org_bells-university-of-technology';
