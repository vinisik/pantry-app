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
    
    onMutate: async (recipeId) => {
      await queryClient.cancelQueries({ queryKey: ['recipes'] });
      const previousRecipes = queryClient.getQueryData(['recipes']);

      queryClient.setQueryData(['recipes'], (old: any) => {
        if (!old) return [];
        return old.filter((recipe: any) => recipe.id !== recipeId);
      });

      setSelectedRecipe(null);
      return { previousRecipes };
    },

    onError: (err, recipeId, context) => {
      if (context?.previousRecipes) {
        queryClient.setQueryData(['recipes'], context.previousRecipes);
      }
      Alert.alert('Erro', 'Não foi possível excluir a receita.');
    },

    onSuccess: (_, recipeId) => {
      queryClient.setQueryData(['recipes'], (old: any) => {
        if (!old) return [];
        return old.filter((recipe: any) => recipe.id !== recipeId);
      });
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

  // Mutação para enviar ingredientes em falta para a lista de compras
  const addMissingToShoppingListMutation = useMutation({
    mutationFn: async (missingList: string[]) => {
      for (const itemName of missingList) {
        await shoppingService.addItem(houseId, userId, itemName, 1, 'un', undefined, false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList', houseId] });
      Alert.alert('Sucesso!', 'Os ingredientes em falta foram adicionados à sua lista de compras.');
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
      Alert.alert('Pronto!', 'Sua despensa foi atualizada.');
    }
  });

  const toggleExhausted = (itemName: string) => {
    setExhaustedItems(prev => prev.includes(itemName) ? prev.filter(i => i !== itemName) : [...prev, itemName]);
  };

  if (loadingRecipes || loadingPantry) return <View style={styles.centered}><Text>Consultando cadernos...</Text></View>;
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
        <ScrollView style={styles.ingredientsBox}>
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
          <Text style={styles.btnCookText}>{exhaustedItems.length > 0 ? 'Atualizar Despensa' : 'Sobrou tudo (Sair)'}</Text>
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

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.detailTitle}>{selectedRecipe.title}</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoBadge}>⏱ {selectedRecipe.prep_time_minutes} min</Text>
            <Text style={styles.infoBadge}>🍽 {selectedRecipe.servings} porções</Text>
          </View>
          <Text style={styles.sectionTitle}>Ingredientes</Text>
          <View style={styles.ingredientsBox}>
            {selectedRecipe.recipe_ingredients.map((ing: any) => {
              const isMissing = selectedRecipe.missingIngredients.includes(ing.product_name);
              return <Text key={ing.id} style={[styles.ingredientText, isMissing && styles.ingredientMissing]}>• {ing.quantity} {ing.unit} de {ing.product_name} {isMissing ? '(Falta)' : ''}</Text>;
            })}
          </View>
          {/* Botão para enviar itens em falta para a lista de compras */}
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
          <Text style={styles.sectionTitle}>Preparo</Text>
          <Text style={styles.instructions}>{selectedRecipe.instructions}</Text>
          <TouchableOpacity style={styles.btnCook} onPress={() => prepMutation.mutate(selectedRecipe.title)} disabled={prepMutation.isPending}>
            <Text style={styles.btnCookText}>Cozinhei isso!</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // LISTA DE RECEITAS
  return (
    <View style={styles.container}>
      <Text style={styles.title}>O que vamos comer?</Text>
      <Text style={styles.subtitle}>Receitas baseadas no que você tem em casa.</Text>

      {/* Campo para pedido personalizado à IA */}
      <TextInput 
        style={styles.aiInput} 
        placeholder="O que deseja comer? (ex: Almoço fit com frango)" 
        value={aiPrompt} 
        onChangeText={setAiPrompt} 
      />
      <TouchableOpacity 
        style={styles.aiButton} 
        onPress={() => generateAiRecipeMutation.mutate()}
        disabled={generateAiRecipeMutation.isPending}
      >
        <Text style={styles.aiButtonText}>
          {generateAiRecipeMutation.isPending ? 'A criar prato com IA...' : '✨ Gerar Receita com IA (testes)'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.aiButton} 
        onPress={() => generateAiRecipeMutation.mutate()}
        disabled={generateAiRecipeMutation.isPending}
      >
        <Text style={styles.aiButtonText}>
          {generateAiRecipeMutation.isPending ? 'Criando prato com IA...' : '✨ Inventar receita com o que eu tenho!'}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={processedRecipes}
        keyExtractor={(item) => item.id}
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
              {isReady ? <Text style={styles.statusReady}>✨ Dá para fazer agora!</Text> : <Text style={styles.statusMissing}>Faltam {missCount}: {item.missingIngredients.join(', ')}</Text>}
              
              <View style={styles.cardActionsRow}>
                <TouchableOpacity style={[styles.btnOpen, { flex: 1 }]} onPress={() => setSelectedRecipe(item)}>
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
  container: { flex: 1, padding: 16, backgroundColor: '#f5f5f5', paddingTop: 30 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: 'red', fontWeight: 'bold' },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#666', marginBottom: 20, marginTop: 4 },
  empty: { textAlign: 'center', color: '#666', marginTop: 40, fontStyle: 'italic' },
  aiButton: { backgroundColor: '#7B1FA2', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 16, elevation: 2 },
  aiButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 16, borderRadius: 8, elevation: 2, borderLeftWidth: 4 },
  cardReady: { borderLeftColor: '#4CAF50' },
  cardMissing: { borderLeftColor: '#FF9800' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  recipeTitle: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  timeText: { fontSize: 14, color: '#666', fontWeight: 'bold' },
  statusReady: { color: '#4CAF50', fontWeight: 'bold', marginBottom: 12 },
  statusMissing: { color: '#FF9800', fontStyle: 'italic', marginBottom: 12 },
  cardActionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnOpen: { backgroundColor: '#e0e0e0', padding: 10, borderRadius: 6, alignItems: 'center' },
  btnOpenText: { color: '#333', fontWeight: 'bold' },
  btnCardDelete: { backgroundColor: '#FFEBEE', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  btnCardDeleteText: { color: '#D32F2F', fontWeight: 'bold', fontSize: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backButton: { paddingVertical: 8, paddingRight: 16 },
  backText: { color: '#2196F3', fontWeight: 'bold', fontSize: 16 },
  deleteHeaderButton: { backgroundColor: '#FFEBEE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  deleteHeaderText: { color: '#D32F2F', fontWeight: 'bold', fontSize: 14 },
  detailTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  infoBadge: { backgroundColor: '#E3F2FD', color: '#1976D2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 10, marginBottom: 10 },
  ingredientsBox: { backgroundColor: '#fff', padding: 16, borderRadius: 8, elevation: 1, marginBottom: 20 },
  ingredientText: { fontSize: 16, color: '#444', marginBottom: 6 },
  ingredientMissing: { color: '#F44336', textDecorationLine: 'line-through' },
  instructions: { fontSize: 16, color: '#444', lineHeight: 24, backgroundColor: '#fff', padding: 16, borderRadius: 8, elevation: 1, marginBottom: 30 },
  btnCook: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 40 },
  btnCookText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  reviewItem: { padding: 16, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between' },
  reviewItemSelected: { backgroundColor: '#FFEBEE', borderColor: '#F44336' },
  reviewItemText: { fontSize: 16, color: '#333' },
  reviewItemTextSelected: { color: '#D32F2F', fontWeight: 'bold' },
  checkIcon: { color: '#D32F2F', fontWeight: 'bold' },
  aiInput: { borderWidth: 1, borderColor: '#CE93D8', padding: 10, borderRadius: 8, backgroundColor: '#fff', marginBottom: 8, fontSize: 14 },
  btnAddToCart: { backgroundColor: '#FF9800', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  btnAddToCartText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});