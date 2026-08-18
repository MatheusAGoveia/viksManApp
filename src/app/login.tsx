import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

type Mode = 'login' | 'register' | 'recover';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string }>();

  const heading = {
    login: ['Bem-vindo', 'de volta.'],
    register: ['Crie sua', 'conta.'],
    recover: ['Recupere seu', 'acesso.'],
  }[mode];

  function finish() {
    router.replace(params.returnTo === '/book' ? '/book' : '/');
  }

  async function submit() {
    setBusy(true);
    setFeedback(undefined);
    let result;
    if (mode === 'login') result = await auth.signInWithEmail(email, password);
    else if (mode === 'register') result = await auth.signUpWithEmail(fullName, email, password);
    else result = await auth.resetPassword(email);
    setBusy(false);
    if (result.error) {
      setFeedback({ type: 'error', text: result.error });
      return;
    }
    if (result.message) {
      setFeedback({ type: 'success', text: result.message });
      return;
    }
    finish();
  }

  const buttonLabel = mode === 'login' ? 'ENTRAR' : mode === 'register' ? 'CRIAR CONTA' : 'RECUPERAR SENHA';

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <SafeAreaView style={styles.page}>
          <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" color={colors.white} size={20} /></Pressable>
          <View style={styles.brandRow}><Text style={styles.brand}>VKS</Text><Text style={styles.brandSuffix}>MAN</Text></View>

          <View style={styles.content}>
            <Text style={styles.eyebrow}>CONTA VIKS</Text>
            <Text style={styles.title}>{heading[0]}{`\n`}<Text style={styles.titleAccent}>{heading[1]}</Text></Text>
            <Text style={styles.subtitle}>Agende, acompanhe e repita seu corte de qualquer dispositivo.</Text>

            {!auth.configured ? (
              <View style={styles.demoNotice}>
                <Ionicons name="construct-outline" color={colors.blue} size={22} />
                <View style={styles.demoCopy}><Text style={styles.demoTitle}>Backend aguardando conexão</Text><Text style={styles.demoText}>A interface está pronta. Configure as chaves do Supabase para ativar cadastro e sincronização.</Text></View>
              </View>
            ) : null}

            <View style={styles.form}>
              {mode === 'register' ? (
                <View><Text style={styles.label}>NOME</Text><TextInput value={fullName} onChangeText={setFullName} placeholder="Como podemos chamar você?" placeholderTextColor="#76777D" autoCapitalize="words" style={styles.input} /></View>
              ) : null}
              {mode === 'login' || mode === 'register' || mode === 'recover' ? (
                <View><Text style={styles.label}>E-MAIL</Text><TextInput value={email} onChangeText={setEmail} placeholder="voce@email.com" placeholderTextColor="#76777D" autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={styles.input} /></View>
              ) : null}
              {mode === 'login' || mode === 'register' ? (
                <View><Text style={styles.label}>SENHA</Text><TextInput value={password} onChangeText={setPassword} placeholder="Mínimo de 8 caracteres" placeholderTextColor="#76777D" secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} style={styles.input} /></View>
              ) : null}
              {feedback ? <Text style={[styles.feedback, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>{feedback.text}</Text> : null}

              <Pressable disabled={busy || !auth.configured} onPress={submit} style={({ pressed }) => [styles.primaryButton, (!auth.configured || busy) && styles.primaryDisabled, pressed && styles.pressed]}>
                {busy ? <ActivityIndicator color={colors.white} /> : <><Text style={styles.primaryText}>{buttonLabel}</Text><Ionicons name="arrow-forward" color={colors.white} size={19} /></>}
              </Pressable>
            </View>

            {mode === 'login' ? (
              <>
                <View style={styles.linkRow}><Pressable onPress={() => setMode('register')}><Text style={styles.link}>CRIAR CONTA</Text></Pressable><Pressable onPress={() => setMode('recover')}><Text style={styles.linkMuted}>ESQUECI A SENHA</Text></Pressable></View>
                <Text style={styles.emailNote}>A conta usa e-mail. O telefone do perfil fica somente para contato e WhatsApp autorizado.</Text>
              </>
            ) : (
              <Pressable onPress={() => { setMode('login'); setFeedback(undefined); }} style={styles.returnButton}><Ionicons name="arrow-back" color="#B6B7BC" size={16} /><Text style={styles.returnText}>VOLTAR PARA O LOGIN</Text></Pressable>
            )}

            {!auth.configured ? <Pressable onPress={finish} style={styles.demoButton}><Text style={styles.demoButtonText}>CONTINUAR NA DEMONSTRAÇÃO</Text></Pressable> : null}
          </View>
        </SafeAreaView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  scrollContent: { flexGrow: 1, alignItems: 'center' },
  page: { width: '100%', maxWidth: 720, minHeight: '100%', paddingHorizontal: 24, paddingBottom: 50 },
  backButton: { width: 44, height: 44, borderWidth: 1, borderColor: '#33343A', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  brandRow: { position: 'absolute', top: 27, right: 24, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  brand: { color: colors.white, fontFamily: fonts.sans, fontSize: 22, fontWeight: '900', letterSpacing: -1.5 },
  brandSuffix: { color: colors.blue, fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1.6 },
  content: { paddingTop: 60 },
  eyebrow: { color: colors.blue, fontFamily: fonts.mono, fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: colors.white, fontFamily: fonts.sans, fontSize: 53, lineHeight: 48, fontWeight: '800', letterSpacing: -3.3, marginTop: 18 },
  titleAccent: { color: colors.blue, fontFamily: fonts.serif, fontWeight: '400', fontStyle: 'italic' },
  subtitle: { color: '#A3A4AA', fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, maxWidth: 410, marginTop: 18 },
  demoNotice: { flexDirection: 'row', gap: 13, padding: 16, backgroundColor: '#191A1F', borderLeftWidth: 3, borderLeftColor: colors.blue, marginTop: 28 },
  demoCopy: { flex: 1 },
  demoTitle: { color: colors.white, fontFamily: fonts.sans, fontSize: 12, fontWeight: '800' },
  demoText: { color: '#95969C', fontFamily: fonts.sans, fontSize: 10, lineHeight: 15, marginTop: 4 },
  form: { gap: 18, marginTop: 34 },
  label: { color: '#919298', fontFamily: fonts.mono, fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  input: { height: 56, borderWidth: 1, borderColor: '#3A3B41', color: colors.white, fontFamily: fonts.sans, fontSize: 14, paddingHorizontal: 16, backgroundColor: '#15161A' },
  feedback: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 17 },
  feedbackError: { color: '#FF8D86' },
  feedbackSuccess: { color: '#7FDCAC' },
  primaryButton: { height: 58, backgroundColor: colors.blue, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryDisabled: { opacity: 0.38 },
  primaryText: { color: colors.white, fontFamily: fonts.sans, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  pressed: { opacity: 0.72 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  link: { color: colors.blue, fontFamily: fonts.sans, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  linkMuted: { color: '#9A9BA1', fontFamily: fonts.sans, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
  emailNote: { color: '#85868C', fontFamily: fonts.sans, fontSize: 10, lineHeight: 16, marginTop: 24 },
  returnButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 22 },
  returnText: { color: '#B6B7BC', fontFamily: fonts.sans, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  demoButton: { alignItems: 'center', paddingVertical: 20, marginTop: 10 },
  demoButtonText: { color: '#85868C', fontFamily: fonts.sans, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
});
