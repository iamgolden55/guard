import { ReactNode, useEffect } from 'react';
import { motion, useAnimation, Variant } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

interface RevealProps {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  once?: boolean;
  className?: string;
}

// Microsoft-style reveal animations
const RevealAnimation = ({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.5,
  distance = 30,
  once = true,
  className = '',
}: RevealProps) => {
  const controls = useAnimation();
  const [ref, inView] = useInView({
    triggerOnce: once,
    threshold: 0.1,
  });

  // Define animation variants based on direction
  const getVariants = (): Record<string, Variant> => {
    const variants: Record<string, Variant> = {
      hidden: {},
      visible: {
        opacity: 1,
        transition: {
          duration,
          delay,
          ease: [0.25, 0.1, 0.25, 1], // Microsoft uses cubic bezier easing
        },
      },
    };

    switch (direction) {
      case 'up':
        variants.hidden = { opacity: 0, y: distance };
        variants.visible = {
          ...variants.visible,
          y: 0,
        };
        break;
      case 'down':
        variants.hidden = { opacity: 0, y: -distance };
        variants.visible = {
          ...variants.visible,
          y: 0,
        };
        break;
      case 'left':
        variants.hidden = { opacity: 0, x: distance };
        variants.visible = {
          ...variants.visible,
          x: 0,
        };
        break;
      case 'right':
        variants.hidden = { opacity: 0, x: -distance };
        variants.visible = {
          ...variants.visible,
          x: 0,
        };
        break;
      case 'none':
        variants.hidden = { opacity: 0 };
        break;
    }

    return variants;
  };

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    } else if (!once) {
      controls.start('hidden');
    }
  }, [controls, inView, once]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={getVariants()}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default RevealAnimation;
