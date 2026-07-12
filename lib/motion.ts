import { Variants } from "framer-motion";

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } 
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.3, ease: [0.7, 0, 0.84, 0] } 
  }
};

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 15 },
  animate: (custom?: number) => ({
    opacity: 1,
    y: 0,
    transition: { 
      duration: 0.5, 
      ease: [0.16, 1, 0.3, 1],
      delay: custom ? custom * 0.05 : 0 
    }
  })
};

export const staggerChildren: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.06
    }
  }
};

export const transitionFast = { duration: 0.15, ease: "easeInOut" };
export const transitionMedium = { duration: 0.3, ease: [0.16, 1, 0.3, 1] };
