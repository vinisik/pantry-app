import React, { useState } from 'react';
import { Alert, StyleSheet, View, TextInput, TouchableOpacity, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Erro ao iniciar sessão', error.message);
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) Alert.alert('Erro ao registar', error.message);
    else if (data.session) Alert.alert('Sucesso', 'Conta criada com sucesso!');
    else Alert.alert('Verifique o seu email para confirmar o registo.');
    
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.logoEmoji}>🥑🍳</Text>
        <Text style={styles.title}>Despensa Inteligente</Text>
        <Text style={styles.subtitle}>O seu gestor de despensa e gerador de receitas com IA</Text>
      </View>

      <View style={styles.formCard}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            onChangeText={(text) => setEmail(text)}
            value={email}
            placeholder="seu@email.com"
            placeholderTextColor="#A0A0A0"
            autoCapitalize={'none'}
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Palavra-passe</Text>
          <TextInput
            style={styles.input}
            onChangeText={(text) => setPassword(text)}
            value={password}
            secureTextEntry={true}
            placeholder="Sua senha secreta"
            placeholderTextColor="#A0A0A0"
            autoCapitalize={'none'}
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          disabled={loading} 
          onPress={signInWithEmail}
        >
          <Text style={styles.primaryButtonText}>Iniciar Sessão</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          disabled={loading} 
          onPress={signUpWithEmail}
        >
          <Text style={styles.secondaryButtonText}>Criar Conta Nova</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F8F9FA' },
  headerContainer: { alignItems: 'center', marginBottom: 32 },
  logoEmoji: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6C757D', textAlign: 'center', paddingHorizontal: 20 },
  formCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  inputContainer: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#495057', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E5EA', padding: 12, borderRadius: 10, fontSize: 15, backgroundColor: '#FAFAFC', color: '#1C1C1E' },
  button: { padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  primaryButton: { backgroundColor: '#2E7D32', shadowColor: '#2E7D32', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
  secondaryButton: { backgroundColor: '#F1F3F5', marginTop: 10 },
  secondaryButtonText: { color: '#495057', fontWeight: '600', fontSize: 15 },
});