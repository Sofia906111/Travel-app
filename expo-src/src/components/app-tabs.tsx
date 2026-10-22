import { NativeTabs } from 'expo-router/native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // `Material Symbol name: https://fonts.google.com/icons
  const paths = [
    { name: 'index', label: 'Map', icon: 'map' as const },
    { name: 'explore', label: 'Explore', icon: 'explore' as const },
    { name: 'preferences', label: 'Preferences', icon: 'settings' as const },
    { name: 'contribute', label: 'Contribute', icon: 'add_circle' as const },
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
