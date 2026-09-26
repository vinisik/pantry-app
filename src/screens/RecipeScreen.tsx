import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recipeService } from '../services/recipeService';
import { pantryService } from '../services/pantryService';
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

  // 1. Busca receitas
  const { data: recipes, isLoading: loadingRecipes, isError: isErrorRecipes, error: errorRecipes } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => recipeService.getCatalog(),
  });

  // 2. Busca despensa
  const { data: pantry, isLoading: loadingPantry } = useQuery({
    queryKey: ['pantry', houseId],
    queryFn: () => pantryService.getEstimatedPantry(houseId),
  });

  // 3. Busca o perfil da casa (Restrições e Preferências)
  const { data: preferences, isLoading: loadingPrefs } = useQuery({
    queryKey: ['housePreferences', houseId],
    queryFn: () => houseService.getHousePreferences(houseId),
  });

  const prepMutation = useMutation({
    mutationFn: (recipeName: string) => recipeService.registerPrep(houseId, userId, recipeName),
    onSuccess: (_, recipeName) => {
      setReviewingRecipe(selectedRecipe);
      setSelectedRecipe(null);
      setExhaustedItems([]);
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

  if (loadingRecipes || loadingPantry || loadingPrefs) return <View style={styles.centered}><Text>Consultando cadernos e regras...</Text></View>;
  if (isErrorRecipes) return <View style={styles.centered}><Text style={styles.errorText}>Erro: {errorRecipes?.message}</Text></View>;

  // INTELIGÊNCIA DOS FILTROS
  const restrictions = preferences?.filter(p => p.type === 'RESTRICTION').map(p => p.value.toLowerCase().trim()) || [];
  const likes = preferences?.filter(p => p.type === 'PREFERENCE').map(p => p.value.toLowerCase().trim()) || [];

  const processedRecipes = recipes?.map((recipe: any) => {
    const missingIngredients: string[] = [];
    if (recipe.recipe_ingredients) {
      recipe.recipe_ingredients.forEach((ing: any) => {
        const hasItem = pantry?.some(p => p.product_name.toLowerCase() === ing.product_name.toLowerCase());
        if (!hasItem) missingIngredients.push(ing.product_name);
      });
    }

    const recipeTags = recipe.tags?.map((t: string) => t.toLowerCase()) || [];
    
    // Calcula a pontuação de preferências
    const prefScore = likes.reduce((score, like) => score + (recipeTags.includes(like) ? 1 : 0), 0);

    // Verifica se a receita viola alguma restrição 
    const isSafe = restrictions.every(restriction => recipeTags.includes(restriction));

    return { ...recipe, missingIngredients, prefScore, isSafe, recipeTags };
  });

  // Filtra as receitas inseguras e ordena as que sobraram
  let filteredRecipes = processedRecipes?.filter(r => r.isSafe) || [];

  filteredRecipes.sort((a, b) => {
    // Quem tem menos ingredientes faltando
    if (a.missingIngredients.length !== b.missingIngredients.length) {
      return a.missingIngredients.length - b.missingIngredients.length;
    }
    // Quem atende mais preferências da casa
    return b.prefScore - a.prefScore; 
  });

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

  if (selectedRecipe) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setSelectedRecipe(null)} style={styles.backButton}><Text style={styles.backText}>{"< Voltar"}</Text></TouchableOpacity>
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
          <Text style={styles.sectionTitle}>Preparo</Text>
          <Text style={styles.instructions}>{selectedRecipe.instructions}</Text>
          <TouchableOpacity style={styles.btnCook} onPress={() => prepMutation.mutate(selectedRecipe.title)} disabled={prepMutation.isPending}>
            <Text style={styles.btnCookText}>Cozinhei isso!</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>O que vamos comer?</Text>
      <Text style={styles.subtitle}>Receitas baseadas no que você tem em casa.</Text>
      
      <FlatList
        data={filteredRecipes}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 40, padding: 20 }}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🕵️</Text>
            <Text style={[styles.empty, { marginTop: 0 }]}>
              Nenhuma receita encontrada. Verifique se as restrições da sua Residência não são severas demais.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const missCount = item.missingIngredients.length;
          const isReady = missCount === 0;
          return (
            <View style={[styles.card, isReady ? styles.cardReady : styles.cardMissing]}>
              <View style={styles.cardHeader}>
                <Text style={styles.recipeTitle}>{item.title}</Text>
                <Text style={styles.timeText}>⏱ {item.prep_time_minutes} min</Text>
              </View>
              
              {/* Mostra as Tags se houver e se alguma delas combinar com preferência */}
              {item.tags && item.tags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {item.tags.map((tag: string, idx: number) => {
                    const isPreferred = likes.includes(tag.toLowerCase());
                    return (
                      <View key={idx} style={[styles.tagBadge, isPreferred && styles.tagBadgePreferred]}>
                        <Text style={[styles.tagText, isPreferred && styles.tagTextPreferred]}>
                          {isPreferred ? '⭐ ' : ''}{tag}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {isReady ? <Text style={styles.statusReady}>✨ Dá para fazer agora!</Text> : <Text style={styles.statusMissing}>Faltam {missCount}: {item.missingIngredients.join(', ')}</Text>}
              <TouchableOpacity style={styles.btnOpen} onPress={() => setSelectedRecipe(item)}><Text style={styles.btnOpenText}>Ver Receita</Text></TouchableOpacity>
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
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 16, borderRadius: 8, elevation: 2, borderLeftWidth: 4 },
  cardReady: { borderLeftColor: '#4CAF50' },
  cardMissing: { borderLeftColor: '#FF9800' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  recipeTitle: { fontSize: 18, fontWeight: 'bold', flex: 1 },
  timeText: { fontSize: 14, color: '#666', fontWeight: 'bold' },
  statusReady: { color: '#4CAF50', fontWeight: 'bold', marginBottom: 12 },
  statusMissing: { color: '#FF9800', fontStyle: 'italic', marginBottom: 12 },
  btnOpen: { backgroundColor: '#e0e0e0', padding: 10, borderRadius: 6, alignItems: 'center' },
  btnOpenText: { color: '#333', fontWeight: 'bold' },
  headerRow: { flexDirection: 'row', marginBottom: 16 },
  backButton: { paddingVertical: 8, paddingRight: 16 },
  backText: { color: '#2196F3', fontWeight: 'bold', fontSize: 16 },
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
  
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tagBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tagText: { fontSize: 11, color: '#666' },
  tagBadgePreferred: { backgroundColor: '#FFF9C4', borderWidth: 1, borderColor: '#FBC02D' },
  tagTextPreferred: { color: '#F57F17', fontWeight: 'bold' }
});