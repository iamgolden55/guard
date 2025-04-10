import { createTheme, loadTheme, type Theme } from '@fluentui/react';

// Create a custom red theme
const redTheme: Theme = createTheme({
  palette: {
    themePrimary: '#cb2431', // Primary red color
    themeLighterAlt: '#fef5f6',
    themeLighter: '#fbdadd',
    themeLight: '#f7bbc0',
    themeTertiary: '#ed7d87',
    themeSecondary: '#d23b47',
    themeDarkAlt: '#b5202c',
    themeDark: '#991b25',
    themeDarker: '#71141c',
    neutralLighterAlt: '#faf9f8',
    neutralLighter: '#f3f2f1',
    neutralLight: '#edebe9',
    neutralQuaternaryAlt: '#e1dfdd',
    neutralQuaternary: '#d0d0d0',
    neutralTertiaryAlt: '#c8c6c4',
    neutralTertiary: '#a19f9d',
    neutralSecondary: '#605e5c',
    neutralPrimaryAlt: '#3b3a39',
    neutralPrimary: '#323130',
    neutralDark: '#201f1e',
    black: '#000000',
    white: '#ffffff',
  }
});

// Load the theme
export const initializeTheme = (): Theme => {
  return loadTheme(redTheme);
};

export default redTheme;
