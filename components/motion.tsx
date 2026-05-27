"use client";

import { motion, AnimatePresence, useReducedMotion, type Variants, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

export { motion, AnimatePresence, useReducedMotion };

// Standard easing curves used across the app.
export const EASE_OUT = [0.22, 0.61, 0.36, 1] as const;

// Generic fade-up: opacity 0→1, y 6→0. Default 200ms.
export function FadeIn({
  children,
  delay = 0,
  duration = 0.2,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  as?: keyof typeof motion;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      className={className}
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: EASE_OUT }}
    >
      {children}
    </Comp>
  );
}

const STAGGER_PARENT: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
};
const STAGGER_CHILD: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
};

// Use to wrap a list whose direct children should fade-up in sequence.
export function StaggerList({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof typeof motion;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  if (reduce) {
    // Render children without animation but still mount.
    const Static = as as unknown as "div";
    return <Static className={className}>{children as React.ReactNode}</Static>;
  }
  return (
    <Comp
      className={className}
      variants={STAGGER_PARENT}
      initial="hidden"
      animate="show"
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof typeof motion;
}) {
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp className={className} variants={STAGGER_CHILD}>
      {children}
    </Comp>
  );
}

// Drop-in <button> replacement with subtle press feedback.
export const PressableButton = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<"button">
>(function PressableButton({ children, ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.08 }}
      {...props}
    >
      {children}
    </motion.button>
  );
});
