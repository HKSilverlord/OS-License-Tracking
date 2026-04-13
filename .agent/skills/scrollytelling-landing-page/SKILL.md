---
name: scrollytelling-landing-page
description: Build cinematic, scroll-driven landing pages with sticky sections, scroll-triggered reveal animations, and smooth scrolling. Covers GSAP ScrollTrigger, Framer Motion, Lenis, AOS, section architecture, and conversion-optimized layout patterns.
---

# Scrollytelling Landing Page Builder

## What Is Scrollytelling?

Scrollytelling is a web design pattern where the page tells a **narrative story as the user scrolls**, using scroll-triggered animations, sticky pinned sections, and cinematic pacing to create a PowerPoint-like animation experience — but in the browser.

**Key Characteristics**:
- Sections animate in/out based on scroll position
- Elements reveal themselves (fade-in, slide-up, zoom-in) as they enter the viewport
- Sticky sections pin in place while content transforms around them
- Smooth, buttery scrolling creates a premium feel
- Each scroll "frame" delivers one digestible piece of information

---

## Animation Library Decision Matrix

| Library | Best For | Size | Difficulty | React Support |
|---------|----------|------|------------|---------------|
| **GSAP + ScrollTrigger** | Complex timelines, sticky pins, scrub animations | ~30KB | Medium | ✅ via `useEffect` |
| **Framer Motion** | Declarative React animations, `whileInView` reveals | ~30KB | Easy | ✅ Native |
| **Lenis** | Smooth scrolling ("buttery" feel) | ~3KB | Easy | ✅ via hook |
| **AOS (Animate On Scroll)** | Simple fade/slide reveals (quick & dirty) | ~14KB | Very Easy | ✅ via `data-aos` |
| **Intersection Observer** | Zero-dependency viewport detection | 0KB | Medium | ✅ Native API |

### Recommended Stack

```
Lenis (smooth scroll) + GSAP ScrollTrigger (sticky/scrub) + Framer Motion (simple reveals)
```

**Or for lightweight projects**:
```
Lenis (smooth scroll) + Intersection Observer + CSS transitions
```

---

## Installation

### Full Stack (GSAP + Lenis)

```bash
npm install gsap lenis
```

### Lightweight (Framer Motion only)

```bash
npm install framer-motion
```

### Quick & Easy (AOS)

```bash
npm install aos
```

---

## Core Patterns

### Pattern 1: Smooth Scrolling with Lenis

Lenis creates "buttery smooth" scrolling (~3KB). This is the foundation — install it first.

```tsx
// hooks/useSmoothScroll.ts
import { useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

export function useSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,        // Smoothness (0.05 = very smooth, 0.1 = balanced)
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);
}
```

### Pattern 2: Lenis + GSAP ScrollTrigger Sync

When combining Lenis with GSAP, you MUST synchronize them:

```tsx
// hooks/useSmoothScrollGSAP.ts
import { useEffect } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function useSmoothScrollGSAP() {
  useEffect(() => {
    const lenis = new Lenis();

    // Sync: tell ScrollTrigger every time Lenis scrolls
    lenis.on('scroll', ScrollTrigger.update);

    // Use GSAP ticker for Lenis RAF (keeps them in sync)
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0); // CRITICAL: prevents jitter

    return () => {
      lenis.destroy();
      gsap.ticker.remove();
    };
  }, []);
}
```

### Pattern 3: Sticky Pinned Section (GSAP ScrollTrigger)

The signature scrollytelling effect — a section **pins in place** while content animates within it:

```tsx
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function StickyFeatureSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=3000',     // How long the pin lasts (pixels of scroll)
          scrub: 1,          // Smooth link to scroll position
          pin: true,         // PIN the section in place
          anticipatePin: 1,  // Prevents flash on pin start
        },
      });

      // Step 1: Fade in first card
      tl.from('.card-1', { opacity: 0, y: 60, duration: 1 })
        // Step 2: Fade in second card
        .from('.card-2', { opacity: 0, y: 60, duration: 1 })
        // Step 3: Scale up the image
        .to('.hero-image', { scale: 1.1, duration: 1 }, '<');
    }, containerRef);

    return () => ctx.revert(); // CLEANUP: prevents memory leaks
  }, []);

  return (
    <div ref={containerRef} className="relative h-screen overflow-hidden">
      <div className="card-1">{/* Content */}</div>
      <div className="card-2">{/* Content */}</div>
      <img className="hero-image" src="..." alt="" />
    </div>
  );
}
```

### Pattern 4: Scroll-Triggered Reveal (Framer Motion)

The simplest way to make elements animate in as they scroll into view:

```tsx
import { motion } from 'framer-motion';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const offsets = {
  up:    { y: 60 },
  down:  { y: -60 },
  left:  { x: 60 },
  right: { x: -60 },
};

export function ScrollReveal({ children, delay = 0, direction = 'up' }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, ...offsets[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.7, delay, ease: 'easeOut' }}
      viewport={{ once: true, margin: '-100px' }}
    >
      {children}
    </motion.div>
  );
}
```

Usage:
```tsx
<ScrollReveal direction="up">
  <h2 className="text-4xl font-bold">Features</h2>
</ScrollReveal>
<ScrollReveal direction="up" delay={0.2}>
  <p className="text-lg text-slate-600">Description here</p>
</ScrollReveal>
```

### Pattern 5: Stagger Reveal (Children Appear One by One)

```tsx
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export function StaggerGrid({ items }: { items: React.ReactNode[] }) {
  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-3 gap-8"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {items.map((item, i) => (
        <motion.div key={i} variants={itemVariants}>
          {item}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### Pattern 6: Zero-Dependency Reveal (Intersection Observer)

No libraries needed — pure React + CSS transitions:

```tsx
import { useEffect, useRef, useState } from 'react';

function useIsVisible(options = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.15, ...options }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

export function FadeInSection({ children }: { children: React.ReactNode }) {
  const { ref, isVisible } = useIsVisible();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
    >
      {children}
    </div>
  );
}
```

---

## Landing Page Section Architecture

### Recommended Section Order (Conversion-Optimized)

```
┌─────────────────────────────────────┐
│  1. NAVBAR (sticky/transparent)     │  ← Logo + minimal links + CTA button
├─────────────────────────────────────┤
│  2. HERO (above the fold)           │  ← Headline + subheadline + CTA + visual
├─────────────────────────────────────┤
│  3. SOCIAL PROOF BAR                │  ← Logo strip: "Trusted by X, Y, Z"
├─────────────────────────────────────┤
│  4. FEATURES / BENEFITS             │  ← 3-4 cards or icon+text blocks
├─────────────────────────────────────┤
│  5. HOW IT WORKS                    │  ← 3-step process with numbered steps
├─────────────────────────────────────┤
│  6. STICKY DEMO / SHOWCASE          │  ← Pinned section with scroll-driven demo
├─────────────────────────────────────┤
│  7. TESTIMONIALS                    │  ← Customer quotes, photos, star ratings
├─────────────────────────────────────┤
│  8. PRICING                         │  ← Clear tiers, highlighted recommended plan
├─────────────────────────────────────┤
│  9. FAQ                             │  ← Accordion, addresses objections
├─────────────────────────────────────┤
│  10. FINAL CTA                      │  ← Last push: headline + button + guarantee
├─────────────────────────────────────┤
│  11. FOOTER                         │  ← Links, legal, social icons
└─────────────────────────────────────┘
```

### Section Component File Structure

```
components/landing/
├── Navbar.tsx
├── Hero.tsx
├── SocialProofBar.tsx
├── Features.tsx
├── HowItWorks.tsx
├── StickyShowcase.tsx      ← The scrollytelling star section
├── Testimonials.tsx
├── Pricing.tsx
├── FAQ.tsx
├── FinalCTA.tsx
└── Footer.tsx
```

---

## Hero Section Variants

### Variant A: Centered Hero (Most Common)
```
          [HEADLINE]
        [Subheadline text]
     [Primary CTA] [Secondary CTA]
         [Product Screenshot]
```

### Variant B: Split Hero (Text + Visual)
```
[HEADLINE]              [Product Image
[Subheadline]            or 3D visual
[CTA Button]             or video]
```

### Variant C: Full-Screen Video/Gradient Hero
```
┌─────────────────────────────────────┐
│     (background video/gradient)     │
│                                     │
│          [HEADLINE]                 │
│        [Subheadline]                │
│      [CTA] [CTA Secondary]         │
│                                     │
└─────────────────────────────────────┘
```

### Hero Tailwind Pattern (Centered)
```tsx
<section className="relative min-h-screen flex items-center justify-center
  bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 overflow-hidden">

  {/* Background effects */}
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))]
    from-blue-900/20 via-transparent to-transparent" />

  <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
    {/* Badge */}
    <div className="inline-flex items-center px-4 py-1.5 rounded-full
      bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
      ✨ Now available
    </div>

    {/* Headline */}
    <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-[1.1] mb-6">
      Build something
      <span className="bg-gradient-to-r from-blue-400 to-cyan-400
        bg-clip-text text-transparent"> amazing</span>
    </h1>

    {/* Subheadline */}
    <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
      The modern platform for teams who want to ship faster,
      iterate smarter, and delight their users.
    </p>

    {/* CTAs */}
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="#" className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500
        text-white font-semibold rounded-xl transition-all shadow-lg
        shadow-blue-500/25 hover:shadow-blue-500/40">
        Get Started Free
      </a>
      <a href="#" className="px-8 py-3.5 border border-slate-600
        text-slate-300 hover:text-white hover:border-slate-400
        font-medium rounded-xl transition-all">
        Watch Demo →
      </a>
    </div>
  </div>
</section>
```

---

## Social Proof Bar Pattern

```tsx
<section className="py-12 border-y border-slate-200 bg-white">
  <div className="max-w-6xl mx-auto px-6">
    <p className="text-center text-sm font-medium text-slate-500 mb-8">
      Trusted by teams at
    </p>
    <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6
      opacity-60 grayscale hover:grayscale-0 transition-all">
      {logos.map(logo => (
        <img key={logo.name} src={logo.src} alt={logo.name}
          className="h-7 object-contain" />
      ))}
    </div>
  </div>
</section>
```

---

## Sticky Showcase Section (The Star Element)

This is the **signature scrollytelling section** — a sticky container where content transforms as the user scrolls:

```tsx
// components/landing/StickyShowcase.tsx
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { title: 'Step 1: Connect', desc: 'Link your data sources in one click.', image: '/step1.png' },
  { title: 'Step 2: Analyze', desc: 'AI-powered insights in seconds.',       image: '/step2.png' },
  { title: 'Step 3: Ship',    desc: 'Deploy to production with confidence.', image: '/step3.png' },
];

export function StickyShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      steps.forEach((_, i) => {
        gsap.timeline({
          scrollTrigger: {
            trigger: `.step-${i}`,
            start: 'top center',
            end: 'bottom center',
            scrub: true,
          },
        })
        .to(`.showcase-image-${i}`, { opacity: 1, scale: 1, duration: 0.5 })
        .from(`.showcase-text-${i}`, { opacity: 0, x: -40, duration: 0.5 }, '<');
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Left: Scrolling text steps */}
          <div className="space-y-[50vh]">
            {steps.map((step, i) => (
              <div key={i} className={`step-${i} py-24`}>
                <div className={`showcase-text-${i}`}>
                  <h3 className="text-3xl font-bold text-slate-900 mb-4">{step.title}</h3>
                  <p className="text-lg text-slate-600">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Sticky image area */}
          <div className="hidden lg:block">
            <div className="sticky top-1/4">
              {steps.map((step, i) => (
                <img key={i}
                  src={step.image}
                  alt={step.title}
                  className={`showcase-image-${i} absolute inset-0 w-full rounded-2xl
                    shadow-2xl opacity-0 scale-95 transition-all`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

---

## CTA Button Patterns

### Primary CTA (High Contrast)
```tsx
<button className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500
  text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25
  hover:shadow-blue-500/40 transition-all duration-200">
  Get Started Free
</button>
```

### Ghost CTA (Secondary)
```tsx
<button className="px-8 py-3.5 border border-slate-300 text-slate-700
  hover:border-slate-900 hover:text-slate-900 font-medium rounded-xl
  transition-all duration-200">
  Learn More →
</button>
```

### Effective CTA Texts

| ✅ High-converting | ❌ Weak |
|--------------------|---------|
| "Get Started Free" | "Submit" |
| "Start Your Free Trial" | "Click Here" |
| "See It In Action" | "Learn More" |
| "Join 10,000+ Teams" | "Sign Up" |
| "Try For Free — No Card Required" | "Register" |

### Microcopy Under CTAs
Always add trust-building microcopy below CTA buttons:
```
✓ No credit card required
✓ Free 14-day trial
✓ Cancel anytime
✓ Setup in under 2 minutes
```

---

## 2026 Design Trends to Apply

### 1. Cinematic Pacing
- Each scroll "frame" = one message
- Generous whitespace between sections (`py-24` or `py-32`)
- Don't rush — let animations breathe

### 2. Dark Mode by Default
- Dark backgrounds (`slate-950`, `slate-900`) for hero sections
- Light content sections for contrast and readability
- Gradient transitions between dark and light

### 3. Kinetic Typography
- Headlines that grow/shrink/slide as you scroll
- Text gradients: `bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent`
- Variable font weight animation

### 4. Bento Grid Layouts
- Modular cards in asymmetric grids for feature sections
- Mixed card sizes (1×1, 2×1, 1×2)
- Rounded corners (`rounded-2xl` or `rounded-3xl`)

### 5. Radial Gradient Backgrounds
```tsx
<div className="bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]
  from-blue-900/20 via-slate-950 to-slate-950" />
```

### 6. Glassmorphism Nav
```tsx
<nav className="fixed top-0 w-full z-50 backdrop-blur-xl bg-white/70
  border-b border-slate-200/50">
```

---

## Performance Rules

### Animation Performance
- ✅ Animate `transform` (x, y, scale, rotate) and `opacity` — these are GPU-composited
- ❌ Never animate `width`, `height`, `top`, `left`, `margin`, `padding` — causes layout reflow
- ✅ Use `will-change: transform` on elements about to animate
- ✅ Use `viewport={{ once: true }}` on reveal animations (don't re-trigger)

### GSAP Cleanup in React
```tsx
useEffect(() => {
  const ctx = gsap.context(() => {
    // ... all GSAP animations here
  }, containerRef);   // Scope to container

  return () => ctx.revert();  // ALWAYS cleanup
}, []);
```

### ScrollTrigger Best Practices
- Call `ScrollTrigger.refresh()` after dynamic content loads
- Use `ScrollTrigger.matchMedia()` for mobile-specific behavior
- Never mix CSS `position: sticky` with GSAP `pin: true` on same element
- Set `gsap.ticker.lagSmoothing(0)` when using Lenis

### Page Load
- Lazy-load images below the fold
- Preload hero section fonts and images
- Target < 3 second First Contentful Paint
- Use `loading="lazy"` on all non-hero images

---

## Quick Reference: CSS Animation Classes (Tailwind)

For simple reveals without JS libraries:

```css
/* In your CSS file, after @import "tailwindcss" */

@keyframes fade-up {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

.animate-fade-up  { animation: fade-up 0.7s ease-out forwards; }
.animate-fade-in  { animation: fade-in 0.7s ease-out forwards; }
.animate-scale-in { animation: scale-in 0.6s ease-out forwards; }
```

---

## Complete Landing Page Skeleton

```tsx
// pages/LandingPage.tsx
import { useSmoothScroll } from '../hooks/useSmoothScroll';
import { ScrollReveal } from '../components/ScrollReveal';

export default function LandingPage() {
  useSmoothScroll();

  return (
    <div className="bg-white text-slate-900">
      <Navbar />

      <Hero />

      <ScrollReveal>
        <SocialProofBar />
      </ScrollReveal>

      <ScrollReveal>
        <Features />
      </ScrollReveal>

      <ScrollReveal>
        <HowItWorks />
      </ScrollReveal>

      <StickyShowcase />   {/* Self-managed scroll animations */}

      <ScrollReveal>
        <Testimonials />
      </ScrollReveal>

      <ScrollReveal>
        <Pricing />
      </ScrollReveal>

      <ScrollReveal>
        <FAQ />
      </ScrollReveal>

      <ScrollReveal>
        <FinalCTA />
      </ScrollReveal>

      <Footer />
    </div>
  );
}
```
