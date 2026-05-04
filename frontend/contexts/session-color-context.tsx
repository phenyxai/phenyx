"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const orbColors = [
  '#A0B8FF', // O-type hypergiant, extreme blue-white
  '#B0C8FF', // O-type main sequence, blue-white
  '#BDD4FF', // early B-type, soft blue
  '#C8DAFF', // mid B-type, pale blue-white
  '#D6E8FF', // late B-type, near white blue
  '#DDEEFF', // A-type, pure white star
  '#EEF4FF', // A-type subgiant, cool white
  '#FFFDE0', // early F-type, warm white
  '#FFF5B0', // mid F-type, pale yellow
  '#FFE87A', // late F-type, soft yellow
  '#FFD44A', // early G-type, bright yellow
  '#FFCA2A', // mid G-type, our sun range
  '#FFC14A', // late G-type, yellow warming
  '#FFB347', // early K-type, amber orange
  '#FF9B4A', // mid K-type, deep amber
  '#FF8C42', // late K-type, orange
  '#FF7A3A', // K-M boundary, deep orange
  '#FF6B35', // early M-type, red-orange
  '#FF5C3A', // mid M-type, orange-red
  '#E8451E', // late M-type red giant, PHENYX accent
  '#D63B1F', // AGB star, deep red
  '#C23B8A', // carbon star, magenta-red
  '#9B2FCF', // pre-planetary nebula, violet
  '#7B68EE', // white dwarf cooling, medium slate
  '#5BA3D9', // neutron star glow, icy blue
];

interface SessionColorContextType {
  sessionColor: string;
}

const SessionColorContext = createContext<SessionColorContextType>({
  sessionColor: '#DDEEFF',
});

export function SessionColorProvider({ children }: { children: ReactNode }) {
  const [sessionColor, setSessionColor] = useState<string>('#DDEEFF');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Check localStorage first for existing stellar color
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) {
      setSessionColor(stored);
    } else {
      // Pick a random color on page load and persist it
      const randomIndex = Math.floor(Math.random() * orbColors.length);
      const color = orbColors[randomIndex];
      setSessionColor(color);
      localStorage.setItem("phenyx_stellar_color", color);
    }
    setIsInitialized(true);
  }, []);

  // Prevent flash by not rendering children until color is set
  if (!isInitialized) {
    return null;
  }

  return (
    <SessionColorContext.Provider value={{ sessionColor }}>
      {children}
    </SessionColorContext.Provider>
  );
}

export function useSessionColor() {
  return useContext(SessionColorContext);
}
