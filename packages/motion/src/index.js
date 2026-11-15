/**
 * @qazsupply/motion - anime.js v4 helpers for React.
 *
 * Uses subpath imports (animejs/scope, animejs/animation) and the
 * createScope + revert lifecycle so every animation is torn down on unmount
 * (docs/design/design-system.md). Import presets from the DOM-free `./presets` entry in tests.
 */

import { animate } from "animejs/animation";
import { createScope } from "animejs/scope";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, reduceMotionQuery } from "./presets.js";

export * from "./presets.js";
export { animate, createScope, prefersReducedMotion };

/**
 * Track `prefers-reduced-motion`. SSR-safe: starts from the media query when it
 * exists, otherwise from the server default (false).
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== "function") return undefined;
    const query = globalThis.matchMedia(reduceMotionQuery);
    const onChange = () => setReduced(query.matches);
    onChange();
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Run an anime.js scope inside a React component and revert it on unmount or
 * whenever `deps` change. Returns the ref to spread on the scope root.
 * @param {import("animejs").ScopeConstructorCallback} setup
 * @param {unknown[]} [deps]
 */
export function useAnimeScope(setup, deps = []) {
  const root = useRef(null);

  useEffect(() => {
    const scope = createScope({ root }).add(setup);
    return () => scope.revert();
    // biome-ignore lint/correctness/useExhaustiveDependencies: caller owns the dependency list
  }, deps);

  return root;
}
