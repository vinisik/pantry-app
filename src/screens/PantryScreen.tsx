import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, Platform, Modal, ActivityIndicator, TextInput } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { pantryService } from '../services/pantryService';

interface PantryScreenProps {
  houseId: string;
  session: any; 
}

export default function PantryScreen({ houseId, session }: PantryScreenProps) {
  const queryClient = useQueryClient();
  const userId = session.user.id;

  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [scannedProductName, setScannedProductName] = useState('');
  const [scannedProductUnit, setScannedProductUnit] = useState('un');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const { data: items, isLoading, refetch } = useQuery({ queryKey: ['pantry', houseId], queryFn: () => pantryService.getEstimatedPantry(houseId) });

  const aiCheckMutation = useMutation({
    mutationFn: () => pantryService.checkAndAutoUpdateLowStock(houseId, userId),
    onSuccess: (updatedCount) => {
      if (updatedCount > 0) {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      }
    }
  });

  useEffect(() => { aiCheckMutation.mutate(); }, []);

  const statusMutation = useMutation({
    mutationFn: (params: any) => pantryService.updateItemStatus(params.id, houseId, userId, params.status, params.name, params.unit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] }); 
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const handleStatusChange = (item: any, newStatus: string) => {
    statusMutation.mutate({ id: item.id, name: item.product_name, unit: item.unit, status: newStatus });
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) return Alert.alert('Permissão necessária', 'É preciso permitir o acesso à câmara.');
    }
    setScanned(false);
    setIsScannerOpen(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      let foundName = '';
      let foundUnit = 'un';

      // Tenta a API do Open Food Facts
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
      const json = await response.json();

      if (json.status === 1 && json.product) {
        const prod = json.product;
        foundName = prod.product_name_pt || prod.product_name || prod.generic_name_pt || prod.generic_name || '';
        
        if (prod.brands && foundName) {
          foundName = `${foundName} (${prod.brands})`;
        }

        if (prod.quantity) {
          foundUnit = prod.quantity.replace(/[^a-zA-Z]/g, '').toLowerCase() || 'un';
        }
      }

      // Fallback para a Bluesoft Cosmos API
      if (!foundName) {
        const COSMOS_TOKEN = process.env.EXPO_PUBLIC_COSMOS_TOKEN;

        if (COSMOS_TOKEN) {
          const cosmosResponse = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${data}.json`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Cosmos-Token': COSMOS_TOKEN,
              'User-Agent': 'Cosmos-API-Request'
            }
          });

          if (cosmosResponse.ok) {
            const cosmosData = await cosmosResponse.json();
            if (cosmosData && cosmosData.description) {
              foundName = cosmosData.description;
            }
          }
        }
      }

      // Abre o modal com o nome preenchido pronto para ser ajustado se necessário
      setIsScannerOpen(false);
      setScannedProductName(foundName || 'Novo Produto');
      setScannedProductUnit(foundUnit || 'un');
      setIsConfirmModalOpen(true);

    } catch (error) {
      Alert.alert('Erro', 'Falha ao consultar as bases de dados de produtos.');
      setIsScannerOpen(false);
    } finally {
      setScanned(false);
    }
  };

  const saveScannedItemToPantry = (name: string, unit: string) => {
    statusMutation.mutate({
      id: 'new',
      name: name.trim(),
      unit: unit.trim(),
      status: 'AVAILABLE'
    }, {
      onSuccess: () => {
        setIsConfirmModalOpen(false);
        Alert.alert('Guardado!', `"${name}" adicionado à despensa com sucesso.`);
      }
    });
  };

  if (isLoading) return <View style={styles.centered}><Text style={styles.loadingText}>Carregando despensa...</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>Despensa</Text>
          <Text style={styles.subtitle}>O que tem em casa agora.</Text>
        </View>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleOpenScanner} activeOpacity={0.8}>
          <Feather name="camera" size={16} color="#0F766E" />
          <Text style={styles.actionButtonText}>Guardar</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="package" size={64} color="#CBD5E1" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>A sua despensa está vazia.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isLow = item.status === 'RUNNING_LOW';
          return (
            <View style={styles.card}>
              <View style={[styles.statusIndicator, isLow ? styles.indicatorLow : styles.indicatorOk]} />
              
              <View style={styles.cardContent}>
                <View style={styles.cardInfo}>
                  <Text style={styles.product}>{item.product_name}</Text>
                  {item.expected_duration_days && (
                    <Text style={styles.debugSubtext}>Duração configurada: {item.expected_duration_days} dias</Text>
                  )}
                  <View style={styles.badgeRow}>
                    <View style={[styles.statusBadge, isLow ? styles.badgeLow : styles.badgeOk]}>
                      <Text style={[styles.statusText, isLow ? styles.textLow : styles.textOk]}>
                        {isLow ? 'Acabando' : 'Boa quantidade'}
                      </Text>
                    </View>
                    <Text style={styles.unitText}>{item.unit}</Text>
                  </View>
                </View>
                
                <View style={styles.actions}>
                  {isLow && (
                    <TouchableOpacity style={[styles.btn, styles.btnOk]} onPress={() => handleStatusChange(item, 'AVAILABLE')}>
                      <Feather name="corner-up-left" size={18} color="#0F766E" />
                    </TouchableOpacity>
                  )}
                  {item.status === 'AVAILABLE' && (
                    <TouchableOpacity style={[styles.btn, styles.btnLow]} onPress={() => handleStatusChange(item, 'RUNNING_LOW')}>
                      <Feather name="trending-down" size={18} color="#D97706" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.btn, styles.btnOut]} onPress={() => handleStatusChange(item, 'OUT_OF_STOCK')}>
                    <Feather name="trash-2" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Modal do Scanner de Código de Barras */}
      <Modal visible={isScannerOpen} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
          />
          <View style={styles.scannerTargetContainer}>
            <View style={styles.scannerTargetBox} />
          </View>
          <View style={styles.scannerOverlay}>
            {scanned ? (
              <View style={styles.loadingBoxScanner}>
                <ActivityIndicator size="large" color="#CCFBF1" />
                <Text style={styles.loadingTextScanner}>Buscando produto...</Text>
              </View>
            ) : (
              <Text style={styles.scannerText}>Aponte para o código de barras do produto</Text>
            )}
            <TouchableOpacity style={styles.closeScannerBtn} onPress={() => setIsScannerOpen(false)} disabled={scanned}>
              <Text style={styles.closeScannerText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DE EDIÇÃO PRÉVIA ANTES DE GUARDAR NA DESPENSA */}
      <Modal visible={isConfirmModalOpen} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Guardar na Despensa</Text>
            <Text style={styles.modalSubtitle}>Confirme ou edite o nome do produto antes de salvar:</Text>
            
            <Text style={styles.labelInput}>Nome do Produto</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="Ex: Achocolatado em Pó" 
              placeholderTextColor="#94A3B8"
              value={scannedProductName}
              onChangeText={setScannedProductName}
            />

            <Text style={styles.labelInput}>Unidade</Text>
            <TextInput 
              style={styles.modalInput} 
              placeholder="Ex: un, kg, g, L" 
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              value={scannedProductUnit}
              onChangeText={setScannedProductUnit}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsConfirmModalOpen(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={() => {
                if (scannedProductName.trim()) {
                  saveScannedItemToPantry(scannedProductName, scannedProductUnit);
                } else {
                  Alert.alert('Aviso', 'Insira um nome válido.');
                }
              }}>
                <Text style={styles.modalSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'ios' ? 20 : 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { color: '#64748B', fontSize: 16, fontWeight: '500' },
  
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginBottom: 20,
    gap: 12 
  },
  
  headerTextContainer: {
    flex: 1,
  },

  title: { 
    fontSize: 36, 
    fontWeight: '900', 
    color: '#0F172A', 
    letterSpacing: -1, 
    marginBottom: 2 
  },
  
  subtitle: { 
    fontSize: 14, 
    color: '#64748B', 
    fontWeight: '500' 
  },

  actionButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#CCFBF1', 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 14, 
    gap: 6,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  
  actionButtonText: { 
    color: '#0F766E', 
    fontWeight: '800', 
    fontSize: 13 
  },
  
  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 16, fontWeight: '500' },
  
  card: { backgroundColor: '#FFFFFF', marginBottom: 16, borderRadius: 24, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3, flexDirection: 'row', overflow: 'hidden' },
  statusIndicator: { width: 6, height: '100%' },
  indicatorOk: { backgroundColor: '#10B981' },
  indicatorLow: { backgroundColor: '#F59E0B' },
  
  cardContent: { flex: 1, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1, marginRight: 16 },
  product: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5, marginBottom: 4 },
  debugSubtext: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 8 },
  
  badgeRow: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 8 },
  badgeOk: { backgroundColor: '#D1FAE5' },
  badgeLow: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  textOk: { color: '#047857' },
  textLow: { color: '#B45309' },
  unitText: { color: '#94A3B8', fontWeight: '700', fontSize: 14 },
  
  actions: { flexDirection: 'row', gap: 10 },
  btn: { width: 44, height: 44, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnOk: { backgroundColor: '#CCFBF1' },
  btnLow: { backgroundColor: '#FEF3C7' },
  btnOut: { backgroundColor: '#FEE2E2' },

  scannerContainer: { flex: 1, backgroundColor: '#000000' },
  scannerTargetContainer: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  scannerTargetBox: { width: 260, height: 200, borderWidth: 3, borderColor: '#0F766E', borderRadius: 24, backgroundColor: 'transparent' },
  scannerOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 60, zIndex: 2 },
  scannerText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 24, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, overflow: 'hidden' },
  loadingBoxScanner: { backgroundColor: 'rgba(15, 118, 110, 0.9)', paddingHorizontal: 32, paddingVertical: 20, borderRadius: 24, alignItems: 'center', marginBottom: 24 },
  loadingTextScanner: { color: '#FFFFFF', marginTop: 12, fontSize: 16, fontWeight: '800' },
  closeScannerBtn: { backgroundColor: '#EF4444', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 20 },
  closeScannerText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },

  // Estilos do Modal de Edição Prévia
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#FFFFFF', width: '100%', maxWidth: 360, padding: 24, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  labelInput: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 4, textTransform: 'uppercase' },
  modalInput: { backgroundColor: '#F1F5F9', padding: 14, borderRadius: 14, fontSize: 15, color: '#0F172A', fontWeight: '600', marginBottom: 14 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { color: '#64748B', fontWeight: '700', fontSize: 15 },
  modalSaveBtn: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#0F766E', alignItems: 'center' },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});