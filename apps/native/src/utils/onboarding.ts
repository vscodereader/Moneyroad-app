// MoneyRoad — onboarding completion state, persisted with expo-secure-store.
// Onboarding is shown once: after the user finishes (or skips), the flag is
// stored and onboarding is permanently skipped on subsequent launches.
// SecureStore is native-only, so web falls back to a non-persistent session.

import { getItemAsync, setItemAsync } from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

const STORAGE_KEY = "mr.onboarded.v1";
const isNative = Platform.OS !== "web";

// null = not yet hydrated from storage.
let onboarded: boolean | null = null;
let hydrating = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function loadOnboarded(): Promise<void> {
  let value = false;
  if (isNative) {
    try {
      value = (await getItemAsync(STORAGE_KEY)) === "1";
    } catch {
      value = false;
    }
  }
  onboarded = value;
  hydrating = false;
  emit();
}

export function hydrateOnboarding(): void {
  if (onboarded !== null || hydrating) {
    return;
  }
  hydrating = true;
  loadOnboarded().catch(() => {
    hydrating = false;
  });
}

export function setOnboarded(value: boolean): void {
  if (onboarded === value) {
    return;
  }
  onboarded = value;
  emit();
  if (isNative) {
    setItemAsync(STORAGE_KEY, value ? "1" : "0").catch(() => undefined);
  }
}

/** Returns null while hydrating from storage, then the persisted boolean. */
export function useOnboarded(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => onboarded,
    () => onboarded
  );
}
