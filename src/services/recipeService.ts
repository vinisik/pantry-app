import { supabase } from '../lib/supabase';

export const recipeService = {
  async getCatalog() {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        recipe_ingredients (*)
      `)
      .order('title', { ascending: true });

    if (error) throw new Error(`Erro ao buscar receitas: ${error.message}`);
    return data;
  },

  // Registra que a casa preparou esta receita 
  async registerPrep(houseId: string, userId: string, recipeName: string) {
    const { error } = await supabase.from('house_events').insert({
      house_id: houseId,
      actor_id: userId,
      event_type: 'RECIPE_PREPARED',
      payload: { recipe_name: recipeName }
    });

    if (error) throw new Error(`Erro ao registrar preparo: ${error.message}`);
  },

  // Exclui uma receita do catálogo
  async deleteRecipe(recipeId: string) {
    const { error: ingError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId);

    if (ingError) {
      console.error('Erro ao apagar ingredientes:', ingError);
      throw new Error(`Erro ao apagar ingredientes: ${ingError.message}`);
    }

    const { error: recipeError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (recipeError) {
      console.error('Erro ao apagar receita:', recipeError);
      throw new Error(`Erro ao apagar receita: ${recipeError.message}`);
    }
  },
};