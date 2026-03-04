'use client';

import { motion } from 'framer-motion';
import { fadeUp, scaleIn, staggerContainer } from '@/components/landing/animations';

const CALLOUTS = [
  {
    title: 'LiveKit WebRTC',
    detail: 'Voice in, voice out - under 200ms round-trip.',
  },
  {
    title: 'Stagehand v3',
    detail: 'AI-powered browser control, not brittle CSS selectors.',
  },
  {
    title: 'Convex',
    detail: 'Screenshots show up the instant they\'re taken.',
  },
  {
    title: 'Browserbase',
    detail: 'A real browser that sticks around between commands.',
  },
];

export function TechStack() {
  return (
    <section className="px-6 py-32 sm:py-40">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={staggerContainer}
        className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2"
      >
        <motion.div variants={scaleIn} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl sm:p-7">
          <p className="mb-4 text-xs uppercase tracking-[0.18em] text-friday-text-muted">
            Runtime Flow
          </p>
          <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-friday-text-secondary">
            <code>
              <span className="text-friday-text-muted">
                // Voice command -&gt; browser execution -&gt; spoken result
              </span>
              {'\n'}
              <span className="text-blue-300">user</span>
              <span className="text-friday-text-primary">: </span>
              <span className="text-emerald-300">&quot;Find the top Hacker News story&quot;</span>
              {'\n\n'}
              <span className="text-violet-300">await</span>
              <span className="text-friday-text-primary"> stagehand.act(</span>
              <span className="text-emerald-300">&quot;navigate to news.ycombinator.com&quot;</span>
              <span className="text-friday-text-primary">)</span>
              {'\n'}
              <span className="text-violet-300">const</span>
              <span className="text-friday-text-primary"> data = </span>
              <span className="text-violet-300">await</span>
              <span className="text-friday-text-primary"> stagehand.extract(&#123;</span>
              {'\n'}
              <span className="text-friday-text-primary">  instruction: </span>
              <span className="text-emerald-300">&quot;get the #1 story title and points&quot;</span>
              <span className="text-friday-text-primary">,</span>
              {'\n'}
              <span className="text-friday-text-primary">  schema: z.object(&#123; title: z.string(), points: z.number() &#125;)</span>
              {'\n'}
              <span className="text-friday-text-primary">&#125;)</span>
              {'\n\n'}
              <span className="text-friday-text-primary">friday.say(</span>
              <span className="text-emerald-300">`The top story is ${'${data.title}'} with ${'${data.points}'} points`</span>
              <span className="text-friday-text-primary">)</span>
            </code>
          </pre>
        </motion.div>

        <motion.div variants={staggerContainer} className="space-y-4">
          {CALLOUTS.map((item) => (
            <motion.article
              key={item.title}
              variants={fadeUp}
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl"
            >
              <h3 className="text-lg font-semibold text-friday-text-primary">{item.title}</h3>
              <p className="mt-2 text-sm text-friday-text-secondary">{item.detail}</p>
            </motion.article>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
