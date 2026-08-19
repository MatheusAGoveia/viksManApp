import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatCurrency } from '@/data/catalog';
import { LabeledInput } from '../components/LabeledInput';
import { styles } from '../styles';
import type { Option } from '../types';

type CatalogTabProps = {
  serviceName: string;
  setServiceName: (value: string) => void;
  serviceSlug: string;
  setServiceSlug: (value: string) => void;
  serviceDuration: string;
  setServiceDuration: (value: string) => void;
  servicePrice: string;
  setServicePrice: (value: string) => void;
  createService: () => void;
  barberName: string;
  setBarberName: (value: string) => void;
  barberSlug: string;
  setBarberSlug: (value: string) => void;
  createBarber: () => void;
  serviceOptions: Option[];
  barberOptions: Option[];
  toggleCatalog: (kind: 'services' | 'barbers', item: Option) => void;
  onManageViksClubPlans?: () => void;
  wide?: boolean;
};

export function CatalogTab({
  serviceName,
  setServiceName,
  serviceSlug,
  setServiceSlug,
  serviceDuration,
  setServiceDuration,
  servicePrice,
  setServicePrice,
  createService,
  barberName,
  setBarberName,
  barberSlug,
  setBarberSlug,
  createBarber,
  serviceOptions,
  barberOptions,
  toggleCatalog,
  onManageViksClubPlans,
  wide,
}: CatalogTabProps) {
  return (
    <>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>CATÁLOGO E EQUIPE</Text>
          <Text style={styles.pageTitle}>O que a Viks oferece.</Text>
        </View>
        {onManageViksClubPlans ? (
          <Pressable
            onPress={onManageViksClubPlans}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.blue,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 6,
            }}
          >
            <Ionicons name="sparkles" size={16} color={colors.white} />
            <Text style={{ color: colors.white, fontFamily: 'monospace', fontSize: 11, fontWeight: '800' }}>
              PLANOS VIKS CLUB
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.operationGrid, wide && styles.operationGridWide]}>
        <View style={styles.operationCard}>
          <Text style={styles.cardTitle}>NOVO SERVIÇO</Text>
          <LabeledInput label="NOME" value={serviceName} onChangeText={setServiceName} placeholder="Ex.: Corte infantil" />
          <LabeledInput label="IDENTIFICADOR" value={serviceSlug} onChangeText={setServiceSlug} placeholder="corte-infantil" />
          <View style={styles.inputPair}>
            <LabeledInput label="DURAÇÃO (MIN)" value={serviceDuration} onChangeText={setServiceDuration} placeholder="45" />
            <LabeledInput label="PREÇO (R$)" value={servicePrice} onChangeText={setServicePrice} placeholder="40" />
          </View>
          <Pressable onPress={createService} style={styles.operationButton}>
            <Text style={styles.operationButtonText}>CRIAR SERVIÇO</Text>
          </Pressable>
        </View>

        <View style={styles.operationCard}>
          <Text style={styles.cardTitle}>NOVO PROFISSIONAL</Text>
          <LabeledInput label="NOME" value={barberName} onChangeText={setBarberName} placeholder="Nome profissional" />
          <LabeledInput label="IDENTIFICADOR" value={barberSlug} onChangeText={setBarberSlug} placeholder="nome-sem-espacos" />
          <Text style={styles.cardHint}>A jornada inicial será segunda a sábado, das 9h às 19h, com todos os serviços ativos.</Text>
          <Pressable onPress={createBarber} style={styles.operationButton}>
            <Text style={styles.operationButtonText}>CRIAR PROFISSIONAL</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.subheading}>SERVIÇOS</Text>
      <View style={styles.catalogList}>
        {serviceOptions.map((item) => (
          <View key={item.id} style={styles.catalogRow}>
            <View style={styles.catalogCopy}>
              <Text style={styles.catalogName}>{item.name}</Text>
              <Text style={styles.catalogMeta}>
                {item.duration} min · {formatCurrency(item.price ?? 0)} · {item.slug}
              </Text>
            </View>
            <Pressable
              onPress={() => toggleCatalog('services', item)}
              style={[styles.statusButton, item.active === false && styles.statusButtonOff]}
            >
              <Text style={[styles.statusButtonText, item.active === false && styles.statusButtonTextOff]}>
                {item.active === false ? 'REATIVAR' : 'ATIVO'}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>

      <Text style={styles.subheading}>PROFISSIONAIS</Text>
      <View style={styles.catalogList}>
        {barberOptions.map((item) => (
          <View key={item.id} style={styles.catalogRow}>
            <View style={styles.catalogCopy}>
              <Text style={styles.catalogName}>{item.name}</Text>
              <Text style={styles.catalogMeta}>{item.slug}</Text>
            </View>
            <Pressable
              onPress={() => toggleCatalog('barbers', item)}
              style={[styles.statusButton, item.active === false && styles.statusButtonOff]}
            >
              <Text style={[styles.statusButtonText, item.active === false && styles.statusButtonTextOff]}>
                {item.active === false ? 'REATIVAR' : 'ATIVO'}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </>
  );
}
