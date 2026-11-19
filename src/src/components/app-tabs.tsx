import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  // Follows the theme chosen in Preferences (light / dark / high contrast).
  const colors = useTheme();

  // `Material Symbol name: https://fonts.google.com/icons
  const paths = [
    { name: 'index', label: 'Map', icon: 'map' as const },
    { name: 'contribute', label: 'Contribute', icon: 'add_circle' as const },
    { name: 'preferences', label: 'Settings', icon: 'settings' as const },
  ];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      iconColor={colors.tabsColor}
      rippleColor={`${colors.tabsColor}33`}
      labelVisibilityMode="labeled"
      labelStyle={{ default: { color: colors.tabsColor }, selected: { fontSize: 13 } }}>
      {paths.map((path) => (
        <NativeTabs.Trigger key={path.name} name={path.name}>
          <NativeTabs.Trigger.Label>{path.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon md={path.icon} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
