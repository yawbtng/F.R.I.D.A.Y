'use client';

import { motion, useScroll, useTransform } from 'framer-motion';

export function AmbientGlow() {
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 600], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ opacity }}
      aria-hidden="true"
    >
      <div
        className="absolute left-[-18%] top-[-26%] h-[30rem] w-[30rem] rounded-full liquid-blob-1"
        style={{
          filter: 'blur(120px)',
          background:
            'radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.1) 35%, transparent 72%)',
        }}
      />
      <div
        className="absolute right-[-22%] top-[4%] h-[32rem] w-[32rem] rounded-full liquid-blob-2"
        style={{
          filter: 'blur(120px)',
          background:
            'radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(59,130,246,0.08) 40%, transparent 74%)',
        }}
      />
      <div
        className="absolute bottom-[-36%] left-[24%] h-[30rem] w-[30rem] rounded-full liquid-blob-1"
        style={{
          filter: 'blur(120px)',
          background:
            'radial-gradient(circle, rgba(59,130,246,0.14) 0%, rgba(99,102,241,0.06) 42%, transparent 72%)',
        }}
      />
    </motion.div>
  );
}
