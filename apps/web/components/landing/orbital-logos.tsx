'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { AudioOrb } from '@/components/audio-orb';
import { fadeUp, staggerContainer } from '@/components/landing/animations';
import { OrbitingCircles } from '@/components/ui/orbiting-circles';

type Partner = {
  name: string;
  logo: string;
  color: string;
  ring: 'inner' | 'outer';
  delay: number;
};

const PARTNERS: Partner[] = [
  { name: 'Browserbase', logo: '/logos/browserbase.png', color: 'rgba(249,115,22,0.7)', ring: 'outer', delay: 0 },
  { name: 'Convex', logo: '/logos/convex.png', color: 'rgba(244,63,94,0.7)', ring: 'outer', delay: 11.33 },
  { name: 'Deepgram', logo: '/logos/deepgram.png', color: 'rgba(59,130,246,0.7)', ring: 'outer', delay: 22.66 },
  { name: 'Stagehand', logo: '/logos/stagehand.png', color: 'rgba(139,92,246,0.7)', ring: 'inner', delay: 0 },
  { name: 'LiveKit', logo: '/logos/livekit.png', color: 'rgba(34,197,94,0.7)', ring: 'inner', delay: 8.66 },
  { name: 'Cartesia', logo: '/logos/cartesia.png', color: 'rgba(14,165,233,0.7)', ring: 'inner', delay: 17.33 },
];

export function OrbitalLogos() {
  const inner = PARTNERS.filter((item) => item.ring === 'inner');
  const outer = PARTNERS.filter((item) => item.ring === 'outer');

  return (
    <section className="px-6 py-28 sm:py-32">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={staggerContainer}
        className="mx-auto max-w-6xl"
      >
        <motion.h2
          variants={fadeUp}
          className="text-center text-3xl font-semibold text-friday-text-primary sm:text-4xl"
        >
          Powered by the stack that runs Friday
        </motion.h2>

        <motion.div variants={fadeUp} className="relative mx-auto mt-14 h-[560px] w-full max-w-[680px]">
          <div
            className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(59,130,246,0.09) 0%, rgba(59,130,246,0.03) 45%, transparent 72%)',
            }}
          />

          <div className="absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />

          {inner.map((partner, index) => (
            <OrbitingCircles
              key={partner.name}
              radius={150}
              duration={26}
              delay={partner.delay}
              reverse
              path={index === 0}
              className="size-12 border-none bg-transparent p-0"
            >
              <Image
                src={partner.logo}
                alt={`${partner.name} logo`}
                width={46}
                height={46}
                className="h-full w-full object-contain"
                style={{
                  filter: `drop-shadow(0 0 12px ${partner.color}) drop-shadow(0 0 20px rgba(0,0,0,0.35))`,
                }}
              />
            </OrbitingCircles>
          ))}

          {outer.map((partner, index) => (
            <OrbitingCircles
              key={partner.name}
              radius={230}
              duration={34}
              delay={partner.delay}
              path={index === 0}
              className="size-12 border-none bg-transparent p-0"
            >
              <Image
                src={partner.logo}
                alt={`${partner.name} logo`}
                width={46}
                height={46}
                className="h-full w-full object-contain"
                style={{
                  filter: `drop-shadow(0 0 12px ${partner.color}) drop-shadow(0 0 20px rgba(0,0,0,0.35))`,
                }}
              />
            </OrbitingCircles>
          ))}

          <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.14] bg-[rgba(10,12,18,0.86)] backdrop-blur-xl">
            <div className="absolute inset-0 flex items-center justify-center">
              <AudioOrb state="idle" className="scale-95" />
            </div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-friday-text-muted">F.R.I.D.A.Y.</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
