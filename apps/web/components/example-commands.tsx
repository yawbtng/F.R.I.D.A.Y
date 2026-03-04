'use client';

import { motion } from 'framer-motion';

interface ExampleCommandsProps {
  onCommand: (cmd: string) => void;
  /** Disable chips while a command is executing */
  disabled?: boolean;
}

const COMMANDS = [
  'Search Hacker News',
  'Read top story',
  'Compare iPhone prices',
  'Extract GitHub trending',
  'Find best flights to Tokyo',
] as const;

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const chipVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 25,
    },
  },
};

export function ExampleCommands({ onCommand, disabled = false }: ExampleCommandsProps) {
  return (
    <motion.div
      className="flex flex-col gap-2"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {COMMANDS.map((cmd) => (
        <motion.button
          key={cmd}
          variants={chipVariants}
          onClick={() => onCommand(cmd)}
          disabled={disabled}
          className={`
            group relative px-4 py-2.5 rounded-full text-sm font-medium
            text-friday-text-secondary
            border border-friday-border
            bg-friday-secondary
            transition-all duration-200 ease-out
            hover:text-friday-text-primary
            hover:border-friday-accent
            hover:shadow-glow
            hover:bg-friday-elevated
            active:scale-[0.98]
            disabled:opacity-40 disabled:pointer-events-none
            text-left
          `}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="relative z-10">{cmd}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
