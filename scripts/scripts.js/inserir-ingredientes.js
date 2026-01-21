/**
 * Script seguro para inserir ou atualizar ingredientes das receitas
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const { serverEnv } = require('../../src/env/server-env.cjs')

const supabaseUrl = serverEnv.SUPABASE_URL
const supabaseServiceKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function inserirOuAtualizarIngredientes() {
  try {
    console.log('🥄 Inserindo ou atualizando ingredientes das receitas...\n')

    // Buscar IDs das receitas e insumos
    const { data: receitas } = await supabase.from('receitas').select('id, nome')
    const { data: insumos } = await supabase.from('insumos').select('id, nome')

    if (!receitas || !insumos) {
      console.error('❌ Erro ao buscar receitas ou insumos')
      return
    }

    const receitasMap = {}
    receitas.forEach(r => { receitasMap[r.nome] = r.id })

    const insumosMap = {}
    insumos.forEach(i => { insumosMap[i.nome] = i.id })

    // Ingredientes definidos para cada receita
    const ingredientesReceitas = {
      'Pão Francês': [
        { insumo: 'Farinha de Trigo', quantidade: 1000.0, unidade: 'g' },
        { insumo: 'Açúcar', quantidade: 50.0, unidade: 'g' },
        { insumo: 'Sal', quantidade: 10.0, unidade: 'g' },
        { insumo: 'Fermento Biológico', quantidade: 20.0, unidade: 'g' },
        { insumo: 'Manteiga', quantidade: 50.0, unidade: 'g' },
        { insumo: 'Leite', quantidade: 500.0, unidade: 'ml' },
        { insumo: 'Ovos', quantidade: 2.0, unidade: 'unidade' }
      ],
      'Pão de Açúcar': [
        { insumo: 'Farinha de Trigo', quantidade: 1000.0, unidade: 'g' },
        { insumo: 'Açúcar', quantidade: 100.0, unidade: 'g' },
        { insumo: 'Sal', quantidade: 10.0, unidade: 'g' },
        { insumo: 'Fermento Biológico', quantidade: 20.0, unidade: 'g' },
        { insumo: 'Manteiga', quantidade: 80.0, unidade: 'g' },
        { insumo: 'Leite', quantidade: 400.0, unidade: 'ml' },
        { insumo: 'Ovos', quantidade: 2.0, unidade: 'unidade' }
      ],
      'Croissant': [
        { insumo: 'Farinha de Trigo', quantidade: 1000.0, unidade: 'g' },
        { insumo: 'Açúcar', quantidade: 30.0, unidade: 'g' },
        { insumo: 'Sal', quantidade: 15.0, unidade: 'g' },
        { insumo: 'Fermento Biológico', quantidade: 25.0, unidade: 'g' },
        { insumo: 'Manteiga', quantidade: 300.0, unidade: 'g' },
        { insumo: 'Leite', quantidade: 300.0, unidade: 'ml' },
        { insumo: 'Ovos', quantidade: 3.0, unidade: 'unidade' }
      ],
      'Bolo de Chocolate': [
        { insumo: 'Farinha de Trigo', quantidade: 300.0, unidade: 'g' },
        { insumo: 'Açúcar', quantidade: 200.0, unidade: 'g' },
        { insumo: 'Sal', quantidade: 5.0, unidade: 'g' },
        { insumo: 'Manteiga', quantidade: 100.0, unidade: 'g' },
        { insumo: 'Leite', quantidade: 200.0, unidade: 'ml' },
        { insumo: 'Ovos', quantidade: 4.0, unidade: 'unidade' }
      ]
    }

    let totalInseridos = 0

    for (const [nomeReceita, ingredientes] of Object.entries(ingredientesReceitas)) {
      const receitaId = receitasMap[nomeReceita]
      if (!receitaId) {
        console.log(`❌ Receita "${nomeReceita}" não encontrada`)
        continue
      }

      console.log(`\n👨‍🍳 Processando ingredientes para: ${nomeReceita}`)

      for (const ingrediente of ingredientes) {
        const insumoId = insumosMap[ingrediente.insumo]
        if (!insumoId) {
          console.log(`❌ Insumo "${ingrediente.insumo}" não encontrado`)
          continue
        }

        const { error } = await supabase
          .from('receita_ingredientes')
          .upsert(
            {
              receita_id: receitaId,
              insumo_id: insumoId,
              quantidade: ingrediente.quantidade,
              unidade: ingrediente.unidade
            },
            { onConflict: ['receita_id', 'insumo_id'] }
          )

        if (error) {
          console.log(`⚠️ Erro ao inserir/atualizar ${ingrediente.insumo}: ${error.message}`)
        } else {
          console.log(`✅ ${ingrediente.insumo}: ${ingrediente.quantidade} ${ingrediente.unidade} inserido/atualizado`)
          totalInseridos++
        }
      }
    }

    console.log(`\n📊 Total de ingredientes inseridos/atualizados: ${totalInseridos}`)
    console.log('\n🎉 Ingredientes processados com sucesso!')

  } catch (err) {
    console.error('❌ Erro ao processar ingredientes:', err.message)
  }
}

inserirOuAtualizarIngredientes()
