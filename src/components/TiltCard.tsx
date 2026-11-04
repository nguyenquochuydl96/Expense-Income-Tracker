import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'motion/react';

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  glare?: boolean;
}

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  style = {},
  onClick,
  glare = true,
  ...props
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Normalized pointer coordinates from 0 to 1 (center is 0.5)
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  // Smooth springs for 3D rotation angles (-7deg to +7deg)
  const rotateXSpring = useSpring(useTransform(y, [0, 1], [6, -6]), {
    damping: 24,
    stiffness: 280,
  });
  const rotateYSpring = useSpring(useTransform(x, [0, 1], [-6, 6]), {
    damping: 24,
    stiffness: 280,
  });

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only apply tilt on pointer fine devices (mouse/stylus), avoid touch jank
    if (e.pointerType === 'touch') return;
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    x.set(px);
    y.set(py);
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    setIsHovered(true);
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    x.set(0.5);
    y.set(0.5);
  };

  // Metallic glass reflection coordinates
  const glareXPercent = useTransform(x, [0, 1], [0, 100]);
  const glareYPercent = useTransform(y, [0, 1], [0, 100]);
  const backgroundSheen = useMotionTemplate`radial-gradient(circle at ${glareXPercent}% ${glareYPercent}%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.06) 35%, transparent 68%)`;

  return (
    <div style={{ perspective: 1000 }} className="relative h-full">
      <motion.div
        ref={ref}
        style={{
          rotateX: rotateXSpring,
          rotateY: rotateYSpring,
          transformStyle: 'preserve-3d',
          ...style,
        }}
        whileHover={{
          scale: 1.02,
          y: -3,
          transition: { duration: 0.18, ease: 'easeOut' },
        }}
        whileTap={{ scale: 0.98 }}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onClick={onClick}
        className={`relative overflow-hidden rounded-xl transition-shadow duration-300 ${
          isHovered ? 'shadow-xl' : 'shadow-xs'
        } ${className}`}
        {...(props as any)}
      >
        {/* Dynamic metallic sheen reflection overlay */}
        {glare && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
            style={{
              opacity: isHovered ? 1 : 0,
              background: backgroundSheen,
            }}
          />
        )}

        {/* Content elevated in Z-space */}
        <div style={{ transform: 'translateZ(8px)' }} className="relative z-0 h-full">
          {children}
        </div>
      </motion.div>
    </div>
  );
};
