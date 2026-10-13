import { createContext, ReactNode, useContext, useMemo } from 'react';

import { defaultBrand } from '@/constants/theme';
import { useCompany } from '@/providers/session-provider';

type Brand = {
  name: string;
  primary: string;
  secondary: string;
  logo: string;
};

const BrandContext = createContext<Brand>(defaultBrand);

function colorOrDefault(value: string | null | undefined, fallback: string) {
  if (value && /^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return fallback;
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const { company } = useCompany();
  const value = useMemo<Brand>(() => {
    const label = company?.whiteLabel;
    const name = label?.name?.trim() || company?.name || defaultBrand.name;
    return {
      name,
      primary: colorOrDefault(label?.primaryColor, defaultBrand.primary),
      secondary: colorOrDefault(label?.secondaryColor, defaultBrand.secondary),
      logo: label?.logo?.trim() || '',
    };
  }, [company]);

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
