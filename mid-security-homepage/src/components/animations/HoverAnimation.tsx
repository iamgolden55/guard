import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface HoverAnimationProps {
  children: ReactNode;
  scale?: number;
  elevation?: boolean;
  rotate?: boolean;
  className?: string;
}

// Microsoft-style hover animations
const HoverAnimation = ({
  children,
  scale = 1.02,
  elevation = true,
  rotate = false,
  className = '',
}: HoverAnimationProps) => {
  return (
    <motion.div
      className={className}
      whileHover={{
        scale,
        rotate: rotate ? 1 : 0,
        y: elevation ? -5 : 0,
        transition: {
          duration: 0.2,
          ease: [0.25, 0.1, 0.25, 1] // Microsoft's easing function
        },
      }}
      whileTap={{
        scale: 0.98,
        transition: {
          duration: 0.1
        }
      }}
    >
      {children}
    </motion.div>
  );
};

export default HoverAnimation;
