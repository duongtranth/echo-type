'use client';

import { motion, type Transition, type UseInViewOptions, useInView } from 'framer-motion';
import {
  type ElementType,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils';

type HighlightDirection = 'ltr' | 'rtl' | 'ttb' | 'btt';

type TextHighlighterProps = {
  children: ReactNode;
  as?: ElementType;
  triggerType?: 'hover' | 'ref' | 'inView' | 'auto';
  transition?: Transition;
  useInViewOptions?: UseInViewOptions;
  className?: string;
  highlightColor?: string;
  direction?: HighlightDirection;
} & HTMLAttributes<HTMLElement>;

export interface TextHighlighterRef {
  animate: (direction?: HighlightDirection) => void;
  reset: () => void;
}

function getBackgroundSize(direction: HighlightDirection, animated: boolean) {
  switch (direction) {
    case 'ttb':
    case 'btt':
      return animated ? '100% 100%' : '100% 0%';
    default:
      return animated ? '100% 100%' : '0% 100%';
  }
}

function getBackgroundPosition(direction: HighlightDirection) {
  switch (direction) {
    case 'rtl':
      return '100% 0%';
    case 'btt':
      return '0% 100%';
    default:
      return '0% 0%';
  }
}

/** Animated background-sweep highlight, ported from fancycomponents.dev's text-highlighter. */
export const TextHighlighter = forwardRef<TextHighlighterRef, TextHighlighterProps>(
  (
    {
      children,
      as: ElementTag = 'span',
      triggerType = 'inView',
      transition = { type: 'spring', duration: 1, delay: 0, bounce: 0 },
      useInViewOptions = { once: true, initial: false, amount: 0.1 },
      className,
      highlightColor = 'hsl(25, 90%, 80%)',
      direction = 'ltr',
      ...props
    },
    ref,
  ) => {
    const componentRef = useRef<HTMLDivElement>(null);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [currentDirection, setCurrentDirection] = useState<HighlightDirection>(direction);

    useEffect(() => {
      setCurrentDirection(direction);
    }, [direction]);

    const isInView = useInView(componentRef, useInViewOptions);

    useImperativeHandle(ref, () => ({
      animate: (animationDirection?: HighlightDirection) => {
        if (animationDirection) setCurrentDirection(animationDirection);
        setIsAnimating(true);
      },
      reset: () => setIsAnimating(false),
    }));

    const shouldAnimate =
      triggerType === 'hover'
        ? isHovered
        : triggerType === 'inView'
          ? isInView
          : triggerType === 'ref'
            ? isAnimating
            : triggerType === 'auto';

    const animatedSize = useMemo(
      () => getBackgroundSize(currentDirection, shouldAnimate),
      [shouldAnimate, currentDirection],
    );
    const initialSize = useMemo(() => getBackgroundSize(currentDirection, false), [currentDirection]);
    const backgroundPosition = useMemo(() => getBackgroundPosition(currentDirection), [currentDirection]);

    const highlightStyle: React.CSSProperties = {
      backgroundImage: `linear-gradient(${highlightColor}, ${highlightColor})`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition,
      backgroundSize: animatedSize,
      boxDecorationBreak: 'clone',
      WebkitBoxDecorationBreak: 'clone',
    } as React.CSSProperties;

    return (
      <ElementTag
        ref={componentRef}
        onMouseEnter={() => triggerType === 'hover' && setIsHovered(true)}
        onMouseLeave={() => triggerType === 'hover' && setIsHovered(false)}
        {...props}
      >
        <motion.span
          className={cn('inline', className)}
          style={highlightStyle}
          animate={{ backgroundSize: animatedSize }}
          initial={{ backgroundSize: initialSize }}
          transition={transition}
        >
          {children}
        </motion.span>
      </ElementTag>
    );
  },
);

TextHighlighter.displayName = 'TextHighlighter';
