import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeType = 'clean' | 'light' | 'dark' | 'vivid' | 'eye';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('clean');

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('canai-theme', newTheme);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('canai-theme') as ThemeType | null;
    if (savedTheme) {
      setThemeState(savedTheme);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
