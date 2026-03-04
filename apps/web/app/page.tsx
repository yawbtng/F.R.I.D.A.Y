import { BentoFeatures } from '@/components/landing/bento-features';
import { BoldStatement } from '@/components/landing/bold-statement';
import { CTASection } from '@/components/landing/cta-section';
import { DemoSection } from '@/components/landing/demo-section';
import { Footer } from '@/components/landing/footer';
import { GradientDivider } from '@/components/landing/gradient-divider';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Nav } from '@/components/landing/nav';
import { OrbitalLogos } from '@/components/landing/orbital-logos';
import { TechStack } from '@/components/landing/tech-stack';

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-friday-bg text-friday-text-primary">
      <Nav />

      <div className="relative z-10">
        <Hero />
        <DemoSection />
        <BoldStatement />
        <OrbitalLogos />
        <GradientDivider />
        <BentoFeatures />
        <HowItWorks />
        <TechStack />
        <CTASection />
        <Footer />
      </div>
    </main>
  );
}
