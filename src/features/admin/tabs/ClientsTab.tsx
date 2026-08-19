import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';
import { styles } from '../styles';
import type { Client } from '../types';

type ClientsTabProps = {
  clientsCount: number;
  search: string;
  setSearch: (search: string) => void;
  filteredClients: Client[];
  onSelectClient: (clientId: string) => void;
};

export function ClientsTab({
  clientsCount,
  search,
  setSearch,
  filteredClients,
  onSelectClient,
}: ClientsTabProps) {
  return (
    <>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>BASE DE CLIENTES</Text>
          <Text style={styles.pageTitle}>Encontre rápido.</Text>
        </View>
        <Text style={styles.total}>{clientsCount} CADASTROS</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" color={colors.muted} size={19} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Nome, telefone ou e-mail"
          placeholderTextColor="#92938E"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.clientList}>
        {filteredClients.map((client) => (
          <View key={client.id} style={styles.clientRow}>
            <View style={styles.clientAvatar}>
              <Text style={styles.clientInitial}>{client.name[0]}</Text>
            </View>
            <View style={styles.clientCopy}>
              <Text style={styles.clientName}>{client.name}</Text>
              <Text style={styles.clientPhone}>{client.phone}</Text>
            </View>
            <Pressable onPress={() => onSelectClient(client.id)} style={styles.clientAction}>
              <Text style={styles.clientActionText}>AGENDAR</Text>
              <Ionicons name="arrow-forward" color={colors.blue} size={16} />
            </Pressable>
          </View>
        ))}
      </View>
    </>
  );
}
