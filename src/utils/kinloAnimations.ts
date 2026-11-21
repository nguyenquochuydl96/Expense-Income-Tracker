import { useEffect } from 'react';
import { animate } from 'motion/react';

// Prefers-reduced-motion media query check
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canHover = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Kinlo signature card entrance animation (`ko`)
 * Organic slight alternating rotation tilt, scale 0.96 -> 1, smooth spring ease
 */
export function animateCardsEntrance(
  elements: (Element | null)[] | NodeListOf<Element> | HTMLCollection | Element[],
  options?: { delay?: number; stagger?: number; onComplete?: () => void }
) {
  if (prefersReducedMotion()) return;
  const list = Array.from(elements).filter(Boolean) as HTMLElement[];
  if (!list.length) return;

  const isMobile = !canHover() || (typeof window !== 'undefined' && window.innerWidth < 768);
  const stagger = options?.stagger ?? (isMobile ? 0.03 : 0.05);
  const baseDelay = options?.delay ?? 0;

  const animations = list.map((el, i) => {
    const delay = baseDelay + i * stagger;
    if (isMobile) {
      return animate(
        el,
        { opacity: [0, 1], y: [16, 0] },
        { duration: 0.35, ease: 'easeOut', delay }
      );
    } else {
      const rot = i % 2 === 0 ? -2 : 2;
      return animate(
        el,
        { opacity: [0, 1], y: [32, 0], scale: [0.96, 1], rotate: [rot, 0] },
        { duration: 0.6, ease: [0.34, 1.56, 0.64, 1], delay }
      );
    }
  });

  if (options?.onComplete) {
    Promise.all(animations.map((a) => a.finished)).then(() => {
      options.onComplete?.();
    });
  }

  return animations;
}

/**
 * Kinlo section / row entrance animation (`Oo`)
 * Smooth expo.out glide up
 */
export function animateSectionEntrance(
  elements: (Element | null)[] | NodeListOf<Element> | Element[],
  options?: { y?: number; stagger?: number; delay?: number; onComplete?: () => void }
) {
  if (prefersReducedMotion()) return;
  const list = Array.from(elements).filter(Boolean) as HTMLElement[];
  if (!list.length) return;

  const stagger = options?.stagger ?? 0.04;
  const baseDelay = options?.delay ?? 0;
  const yDist = options?.y ?? 24;

  const animations = list.map((el, i) =>
    animate(
      el,
      { opacity: [0, 1], y: [yDist, 0], scale: [0.985, 1] },
      { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: baseDelay + i * stagger }
    )
  );

  if (options?.onComplete) {
    Promise.all(animations.map((a) => a.finished)).then(() => {
      options.onComplete?.();
    });
  }

  return animations;
}

/**
 * Kinlo button / icon spring bounce (`Io`)
 * Springs the inner SVG on click or hover
 */
export function animateIconBounce(element: Element | null) {
  if (!element || prefersReducedMotion()) return;
  const target = (element.querySelector('svg') || element) as HTMLElement;
  return animate(
    target,
    { scale: [0.72, 1.15, 1] },
    { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
  );
}

/**
 * Kinlo badge / chip pop (`jo`)
 */
export function animateBadgePop(
  element: Element | null,
  options?: { from?: number; delay?: number }
) {
  if (!element || prefersReducedMotion()) return;
  return animate(
    element as HTMLElement,
    { scale: [options?.from ?? 0.6, 1.1, 1], opacity: [0, 1, 1] },
    { duration: 0.55, delay: options?.delay ?? 0, ease: [0.34, 1.56, 0.64, 1] }
  );
}

/**
 * Kinlo bar fill expansion (`Ao`)
 * scaleX: 0 -> 1 with expo.out
 */
export function animateBarScaleX(
  elements: (Element | null)[] | NodeListOf<Element> | Element[],
  options?: { duration?: number; stagger?: number; delay?: number }
) {
  if (prefersReducedMotion()) return;
  const list = Array.from(elements).filter(Boolean) as HTMLElement[];
  if (!list.length) return;

  const stagger = options?.stagger ?? 0.03;
  const baseDelay = options?.delay ?? 0;
  const dur = options?.duration ?? 0.85;

  return list.map((el, i) => {
    el.style.transformOrigin = '0% 50%';
    return animate(
      el,
      { scaleX: [0, 1] },
      { duration: dur, ease: [0.16, 1, 0.3, 1], delay: baseDelay + i * stagger }
    );
  });
}

/**
 * Kinlo interactive card hover lift (`Bo` / `[data-lift]`)
 * Translates -4px on Y smoothly
 */
export function initCardLift(container: HTMLElement | Document = document, yOffset = -4) {
  if (!canHover() || prefersReducedMotion()) return () => {};

  const elements = container.querySelectorAll<HTMLElement>('[data-lift], .kinlo-card, .kinlo-card-night');
  const cleanups: (() => void)[] = [];

  elements.forEach((el) => {
    if ((el as any).__kinloLift) return;
    (el as any).__kinloLift = true;

    let anim: any = null;
    const onEnter = () => {
      anim?.stop?.();
      anim = animate(el, { y: yOffset }, { duration: 0.4, ease: 'easeOut' });
    };

    const onLeave = () => {
      anim?.stop?.();
      anim = animate(el, { y: 0 }, { duration: 0.45, ease: 'easeOut' });
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);

    cleanups.push(() => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      delete (el as any).__kinloLift;
    });
  });

  return () => cleanups.forEach((c) => c());
}

/**
 * Kinlo magnetic button hover tracking (`Ro` / `.magnetic`)
 * Follows cursor with quick spring and returns on leave
 */
export function initMagneticButtons(container: HTMLElement | Document = document) {
  if (!canHover() || prefersReducedMotion()) return () => {};

  const elements = container.querySelectorAll<HTMLElement>('.magnetic');
  const cleanups: (() => void)[] = [];

  elements.forEach((el) => {
    if ((el as any).__kinloMag) return;
    (el as any).__kinloMag = true;

    let animX: any = null;
    let animY: any = null;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width / 2) * 0.22;
      const dy = (e.clientY - rect.top - rect.height / 2) * 0.28;
      animX?.stop?.();
      animY?.stop?.();
      animX = animate(el, { x: dx }, { duration: 0.45, ease: 'easeOut' });
      animY = animate(el, { y: dy }, { duration: 0.45, ease: 'easeOut' });
    };

    const onLeave = () => {
      animX?.stop?.();
      animY?.stop?.();
      animX = animate(el, { x: 0 }, { duration: 0.45, ease: 'easeOut' });
      animY = animate(el, { y: 0 }, { duration: 0.45, ease: 'easeOut' });
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    cleanups.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      delete (el as any).__kinloMag;
    });
  });

  return () => cleanups.forEach((c) => c());
}

/**
 * Kinlo sliding active nav pill indicator (`Uo`)
 * Animates clipPath inset smoothly behind the active item
 */
export function updateSlidingPill(
  pill: HTMLElement | null,
  activeTarget: HTMLElement | null,
  options?: { animate?: boolean; radius?: number }
) {
  if (!pill) return;
  const parent = pill.parentElement;
  if (!activeTarget || !activeTarget.offsetWidth || !parent) {
    pill.style.opacity = '0';
    return;
  }

  const radius = options?.radius ?? 14;
  const parentStyle = getComputedStyle(parent);
  const totalW = /auto|scroll/.test(parentStyle.overflowX) ? parent.scrollWidth : parent.offsetWidth;
  const totalH = /auto|scroll/.test(parentStyle.overflowY) ? parent.scrollHeight : parent.offsetHeight;

  const targetBounds = {
    l: activeTarget.offsetLeft,
    r: Math.max(0, totalW - (activeTarget.offsetLeft + activeTarget.offsetWidth)),
    t: activeTarget.offsetTop,
    b: Math.max(0, totalH - (activeTarget.offsetTop + activeTarget.offsetHeight)),
  };

  const getInset = (b: { t: number; r: number; b: number; l: number }) =>
    `inset(${Math.round(b.t)}px ${Math.round(b.r)}px ${Math.round(b.b)}px ${Math.round(b.l)}px round ${radius}px)`;

  const d = pill as any;
  const prevTarget = d.__targetBounds;
  d.__targetBounds = targetBounds;

  if (!options?.animate || prefersReducedMotion() || !prevTarget || pill.style.opacity === '0') {
    pill.style.clipPath = getInset(targetBounds);
    pill.style.opacity = '1';
    return;
  }

  d.__anim?.stop?.();
  d.__anim = animate(
    (progress: number) => {
      const cur = {
        l: prevTarget.l + (targetBounds.l - prevTarget.l) * progress,
        r: prevTarget.r + (targetBounds.r - prevTarget.r) * progress,
        t: prevTarget.t + (targetBounds.t - prevTarget.t) * progress,
        b: prevTarget.b + (targetBounds.b - prevTarget.b) * progress,
      };
      pill.style.clipPath = getInset(cur);
      pill.style.opacity = '1';
    },
    { duration: 0.38, ease: 'easeInOut' }
  );
}

/**
 * Kinlo Floating score / delta pop-up (`No`)
 * Pops up e.g. "+500,000₫" or "✓ Đã lưu" above target element
 */
export function triggerFloatUp(
  anchor: HTMLElement | null,
  text: string,
  variant: 'good' | 'bad' | 'neutral' = 'good'
) {
  if (!anchor || typeof document === 'undefined' || prefersReducedMotion()) return;
  const rect = anchor.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'kinlo-float-up pointer-events-none fixed font-bold text-xs sm:text-sm z-50 font-mono-tabular';
  el.textContent = text;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top}px`;
  el.style.transform = 'translate(-50%, 0)';
  el.style.color =
    variant === 'good'
      ? 'var(--emerald-600, #059669)'
      : variant === 'bad'
        ? 'var(--rose-600, #e11d48)'
        : 'var(--accent-text, #0f766e)';

  document.body.appendChild(el);

  animate(
    el,
    { opacity: [0, 1, 1, 0], y: [6, -14, -14, -38], scale: [0.9, 1.05, 1.05, 1] },
    { duration: 1.0, times: [0, 0.35, 0.65, 1.0], ease: 'easeOut' }
  ).finished.then(() => {
    el.remove();
  });
}

/**
 * React hook for Kinlo card entrance on mount or key change
 */
export function useKinloCardsEntrance(
  containerRef: React.RefObject<HTMLElement | null>,
  dependencies: any[] = []
) {
  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('.kinlo-card, .kinlo-card-night, [data-card-entrance]');
    if (cards.length > 0) {
      animateCardsEntrance(cards);
    }
  }, dependencies);
}

/**
 * React hook for initializing magnetic buttons and card lift
 */
export function useKinloInteractions(
  containerRef?: React.RefObject<HTMLElement | null>,
  dependencies: any[] = []
) {
  useEffect(() => {
    const root = containerRef?.current ?? document;
    const cleanLift = initCardLift(root);
    const cleanMag = initMagneticButtons(root);

    return () => {
      cleanLift();
      cleanMag();
    };
  }, dependencies);
}
