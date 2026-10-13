export const theme = {
  color: {
    primary: '#6B2AEE',
    primaryDark: '#581ECD',
    secondary: '#02E7D9',
    text: '#1A1A1A',
    muted: '#707070',
    background: '#FFFFFF',
    surface: '#F6F4FB',
    line: '#D7D9DD',
    error: '#9F1020',
    errorFill: '#FF2133',
    warning: '#8A5A00',
    warningFill: '#FFF4D6',
    success: '#067A32',
    successFill: '#E5F8EC',
    white: '#FFFFFF',
  },
  font: {
    regular: 'Poppins_400Regular',
    semibold: 'Poppins_600SemiBold',
    bold: 'Poppins_700Bold',
  },
  text: {
    body: 18,
    title: 26,
    meta: 16,
  },
  control: 56,
  radius: 8,
  space: 16,
} as const;

export const defaultBrand = {
  name: 'Performax',
  primary: theme.color.primary,
  secondary: theme.color.secondary,
  logo: '',
};
