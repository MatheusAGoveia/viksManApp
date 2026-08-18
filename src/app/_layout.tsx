import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors, fonts, layout } from '@/constants/theme';
import { AuthProvider } from '@/context/auth-context';
import { BookingProvider } from '@/context/booking-context';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';

export default function RootLayout() {
  const { desktop } = useResponsiveLayout();
  return (
    <AuthProvider>
      <BookingProvider>
        <StatusBar style="light" />
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: colors.paper },
            tabBarPosition: desktop ? 'left' : 'bottom',
            tabBarActiveTintColor: colors.white,
            tabBarInactiveTintColor: '#85868B',
            tabBarActiveBackgroundColor: colors.blue,
            tabBarLabelStyle: {
              fontFamily: fonts.sans,
              fontSize: 9,
              fontWeight: '800',
              letterSpacing: 0.4,
            },
            tabBarItemStyle: desktop ? { minHeight: 64, marginHorizontal: 12, marginVertical: 4 } : undefined,
            tabBarStyle: desktop ? {
              width: 190,
              minWidth: 190,
              maxWidth: 190,
              paddingHorizontal: 8,
              paddingTop: 28,
              paddingBottom: 28,
              backgroundColor: colors.ink,
              borderRightWidth: 0,
            } : {
              height: layout.tabBarHeight,
              paddingTop: 8,
              paddingBottom: 8,
              backgroundColor: colors.ink,
              borderTopWidth: 0,
            },
          }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="book"
          options={{
            title: 'Agendar',
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="appointments"
          options={{
            title: 'Horários',
            tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen name="login" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="admin" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
      </BookingProvider>
    </AuthProvider>
  );
}
