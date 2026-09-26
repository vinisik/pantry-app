import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { recipeService } from '../services/recipeService';
import { pantryService } from '../services/pantryService';

interface RecipesScreenProps {
  houseId: string;
  session: any; 
}

export default function RecipesScreen({ houseId, session }: RecipesScreenProps) {
  const userId = session.user.id;
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);

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
      Alert.alert(
        'Bom apetite!', 
        'Preparo registrado com sucesso.\n\nAlgum ingrediente da sua despensa acabou durante o preparo?',
        [
          { text: 'Não, sobrou', onPress: () => setSelectedRecipe(null), style: 'cancel' },
          { text: 'Sim, vou atualizar', onPress: () => setSelectedRecipe(null) } // O usuário navega para "Em Casa" manualmente depois
        ]
      );
    },
    onError: (error: any) => Alert.alert('Erro', error.message)
  });

  if (loadingRecipes || loadingPantry) {
    return <View style={styles.centered}><Text>Consultando os cadernos de receitas...</Text></View>;
  }

  if (isErrorRecipes) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Erro ao carregar receitas:</Text>
        <Text>{errorRecipes?.message}</Text>
      </View>
    );
  }

  const recipesWithMatch = recipes?.map((recipe: any) => {
    const missingIngredients: string[] = [];
    if (recipe.recipe_ingredients && recipe.recipe_ingredients.length > 0) {
      recipe.recipe_ingredients.forEach((ing: any) => {
        const hasItem = pantry?.some(p => p.product_name.toLowerCase() === ing.product_name.toLowerCase());
        if (!hasItem) missingIngredients.push(ing.product_name);
      });
    }
    return { ...recipe, missingIngredients };
  });

  recipesWithMatch?.sort((a, b) => a.missingIngredients.length - b.missingIngredients.length);

  // TELA DE DETALHES DA RECEITA
  if (selectedRecipe) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setSelectedRecipe(null)} style={styles.backButton}>
            <Text style={styles.backText}>{"< Voltar"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.detailTitle}>{selectedRecipe.title}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoBadge}>⏱ {selectedRecipe.prep_time_minutes} min</Text>
            <Text style={styles.infoBadge}>🍽 {selectedRecipe.servings} porção(ões)</Text>
          </View>

          <Text style={styles.sectionTitle}>Ingredientes</Text>
          <View style={styles.ingredientsBox}>
            {selectedRecipe.recipe_ingredients.map((ing: any) => {
              const isMissing = selectedRecipe.missingIngredients.includes(ing.product_name);
              return (
                <Text key={ing.id} style={[styles.ingredientText, isMissing && styles.ingredientMissing]}>
                  • {ing.quantity} {ing.unit} de {ing.product_name} {isMissing ? '(Falta)' : ''}
                </Text>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>Modo de Preparo</Text>
          <Text style={styles.instructions}>{selectedRecipe.instructions}</Text>

          <TouchableOpacity 
            style={styles.btnCook} 
            onPress={() => prepMutation.mutate(selectedRecipe.title)}
            disabled={prepMutation.isPending}
          >
            <Text style={styles.btnCookText}>Cozinhei isso!</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // TELA DE LISTA DE RECEITAS
  return (
    <View style={styles.container}>
      <Text style={styles.title}>O que vamos comer?</Text>
      <Text style={styles.subtitle}>Receitas baseadas no que você tem em casa.</Text>

      <FlatList
        data={recipesWithMatch}
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

              {isReady ? (
                <Text style={styles.statusReady}>✨ Dá para fazer agora!</Text>
              ) : (
                <Text style={styles.statusMissing}>
                  Faltam {missCount} ingredientes: {item.missingIngredients.join(', ')}
                </Text>
              )}

              <TouchableOpacity style={styles.btnOpen} onPress={() => setSelectedRecipe(item)}>
                <Text style={styles.btnOpenText}>Ver Receita</Text>
              </TouchableOpacity>
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
  errorText: { color: 'red', fontWeight: 'bold', fontSize: 16, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#666', marginBottom: 20, marginTop: 4 },
  empty: { textAlign: 'center', color: '#666', marginTop: 40, fontSize: 16, fontStyle: 'italic' },
  
  card: { backgroundColor: '#fff', padding: 16, marginBottom: 16, borderRadius: 8, elevation: 2, borderLeftWidth: 4 },
  cardReady: { borderLeftColor: '#4CAF50' },
  cardMissing: { borderLeftColor: '#FF9800' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recipeTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1, paddingRight: 10 },
  timeText: { fontSize: 14, color: '#666', fontWeight: 'bold' },
  statusReady: { color: '#4CAF50', fontWeight: 'bold', marginBottom: 12 },
  statusMissing: { color: '#FF9800', fontStyle: 'italic', marginBottom: 12 },
  btnOpen: { backgroundColor: '#e0e0e0', padding: 10, borderRadius: 6, alignItems: 'center' },
  btnOpenText: { color: '#333', fontWeight: 'bold' },

  // Estilos da Tela de Detalhes
  headerRow: { flexDirection: 'row', marginBottom: 16 },
  backButton: { paddingVertical: 8, paddingRight: 16 },
  backText: { color: '#2196F3', fontWeight: 'bold', fontSize: 16 },
  detailTitle: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  infoBadge: { backgroundColor: '#E3F2FD', color: '#1976D2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 10, marginBottom: 10 },
  ingredientsBox: { backgroundColor: '#fff', padding: 16, borderRadius: 8, elevation: 1, marginBottom: 20 },
  ingredientText: { fontSize: 16, color: '#444', marginBottom: 6 },
  ingredientMissing: { color: '#F44336', textDecorationLine: 'line-through' },
  instructions: { fontSize: 16, color: '#444', lineHeight: 24, backgroundColor: '#fff', padding: 16, borderRadius: 8, elevation: 1, marginBottom: 30 },
  btnCook: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 40 },
  btnCookText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});