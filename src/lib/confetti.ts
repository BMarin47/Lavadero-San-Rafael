'use client';

import confetti from 'canvas-confetti';

export function fireSuccessConfetti() {
  if (typeof window === 'undefined') return;

  // First burst - centered
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#06b6d4', '#3b82f6', '#10b981', '#38bdf8', '#f59e0b'],
  });

  // Second celebratory burst left and right
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#06b6d4', '#60a5fa', '#34d399'],
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#06b6d4', '#60a5fa', '#34d399'],
    });
  }, 250);
}
