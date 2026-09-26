import { supabase } from '../lib/supabase';

export const pantryService = {
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

  async updateItemStatus(itemId: string, houseId: string, userId: string, newStatus: 'AVAILABLE' | 'RUNNING_LOW' | 'OUT_OF_STOCK', productName: string, unit: string) {
    let targetId = itemId;

    if (!targetId || targetId === 'new') {
      const { data: existing } = await supabase
        .from('pantry_items')
        .select('id')
        .eq('house_id', houseId)
        .ilike('product_name', productName.trim())
        .maybeSingle();

      if (existing) {
        targetId = existing.id;
      } else {
        // Insere apenas as colunas válidas da tabela pantry_items
        const { data: inserted, error: insertError } = await supabase
          .from('pantry_items')
          .insert({
            house_id: houseId,
            product_name: productName.trim(),
            unit: unit || 'un',
            status: newStatus
          })
          .select('id')
          .single();

        if (insertError) {
          throw new Error(`Falha ao adicionar à despensa: ${insertError.message}`);
        }
        targetId = inserted.id;
      }
    }

    const { error: updateError } = await supabase
      .from('pantry_items')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', targetId);

    if (updateError) throw new Error('Falha ao atualizar a despensa.');

    // Regista o evento na casa 
    try {
      await supabase.from('house_events').insert({
        house_id: houseId,
        actor_id: userId,
        event_type: `PANTRY_STATUS_${newStatus}`,
        payload: { item_id: targetId, product_name: productName, unit }
      });
    } catch {
    }
  },

  // Verifica se algum produto passou de 80% do tempo de vida útil
  async checkAndAutoUpdateLowStock(houseId: string, userId: string) {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('house_id', houseId)
      .eq('status', 'AVAILABLE')
      .not('expected_duration_days', 'is', null);

    if (error || !data) return 0;

    const now = new Date().getTime();
    let updatedCount = 0;

    for (const item of data) {
      const updatedAt = new Date(item.updated_at).getTime();
      const daysPassed = (now - updatedAt) / (1000 * 60 * 60 * 24);
      const threshold = item.expected_duration_days * 0.8;

      if (daysPassed >= threshold) {
        await this.updateItemStatus(
          item.id, 
          houseId, 
          userId, 
          'RUNNING_LOW', 
          item.product_name, 
          item.unit
        );
        updatedCount++;
      }
    }

    return updatedCount;
  },

  async deleteItem(itemId: string) {
    const { error } = await supabase
      .from('pantry_items')
      .delete()
      .eq('id', itemId);

    if (error) throw new Error(`Erro ao remover da despensa: ${error.message}`);
  },
};