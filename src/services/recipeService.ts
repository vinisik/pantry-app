import { supabase } from '../lib/supabase';

export const recipeService = {
  // Procura APENAS as receitas salvas/guardadas pela casa
  async getSavedRecipes(houseId: string) {
    const { data, error } = await supabase
      .from('house_recipes')
      .select(`
        recipe_id,
        recipes (
          *,
          recipe_ingredients (*)
        )
      `)
      .eq('house_id', houseId);

    if (error) throw new Error(`Erro ao buscar receitas salvas: ${error.message}`);
    return data ? data.map(item => item.recipes).filter(Boolean) : [];
  },

  // Procura no catálogo geral por palavra-chave ou devolve tudo
  async searchCatalog(searchTerm: string) {
    if (!searchTerm || searchTerm.trim() === '') {
      const { data, error } = await supabase
        .from('recipes')
        .select(`*, recipe_ingredients (*)`)
        .order('title', { ascending: true });

      if (error) throw new Error(`Erro ao buscar receitas: ${error.message}`);
      return data || [];
    }

    const query = searchTerm.trim().toLowerCase();
    const { data, error } = await supabase
      .from('recipes')
      .select(`*, recipe_ingredients (*)`)
      .ilike('title', `%${query}%`)
      .order('title', { ascending: true });

    if (error) throw new Error(`Erro ao pesquisar receitas: ${error.message}`);
    return data || [];
  },

  // Recomenda a melhor receita do catálogo com base na cobertura de ingredientes da despensa
  async getPantryRecommendation(pantryItems: any[]) {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select(`*, recipe_ingredients (*)`);

    if (error) throw new Error(`Erro ao buscar recomendação da despensa: ${error.message}`);
    if (!recipes || recipes.length === 0) return null;

    const availableProducts = new Set(
      (pantryItems || []).map(p => p.product_name.toLowerCase().trim())
    );

    const scoredRecipes = recipes.map(recipe => {
      const totalIngredients = recipe.recipe_ingredients?.length || 0;
      if (totalIngredients === 0) return { ...recipe, matchPercentage: 0, missingIngredients: [] };

      const missingIngredients: string[] = [];
      let availableCount = 0;

      recipe.recipe_ingredients.forEach((ing: any) => {
        const ingName = ing.product_name.toLowerCase().trim();
        if (availableProducts.has(ingName)) {
          availableCount++;
        } else {
          missingIngredients.push(ing.product_name);
        }
      });

      const matchPercentage = Math.round((availableCount / totalIngredients) * 100);
      return { ...recipe, matchPercentage, missingIngredients };
    });

    // Ordena do maior match para o menor
    scoredRecipes.sort((a, b) => b.matchPercentage - a.matchPercentage);
    return scoredRecipes[0] || null;
  },

  // Recomenda uma receita aleatória do catálogo global
  async getRandomRecommendation() {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select(`*, recipe_ingredients (*)`);

    if (error) throw new Error(`Erro ao buscar receita aleatória: ${error.message}`);
    if (!recipes || recipes.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * recipes.length);
    return recipes[randomIndex];
  },

  // Guarda uma receita do catálogo na lista da casa
  async saveRecipeToHouse(houseId: string, recipeId: string) {
    const { error } = await supabase
      .from('house_recipes')
      .insert({ house_id: houseId, recipe_id: recipeId });

    if (error) throw new Error(`Erro ao salvar receita: ${error.message}`);
  },

  // Remove uma receita da lista de salvas da casa
  async removeRecipeFromHouse(houseId: string, recipeId: string) {
    const { error } = await supabase
      .from('house_recipes')
      .delete()
      .eq('house_id', houseId)
      .eq('recipe_id', recipeId);

    if (error) throw new Error(`Erro ao remover receita: ${error.message}`);
  },

  // Regista a preparação de uma receita
  async registerPrep(houseId: string, userId: string, recipeName: string) {
    const { error } = await supabase.from('house_events').insert({
      house_id: houseId,
      actor_id: userId,
      event_type: 'RECIPE_PREPARED',
      payload: { recipe_name: recipeName }
    });

    if (error) throw new Error(`Erro ao registar preparo: ${error.message}`);
  },

  // Elimina a receita do catálogo global
  async deleteRecipe(recipeId: string) {
    const { error: ingError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);

    if (ingError) throw new Error(`Erro ao apagar ingredientes: ${ingError.message}`);

    const { error: recipeError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (recipeError) throw new Error(`Erro ao apagar receita: ${recipeError.message}`);
  }
};