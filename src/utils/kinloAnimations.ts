import gsap from 'gsap';
import { useEffect, useRef } from 'react';

// Expose gsap globally for debugging and inspection
if (typeof window !== 'undefined') {
  (window as any).gsap = gsap;
}

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
 * Organic slight alternating rotation tilt, scale 0.95 -> 1, back.out(1.4)
 */
export function animateCardsEntrance(
  elements: (Element | null)[] | NodeListOf<Element> | HTMLCollection | Element[],
  options?: { delay?: number; stagger?: number; onComplete?: () => void }
) {
  if (prefersReducedMotion()) return;
  const list = Array.from(elements).filter(Boolean) as Element[];
  if (!list.length) return;

  const isMobile = !canHover() || (typeof window !== 'undefined' && window.innerWidth < 768);

  if (isMobile) {
    return gsap.fromTo(
      list,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.35,
        ease: 'power2.out',
        stagger: options?.stagger ?? 0.03,
        delay: options?.delay ?? 0,
        overwrite: 'auto',
        clearProps: 'transform,opacity',
        onComplete: options?.onComplete,
      }
    );
  }

  return gsap.fromTo(
    list,
    {
      opacity: 0,
      y: 32,
      rotation: (i: number) => (i % 2 === 0 ? -2 : 2),
      scale: 0.96,
    },
    {
      opacity: 1,
      y: 0,
      rotation: 0,
      scale: 1,
      duration: 0.6,
      ease: 'back.out(1.4)',
      stagger: options?.stagger ?? 0.05,
      delay: options?.delay ?? 0,
      overwrite: 'auto',
      clearProps: 'transform,opacity',
      onComplete: options?.onComplete,
    }
  );
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
  const list = Array.from(elements).filter(Boolean) as Element[];
  if (!list.length) return;

  return gsap.fromTo(
    list,
    {
      opacity: 0,
      y: options?.y ?? 24,
      scale: 0.985,
    },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.7,
      ease: 'expo.out',
      stagger: options?.stagger ?? 0.04,
      delay: options?.delay ?? 0,
      clearProps: 'transform,opacity',
      onComplete: options?.onComplete,
    }
  );
}

/**
 * Kinlo button / icon spring bounce (`Io`)
 * Springs the inner SVG on click or hover with back.out(3)
 */
export function animateIconBounce(element: Element | null) {
  if (!element || prefersReducedMotion()) return;
  const target = element.querySelector('svg') || element;
  return gsap.fromTo(
    target,
    { scale: 0.72 },
    {
      scale: 1,
      duration: 0.5,
      ease: 'back.out(3)',
      overwrite: true,
      clearProps: 'transform',
    }
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
  return gsap.fromTo(
    element,
    { scale: options?.from ?? 0.6, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration: 0.55,
      ease: 'back.out(3)',
      delay: options?.delay ?? 0,
      clearProps: 'transform,opacity',
    }
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
  const list = Array.from(elements).filter(Boolean) as Element[];
  if (!list.length) return;

  return gsap.fromTo(
    list,
    {
      scaleX: 0,
      transformOrigin: '0% 50%',
    },
    {
      scaleX: 1,
      duration: options?.duration ?? 0.85,
      ease: 'expo.out',
      stagger: options?.stagger ?? 0.03,
      delay: options?.delay ?? 0,
      clearProps: 'transform',
    }
  );
}

/**
 * Kinlo interactive card hover lift (`Bo` / `[data-lift]`)
 * Translates -4px on Y smoothly with power3.out
 */
export function initCardLift(container: HTMLElement | Document = document, yOffset = -4) {
  if (!canHover() || prefersReducedMotion()) return () => {};

  const elements = container.querySelectorAll<HTMLElement>('[data-lift], .kinlo-card, .kinlo-card-night');
  const cleanups: (() => void)[] = [];

  elements.forEach((el) => {
    if ((el as any).__kinloLift) return;
    (el as any).__kinloLift = true;

    const onEnter = () => {
      gsap.to(el, { y: yOffset, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
    };

    const onLeave = () => {
      gsap.to(el, { y: 0, duration: 0.45, ease: 'power3.out', overwrite: 'auto', clearProps: 'transform' });
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
 * Follows cursor with quickTo and springs back on leave
 */
export function initMagneticButtons(container: HTMLElement | Document = document) {
  if (!canHover() || prefersReducedMotion()) return () => {};

  const elements = container.querySelectorAll<HTMLElement>('.magnetic');
  const cleanups: (() => void)[] = [];

  elements.forEach((el) => {
    if ((el as any).__kinloMag) return;
    (el as any).__kinloMag = true;

    const quickX = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
    const quickY = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width / 2) * 0.22;
      const dy = (e.clientY - rect.top - rect.height / 2) * 0.28;
      quickX(dx);
      quickY(dy);
    };

    const onLeave = () => {
      quickX(0);
      quickY(0);
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
    gsap.set(pill, { opacity: 0 });
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

  if (!options?.animate || prefersReducedMotion() || !prevTarget || Number(gsap.getProperty(pill, 'opacity')) === 0) {
    gsap.killTweensOf(d.__state ?? {});
    d.__state = { ...targetBounds };
    gsap.set(pill, { clipPath: getInset(targetBounds), opacity: 1 });
    return;
  }

  const animState = d.__state ?? { ...prevTarget };
  d.__state = animState;
  gsap.killTweensOf(animState);

  const applyClip = () => {
    gsap.set(pill, { clipPath: getInset(animState), opacity: 1 });
  };

  gsap.to(animState, {
    l: targetBounds.l,
    r: targetBounds.r,
    t: targetBounds.t,
    b: targetBounds.b,
    duration: 0.38,
    ease: 'power3.inOut',
    onUpdate: applyClip,
  });
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

  gsap.fromTo(
    el,
    { opacity: 0, y: 6, scale: 0.9 },
    {
      keyframes: [
        { opacity: 1, y: -14, scale: 1.05, duration: 0.35, ease: 'back.out(2)' },
        { opacity: 0, y: -38, duration: 0.65, ease: 'power2.in', delay: 0.4 },
      ],
      onComplete: () => el.remove(),
    }
  );
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
