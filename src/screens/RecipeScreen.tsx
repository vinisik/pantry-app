import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, Alert, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import { recipeService } from '../services/recipeService';
import { pantryService } from '../services/pantryService';
import { shoppingService } from '../services/shoppingService';
import { houseService } from '../services/houseService';

interface RecipesScreenProps {
  houseId: string;
  session: any;
}

export default function RecipesScreen({ houseId, session }: RecipesScreenProps) {
  const queryClient = useQueryClient();
  const userId = session?.user?.id;
  
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [reviewingRecipe, setReviewingRecipe] = useState<any>(null);
  const [exhaustedItems, setExhaustedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  // Se houver busca ativa, pesquisa no catálogo global
  const { data: recipes, isLoading: loadingRecipes } = useQuery({ 
    queryKey: ['recipes', houseId, activeSearchTerm], 
    queryFn: () => activeSearchTerm.trim() !== '' 
      ? recipeService.searchCatalog(activeSearchTerm) 
      : recipeService.getSavedRecipes(houseId) 
  });

  const { data: pantry, isLoading: loadingPantry } = useQuery({ queryKey: ['pantry', houseId], queryFn: () => pantryService.getEstimatedPantry(houseId) });
  const { data: preferences, isLoading: loadingPrefs } = useQuery({ queryKey: ['housePreferences', houseId], queryFn: () => houseService.getHousePreferences(houseId) });

  const activeRestrictions = preferences?.filter(p => p.type === 'RESTRICTION') || [];
  const activePreferences = preferences?.filter(p => p.type === 'PREFERENCE') || [];

  // Mutation para guardar receita do catálogo na casa
  const saveRecipeMutation = useMutation({
    mutationFn: (recipeId: string) => recipeService.saveRecipeToHouse(houseId, recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', houseId] });
      Alert.alert('Sucesso!', 'Receita salva na lista da casa.');
    },
    onError: (error: any) => Alert.alert('Aviso', error.message.includes('unique') ? 'Esta receita já está salva.' : error.message)
  });

  // Mutation para remover receita das salvas da casa
  const removeSavedRecipeMutation = useMutation({
    mutationFn: (recipeId: string) => recipeService.removeRecipeFromHouse(houseId, recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', houseId] });
      setSelectedRecipe(null);
      Alert.alert('Sucesso', 'Receita removida das salvas.');
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const prepMutation = useMutation({
    mutationFn: (recipeName: string) => recipeService.registerPrep(houseId, userId, recipeName),
    onSuccess: () => { setReviewingRecipe(selectedRecipe); setSelectedRecipe(null); setExhaustedItems([]); }
  });

  const addMissingToShoppingListMutation = useMutation({
    mutationFn: async (missingList: string[]) => {
      for (const itemName of missingList) {
        const recipeIng = selectedRecipe?.recipe_ingredients?.find(
          (ing: any) => ing.product_name.toLowerCase() === itemName.toLowerCase()
        );
        
        const rawName = itemName.toLowerCase().trim();
        let quantity = recipeIng?.quantity || 1;
        let unit = recipeIng?.unit || 'un';

        if (rawName.includes('sal') || rawName.includes('açúcar') || rawName.includes('acucar') || rawName.includes('farinha')) {
          quantity = 1; unit = 'kg';
        } else if (rawName.includes('arroz')) {
          quantity = 5; unit = 'kg';
        } else if (rawName.includes('óleo') || rawName.includes('oleo') || rawName.includes('azeite')) {
          quantity = 1; unit = 'un';
        } else if (rawName.includes('leite')) {
          quantity = 1; unit = 'L';
        } else if (rawName.includes('manteiga') || rawName.includes('margarina')) {
          quantity = 1; unit = 'un'; 
        } else if (rawName.includes('ovo') || rawName.includes('ovos')) {
          quantity = 6; unit = 'un';
        }

        await shoppingService.addItem(houseId, userId, itemName, quantity, unit, undefined, false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      Alert.alert('Sucesso!', 'Ingredientes em falta adicionados à lista de compras.');
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const toggleExhausted = (itemName: string) => {
    setExhaustedItems(prev => prev.includes(itemName) ? prev.filter(i => i !== itemName) : [...prev, itemName]);
  };

  const updatePantryMutation = useMutation({
    mutationFn: async () => {
      for (const itemName of exhaustedItems) {
        const pItem = pantry?.find(p => p.product_name.toLowerCase() === itemName.toLowerCase());
        if (pItem) await pantryService.updateItemStatus(pItem.id, houseId, userId, 'OUT_OF_STOCK', pItem.product_name, pItem.unit);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      setReviewingRecipe(null);
    }
  });

  if (loadingPantry) return <View style={styles.centered}><Text style={styles.loadingText}>A ler os cadernos...</Text></View>;

  const processedRecipes = recipes?.map((recipe: any) => {
    const missingIngredients: string[] = [];
    if (recipe?.recipe_ingredients) {
      recipe.recipe_ingredients.forEach((ing: any) => {
        if (!pantry?.some(p => p.product_name.toLowerCase() === ing.product_name.toLowerCase())) missingIngredients.push(ing.product_name);
      });
    }
    return { ...recipe, missingIngredients };
  })?.sort((a, b) => a.missingIngredients.length - b.missingIngredients.length);

  if (reviewingRecipe) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bom Apetite!</Text>
          <Text style={styles.subtitle}>Algum destes ingredientes acabou durante o preparo?</Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }}>
          {reviewingRecipe.recipe_ingredients.map((ing: any) => {
            if (reviewingRecipe.missingIngredients.includes(ing.product_name)) return null;
            const isSelected = exhaustedItems.includes(ing.product_name);
            return (
              <TouchableOpacity key={ing.id} style={[styles.reviewItem, isSelected && styles.reviewItemSelected]} onPress={() => toggleExhausted(ing.product_name)}>
                <Text style={[styles.reviewItemText, isSelected && styles.reviewItemTextSelected]}>{ing.product_name}</Text>
                {isSelected && <Feather name="check-circle" size={24} color="#EF4444" />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.btnCookFinal} onPress={() => updatePantryMutation.mutate()}>
          <Text style={styles.btnCookTextFinal}>{exhaustedItems.length > 0 ? 'Atualizar Despensa' : 'Sobrou tudo (Concluir)'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (selectedRecipe) {
    return (
      <View style={styles.container}>
        <View style={styles.detailNav}>
          <TouchableOpacity onPress={() => setSelectedRecipe(null)} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => saveRecipeMutation.mutate(selectedRecipe.id)} style={styles.saveBtn}>
              <Feather name="bookmark" size={20} color="#4F46E5" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24 }}>
          <Text style={styles.detailTitle}>{selectedRecipe.title}</Text>
          
          <View style={styles.infoRow}>
            <View style={styles.infoBadge}><Feather name="clock" size={16} color="#0F766E" /><Text style={styles.infoBadgeText}>{selectedRecipe.prep_time_minutes} min</Text></View>
            <View style={styles.infoBadge}><Feather name="users" size={16} color="#0F766E" /><Text style={styles.infoBadgeText}>{selectedRecipe.servings} porções</Text></View>
          </View>

          <Text style={styles.sectionTitle}>Ingredientes</Text>
          <View style={styles.ingredientsBox}>
            {selectedRecipe.recipe_ingredients?.map((ing: any) => {
              const isMissing = selectedRecipe.missingIngredients.includes(ing.product_name);
              return (
                <View key={ing.id || ing.product_name} style={styles.ingredientRow}>
                  <View style={[styles.bullet, isMissing && styles.bulletMissing]} />
                  <Text style={[styles.ingredientText, isMissing && styles.ingredientMissing]}>
                    {ing.quantity} {ing.unit} {ing.product_name}
                  </Text>
                </View>
              );
            })}
          </View>

          {selectedRecipe.missingIngredients && selectedRecipe.missingIngredients.length > 0 && (
            <TouchableOpacity 
              style={styles.btnAddMissing} 
              onPress={() => addMissingToShoppingListMutation.mutate(selectedRecipe.missingIngredients)}
              disabled={addMissingToShoppingListMutation.isPending}
            >
              <Feather name="shopping-cart" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.btnAddMissingText}>
                {addMissingToShoppingListMutation.isPending ? 'Adicionando...' : 'Adicionar faltas à lista de compras'}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Preparação</Text>
          <View style={styles.instructionsBox}>
            <Text style={styles.instructions}>{selectedRecipe.instructions}</Text>
          </View>

          {/* Botão de remover da lista da casa */}
          {activeSearchTerm === '' && (
            <TouchableOpacity 
              style={styles.btnRemoveSaved} 
              onPress={() => removeSavedRecipeMutation.mutate(selectedRecipe.id)}
            >
              <Feather name="minus-circle" size={18} color="#EF4444" style={{ marginRight: 8 }} />
              <Text style={styles.btnRemoveSavedText}>Remover das receitas salvas</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.btnCookPrimary} onPress={() => prepMutation.mutate(selectedRecipe.title)}>
            <Text style={styles.btnCookTextPrimary}>Cozinhar isto!</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Receitas</Text>
        <Text style={styles.subtitle}>
          {activeSearchTerm !== '' ? 'Resultados da pesquisa no catálogo' : 'Suas receitas salvas e recomendadas'}
        </Text>
      </View>

      <View style={styles.aiCard}>
        <Text style={styles.aiCardTitle}>Procurar no Catálogo</Text>
        
        <View style={styles.aiInputWrapper}>
          <Feather name="search" size={20} color="#6366F1" />
          <TextInput 
            style={styles.aiInput} 
            placeholder="Ex: Frango, massa, bolo..." 
            placeholderTextColor="#94A3B8" 
            value={searchQuery} 
            onChangeText={(text) => {
              setSearchQuery(text);
              if (text === '') setActiveSearchTerm('');
            }} 
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setActiveSearchTerm(''); }}>
              <Feather name="x" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={styles.aiButton} 
          onPress={() => setActiveSearchTerm(searchQuery)}
        >
          <Text style={styles.aiButtonText}>Pesquisar no Catálogo</Text>
        </TouchableOpacity>
      </View>

      {loadingRecipes ? (
        <View style={{ marginTop: 40 }}><ActivityIndicator size="large" color="#4F46E5" /></View>
      ) : (
        <FlatList
          data={processedRecipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {activeSearchTerm !== '' ? 'Nenhuma receita encontrada no catálogo.' : 'Nenhuma receita salva ainda. Pesquise no catálogo para adicionar!'}
            </Text>
          }
          renderItem={({ item }) => {
            const isReady = item.missingIngredients.length === 0;
            return (
              <TouchableOpacity style={styles.recipeCard} onPress={() => setSelectedRecipe(item)} activeOpacity={0.8}>
                <View style={styles.recipeCardHeader}>
                  <Text style={styles.recipeTitle}>{item.title}</Text>
                  <View style={styles.timeBadge}><Text style={styles.timeText}>{item.prep_time_minutes}m</Text></View>
                </View>
                
                <View style={[styles.statusBadge, isReady ? styles.badgeReady : styles.badgeMissing]}>
                  <Text style={[styles.statusText, isReady ? styles.textReady : styles.textMissing]}>
                    {isReady ? 'Pronto para preparar' : `Faltam ${item.missingIngredients.length} ingredientes`}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'ios' ? 20 : 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  loadingText: { color: '#64748B', fontSize: 16, fontWeight: '500' },
  
  header: { paddingHorizontal: 24, marginBottom: 20 },
  title: { fontSize: 36, fontWeight: '900', color: '#0F172A', letterSpacing: -1.5, marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#64748B', fontWeight: '500' },
  
  aiCard: { backgroundColor: '#EEF2FF', marginHorizontal: 20, padding: 20, borderRadius: 24, marginBottom: 20 },
  aiCardTitle: { fontSize: 14, fontWeight: '800', color: '#4F46E5', textTransform: 'uppercase', marginBottom: 12 },
  
  aiInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 16, marginBottom: 16 },
  aiInput: { flex: 1, paddingVertical: 16, paddingLeft: 12, fontSize: 16, color: '#0F172A', fontWeight: '500' },
  aiButton: { backgroundColor: '#4F46E5', padding: 16, borderRadius: 16, alignItems: 'center' },
  aiButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  listContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 16, marginTop: 40 },
  
  recipeCard: { backgroundColor: '#FFFFFF', padding: 24, marginBottom: 16, borderRadius: 24, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  recipeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  recipeTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', flex: 1, marginRight: 12, letterSpacing: -0.5 },
  timeBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  timeText: { color: '#64748B', fontWeight: '800', fontSize: 14 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeReady: { backgroundColor: '#D1FAE5' },
  badgeMissing: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  textReady: { color: '#047857' },
  textMissing: { color: '#B45309' },

  detailNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 16 },
  backBtn: { width: 44, height: 44, backgroundColor: '#FFFFFF', borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 },
  saveBtn: { width: 44, height: 44, backgroundColor: '#EEF2FF', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 44, height: 44, backgroundColor: '#FEE2E2', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  
  detailTitle: { fontSize: 32, fontWeight: '900', color: '#0F172A', letterSpacing: -1, marginBottom: 20 },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#CCFBF1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16 },
  infoBadgeText: { color: '#0F766E', fontWeight: '800', fontSize: 15, marginLeft: 8 },
  
  sectionTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 16, letterSpacing: -0.5 },
  ingredientsBox: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 24, marginBottom: 16, shadowColor: '#94A3B8', shadowOpacity: 0.05, shadowRadius: 10 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bullet: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0F766E', marginRight: 12 },
  bulletMissing: { backgroundColor: '#EF4444' },
  ingredientText: { fontSize: 16, color: '#334155', fontWeight: '500' },
  ingredientMissing: { color: '#EF4444', textDecorationLine: 'line-through' },

  btnAddMissing: { flexDirection: 'row', backgroundColor: '#D97706', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 24, shadowColor: '#94A3B8', shadowOpacity: 0.1, shadowRadius: 8 },
  btnAddMissingText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  
  btnRemoveSaved: { flexDirection: 'row', backgroundColor: '#FEF2F2', padding: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#FCA5A5' },
  btnRemoveSavedText: { color: '#EF4444', fontSize: 16, fontWeight: '800' },

  instructionsBox: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, marginBottom: 40, shadowColor: '#94A3B8', shadowOpacity: 0.05, shadowRadius: 10 },
  instructions: { fontSize: 16, color: '#334155', lineHeight: 28, fontWeight: '500' },
  
  bottomBar: { padding: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  btnCookPrimary: { backgroundColor: '#0F766E', padding: 20, borderRadius: 20, alignItems: 'center' },
  btnCookTextPrimary: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },

  reviewItem: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 2, borderColor: '#F1F5F9' },
  reviewItemSelected: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  reviewItemText: { fontSize: 16, color: '#334155', fontWeight: '600' },
  reviewItemTextSelected: { color: '#EF4444', fontWeight: '800' },
  btnCookFinal: { backgroundColor: '#0F172A', margin: 20, padding: 20, borderRadius: 20, alignItems: 'center' },
  btnCookTextFinal: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});