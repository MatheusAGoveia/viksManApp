import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { styles } from '../styles';
import type { Client } from '../types';

type ClientSearchAutocompleteProps = {
  selectedClientId: string;
  selectedClient?: Client | null;
  onSelectClient: (client: Client) => void;
  onClearClient: () => void;
  demoClients: Client[];
};

export function ClientSearchAutocomplete({
  selectedClientId,
  selectedClient,
  onSelectClient,
  onClearClient,
  demoClients,
}: ClientSearchAutocompleteProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Client[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = (text: string) => {
    setSearchTerm(text);
    if (text.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
    }
  };

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const term = searchTerm.trim();
    if (term.length < 2) {
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      if (supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('role', 'client')
          .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
          .order('full_name')
          .limit(20);

        if (!error && data) {
          setResults(
            data.map((item) => ({
              id: item.id,
              name: item.full_name || 'Cliente sem nome',
              phone: item.phone || 'Sem telefone',
            })),
          );
        } else {
          setResults([]);
        }
      } else {
        const filtered = demoClients.filter(
          (item) =>
            item.name.toLowerCase().includes(term.toLowerCase()) ||
            item.phone.toLowerCase().includes(term.toLowerCase()),
        );
        setResults(filtered);
      }
      setLoading(false);
      setHasSearched(true);
    }, 300);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [demoClients, searchTerm]);

  if (selectedClientId && selectedClient) {
    return (
      <View style={styles.selectedClientBox}>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientInitial}>{selectedClient.name[0] ?? 'C'}</Text>
        </View>
        <View style={styles.clientCopy}>
          <Text style={styles.clientName}>{selectedClient.name}</Text>
          <Text style={styles.clientPhone}>{selectedClient.phone}</Text>
        </View>
        <Pressable onPress={onClearClient} style={styles.changeClientButton}>
          <Text style={styles.changeClientText}>TROCAR</Text>
          <Ionicons name="swap-horizontal" color={colors.blue} size={16} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.autocompleteWrapper}>
      <View style={styles.searchBox}>
        <Ionicons name="search" color={colors.muted} size={18} />
        <TextInput
          value={searchTerm}
          onChangeText={handleTextChange}
          placeholder="Buscar cliente por nome ou telefone (min 2 letras)..."
          placeholderTextColor="#92938E"
          style={styles.searchInput}
          autoCapitalize="none"
        />
        {loading ? <ActivityIndicator size="small" color={colors.blue} /> : null}
      </View>

      {searchTerm.trim().length >= 2 && (
        <View style={styles.autocompleteDropdown}>
          {loading ? (
            <View style={styles.autocompleteState}>
              <Text style={styles.autocompleteStateText}>Buscando no cadastro...</Text>
            </View>
          ) : results.length > 0 ? (
            results.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  onSelectClient(item);
                  setSearchTerm('');
                  setResults([]);
                }}
                style={styles.autocompleteItem}
              >
                <View style={styles.autocompleteItemLeft}>
                  <Text style={styles.autocompleteItemName}>{item.name}</Text>
                  <Text style={styles.autocompleteItemPhone}>{item.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" color={colors.muted} size={16} />
              </Pressable>
            ))
          ) : hasSearched ? (
            <View style={styles.autocompleteState}>
              <Text style={styles.autocompleteStateText}>Nenhum cliente encontrado.</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
