"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

type DeveloperModeContextValue = {
  developerMode: boolean;
  setDeveloperMode: (next: boolean) => void;
};

// Defaults make the hook safe to call without a provider (e.g. when a component
// is rendered in isolation in unit tests): reads as off, writes are no-ops.
const DeveloperModeContext = createContext<DeveloperModeContextValue>({
  developerMode: false,
  setDeveloperMode: () => {},
});

// Shares the "Developer Mode" toggle across the options page so that sibling
// components (the UI toggles and the API heartbeat) agree on its value.
export function DeveloperModeProvider({ children }: { children: ReactNode }) {
  const [developerMode, setDeveloperMode] = useState(false);
  return (
    <DeveloperModeContext.Provider value={{ developerMode, setDeveloperMode }}>
      {children}
    </DeveloperModeContext.Provider>
  );
}

export function useDeveloperMode(): DeveloperModeContextValue {
  return useContext(DeveloperModeContext);
}
