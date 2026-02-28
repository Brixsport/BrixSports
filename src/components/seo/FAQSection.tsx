'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { StructuredData } from './StructuredData';
import { generateFAQSchema, FAQItem } from '@/lib/utils/aeo';

interface FAQSectionProps {
    faqs: FAQItem[];
    title?: string;
    description?: string;
    className?: string;
    showStructuredData?: boolean;
}

/**
 * FAQSection Component
 * 
 * Renders an FAQ section with accordion functionality and AEO structured data.
 * Optimized for "People Also Ask" and voice search results.
 * 
 * @example
 * <FAQSection 
 *   faqs={commonSportsFAQs}
 *   title="Frequently Asked Questions"
 *   showStructuredData={true}
 * />
 */
export function FAQSection({
    faqs,
    title = 'Frequently Asked Questions',
    description,
    className = '',
    showStructuredData = true,
}: FAQSectionProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggleFAQ = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <>
            {showStructuredData && (
                <StructuredData 
                    data={generateFAQSchema(faqs)} 
                    id="faq-schema"
                />
            )}
            
            <section className={`py-12 ${className}`}>
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <HelpCircle className="w-6 h-6 text-primary" />
                        <h2 className="text-2xl font-display italic uppercase tracking-tight">
                            {title}
                        </h2>
                    </div>
                    
                    {description && (
                        <p className="text-white/60 mb-8 text-sm">
                            {description}
                        </p>
                    )}

                    <div className="space-y-3">
                        {faqs.map((faq, index) => (
                            <div
                                key={index}
                                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-white/20"
                            >
                                <button
                                    onClick={() => toggleFAQ(index)}
                                    className="w-full flex items-center justify-between p-5 text-left"
                                    aria-expanded={openIndex === index}
                                >
                                    <span className="font-bold text-sm pr-4">
                                        {faq.question}
                                    </span>
                                    <ChevronDown
                                        className={`w-5 h-5 text-white/40 flex-shrink-0 transition-transform duration-300 ${
                                            openIndex === index ? 'rotate-180' : ''
                                        }`}
                                    />
                                </button>
                                
                                <div
                                    className={`overflow-hidden transition-all duration-300 ${
                                        openIndex === index ? 'max-h-96' : 'max-h-0'
                                    }`}
                                >
                                    <div className="px-5 pb-5">
                                        <p className="text-white/60 text-sm leading-relaxed">
                                            {faq.answer}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}

export default FAQSection;
