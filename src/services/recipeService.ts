import { supabase } from '../lib/supabase';

export const recipeService = {
  // Procura as receitas salvas/recomendadas da casa
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
    
    // Mapeia o resultado para retornar a estrutura da receita diretamente
    return data ? data.map(item => item.recipes) : [];
  },

  // Procura no catálogo completo por receitas que correspondam ao termo de pesquisa
  async searchCatalog(searchTerm: string) {
    if (!searchTerm || searchTerm.trim() === '') {
      const { data, error } = await supabase
        .from('recipes')
        .select(`*, recipe_ingredients (*)`)
        .order('title', { ascending: true });

      if (error) throw new Error(`Erro ao buscar receitas: ${error.message}`);
      return data;
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

  // Salva uma receita do catálogo na lista da casa
  async saveRecipeToHouse(houseId: string, recipeId: string) {
    const { error } = await supabase
      .from('house_recipes')
      .insert({ house_id: houseId, recipe_id: recipeId });

    if (error) throw new Error(`Erro ao salvar receita: ${error.message}`);
  },

  // Remove uma receita da lista da casa
  async removeRecipeFromHouse(houseId: string, recipeId: string) {
    const { error } = await supabase
      .from('house_recipes')
      .delete()
      .eq('house_id', houseId)
      .eq('recipe_id', recipeId);

    if (error) throw new Error(`Erro ao remover receita: ${error.message}`);
  },

  async registerPrep(houseId: string, userId: string, recipeName: string) {
    const { error } = await supabase.from('house_events').insert({
      house_id: houseId,
      actor_id: userId,
      event_type: 'RECIPE_PREPARED',
      payload: { recipe_name: recipeName }
    });

    if (error) throw new Error(`Erro ao registar preparo: ${error.message}`);
  }
};