'use client';

import Link from 'next/link';
import { motion, useMotionTemplate, useScroll, useTransform } from 'framer-motion';

export function Nav() {
  const { scrollY } = useScroll();
  const bgAlpha = useTransform(scrollY, [0, 120], [0.22, 0.78]);
  const borderAlpha = useTransform(scrollY, [0, 120], [0.16, 0.34]);

  const backgroundColor = useMotionTemplate`rgba(9, 9, 11, ${bgAlpha})`;
  const borderColor = useMotionTemplate`rgba(255, 255, 255, ${borderAlpha})`;

  return (
    <motion.nav
      className="fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-2xl"
      style={{ backgroundColor, borderColor }}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-friday-accent shadow-glow" />
          <span className="text-sm font-semibold tracking-wide text-friday-text-primary">
            F.R.I.D.A.Y.
          </span>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/yawbtng/F.R.I.D.A.Y"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring rounded-md px-2 py-1 text-sm text-friday-text-secondary transition-colors hover:text-friday-text-primary"
          >
            GitHub
          </a>
          <Link
            href="/workspace"
            className="focus-ring rounded-full bg-friday-accent/90 px-4 py-1.5 text-sm font-medium text-white shadow-glow transition-all duration-200 hover:bg-friday-accent-hover hover:shadow-[0_0_30px_var(--accent-glow)]"
          >
            Try Friday &rarr;
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
