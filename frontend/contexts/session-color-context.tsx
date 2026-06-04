"use client";

import { createContext, useContext, ReactNode } from "react";

const PHENYX_COLOR = '#B9D5FF';

interface SessionColorContextType {
  sessionColor: string;
}

const SessionColorContext = createContext<SessionColorContextType>({
  sessionColor: PHENYX_COLOR,
});

export function SessionColorProvider({ children }: { children: ReactNode }) {
  return (
    <SessionColorContext.Provider value={{ sessionColor: PHENYX_COLOR }}>
      {children}
    </SessionColorContext.Provider>
  );
}

export function useSessionColor() {
  return useContext(SessionColorContext);
}
