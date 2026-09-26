import { supabase } from '../lib/supabase';

export const pantryService = {
  // Busca apenas os itens que ainda estão na despensa 
  async getEstimatedPantry(houseId: string) {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('house_id', houseId)
      .neq('status', 'OUT_OF_STOCK')
      .order('product_name', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  },

  // Atualiza o status do item na despensa e registra o evento
  async updateItemStatus(itemId: string, houseId: string, userId: string, newStatus: 'AVAILABLE' | 'RUNNING_LOW' | 'OUT_OF_STOCK', productName: string, unit: string) {
    // Atualiza a tabela da despensa
    const { error: updateError } = await supabase
      .from('pantry_items')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', itemId);

    if (updateError) throw new Error('Falha ao atualizar a despensa.');

    // Registra o evento para futuro aprendizado (ML)
    await supabase.from('house_events').insert({
      house_id: houseId,
      actor_id: userId,
      event_type: `PANTRY_STATUS_${newStatus}`,
      payload: { item_id: itemId, product_name: productName, unit }
    });

    // Se acabou, joga automaticamente para a lista de compras pendente
    if (newStatus === 'OUT_OF_STOCK') {
      await supabase.from('shopping_list_items').insert({
        house_id: houseId,
        product_name: productName,
        quantity_requested: 1, // Quantidade padrão inicial que o usuário pode editar depois
        unit: unit,
        status: 'PENDING',
        created_by: userId
      });
    }
  }
};