import React, { useState } from 'react';
import { Alert, StyleSheet, View, TextInput, TouchableOpacity, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Erro ao iniciar sessão', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) Alert.alert('Erro ao registar', error.message);
    else if (data.session) Alert.alert('Sucesso', 'Conta criada com sucesso!');
    else Alert.alert('Verifique o seu email para confirmar o registo.');
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.iconCircle}>
          <Feather name="shopping-bag" size={40} color="#0F766E" />
        </View>
        <Text style={styles.title}>My Pantry</Text>
        <Text style={styles.subtitle}>Gestão inteligente e IA culinária</Text>
      </View>

      <View style={styles.formCard}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>E-mail</Text>
          <View style={styles.inputWrapper}>
            <Feather name="mail" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              onChangeText={setEmail}
              value={email}
              placeholder="seu@email.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWrapper}>
            <Feather name="lock" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              onChangeText={setPassword}
              value={password}
              secureTextEntry
              placeholder="A sua senha"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} disabled={loading} onPress={signInWithEmail}>
          <Text style={styles.primaryButtonText}>Iniciar Sessão</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} disabled={loading} onPress={signUpWithEmail}>
          <Text style={styles.secondaryButtonText}>Criar Nova Conta</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F8FAFC' },
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  iconCircle: { width: 88, height: 88, borderRadius: 28, backgroundColor: '#CCFBF1', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 36, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 8, letterSpacing: -1.5 },
  subtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', fontWeight: '500' },
  formCard: { backgroundColor: '#FFFFFF', padding: 28, borderRadius: 32, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 6 },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '800', color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 16, backgroundColor: '#F8FAFC' },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, padding: 16, fontSize: 16, color: '#0F172A', fontWeight: '500' },
  primaryButton: { backgroundColor: '#0F766E', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  secondaryButton: { backgroundColor: '#F1F5F9', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#334155', fontWeight: '800', fontSize: 16 },
});