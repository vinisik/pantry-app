import { supabase } from '../lib/supabase';

export const aiRecipeService = {
  async generateAndSaveRecipe(houseId: string, pantryItems: any[], userPrompt?: string) {
    // Invoca a Edge Function que comunica com o Gemini
    const { data: recipeData, error: fnError } = await supabase.functions.invoke('generate-recipe', {
      body: { 
        prompt: userPrompt || 'Surpreenda-me com um prato delicioso', 
        pantryItems 
      }
    });

    // Validação de erros de rede ou falhas internas da IA
    if (fnError || !recipeData) {
      throw new Error(`Erro ao comunicar com a IA: ${fnError?.message || 'Sem resposta do servidor'}`);
    }

    if (recipeData.error) {
      throw new Error(`Erro da IA: ${recipeData.error}`);
    }

    // Insere a estrutura principal da receita na base de dados
    const { data: newRecipe, error: recipeError } = await supabase
      .from('recipes')
      .insert([{
        title: recipeData.title,
        prep_time_minutes: recipeData.prep_time_minutes || 30,
        servings: recipeData.servings || 2,
        instructions: recipeData.instructions,
        tags: recipeData.tags || ['IA']
      }])
      .select()
      .single();

    if (recipeError) throw new Error(`Erro ao salvar receita: ${recipeError.message}`);

    // Mapeia e insere os ingredientes associados a esta nova receita
    if (recipeData.ingredients && recipeData.ingredients.length > 0) {
      const ingredientsToInsert = recipeData.ingredients.map((ing: any) => ({
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