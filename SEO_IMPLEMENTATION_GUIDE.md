# Brixsport SEO & AEO Implementation Guide

This guide explains how to use the new SEO and AEO (Answer Engine Optimization) features added to Brixsport.

## What's Been Added

### 1. Global SEO Enhancements (`src/app/layout.tsx`)
- Comprehensive metadata with keywords, Open Graph, Twitter Cards
- Proper robots configuration for search engine indexing
- Google/Bing verification placeholders (add your verification codes)
- Canonical URLs and alternate language support

### 2. AEO Utilities (`src/lib/utils/aeo.ts`)
Structured data generators for:
- **FAQPage** - For "People Also Ask" and voice search
- **HowTo** - For step-by-step guides
- **SportsEvent** - For match/event pages
- **SportsTeam** - For team profile pages
- **Person/Athlete** - For player profile pages
- **SportsOrganization** - For league/competition pages
- **BreadcrumbList** - For navigation breadcrumbs
- **WebSite** - With SearchAction for sitelinks searchbox

### 3. SEO Components (`src/components/seo/`)
- **StructuredData** - JSON-LD injector for client components
- **PageSEO** - Dynamic meta tag updater for client components
- **FAQSection** - FAQ accordion with built-in structured data

### 4. Crawler Configuration
- **robots.txt** - Controls search engine access
- **sitemap.xml** - Generated at `/sitemap.ts` with dynamic routes support

## How to Use

### For Server Components (Recommended)

Export metadata directly:

```typescript
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Title',
  description: 'Page description for SEO',
  keywords: ['keyword1', 'keyword2'],
  openGraph: {
    title: 'OG Title',
    description: 'OG Description',
    images: ['/image.jpg'],
  },
};
```

### For Client Components

Use the PageSEO and StructuredData components:

```typescript
'use client';

import { PageSEO, StructuredData, FAQSection } from '@/components/seo';
import { generateSportsEventSchema, commonSportsFAQs } from '@/lib/utils/aeo';

export default function MatchPage({ match }) {
  return (
    <>
      {/* Dynamic SEO tags */}
      <PageSEO
        title={`${match.homeTeam.name} vs ${match.awayTeam.name}`}
        description={`Live match coverage: ${match.homeTeam.name} vs ${match.awayTeam.name}. Follow real-time scores and stats.`}
        keywords={['football', 'university sports', match.competition]}
        ogImage={match.image}
        ogType="article"
      />
      
      {/* Structured data for rich results */}
      <StructuredData 
        data={generateSportsEventSchema({
          name: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
          description: match.description,
          startDate: match.startTime,
          sport: 'Football',
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
        })}
        id="match-schema"
      />
      
      {/* Page content */}
      <div>...</div>
      
      {/* FAQ section with AEO */}
      <FAQSection 
        faqs={commonSportsFAQs}
        showStructuredData={true}
      />
    </>
  );
}
```

### Adding Structured Data to Specific Pages

#### Match/Event Pages
```typescript
import { generateSportsEventSchema } from '@/lib/utils/aeo';

<StructuredData 
  data={generateSportsEventSchema({
    name: 'UNILAG vs UI - NUGA Finals',
    description: 'The championship final between University of Lagos and University of Ibadan',
    startDate: '2024-03-15T16:00:00Z',
    sport: 'Football',
    location: {
      name: 'UNILAG Sports Complex',
      address: 'University of Lagos, Akoka, Lagos',
    },
    homeTeam: { name: 'UNILAG', logo: '/logos/unilag.png' },
    awayTeam: { name: 'UI', logo: '/logos/ui.png' },
  })}
/>
```

#### Team Pages
```typescript
import { generateSportsTeamSchema } from '@/lib/utils/aeo';

<StructuredData 
  data={generateSportsTeamSchema({
    name: 'UNILAG Football Team',
    sport: 'Football',
    logo: '/logos/unilag.png',
    description: 'Premier football team representing University of Lagos',
    homeLocation: {
      name: 'UNILAG Sports Complex',
      address: 'University of Lagos, Akoka, Lagos, Nigeria',
    },
    league: 'NUGA Games',
    member: [
      { name: 'John Doe', position: 'Forward', jerseyNumber: '10' },
      { name: 'Jane Smith', position: 'Goalkeeper', jerseyNumber: '1' },
    ],
    coach: { name: 'Coach Mike' },
  })}
/>
```

#### Player/Athlete Pages
```typescript
import { generateAthleteSchema } from '@/lib/utils/aeo';

<StructuredData 
  data={generateAthleteSchema({
    name: 'John Doe',
    description: 'Star forward for UNILAG Football Team',
    image: '/players/john-doe.jpg',
    position: 'Forward',
    jerseyNumber: '10',
    team: 'UNILAG Football Team',
    sport: 'Football',
    nationality: 'Nigeria',
    height: '1.85m',
    weight: '78kg',
  })}
/>
```

#### Competition/League Pages
```typescript
import { generateSportsOrganizationSchema } from '@/lib/utils/aeo';

<StructuredData 
  data={generateSportsOrganizationSchema({
    name: 'NUGA Games 2024',
    alternateName: 'Nigeria University Games Association',
    description: 'Premier university sports competition in Nigeria',
    logo: '/logos/nuga.png',
    foundingDate: '1966',
  })}
/>
```

### Adding Breadcrumbs

```typescript
import { generateBreadcrumbSchema } from '@/lib/utils/aeo';

<StructuredData 
  data={generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Competitions', url: '/competitions' },
    { name: 'NUGA 2024', url: '/competitions/nuga-2024' },
    { name: 'Finals', url: '/competitions/nuga-2024/finals' },
  ])}
  id="breadcrumb-schema"
/>
```

## AEO (Answer Engine Optimization) Best Practices

### 1. FAQ Implementation
Use the `FAQSection` component on key pages:
- Home page (general platform FAQs)
- Sport category pages (sport-specific FAQs)
- Competition pages (event-specific FAQs)

### 2. Content Structure for Voice Search
- Use clear, concise answers (40-60 words ideal)
- Format with proper headings (H1, H2, H3)
- Include question keywords naturally
- Use lists and tables for structured data

### 3. Rich Snippet Optimization
- SportsEvent schema for matches → Event rich snippets
- SportsTeam schema → Knowledge panels
- FAQPage schema → "People Also Ask" boxes
- HowTo schema → Featured snippets

## Configuration

### Add Verification Codes
In `src/app/layout.tsx`, replace empty strings with your verification codes:

```typescript
other: {
  'google-site-verification': 'YOUR_GOOGLE_CODE_HERE',
  'msvalidate.01': 'YOUR_BING_CODE_HERE',
},
```

### Dynamic Sitemap
Update `src/app/sitemap.ts` to include your dynamic routes:

```typescript
const newsArticles = await db.query.news.findMany();
const newsUrls = newsArticles.map(article => ({
  url: `${baseUrl}/news/${article.slug}`,
  lastModified: article.updatedAt,
  changeFrequency: 'weekly',
  priority: 0.7,
}));
```

## Testing Your SEO

1. **Google Rich Results Test**: https://search.google.com/test/rich-results
2. **Schema Markup Validator**: https://validator.schema.org/
3. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
4. **Twitter Card Validator**: https://cards-dev.twitter.com/validator

## Next Steps

1. Add verification codes from Google Search Console and Bing Webmaster Tools
2. Implement structured data on high-priority pages
3. Create sport-specific FAQ content
4. Monitor search performance in Google Search Console
5. Submit sitemap to search engines
