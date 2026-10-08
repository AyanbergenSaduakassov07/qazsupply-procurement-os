export type AnimationParams = Record<string, unknown>;

export type PresetName =
  | "fadeIn"
  | "fadeOut"
  | "slideIn"
  | "slideOut"
  | "panelIn"
  | "panelOut"
  | "press";

export interface MotionOptions {
  reducedMotion?: boolean;
}

export const durations: Readonly<{ micro: 200; complex: 360; max: 400 }>;
export const staggerLimit: 8;
export const staggerStep: 30;
export const reduceMotionQuery: "(prefers-reduced-motion: reduce)";
export const presets: Readonly<Record<PresetName, AnimationParams>>;

export function prefersReducedMotion(): boolean;
export function resolvePreset(name: PresetName, options?: MotionOptions): AnimationParams;
export function stagger(index: number, options?: MotionOptions & { limit?: number }): number;
export function countUp(from: number, to: number, progress: number): number;
