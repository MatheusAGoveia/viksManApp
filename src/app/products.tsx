import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-ui';
import { colors, fonts, layout } from '@/constants/theme';
import { formatCurrency } from '@/data/catalog';
import { useResponsiveLayout } from '@/hooks/use-responsive-layout';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

type Product = Tables<'products'>;

const defaultProducts: Product[] = [
  {
    id: 'prod-1',
    name: 'Pomada Matte Viks',
    slug: 'pomada-matte-viks',
    category: 'finalizacao',
    description: 'Fixação forte com efeito opaco natural. Ideal para topetes e estrutura sem brilho.',
    price_cents: 6500,
    stock_quantity: 12,
    active: true,
    featured: true,
    image_url: null,
    sort_order: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod-2',
    name: 'Óleo para Barba Premium',
    slug: 'oleo-para-barba-premium',
    category: 'barba',
    description: 'Hidratação profunda com óleo de argan e jojoba. Deixa a barba macia e perfumada.',
    price_cents: 5500,
    stock_quantity: 8,
    active: true,
    featured: true,
    image_url: null,
    sort_order: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod-3',
    name: 'Shampoo Fortificante',
    slug: 'shampoo-fortificante',
    category: 'cabelo',
    description: 'Limpeza refrescante com mentol e biotina. Fortalece a raiz e limpa o couro cabeludo.',
    price_cents: 4800,
    stock_quantity: 15,
    active: true,
    featured: false,
    image_url: null,
    sort_order: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod-4',
    name: 'Balm Modelador de Barba',
    slug: 'balm-modelador-de-barba',
    category: 'barba',
    description: 'Alinha fios rebeldes, hidrata a pele e previne coceira na fase de crescimento.',
    price_cents: 4900,
    stock_quantity: 5,
    active: true,
    featured: false,
    image_url: null,
    sort_order: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod-5',
    name: 'Cera Modeladora Brilho',
    slug: 'cera-modeladora-brilho',
    category: 'finalizacao',
    description: 'Brilho clássico com textura flexível. Excelente para cortes clássicos e alinhados.',
    price_cents: 5900,
    stock_quantity: 0,
    active: true,
    featured: false,
    image_url: null,
    sort_order: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'prod-6',
    name: 'Pente de Madeira Viks',
    slug: 'pente-de-madeira-viks',
    category: 'cuidados',
    description: 'Madeira maciça antiestática. Desembaraça sem quebrar os fios da barba e do cabelo.',
    price_cents: 3500,
    stock_quantity: 20,
    active: true,
    featured: false,
    image_url: null,
    sort_order: 6,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const categoryLabels: Record<string, string> = {
  all: 'Todos',
  cabelo: 'Cabelo',
  barba: 'Barba',
  finalizacao: 'Finalização',
  cuidados: 'Cuidados',
};

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  cabelo: 'water-outline',
  barba: 'sparkles-outline',
  finalizacao: 'flash-outline',
  cuidados: 'leaf-outline',
};

function FilterChip({ item, selected, onSelect }: { item: string; selected: boolean; onSelect: () => void }) {
  const isHovered = useSharedValue(false);
  const isPressed = useSharedValue(false);

  const animStyle = useAnimatedStyle(() => {
    const scale = isPressed.value ? 0.97 : isHovered.value ? 1.02 : 1;
    return {
      transform: [{ scale: withSpring(scale, { damping: 20, stiffness: 250 }) }],
      borderColor: isHovered.value && !selected ? colors.blue : selected ? colors.blue : colors.line,
    };
  });

  return (
    <Pressable
      onHoverIn={() => { isHovered.value = true; }}
      onHoverOut={() => { isHovered.value = false; }}
      onPressIn={() => { isPressed.value = true; }}
      onPressOut={() => { isPressed.value = false; }}
      onPress={onSelect}
    >
      <Animated.View style={[styles.filter, selected && styles.filterActive, animStyle]}>
        <Text style={[styles.filterText, selected && styles.filterTextActive]}>
          {(categoryLabels[item] ?? item).toUpperCase()}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function ProductCard({
  product,
  index,
  columns,
  onOrder,
}: {
  product: Product;
  index: number;
  columns: number;
  onOrder: () => void;
}) {
  const available = product.stock_quantity > 0;
  const isHovered = useSharedValue(false);
  const isPressed = useSharedValue(false);
  const buttonPressed = useSharedValue(false);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const scale = isPressed.value ? 0.99 : isHovered.value ? 1.008 : 1;
    const translateY = isHovered.value ? -3 : 0;
    return {
      transform: [
        { scale: withSpring(scale, { damping: 20, stiffness: 220 }) },
        { translateY: withSpring(translateY, { damping: 20, stiffness: 220 }) },
      ],
      borderColor: isHovered.value ? colors.blue : colors.line,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: isHovered.value ? 6 : 1 },
      shadowOpacity: isHovered.value ? 0.08 : 0.03,
      shadowRadius: isHovered.value ? 10 : 3,
      elevation: isHovered.value ? 4 : 1,
    };
  });

  const iconAnimatedStyle = useAnimatedStyle(() => {
    const iconScale = isHovered.value ? 1.06 : 1;
    return {
      transform: [{ scale: withSpring(iconScale, { damping: 18, stiffness: 200 }) }],
      borderColor: isHovered.value ? colors.blue : '#44454B',
    };
  });

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    const btnScale = buttonPressed.value ? 0.97 : 1;
    return {
      transform: [{ scale: withSpring(btnScale, { damping: 20, stiffness: 250 }) }],
      backgroundColor: !available ? '#55565B' : colors.blue,
    };
  });

  const handleHoverIn = () => { isHovered.value = true; };
  const handleHoverOut = () => { isHovered.value = false; };
  const handleBtnPressIn = () => { buttonPressed.value = true; };
  const handleBtnPressOut = () => { buttonPressed.value = false; };

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 70, 450)).duration(450).springify()}
      style={[
        styles.card,
        { width: columns === 1 ? '100%' : columns === 2 ? '48.7%' : '32%' },
        cardAnimatedStyle,
      ]}
    >
      <Pressable
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onPressIn={() => { isPressed.value = true; }}
        onPressOut={() => { isPressed.value = false; }}
        style={styles.cardInner}
      >
        <View style={styles.productVisual}>
          {product.featured ? (
            <View style={styles.featured}>
              <Text style={styles.featuredText}>DESTAQUE</Text>
            </View>
          ) : <View />}
          <Animated.View style={[styles.productIcon, iconAnimatedStyle]}>
            <Ionicons
              name={categoryIcons[product.category] ?? 'bag-handle-outline'}
              color={colors.white}
              size={35}
            />
          </Animated.View>
          <Text style={styles.category}>
            {(categoryLabels[product.category] ?? product.category).toUpperCase()}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.description}>{product.description}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(product.price_cents / 100)}</Text>
            <Text style={[styles.stock, !available && styles.stockOut]}>
              {available ? `${product.stock_quantity} EM ESTOQUE` : 'INDISPONÍVEL'}
            </Text>
          </View>

          <Pressable
            disabled={!available}
            onPressIn={handleBtnPressIn}
            onPressOut={handleBtnPressOut}
            onPress={onOrder}
          >
            <Animated.View
              style={[
                styles.orderButton,
                !available && styles.orderDisabled,
                buttonAnimatedStyle,
              ]}
            >
              <Text style={styles.orderText}>
                {available ? 'PEDIR NO WHATSAPP' : 'AVISE-ME DEPOIS'}
              </Text>
              <Ionicons name="logo-whatsapp" color={colors.white} size={18} />
            </Animated.View>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ProductsScreen() {
  const { width } = useResponsiveLayout();
  const columns = width >= 980 ? 3 : width >= 650 ? 2 : 1;
  const [products, setProducts] = useState<Product[]>(defaultProducts);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('featured', { ascending: false })
      .order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setProducts(data);
        }
        setLoading(false);
      });
  }, []);

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((product) => product.category)))],
    [products],
  );
  const visibleProducts = category === 'all'
    ? products
    : products.filter((product) => product.category === category);

  async function orderProduct(product: Product) {
    const message = [
      'Olá! Quero reservar um produto da Viks Man:',
      `${product.name} — ${formatCurrency(product.price_cents / 100)}`,
      'Podem confirmar a disponibilidade e a retirada na unidade de Betim?',
    ].join('\n');
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.centered}>
      <SafeAreaView edges={['top']} style={styles.page}>
        <View style={styles.header}>
          <View style={styles.topbar}><BrandLockup inverse /><Text style={styles.unit}>LOJA · BETIM</Text></View>
          <Text style={styles.eyebrow}>PRODUTOS VIKS MAN</Text>
          <Text style={styles.title}>Seu estilo{`\n`}continua em casa.</Text>
          <Text style={styles.subtitle}>Produtos selecionados pela barbearia. Reserve pelo WhatsApp e retire na unidade.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {categories.map((item) => (
            <FilterChip
              key={item}
              item={item}
              selected={category === item}
              onSelect={() => setCategory(item)}
            />
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator color={colors.blue} style={styles.loading} /> : null}
        {!loading && visibleProducts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Catálogo em atualização.</Text>
            <Text style={styles.emptyText}>Novos produtos aparecerão aqui assim que estiverem disponíveis.</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {visibleProducts.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              columns={columns}
              onOrder={() => orderProduct(product)}
            />
          ))}
        </View>

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" color={colors.blue} size={20} />
          <Text style={styles.disclaimerText}>
            O pedido é confirmado pela equipe. Pagamento e retirada acontecem na unidade; o estoque exibido pode mudar durante o atendimento.
          </Text>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  centered: { alignItems: 'center' },
  page: { width: '100%', maxWidth: layout.maxWidth, paddingBottom: 50 },
  header: { backgroundColor: colors.ink, paddingHorizontal: layout.pagePadding, paddingBottom: 44 },
  topbar: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unit: { color: '#8F9096', fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  eyebrow: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginTop: 30 },
  title: { color: colors.white, fontFamily: fonts.sans, fontSize: 49, lineHeight: 46, fontWeight: '800', letterSpacing: -3, marginTop: 14 },
  subtitle: { color: '#A6A7AC', fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, maxWidth: 480, marginTop: 17 },
  filters: { paddingHorizontal: layout.pagePadding, paddingVertical: 22, gap: 8 },
  filter: { minHeight: 44, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, justifyContent: 'center' },
  filterActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  filterText: { color: colors.muted, fontFamily: fonts.mono, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  filterTextActive: { color: colors.white },
  loading: { paddingVertical: 70 },
  notice: { marginHorizontal: layout.pagePadding, padding: 16, backgroundColor: '#FBE8E6', borderLeftWidth: 4, borderLeftColor: colors.danger },
  noticeText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 11, fontWeight: '700' },
  empty: { marginHorizontal: layout.pagePadding, paddingVertical: 70, alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontFamily: fonts.sans, fontSize: 26, fontWeight: '800' },
  emptyText: { color: colors.muted, fontFamily: fonts.sans, fontSize: 11, marginTop: 8 },
  grid: { paddingHorizontal: layout.pagePadding, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { backgroundColor: colors.white, minWidth: 0, borderRadius: 2, overflow: 'hidden' },
  cardInner: { width: '100%' },
  productVisual: { minHeight: 190, padding: 18, backgroundColor: colors.ink, justifyContent: 'space-between' },
  featured: { alignSelf: 'flex-start', backgroundColor: colors.blue, paddingHorizontal: 8, paddingVertical: 5 },
  featuredText: { color: colors.white, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  productIcon: { width: 70, height: 70, borderWidth: 1, borderColor: '#44454B', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', borderRadius: 35 },
  category: { color: '#88898F', fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  cardBody: { padding: 18 },
  productName: { color: colors.ink, fontFamily: fonts.sans, fontSize: 21, fontWeight: '800', letterSpacing: -0.7 },
  description: { color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 15, minHeight: 46, marginTop: 7 },
  priceRow: { minHeight: 58, borderTopWidth: 1, borderColor: colors.line, marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  price: { color: colors.ink, fontFamily: fonts.sans, fontSize: 18, fontWeight: '900' },
  stock: { color: colors.success, fontFamily: fonts.mono, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  stockOut: { color: colors.danger },
  orderButton: { minHeight: 50, backgroundColor: colors.blue, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 2 },
  orderDisabled: { backgroundColor: '#55565B' },
  orderText: { color: colors.white, fontFamily: fonts.sans, fontSize: 8, fontWeight: '900', letterSpacing: 0.9 },
  disclaimer: { marginHorizontal: layout.pagePadding, marginTop: 24, padding: 16, backgroundColor: '#E7ECFA', flexDirection: 'row', gap: 12, alignItems: 'center' },
  disclaimerText: { flex: 1, color: colors.muted, fontFamily: fonts.sans, fontSize: 10, lineHeight: 15 },
});
