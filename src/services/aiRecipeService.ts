import { supabase } from '../lib/supabase';

export const aiRecipeService = {
  async generateAndSaveRecipe(houseId: string, pantryItems: any[], userPrompt?: string) {
    const { data: recipeJson, error: fnError } = await supabase.functions.invoke('generate-recipe', {
      body: { 
        prompt: userPrompt || 'Surpreenda-me com um prato delicioso', 
        pantryItems 
      }
    });

    if (fnError || !recipeJson) {
      throw new Error(`Erro ao comunicar com a IA: ${fnError?.message || 'Sem resposta do servidor'}`);
    }

    if (recipeJson.error) {
      throw new Error(`Erro da IA: ${recipeJson.error}`);
    }

    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert([{
        title: recipeJson.title,
        prep_time_minutes: recipeJson.prep_time_minutes || 30,
        servings: recipeJson.servings || 2,
        instructions: recipeJson.instructions,
        tags: recipeJson.tags || ['IA', 'Real']
      }])
      .select()
      .single();

    if (recipeError) throw new Error(`Erro ao salvar receita: ${recipeError.message}`);

    if (recipeJson.ingredients && recipeJson.ingredients.length > 0) {
      const ingredientsToInsert = recipeJson.ingredients.map((ing: any) => ({
        recipe_id: newRecipe.id,
        product_name: ing.product_name,
        quantity: ing.quantity || 1,
        unit: ing.unit || 'un'
      }));

      const { error: ingError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientsToInsert);

      if (ingError) throw new Error(`Erro ao salvar ingredientes: ${ingError.message}`);
    }

    return newRecipe;
  }
};