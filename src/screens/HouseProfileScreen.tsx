import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Clipboard, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { houseService } from '../services/houseService';

interface ResidenceProfileScreenProps { houseId: string; }

export default function ResidenceProfileScreen({ houseId }: ResidenceProfileScreenProps) {
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState('');
  const [type, setType] = useState<'RESTRICTION' | 'PREFERENCE'>('RESTRICTION');

  const { data: preferences, isLoading, isError } = useQuery({ queryKey: ['housePreferences', houseId], queryFn: () => houseService.getHousePreferences(houseId) });
  const { data: participants } = useQuery({ queryKey: ['houseParticipants', houseId], queryFn: () => houseService.getHouseParticipants(houseId) });

  const addMutation = useMutation({
    mutationFn: () => houseService.addPreference(houseId, type, newValue.trim()),
    onSuccess: () => { setNewValue(''); queryClient.invalidateQueries({ queryKey: ['housePreferences', houseId] }); },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (prefId: string) => houseService.removePreference(prefId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['housePreferences', houseId] }),
  });

  if (isLoading) return <View style={styles.centered}><Text style={styles.loadingText}>Carregando perfil...</Text></View>;
  if (isError) return <View style={styles.centered}><Text style={styles.errorText}>Erro ao carregar dados.</Text></View>;

  const copyToClipboard = () => { Clipboard.setString(houseId); Alert.alert('Sucesso!', 'Código da residência copiado.'); };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil da Residência</Text>
        <Text style={styles.subtitle}>Gerencie regras, restrições e moradores</Text>
      </View>

      <View style={styles.inviteCard}>
        <View style={styles.inviteHeader}>
          <Feather name="users" size={20} color="#0F766E" />
          <Text style={styles.inviteLabel}>Convidar Moradores</Text>
        </View>
        <Text style={styles.subtext}>Compartilhe este código com quem deseja juntar à residência:</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeText} numberOfLines={1}>{houseId}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
            <Feather name="copy" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.copyButtonText}>Copiar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Adicionar Nova Regra</Text>
        
        <View style={styles.typeSelector}>
          <TouchableOpacity style={[styles.typeButton, type === 'RESTRICTION' && styles.activeRestriction]} onPress={() => setType('RESTRICTION')}>
            <Text style={[styles.typeText, type === 'RESTRICTION' && styles.activeRestrictionText]}>Restrição</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeButton, type === 'PREFERENCE' && styles.activePreference]} onPress={() => setType('PREFERENCE')}>
            <Text style={[styles.typeText, type === 'PREFERENCE' && styles.activePreferenceText]}>Preferência</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputWrapper}>
          <Feather name="tag" size={18} color="#94A3B8" style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Ex: Sem glúten, Vegano..." placeholderTextColor="#94A3B8" value={newValue} onChangeText={setNewValue} />
        </View>

        <TouchableOpacity style={styles.addButton} onPress={() => newValue.trim() && addMutation.mutate()} disabled={addMutation.isPending}>
          <Text style={styles.addButtonText}>Adicionar Regra</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Regras Ativas</Text>
      {preferences && preferences.length === 0 ? (
        <Text style={styles.empty}>Nenhuma restrição ou preferência registada.</Text>
      ) : (
        preferences?.map((pref: any) => (
          <View key={pref.id} style={styles.prefCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefValue}>{pref.value}</Text>
              <Text style={[styles.prefType, pref.type === 'RESTRICTION' ? styles.textRestriction : styles.textPreference]}>
                {pref.type === 'RESTRICTION' ? 'Restrição Obrigatória' : 'Preferência da Residência'}
              </Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteMutation.mutate(pref.id)}>
              <Feather name="trash-2" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Membros</Text>
      {participants?.map((member: any) => (
        <View key={member.user_id} style={styles.memberCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Feather name="user" size={18} color="#64748B" style={{ marginRight: 12 }} />
            <Text style={styles.memberText}>{member.user_id.substring(0, 10)}...</Text>
          </View>
          <View style={[styles.memberRole, member.role === 'ADMIN' ? styles.roleAdmin : styles.roleMember]}>
            <Text style={[styles.memberRoleText, member.role === 'ADMIN' ? styles.roleAdminText : styles.roleMemberText]}>
              {member.role === 'ADMIN' ? 'Administrador' : 'Morador'}
            </Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { color: '#64748B', fontSize: 16, fontWeight: '500' },
  errorText: { color: '#EF4444', fontSize: 16, fontWeight: '500' },
  
  header: { marginBottom: 24 },
  title: { fontSize: 36, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5, marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#64748B', fontWeight: '500' },

  formCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, marginBottom: 24, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, color: '#0F172A', letterSpacing: -0.5 },
  
  typeSelector: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  typeButton: { flex: 1, padding: 14, borderWidth: 1.5, borderColor: '#F1F5F9', borderRadius: 16, alignItems: 'center', backgroundColor: '#F8FAFC' },
  activeRestriction: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  activePreference: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  typeText: { fontSize: 14, color: '#64748B', fontWeight: '700' },
  activeRestrictionText: { color: '#991B1B' },
  activePreferenceText: { color: '#B45309' },
  
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 16, marginBottom: 16 },
  inputIcon: { paddingLeft: 16 },
  input: { flex: 1, padding: 16, fontSize: 16, color: '#0F172A', fontWeight: '500' },
  
  addButton: { backgroundColor: '#0F766E', padding: 18, borderRadius: 16, alignItems: 'center' },
  addButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  
  empty: { color: '#94A3B8', fontStyle: 'italic', fontSize: 15, marginBottom: 20 },
  
  prefCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  prefValue: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  prefType: { fontSize: 13, marginTop: 4, fontWeight: '700' },
  textRestriction: { color: '#EF4444' },
  textPreference: { color: '#D97706' },
  deleteButton: { backgroundColor: '#FEE2E2', padding: 12, borderRadius: 14 },
  
  memberCard: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  memberText: { color: '#334155', fontSize: 16, fontWeight: '700' },
  memberRole: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  roleAdmin: { backgroundColor: '#CCFBF1' },
  roleMember: { backgroundColor: '#F1F5F9' },
  memberRoleText: { fontWeight: '800', fontSize: 12, textTransform: 'uppercase' },
  roleAdminText: { color: '#0F766E' },
  roleMemberText: { color: '#64748B' },
  
  inviteCard: { backgroundColor: '#CCFBF1', padding: 20, borderRadius: 24, marginBottom: 24 },
  inviteHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  inviteLabel: { fontSize: 16, fontWeight: '800', color: '#0F766E', marginLeft: 10 },
  subtext: { color: '#334155', fontSize: 14, marginBottom: 16, lineHeight: 20, fontWeight: '500' },
  codeRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center', paddingLeft: 16, overflow: 'hidden' },
  codeText: { flex: 1, color: '#0F766E', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  copyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F766E', paddingVertical: 16, paddingHorizontal: 20 },
  copyButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 }
});