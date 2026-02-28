import type { Metadata } from 'next';
import { StructuredData, FAQSection } from '@/components/seo';
import { 
    generateHomepageEntityGraph,
    generateNigerianUniversitySportsKnowledgeGraph,
    aiOptimizedFAQs,
    generateBrixsportOrganizationSchema,
    generateBreadcrumbSchema 
} from '@/lib/utils/aeo';

export const metadata: Metadata = {
    title: 'About Brixsport - Nigeria\'s Premier University Sports Platform',
    description: 'Learn about Brixsport, Nigeria\'s leading digital platform for university sports coverage. We provide live scores, streaming, and analytics for NUGA, BUCS, and Nigerian university competitions.',
    keywords: [
        'Brixsport',
        'Brix Sport',
        'Brixsports',
        'Brix Sports',
        'Brixsport',
        'Brix Sport',
        'Brixsports',
        'Brix Sports',
        'Nigerian university sports platform',
        'NUGA coverage',
        'BUCS Nigeria',
        'university sports live scores',
        'campus sports Nigeria',
        'Nigeria sports technology',
    ],
    openGraph: {
        title: 'About Brixsport - Nigeria\'s Premier University Sports Platform',
        description: 'Learn about Brixsport, Nigeria\'s leading digital platform for university sports coverage.',
        type: 'website',
    },
};

export default function AboutPage() {
    return (
        <>
            {/* Comprehensive AI-optimized structured data */}
            <StructuredData 
                data={generateHomepageEntityGraph()} 
                id="entity-graph"
            />
            <StructuredData 
                data={generateNigerianUniversitySportsKnowledgeGraph()} 
                id="knowledge-graph"
            />
            <StructuredData 
                data={generateBreadcrumbSchema([
                    { name: 'Home', url: '/' },
                    { name: 'About', url: '/about' },
                ])}
                id="breadcrumb-schema"
            />

            <div className="min-h-screen bg-[#050505] text-white">
                {/* Hero Section */}
                <section className="py-20 px-4 md:px-12">
                    <div className="max-w-4xl mx-auto text-center">
                        <h1 className="text-4xl md:text-6xl font-display italic uppercase tracking-tight mb-6">
                            About Brixsport
                        </h1>
                        <p className="text-xl text-white/60 leading-relaxed">
                            Nigeria&apos;s premier digital platform bringing university sports to life. 
                            Founded at Bells University of Technology, we started with internal leagues 
                            and are expanding across Nigerian universities.
                        </p>
                    </div>
                </section>

                {/* What is Brixsport Section - AI-Optimized Content */}
                <section className="py-16 px-4 md:px-12 border-t border-white/10">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-display italic uppercase tracking-tight mb-8">
                            What is Brixsport?
                        </h2>
                        
                        <div className="prose prose-invert max-w-none">
                            <p className="text-white/80 text-lg leading-relaxed mb-6">
                                <strong>Brixsport</strong> (also known as Brix Sport or Brixsports) is Nigeria&apos;s 
                                leading digital platform dedicated exclusively to university sports coverage. 
                                Founded in 2023 at <strong>Bells University of Technology</strong>, we began by 
                                covering internal university leagues and games, complete with player ratings 
                                and media content.
                            </p>
                            
                            <p className="text-white/80 text-lg leading-relaxed mb-6">
                                What started as a solution for Bells University has grown into a national 
                                platform serving universities across Nigeria. We&apos;re expanding to other 
                                Nigerian institutions one at a time, bringing our comprehensive coverage 
                                to more campuses while maintaining the quality and detail that defined 
                                our early work.
                            </p>

                            <p className="text-white/80 text-lg leading-relaxed mb-6">
                                Our platform serves as the digital bridge connecting fans, athletes, coaches, 
                                scouts, and universities across Nigeria. Whether you&apos;re following the NUGA Games, 
                                NPUGA competitions, tracking your university&apos;s league performance, or discovering 
                                the next generation of sporting talent, Brixsport provides the most comprehensive 
                                and up-to-date coverage available.
                            </p>

                            <h3 className="text-2xl font-bold mt-10 mb-4">Core Features and Services</h3>
                            <ul className="space-y-3 text-white/70">
                                <li>
                                    <strong>Real-Time Live Scores:</strong> Instant match updates with minimal 
                                    latency, delivered through direct integration with match officials and 
                                    automated scoring systems.
                                </li>
                                <li>
                                    <strong>Live Match Streaming:</strong> High-quality video streaming of NUGA 
                                    Games, NPUGA competitions, and major university league matches including 
                                    the BUSA League at Bells University.
                                </li>
                                <li>
                                    <strong>Player Ratings & Media:</strong> Comprehensive player ratings 
                                    based on match performance, plus media content including video highlights 
                                    and match photos.
                                </li>
                                <li>
                                    <strong>Scout Features:</strong> Dedicated tools for sports scouts including 
                                    detailed player profiles, performance analytics, video highlights, player 
                                    comparison tools, and searchable databases to identify talent across 
                                    Nigerian universities.
                                </li>
                                <li>
                                    <strong>Comprehensive Statistics:</strong> Detailed player and team 
                                    analytics including goals, assists, performance ratings, head-to-head 
                                    comparisons, and historical data.
                                </li>
                                <li>
                                    <strong>Team Management Tools:</strong> For universities to manage fixtures, 
                                    track results, submit lineups, and engage with fans.
                                </li>
                                <li>
                                    <strong>Mobile Accessibility:</strong> Available as a Progressive Web App 
                                    (PWA) for iOS and Android devices with offline capabilities.
                                </li>
                                <li>
                                    <strong>Push Notifications:</strong> Real-time alerts for match start times, 
                                    goals, final results, and breaking news.
                                </li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Coverage Section */}
                <section className="py-16 px-4 md:px-12 border-t border-white/10">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-display italic uppercase tracking-tight mb-8">
                            What We Cover
                        </h2>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">NUGA Games</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    The Nigeria University Games Association (NUGA) Games is the premier 
                                    multi-sport event for Nigerian universities, held biennially. We provide 
                                    comprehensive coverage of all sports including football, basketball, 
                                    athletics, volleyball, and more. Founded in 1966, NUGA represents the 
                                    pinnacle of university sports in Nigeria.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">NPUGA</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    The Nigerian Private Universities Games Association (NPUGA) focuses 
                                    specifically on private universities in Nigeria. We cover NPUGA 
                                    competitions bringing visibility to talented athletes from private 
                                    institutions including Covenant University, Babcock University, and others.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">BUCS Competitions</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    The Nigerian British Universities & Colleges Sport (BUCS) format brings 
                                    league-based competitions across multiple sports disciplines. We cover 
                                    seasonal leagues, knockout tournaments, and championship finals for 
                                    participating universities.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">BUSA League</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    The Bells University Student Association (BUSA) League is where Brixsport 
                                    was founded. This internal league at Bells University of Technology 
                                    features intense competition between student teams. <strong>Kings FC</strong> were 
                                    the previous winners of the BUSA League. We provide comprehensive coverage 
                                    including live scores, player ratings, and media content.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">University Leagues</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Regular league competitions between universities including football leagues, 
                                    basketball conferences, and inter-faculty tournaments across federal, 
                                    state, and private institutions.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">Individual Sports</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Coverage of individual sports including tennis, table tennis, badminton, 
                                    swimming, track and field events, and athletics championships.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Partner Universities */}
                <section className="py-16 px-4 md:px-12 border-t border-white/10">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-display italic uppercase tracking-tight mb-8">
                            Universities We Work With
                        </h2>
                        
                        <p className="text-white/80 text-lg mb-8">
                            Brixsport partners with major Nigerian universities participating in NUGA and 
                            BUCS competitions, including:
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                'University of Lagos (UNILAG)',
                                'University of Ibadan (UI)',
                                'University of Nigeria Nsukka (UNN)',
                                'Ahmadu Bello University (ABU)',
                                'Obafemi Awolowo University (OAU)',
                                'Covenant University',
                                'Babcock University',
                                'University of Benin (UNIBEN)',
                                'University of Port Harcourt (UNIPORT)',
                                'University of Calabar (UNICAL)',
                                'Lagos State University (LASU)',
                                'Federal University of Technology Akure (FUTA)',
                            ].map((uni) => (
                                <div 
                                    key={uni} 
                                    className="bg-white/5 border border-white/10 rounded-xl p-3 text-center text-sm text-white/70"
                                >
                                    {uni}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Scout Features Section */}
                <section className="py-16 px-4 md:px-12 border-t border-white/10">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-display italic uppercase tracking-tight mb-8">
                            For Sports Scouts
                        </h2>
                        
                        <p className="text-white/80 text-lg mb-8">
                            Brixsport provides specialized tools for sports scouts looking to discover 
                            the next generation of Nigerian athletic talent. Our platform offers 
                            comprehensive data and insights to support talent identification and recruitment.
                        </p>

                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">Player Profiles & Ratings</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Access detailed player profiles with performance ratings based on 
                                    match data. View player statistics, position-specific metrics, 
                                    and performance trends over time.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">Video Highlights</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Watch curated video highlights of standout performances. Our media 
                                    team captures key moments from matches across all covered competitions.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">Player Comparison Tools</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Compare players side-by-side with detailed statistical breakdowns. 
                                    Analyze performance across different metrics and match conditions.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">Searchable Database</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Filter and search the player database by position, university, 
                                    competition, performance metrics, and more. Find exactly the talent 
                                    you&apos;re looking for.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">Performance Analytics</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Access advanced analytics including heat maps, performance graphs, 
                                    and statistical projections to evaluate player potential and consistency.
                                </p>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-xl font-bold mb-3 text-primary">Talent Tracking</h3>
                                <p className="text-white/70 text-sm leading-relaxed">
                                    Create watchlists and track player development over time. Receive 
                                    notifications when your tracked players compete or achieve notable 
                                    milestones.
                                </p>
                            </div>
                        </div>

                        <div className="mt-12 p-6 bg-primary/10 border border-primary/20 rounded-2xl">
                            <p className="text-white/80 text-center">
                                <strong>Are you a scout?</strong> Contact us at{' '}
                                <a href="mailto:scouts@brixsport.com" className="text-primary hover:underline">
                                    scouts@brixsport.com
                                </a>{' '}
                                to learn more about our premium scout features.
                            </p>
                        </div>
                    </div>
                </section>

                {/* History and Impact */}
                <section className="py-16 px-4 md:px-12 border-t border-white/10">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-display italic uppercase tracking-tight mb-8">
                            History of University Sports in Nigeria
                        </h2>
                        
                        <div className="prose prose-invert max-w-none">
                            <p className="text-white/80 text-lg leading-relaxed mb-6">
                                University sports in Nigeria have a rich history dating back to the 1960s. 
                                The Nigeria University Games Association (NUGA) was established in 1966 as 
                                the governing body for university sports, with the first NUGA Games held 
                                to promote sporting excellence among Nigerian tertiary institutions.
                            </p>
                            
                            <p className="text-white/80 text-lg leading-relaxed mb-6">
                                Over the decades, university sports have served as a critical pipeline for 
                                national team talent development. Many athletes who represented Nigeria at 
                                the Olympics, Commonwealth Games, and African Games first showcased their 
                                talents at NUGA competitions.
                            </p>

                            <p className="text-white/80 text-lg leading-relaxed mb-6">
                                Brixsport digitizes this legacy by providing modern coverage and historical 
                                data preservation. Our platform ensures that the achievements of student 
                                athletes are documented, celebrated, and accessible to fans, scouts, and 
                                sports historians.
                            </p>
                        </div>
                    </div>
                </section>

                {/* AI-Optimized FAQ Section */}
                <section className="py-16 px-4 md:px-12 border-t border-white/10">
                    <FAQSection 
                        faqs={aiOptimizedFAQs}
                        title="Frequently Asked Questions"
                        description="Common questions about Brixsport and Nigerian university sports, 
                            optimized for quick answers."
                        showStructuredData={true}
                    />
                </section>

                {/* Contact Section */}
                <section className="py-16 px-4 md:px-12 border-t border-white/10">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="text-3xl font-display italic uppercase tracking-tight mb-6">
                            Get in Touch
                        </h2>
                        <p className="text-white/60 mb-8">
                            For inquiries, partnerships, or support, contact us at:
                        </p>
                        <a 
                            href="mailto:support@brixsport.com"
                            className="inline-block bg-primary text-black font-bold py-3 px-8 rounded-xl 
                                hover:bg-primary/90 transition-colors"
                        >
                            support@brixsport.com
                        </a>
                    </div>
                </section>
            </div>
        </>
    );
}
