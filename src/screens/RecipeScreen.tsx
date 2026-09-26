import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recipeService } from '../services/recipeService';
import { pantryService } from '../services/pantryService';
import { aiRecipeService } from '../services/aiRecipeService';
import { shoppingService } from '../services/shoppingService';

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
  const [aiPrompt, setAiPrompt] = useState('');

  const { data: recipes, isLoading: loadingRecipes, isError: isErrorRecipes, error: errorRecipes } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => recipeService.getCatalog(),
  });

  const { data: pantry, isLoading: loadingPantry } = useQuery({
    queryKey: ['pantry', houseId],
    queryFn: () => pantryService.getEstimatedPantry(houseId),
  });

  const prepMutation = useMutation({
    mutationFn: (recipeName: string) => recipeService.registerPrep(houseId, userId, recipeName),
    onSuccess: () => {
      setReviewingRecipe(selectedRecipe);
      setSelectedRecipe(null);
      setExhaustedItems([]);
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const generateAiRecipeMutation = useMutation({
    mutationFn: () => aiRecipeService.generateAndSaveRecipe(houseId, pantry || [], aiPrompt),
    onSuccess: () => {
      setAiPrompt('');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      Alert.alert('Sucesso!', 'A IA criou uma receita baseada no seu pedido!');
    },
    onError: (error: any) => Alert.alert('Aviso', error.message)
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: (recipeId: string) => recipeService.deleteRecipe(recipeId),
    onSuccess: (_, recipeId) => {
      queryClient.setQueryData(['recipes'], (old: any) => {
        if (!old) return [];
        return old.filter((recipe: any) => recipe.id !== recipeId);
      });
      setSelectedRecipe(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const confirmDelete = (recipeId: string, recipeTitle: string) => {
    Alert.alert(
      'Excluir Receita',
      `Deseja realmente apagar "${recipeTitle}" do catálogo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deleteRecipeMutation.mutate(recipeId) }
      ]
    );
  };

  const addMissingToShoppingListMutation = useMutation({
    mutationFn: async (missingList: string[]) => {
      for (const itemName of missingList) {
        const recipeIng = selectedRecipe?.recipe_ingredients?.find(
          (ing: any) => ing.product_name.toLowerCase() === itemName.toLowerCase()
        );
        const quantity = recipeIng?.quantity || 1;
        const unit = recipeIng?.unit || 'un';
        await shoppingService.addItem(houseId, userId, itemName, quantity, unit, undefined, false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      Alert.alert('Sucesso!', 'Ingredientes em falta adicionados à lista de compras.');
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  const updatePantryMutation = useMutation({
    mutationFn: async () => {
      for (const itemName of exhaustedItems) {
        const pItem = pantry?.find(p => p.product_name.toLowerCase() === itemName.toLowerCase());
        if (pItem) {
          await pantryService.updateItemStatus(pItem.id, houseId, userId, 'OUT_OF_STOCK', pItem.product_name, pItem.unit);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry', houseId] });
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      setReviewingRecipe(null);
      Alert.alert('Pronto!', 'Sua despensa foi atualizada com sucesso.');
    }
  });

  const toggleExhausted = (itemName: string) => {
    setExhaustedItems(prev => prev.includes(itemName) ? prev.filter(i => i !== itemName) : [...prev, itemName]);
  };

  if (loadingRecipes || loadingPantry) return <View style={styles.centered}><Text style={styles.loadingText}>A consultar cadernos de receitas...</Text></View>;
  if (isErrorRecipes) return <View style={styles.centered}><Text style={styles.errorText}>Erro: {errorRecipes?.message}</Text></View>;

  const processedRecipes = recipes?.map((recipe: any) => {
    const missingIngredients: string[] = [];
    if (recipe.recipe_ingredients) {
      recipe.recipe_ingredients.forEach((ing: any) => {
        const hasItem = pantry?.some(p => p.product_name.toLowerCase() === ing.product_name.toLowerCase());
        if (!hasItem) missingIngredients.push(ing.product_name);
      });
    }
    return { ...recipe, missingIngredients };
  });

  processedRecipes?.sort((a, b) => a.missingIngredients.length - b.missingIngredients.length);

  // REVISÃO PÓS-PREPARO
  if (reviewingRecipe) {
    return (
      <View style={styles.container}>
        <Text style={styles.detailTitle}>Bom Apetite! 🍽️</Text>
        <Text style={styles.subtitle}>Algum destes ingredientes acabou durante o preparo?</Text>
        <ScrollView style={styles.ingredientsBox} contentContainerStyle={{ paddingBottom: 20 }}>
          {reviewingRecipe.recipe_ingredients.map((ing: any) => {
            if (reviewingRecipe.missingIngredients.includes(ing.product_name)) return null;
            const isSelected = exhaustedItems.includes(ing.product_name);
            return (
              <TouchableOpacity key={ing.id} style={[styles.reviewItem, isSelected && styles.reviewItemSelected]} onPress={() => toggleExhausted(ing.product_name)}>
                <Text style={[styles.reviewItemText, isSelected && styles.reviewItemTextSelected]}>{ing.product_name}</Text>
                {isSelected && <Text style={styles.checkIcon}>✓ Acabou</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={styles.btnCook} onPress={() => updatePantryMutation.mutate()} disabled={updatePantryMutation.isPending}>
          <Text style={styles.btnCookText}>{exhaustedItems.length > 0 ? 'Atualizar Despensa' : 'Sobrou tudo (Concluir)'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // DETALHES DA RECEITA
  if (selectedRecipe) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setSelectedRecipe(null)} style={styles.backButton}>
            <Text style={styles.backText}>{"< Voltar"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => confirmDelete(selectedRecipe.id, selectedRecipe.title)} style={styles.deleteHeaderButton}>
            <Text style={styles.deleteHeaderText}>Excluir Receita</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={styles.detailTitle}>{selectedRecipe.title}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoBadge}>⏱ {selectedRecipe.prep_time_minutes} min</Text>
            <Text style={styles.infoBadge}>🍽 {selectedRecipe.servings} porções</Text>
          </View>

          <Text style={styles.sectionTitle}>Ingredientes</Text>
          <View style={styles.ingredientsBox}>
            {selectedRecipe.recipe_ingredients.map((ing: any) => {
              const isMissing = selectedRecipe.missingIngredients.includes(ing.product_name);
              return (
                <Text key={ing.id} style={[styles.ingredientText, isMissing && styles.ingredientMissing]}>
                  • {ing.quantity} {ing.unit} de {ing.product_name} {isMissing ? '(Falta em casa)' : ''}
                </Text>
              );
            })}
          </View>

          {selectedRecipe.missingIngredients && selectedRecipe.missingIngredients.length > 0 && (
            <TouchableOpacity 
              style={styles.btnAddToCart} 
              onPress={() => addMissingToShoppingListMutation.mutate(selectedRecipe.missingIngredients)}
              disabled={addMissingToShoppingListMutation.isPending}
            >
              <Text style={styles.btnAddToCartText}>
                {addMissingToShoppingListMutation.isPending ? 'Adicionando...' : '🛒 Adicionar Faltas à Lista de Compras'}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Modo de Preparo</Text>
          <Text style={styles.instructions}>{selectedRecipe.instructions}</Text>

          <TouchableOpacity style={styles.btnCook} onPress={() => prepMutation.mutate(selectedRecipe.title)} disabled={prepMutation.isPending}>
            <Text style={styles.btnCookText}>Cozinhei isso! ✨</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // LISTA DE RECEITAS
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>🍳 Inspiração Culinária</Text>
        <Text style={styles.subtitle}>Receitas baseadas na sua despensa atual</Text>
      </View>

      <View style={styles.aiCard}>
        <TextInput 
          style={styles.aiInput} 
          placeholder="O que deseja cozinhar? (ex: Almoço com frango)" 
          placeholderTextColor="#A0A0A0"
          value={aiPrompt} 
          onChangeText={setAiPrompt} 
        />
        <TouchableOpacity 
          style={styles.aiButton} 
          onPress={() => generateAiRecipeMutation.mutate()}
          disabled={generateAiRecipeMutation.isPending}
        >
          <Text style={styles.aiButtonText}>
            {generateAiRecipeMutation.isPending ? 'Criando prato com IA...' : '✨ Inventar receita com o que tenho!'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={processedRecipes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma receita encontrada no catálogo.</Text>}
        renderItem={({ item }) => {
          const missCount = item.missingIngredients.length;
          const isReady = missCount === 0;
          return (
            <View style={[styles.card, isReady ? styles.cardReady : styles.cardMissing]}>
              <View style={styles.cardHeader}>
                <Text style={styles.recipeTitle}>{item.title}</Text>
                <Text style={styles.timeText}>⏱ {item.prep_time_minutes} min</Text>
              </View>
              
              {isReady ? (
                <Text style={styles.statusReady}>✨ Dá para fazer agora com o que tem!</Text>
              ) : (
                <Text style={styles.statusMissing}>⚠️ Faltam {missCount}: {item.missingIngredients.join(', ')}</Text>
              )}
              
              <View style={styles.cardActionsRow}>
                <TouchableOpacity style={styles.btnOpen} onPress={() => setSelectedRecipe(item)}>
                  <Text style={styles.btnOpenText}>Ver Receita</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnCardDelete} onPress={() => confirmDelete(item.id, item.title)}>
                  <Text style={styles.btnCardDeleteText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', paddingTop: 50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  loadingText: { color: '#6C757D', fontSize: 15, fontWeight: '500' },
  errorText: { color: '#D32F2F', fontWeight: 'bold' },
  headerContainer: { paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#1C1C1E' },
  subtitle: { color: '#6C757D', marginTop: 2, fontSize: 14 },
  empty: { textAlign: 'center', color: '#8E8E93', marginTop: 40, fontStyle: 'italic', fontSize: 14 },
  
  aiCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 14, borderRadius: 14, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  aiInput: { borderWidth: 1, borderColor: '#E5E5EA', padding: 11, borderRadius: 10, backgroundColor: '#FAFAFC', marginBottom: 10, fontSize: 14, color: '#1C1C1E' },
  aiButton: { backgroundColor: '#7B1FA2', padding: 12, borderRadius: 10, alignItems: 'center', shadowColor: '#7B1FA2', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
  aiButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { backgroundColor: '#FFFFFF', padding: 16, marginBottom: 14, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, borderLeftWidth: 4 },
  cardReady: { borderLeftColor: '#2E7D32' },
  cardMissing: { borderLeftColor: '#F57C00' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  recipeTitle: { fontSize: 17, fontWeight: '700', flex: 1, color: '#1C1C1E', marginRight: 8 },
  timeText: { fontSize: 13, color: '#6C757D', fontWeight: '600' },
  statusReady: { color: '#2E7D32', fontWeight: '600', fontSize: 13, marginBottom: 12 },
  statusMissing: { color: '#F57C00', fontSize: 13, marginBottom: 12, fontWeight: '500' },
  
  cardActionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnOpen: { backgroundColor: '#F1F3F5', padding: 10, borderRadius: 10, alignItems: 'center', flex: 1 },
  btnOpenText: { color: '#1C1C1E', fontWeight: '600', fontSize: 13 },
  btnCardDelete: { backgroundColor: '#FFEBEE', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  btnCardDeleteText: { color: '#C62828', fontWeight: 'bold', fontSize: 15 },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 20 },
  backButton: { paddingVertical: 8, paddingRight: 16 },
  backText: { color: '#2E7D32', fontWeight: '600', fontSize: 15 },
  deleteHeaderButton: { backgroundColor: '#FFEBEE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  deleteHeaderText: { color: '#C62828', fontWeight: '600', fontSize: 13 },
  
  detailTitle: { fontSize: 24, fontWeight: '700', color: '#1C1C1E', marginBottom: 12, paddingHorizontal: 20 },
  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 20, paddingHorizontal: 20 },
  infoBadge: { backgroundColor: '#E8F5E9', color: '#2E7D32', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, fontWeight: '600', fontSize: 13 },
  
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 10, marginBottom: 10, color: '#1C1C1E', paddingHorizontal: 20 },
  ingredientsBox: { backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 16, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginBottom: 20 },
  ingredientText: { fontSize: 15, color: '#495057', marginBottom: 6, lineHeight: 20 },
  ingredientMissing: { color: '#C62828', textDecorationLine: 'line-through', fontWeight: '500' },
  
  instructions: { fontSize: 15, color: '#495057', lineHeight: 22, backgroundColor: '#FFFFFF', marginHorizontal: 20, padding: 16, borderRadius: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginBottom: 24 },
  
  btnCook: { backgroundColor: '#2E7D32', marginHorizontal: 20, padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20, shadowColor: '#2E7D32', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  btnCookText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  
  reviewItem: { padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5EA', borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewItemSelected: { backgroundColor: '#FFEBEE', borderColor: '#FFCDD2' },
  reviewItemText: { fontSize: 15, color: '#1C1C1E' },
  reviewItemTextSelected: { color: '#C62828', fontWeight: '600' },
  checkIcon: { color: '#C62828', fontWeight: 'bold' },
  
  btnAddToCart: { backgroundColor: '#F57C00', marginHorizontal: 20, padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20, shadowColor: '#F57C00', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
  btnAddToCartText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});