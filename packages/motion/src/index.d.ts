import type { ScopeConstructorCallback } from "animejs";
import type { RefObject } from "react";

export { animate } from "animejs/animation";
export { createScope } from "animejs/scope";
export * from "./presets.js";

/**
 * Track `prefers-reduced-motion`. SSR-safe: starts from the media query when it
 * exists, otherwise from the server default (false).
 */
export function useReducedMotion(): boolean;

/**
 * Run an anime.js scope inside a React component and revert it on unmount or
 * whenever `deps` change. Returns the ref to spread on the scope root.
 */
export function useAnimeScope<T extends HTMLElement = HTMLElement>(
  setup: ScopeConstructorCallback,
  deps?: unknown[],
): RefObject<T | null>;
