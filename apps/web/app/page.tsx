import { AnnouncementBar } from '@/components/landing/announcement-bar';
import { Nav } from '@/components/landing/nav';
import { Hero } from '@/components/landing/hero';
import { DemoSection } from '@/components/landing/demo-section';
import { BoldStatement } from '@/components/landing/bold-statement';
import { HowItWorks } from '@/components/landing/how-it-works';
import { BentoFeatures } from '@/components/landing/bento-features';
import { UseCases } from '@/components/landing/use-cases';
import { Telemetry } from '@/components/landing/telemetry';
import { CTASection } from '@/components/landing/cta-section';
import { Footer } from '@/components/landing/footer';

// Browserbase-native landing. Section order per redesign spec §4: announce → nav → hero →
// live demo → manifesto → how-it-works → features → telemetry → CTA → footer. Every section
// reads semantic tokens, so the whole page themes light/dark with no per-component branches.
export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-bg text-text">
      <AnnouncementBar />
      <Nav />
      <Hero />
      <DemoSection />
      <BoldStatement />
      <HowItWorks />
      <BentoFeatures />
      <UseCases />
      <Telemetry />
      <CTASection />
      <Footer />
    </main>
  );
}
