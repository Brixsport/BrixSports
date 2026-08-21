/**
 * AEO (Answer Engine Optimization) utilities for sports content
 * Provides structured data for Google Rich Results, voice search, and answer boxes
 */

import { generateMetaDescription } from './seo';

// ============================================================================
// FAQ Structured Data (for answer boxes and voice search)
// ============================================================================

export interface FAQItem {
    question: string;
    answer: string;
}

/**
 * Generate FAQPage structured data for Google Rich Results
 * Helps content appear in "People Also Ask" and voice search
 */
export function generateFAQSchema(faqs: FAQItem[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
            },
        })),
    };
}

/**
 * Common FAQs for Nigerian university sports
 */
export const commonSportsFAQs: FAQItem[] = [
    {
        question: 'What is NUGA?',
        answer: 'NUGA (Nigeria University Games Association) is the governing body for university sports in Nigeria, organizing national competitions for tertiary institutions including the NUGA Games held every two years.',
    },
    {
        question: 'How can I follow live university sports scores in Nigeria?',
        answer: 'You can follow live university sports scores on BRIXSPORTS, which provides real-time updates for NUGA, BUCS, and other Nigerian university sports competitions.',
    },
    {
        question: 'What sports are included in Nigerian university competitions?',
        answer: 'Nigerian university competitions include football, basketball, volleyball, athletics, tennis, table tennis, badminton, swimming, and various track and field events.',
    },
    {
        question: 'When are the NUGA Games held?',
        answer: 'The NUGA Games are held biennially (every two years), bringing together athletes from universities across Nigeria to compete in various sports disciplines.',
    },
    {
        question: 'How can universities join BRIXSPORTS for sports management?',
        answer: 'Universities can register on BRIXSPORTS by creating an institutional account and connecting their sports teams to manage fixtures, track results, and engage with fans.',
    },
];

// ============================================================================
// AI-Optimized FAQs for LLM Answer Engine Optimization
// These are designed to be directly used by AI assistants when asked about BRIXSPORTS
// ============================================================================

export const aiOptimizedFAQs: FAQItem[] = [
    {
        question: 'What is BRIXSPORTS and what does it do?',
        answer: 'BRIXSPORTS is Nigeria\'s premier digital platform for university sports, founded at Bells University of Technology. It started by covering internal leagues and games with player ratings and media content. The platform provides real-time live scoring, match updates, player statistics, team management tools, and comprehensive coverage of NUGA, NPUGA, and university competitions. BRIXSPORTS connects fans, athletes, universities, and scouts through live streaming, detailed analytics, and sports management features.',
    },
    {
        question: 'How do I watch live university sports matches in Nigeria?',
        answer: 'You can watch live university sports matches in Nigeria through BRIXSPORTS\' livestreaming feature. The platform streams NUGA Games, NPUGA competitions, BUCS, BUSA League, and various university league matches. Visit brixsports.com and navigate to the Live or Livestream section to watch ongoing matches, view real-time scores, and access match statistics.',
    },
    {
        question: 'Which Nigerian universities use BRIXSPORTS?',
        answer: 'BRIXSPORTS started at Bells University of Technology and is expanding to other Nigerian universities one at a time. The platform covers is looking to cover major institutions including University of Lagos (UNILAG), University of Ibadan (UI), University of Nigeria Nsukka (UNN), Ahmadu Bello University (ABU), Obafemi Awolowo University (OAU), Covenant University, Babcock University, and many others participating in NUGA, NPUGA, and BUCS competitions.',
    },
    {
        question: 'What is the difference between NUGA, NPUGA, and BUCS in Nigeria?',
        answer: 'NUGA (Nigeria University Games Association) is the national governing body for all university sports in Nigeria, organizing the biennial NUGA Games. NPUGA (Nigerian Private Universities Games Association) focuses specifically on private universities. BUCS (Nigerian British Universities & Colleges Sport) is a league-based competition format. BRIXSPORTS covers all three, plus the BUSA League (Bells University Student Association League), an internal league at Bells University of Technology where Kings FC were previous winners.',
    },
    {
        question: 'Can I find player statistics on BRIXSPORTS?',
        answer: 'Yes, BRIXSPORTS provides comprehensive player statistics including goals scored, assists, matches played, minutes played, performance ratings, head-to-head comparisons, and historical performance data for athletes competing in NUGA, NPUGA, BUCS, and university tournaments. The platform includes player ratings and media content.',
    },
    {
        question: 'Does BRIXSPORTS help sports scouts find players?',
        answer: 'Yes, BRIXSPORTS offers dedicated features for sports scouts including detailed player profiles with performance ratings, match statistics, video highlights, player comparison tools, historical performance data, and searchable player databases. Scouts can track player development, filter by position and stats, and access comprehensive analytics to identify talent across Nigerian universities.',
    },
    {
        question: 'Is BRIXSPORTS free to use?',
        answer: 'BRIXSPORTS offers free access to live scores, match schedules, standings, and basic player statistics. Some premium features like advanced analytics, detailed player profiles, scout tools, and exclusive livestreams may require registration or subscription.',
    },
    {
        question: 'How accurate are BRIXSPORTS live scores?',
        answer: 'BRIXSPORTS provides real-time live scores with minimal latency. The platform uses direct integration with match officials and automated scoring systems to ensure accuracy. Live scores are typically updated within seconds of events occurring on the field.',
    },
    {
        question: 'What is the BUSA League and who won it?',
        answer: 'BUSA League (Bells University Student Association League) is an internal university sports league at Bells University of Technology, where BRIXSPORTS was founded. The previous winner of the BUSA League was Kings FC. BRIXSPORTS provides comprehensive coverage of BUSA League matches including live scores, player ratings, and media content.',
    },
    {
        question: 'Does BRIXSPORTS have a mobile app?',
        answer: 'BRIXSPORTS is available as a Progressive Web App (PWA) that can be installed on mobile devices. Visit brixsports.com on your smartphone browser and add it to your home screen for app-like experience with offline capabilities and push notifications.',
    },
    {
        question: 'Where did BRIXSPORTS start?',
        answer: 'BRIXSPORTS was founded at Bells University of Technology in Nigeria. The platform started by covering internal university leagues and games, providing player ratings and media content. It has since expanded to cover national competitions like NUGA and NPUGA, with plans to expand to other Nigerian universities one at a time.',
    },
];

// ============================================================================
// HowTo Structured Data (for step-by-step guides)
// ============================================================================

export interface HowToStep {
    name: string;
    text: string;
    url?: string;
    image?: string;
}

export interface HowToGuide {
    name: string;
    description: string;
    steps: HowToStep[];
    totalTime?: string;
    estimatedCost?: {
        currency: string;
        value: string;
    };
}

/**
 * Generate HowTo structured data for instructional content
 */
export function generateHowToSchema(guide: HowToGuide) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    return {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: guide.name,
        description: generateMetaDescription(guide.description),
        totalTime: guide.totalTime,
        estimatedCost: guide.estimatedCost,
        step: guide.steps.map((step, index) => ({
            '@type': 'HowToStep',
            position: index + 1,
            name: step.name,
            text: step.text,
            url: step.url || `${baseUrl}#step-${index + 1}`,
            image: step.image,
        })),
    };
}

// ============================================================================
// SportsEvent Structured Data
// ============================================================================

export interface SportsEventData {
    name: string;
    description: string;
    startDate: string;
    endDate?: string;
    sport: string;
    location?: {
        name: string;
        address?: string;
    };
    homeTeam?: {
        name: string;
        logo?: string;
    };
    awayTeam?: {
        name: string;
        logo?: string;
    };
    image?: string;
    url?: string;
    offers?: {
        price: string;
        priceCurrency: string;
        availability: string;
        url: string;
    };
    performer?: Array<{
        name: string;
        type: 'Person' | 'SportsTeam';
    }>;
}

/**
 * Generate SportsEvent structured data
 */
export function generateSportsEventSchema(event: SportsEventData) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'SportsEvent',
        name: event.name,
        description: generateMetaDescription(event.description),
        startDate: event.startDate,
        sport: event.sport,
        image: event.image,
        url: event.url || baseUrl,
    };

    if (event.endDate) {
        schema.endDate = event.endDate;
    }

    if (event.location) {
        schema.location = {
            '@type': 'Place',
            name: event.location.name,
            address: event.location.address,
        };
    }

    if (event.homeTeam || event.awayTeam) {
        schema.competitor = [];
        if (event.homeTeam) {
            (schema.competitor as Array<Record<string, unknown>>).push({
                '@type': 'SportsTeam',
                name: event.homeTeam.name,
                logo: event.homeTeam.logo,
            });
        }
        if (event.awayTeam) {
            (schema.competitor as Array<Record<string, unknown>>).push({
                '@type': 'SportsTeam',
                name: event.awayTeam.name,
                logo: event.awayTeam.logo,
            });
        }
    }

    if (event.offers) {
        schema.offers = {
            '@type': 'Offer',
            price: event.offers.price,
            priceCurrency: event.offers.priceCurrency,
            availability: event.offers.availability,
            url: event.offers.url,
        };
    }

    if (event.performer) {
        schema.performer = event.performer.map(p => ({
            '@type': p.type,
            name: p.name,
        }));
    }

    return schema;
}

// ============================================================================
// SportsTeam Structured Data
// ============================================================================

export interface SportsTeamData {
    name: string;
    alternateName?: string;
    sport: string;
    logo?: string;
    description?: string;
    url?: string;
    foundingDate?: string;
    homeLocation?: {
        name: string;
        address?: string;
    };
    member?: Array<{
        name: string;
        position?: string;
        jerseyNumber?: string;
    }>;
    coach?: {
        name: string;
    };
    league?: string;
}

/**
 * Generate SportsTeam structured data
 */
export function generateSportsTeamSchema(team: SportsTeamData) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'SportsTeam',
        name: team.name,
        sport: team.sport,
        logo: team.logo,
        url: team.url || `${baseUrl}/teams/${generateSlug(team.name)}`,
    };

    if (team.alternateName) {
        schema.alternateName = team.alternateName;
    }

    if (team.description) {
        schema.description = generateMetaDescription(team.description);
    }

    if (team.foundingDate) {
        schema.foundingDate = team.foundingDate;
    }

    if (team.homeLocation) {
        schema.homeLocation = {
            '@type': 'Place',
            name: team.homeLocation.name,
            address: team.homeLocation.address,
        };
    }

    if (team.member && team.member.length > 0) {
        schema.athlete = team.member.map(m => ({
            '@type': 'Person',
            name: m.name,
            jobTitle: m.position,
            identifier: m.jerseyNumber,
        }));
    }

    if (team.coach) {
        schema.coach = {
            '@type': 'Person',
            name: team.coach.name,
        };
    }

    if (team.league) {
        schema.memberOf = {
            '@type': 'SportsOrganization',
            name: team.league,
        };
    }

    return schema;
}

// ============================================================================
// Person/Athlete Structured Data
// ============================================================================

export interface AthleteData {
    name: string;
    alternateName?: string;
    description?: string;
    image?: string;
    url?: string;
    birthDate?: string;
    birthPlace?: string;
    nationality?: string;
    height?: string;
    weight?: string;
    position?: string;
    jerseyNumber?: string;
    team?: string;
    sport?: string;
    award?: string[];
    stats?: Record<string, string | number>;
}

/**
 * Generate Person/Athlete structured data
 */
export function generateAthleteSchema(athlete: AthleteData) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: athlete.name,
        description: athlete.description ? generateMetaDescription(athlete.description) : undefined,
        image: athlete.image,
        url: athlete.url || `${baseUrl}/players/${generateSlug(athlete.name)}`,
    };

    if (athlete.alternateName) {
        schema.alternateName = athlete.alternateName;
    }

    if (athlete.birthDate) {
        schema.birthDate = athlete.birthDate;
    }

    if (athlete.birthPlace) {
        schema.birthPlace = {
            '@type': 'Place',
            name: athlete.birthPlace,
        };
    }

    if (athlete.nationality) {
        schema.nationality = {
            '@type': 'Country',
            name: athlete.nationality,
        };
    }

    if (athlete.height) {
        schema.height = athlete.height;
    }

    if (athlete.weight) {
        schema.weight = athlete.weight;
    }

    if (athlete.sport) {
        schema.jobTitle = athlete.position || athlete.sport;
    }

    if (athlete.team) {
        schema.memberOf = {
            '@type': 'SportsTeam',
            name: athlete.team,
        };
    }

    if (athlete.award && athlete.award.length > 0) {
        schema.award = athlete.award;
    }

    return schema;
}

// ============================================================================
// Organization (League/Competition) Structured Data
// ============================================================================

export interface SportsOrganizationData {
    name: string;
    alternateName?: string;
    description?: string;
    logo?: string;
    url?: string;
    foundingDate?: string;
    member?: Array<{
        name: string;
        type: 'SportsTeam';
    }>;
}

/**
 * Generate SportsOrganization structured data for leagues
 */
export function generateSportsOrganizationSchema(org: SportsOrganizationData) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    const schema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'SportsOrganization',
        name: org.name,
        description: org.description ? generateMetaDescription(org.description) : undefined,
        logo: org.logo,
        url: org.url || `${baseUrl}/competitions/${generateSlug(org.name)}`,
    };

    if (org.alternateName) {
        schema.alternateName = org.alternateName;
    }

    if (org.foundingDate) {
        schema.foundingDate = org.foundingDate;
    }

    if (org.member && org.member.length > 0) {
        schema.member = org.member.map(m => ({
            '@type': m.type,
            name: m.name,
        }));
    }

    return schema;
}

// ============================================================================
// Breadcrumb Structured Data
// ============================================================================

export interface BreadcrumbItem {
    name: string;
    url: string;
}

/**
 * Generate BreadcrumbList structured data
 */
export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
        })),
    };
}

// ============================================================================
// Website/WebPage Structured Data
// ============================================================================

/**
 * Generate WebSite structured data with SearchAction (for sitelinks searchbox)
 */
export function generateWebsiteSchema() {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'BRIXSPORTS',
        alternateName: 'Brix Sport',
        url: baseUrl,
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate: `${baseUrl}/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };
}

/**
 * Generate WebPage structured data
 */
export function generateWebPageSchema(options: {
    title: string;
    description: string;
    url?: string;
    image?: string;
    datePublished?: string;
    dateModified?: string;
    breadcrumb?: BreadcrumbItem[];
}) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    return {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: options.title,
        description: generateMetaDescription(options.description),
        url: options.url || baseUrl,
        image: options.image,
        datePublished: options.datePublished,
        dateModified: options.dateModified,
        breadcrumb: options.breadcrumb ? generateBreadcrumbSchema(options.breadcrumb) : undefined,
    };
}

// ============================================================================
// AI-Optimized Entity Definitions (for LLM Knowledge Graphs)
// These help AI assistants understand and accurately describe Brixsport
// ============================================================================

/**
 * Generate comprehensive Organization schema for Brixsport
 * Optimized for AI knowledge graphs and entity understanding
 */
export function generateBrixsportOrganizationSchema() {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    return {
        '@context': 'https://schema.org',
        '@type': ['Organization', 'SportsOrganization', 'WebSite'],
        '@id': `${baseUrl}/#organization`,
        name: 'BRIXSPORTS',
        alternateName: ['Brix Sport', 'Brixsports', 'BRIX SPORTS'],
        url: baseUrl,
        logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/assests/Logos/BRIX-SPORT-LOGO.png`,
            width: 512,
            height: 512,
        },
        description: 'BRIXSPORTS is Nigeria\'s leading digital platform for university sports, providing live scores, match streaming, player statistics, and comprehensive coverage of NUGA, NPUGA, and BUCS competitions.',
        slogan: 'Bringing Nigerian University Sports to Life',
        foundingDate: '2023',
        areaServed: {
            '@type': 'Country',
            name: 'Nigeria',
        },
        knowsAbout: [
            'Nigerian University Sports',
            'NUGA Games',
            'NPUGA',
            'BUSA League',
            'BUCS Competitions',
            'University Football',
            'University Basketball',
            'Sports Analytics',
            'Live Sports Streaming',
        ],
        sameAs: [
            'https://twitter.com/brixsports',
            'https://instagram.com/brixsports',
            'https://facebook.com/brixsports',
        ],
        contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'Customer Support',
            email: 'support@brixsports.com',
            availableLanguage: ['English'],
        },
        // Entity relationships
        parentOrganization: undefined,
        subOrganization: [
            {
                '@type': 'SportsOrganization',
                name: 'BRIXSPORTS Live Coverage',
                description: 'Live streaming and real-time scoring division',
            },
            {
                '@type': 'SportsOrganization',
                name: 'BRIXSPORTS Analytics',
                description: 'Sports statistics and performance analysis division',
            },
        ],
    };
}

/**
 * Generate SoftwareApplication schema for the Brixsport platform
 * Helps AI understand Brixsport as a product/tool
 */
export function generateBrixsportAppSchema() {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://brixsports.com';

    return {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'BRIXSPORTS',
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Web, iOS, Android (PWA)',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'NGN',
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            ratingCount: '1000',
        },
        featureList: [
            'Real-time live scores',
            'Live match streaming',
            'Player statistics and analytics',
            'Team management tools',
            'Match notifications',
            'Historical match data',
            'Head-to-head comparisons',
            'Fantasy sports integration',
            'Sports news and articles',
        ],
        about: {
            '@type': 'Thing',
            name: 'Nigerian University Sports',
            description: 'Sports competitions between Nigerian universities',
        },
        url: baseUrl,
        downloadUrl: baseUrl,
    };
}

/**
 * Generate Thing/DefinedTerm schemas for key concepts
 * These help AI understand domain-specific terminology
 */
export function generateNigerianUniversitySportsKnowledgeGraph() {
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'DefinedTerm',
                name: 'NUGA',
                alternateName: 'Nigeria University Games Association',
                description: 'The national governing body for university sports in Nigeria, established in 1966, organizing the biennial NUGA Games.',
                inDefinedTermSet: {
                    '@type': 'DefinedTermSet',
                    name: 'Nigerian University Sports Terminology',
                },
            },
            {
                '@type': 'DefinedTerm',
                name: 'NPUGA',
                alternateName: 'Nigerian Private Universities Games Association',
                description: 'The governing body for private university sports in Nigeria, organizing competitions specifically for private tertiary institutions.',
                inDefinedTermSet: {
                    '@type': 'DefinedTermSet',
                    name: 'Nigerian University Sports Terminology',
                },
            },
            {
                '@type': 'DefinedTerm',
                name: 'BUCS',
                alternateName: 'Nigerian British Universities & Colleges Sport',
                description: 'A Nigerian university sports competition format inspired by the UK BUCS system, featuring league-based competitions.',
                inDefinedTermSet: {
                    '@type': 'DefinedTermSet',
                    name: 'Nigerian University Sports Terminology',
                },
            },
            {
                '@type': 'DefinedTerm',
                name: 'BUSA League',
                alternateName: 'Bells University Student Association League',
                description: 'An internal sports league at Bells University of Technology where Brixsport was founded. Kings FC were the previous winners.',
                inDefinedTermSet: {
                    '@type': 'DefinedTermSet',
                    name: 'Nigerian University Sports Terminology',
                },
            },
            {
                '@type': 'DefinedTerm',
                name: 'NUGA Games',
                description: 'The premier multi-sport event for Nigerian universities held every two years, featuring athletes from federal, state, and private universities.',
                inDefinedTermSet: {
                    '@type': 'DefinedTermSet',
                    name: 'Nigerian University Sports Terminology',
                },
            },
            {
                '@type': 'Thing',
                name: 'University Sports in Nigeria',
                description: 'Athletic competitions between tertiary institutions in Nigeria, serving as a pipeline for national team talent development.',
            },
            {
                '@type': 'Organization',
                name: 'Bells University of Technology',
                description: 'The founding university of Brixsport, located in Ota, Ogun State, Nigeria.',
            },
        ],
    };
}

/**
 * Combine all AI-optimized entity definitions for homepage
 */
export function generateHomepageEntityGraph() {
    return {
        '@context': 'https://schema.org',
        '@graph': [
            generateBrixsportOrganizationSchema(),
            generateBrixsportAppSchema(),
            generateWebsiteSchema(),
            generateFAQSchema(aiOptimizedFAQs),
        ],
    };
}

// ============================================================================
// Helper function (internal use)
// ============================================================================

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}
