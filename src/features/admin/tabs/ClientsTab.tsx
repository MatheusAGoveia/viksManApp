import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { demoClients } from '../helpers';
import { styles } from '../styles';
import type { Client } from '../types';

type ClientsTabProps = {
  onSelectClient: (clientId: string) => void;
};

export function ClientsTab({ onSelectClient }: ClientsTabProps) {
  const [search, setSearch] = useState('');
  const [clientsList, setClientsList] = useState<Client[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchClients = useCallback(async (searchTerm: string) => {
    const term = searchTerm.trim();
    setLoading(true);

    if (supabase) {
      // 1. Fetch exact total count of client profiles
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'client');

      if (typeof count === 'number') {
        setTotalCount(count);
      }

      // 2. Fetch paginated / searched clients (limit 20)
      let query = supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('role', 'client')
        .order('full_name')
        .limit(20);

      if (term.length >= 2) {
        query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (!error && data) {
        setClientsList(
          data.map((item) => ({
            id: item.id,
            name: item.full_name || 'Cliente sem nome',
            phone: item.phone || 'Sem telefone',
          })),
        );
      } else {
        setClientsList([]);
      }
    } else {
      // Demo mode fallback
      setTotalCount(demoClients.length);
      const filtered = demoClients.filter(
        (client) =>
          client.name.toLowerCase().includes(term.toLowerCase()) ||
          client.phone.toLowerCase().includes(term.toLowerCase()),
      );
      setClientsList(filtered);
    }

    setLoading(false);
  }, []);

  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      fetchClients(text);
    }, 300);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients('');
    }, 0);
    return () => {
      clearTimeout(timer);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [fetchClients]);

  return (
    <>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>BASE DE CLIENTES</Text>
          <Text style={styles.pageTitle}>Encontre rápido.</Text>
        </View>
        <Text style={styles.total}>
          {search.trim().length >= 2
            ? `${clientsList.length} RESULTADOS`
            : totalCount !== null
              ? `${totalCount} CADASTROS`
              : `${clientsList.length} CADASTROS`}
        </Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" color={colors.muted} size={19} />
        <TextInput
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Buscar cliente por nome ou telefone..."
          placeholderTextColor="#92938E"
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {loading ? <ActivityIndicator size="small" color={colors.blue} /> : null}
      </View>

      <View style={styles.clientList}>
        {loading && clientsList.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontFamily: 'sans-serif', fontSize: 12 }}>
              Buscando clientes no cadastro...
            </Text>
          </View>
        ) : clientsList.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontFamily: 'sans-serif', fontSize: 12 }}>
              Nenhum cliente encontrado.
            </Text>
          </View>
        ) : (
          clientsList.map((client) => (
            <View key={client.id} style={styles.clientRow}>
              <View style={styles.clientAvatar}>
                <Text style={styles.clientInitial}>{client.name[0] ?? 'C'}</Text>
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
          ))
        )}
      </View>
    </>
  );
}
