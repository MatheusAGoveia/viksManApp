import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { styles } from '../styles';
import type { AdminTab } from '../types';

type AdminSidebarProps = {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  wide?: boolean;
};

const navItems = [
  ['agenda', 'calendar-outline', 'Agenda'],
  ['clients', 'people-outline', 'Clientes'],
  ['catalog', 'cut-outline', 'Catálogo'],
  ['marketing', 'megaphone-outline', 'Promoções'],
  ['settings', 'options-outline', 'Operação'],
] as const;

export function AdminSidebar({ activeTab, onSelectTab, wide }: AdminSidebarProps) {
  return (
    <View style={[styles.sidebar, wide && styles.sidebarWide]}>
      {navItems.map(([value, icon, label]) => (
        <Pressable
          key={value}
          onPress={() => onSelectTab(value)}
          style={[styles.navItem, activeTab === value && styles.navItemActive]}
        >
          <Ionicons name={icon} color={activeTab === value ? colors.white : '#77787D'} size={19} />
          <Text style={[styles.navText, activeTab === value && styles.navTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
