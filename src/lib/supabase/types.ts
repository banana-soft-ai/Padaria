export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
    public: {
        Tables: {
            // Tipos inline para evitar import circular e resolver 'never'
            insumos: {
                Row: {
                    id: number
                    nome: string
                    marca?: string
                    fornecedor?: string
                    unidade: string
                    peso_pacote: number
                    preco_pacote: number
                    categoria: 'insumo' | 'varejo' | 'embalagem'
                    tipo_estoque: 'insumo' | 'varejo'
                    estoque_atual?: number | null
                    estoque_minimo?: number | null
                    preco_venda?: number
                    codigo_barras: string
                    created_at: string
                    updated_at: string
                }
                Insert: Partial<{
                    id: number
                    nome: string
                    marca?: string
                    fornecedor?: string
                    unidade: string
                    peso_pacote: number
                    preco_pacote: number
                    categoria: 'insumo' | 'varejo' | 'embalagem'
                    tipo_estoque: 'insumo' | 'varejo'
                    estoque_atual?: number | null
                    estoque_minimo?: number | null
                    preco_venda?: number
                    codigo_barras: string
                    created_at: string
                    updated_at: string
                }>
                Update: Partial<{
                    id: number
                    nome: string
                    marca?: string
                    fornecedor?: string
                    unidade: string
                    peso_pacote: number
                    preco_pacote: number
                    categoria: 'insumo' | 'varejo' | 'embalagem'
                    tipo_estoque: 'insumo' | 'varejo'
                    estoque_atual?: number | null
                    estoque_minimo?: number | null
                    preco_venda?: number
                    codigo_barras: string
                    created_at: string
                    updated_at: string
                }>
            }
            varejo: {
                Row: {
                    id: number
                    nome: string
                    categoria?: string
                    unidade?: string
                    estoque_atual?: number
                    preco_venda?: number
                    codigo_barras?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Insert: Partial<{
                    id: number
                    nome: string
                    categoria?: string
                    unidade?: string
                    estoque_atual?: number
                    preco_venda?: number
                    codigo_barras?: string | null
                    created_at?: string
                    updated_at?: string
                }>
                Update: Partial<{
                    id: number
                    nome: string
                    categoria?: string
                    unidade?: string
                    estoque_atual?: number
                    preco_venda?: number
                    codigo_barras?: string | null
                    created_at?: string
                    updated_at?: string
                }>
            }
            receitas: {
                Row: {
                    id: number
                    nome: string
                    rendimento: number
                    unidade_rendimento: string
                    categoria: 'pao' | 'doce' | 'salgado' | 'torta' | 'bolo' | 'outro'
                    preco_venda?: number
                    instrucoes?: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: any
                Update: any
            }
            composicao_receitas: {
                Row: {
                    id: number
                    receita_id: number
                    insumo_id: number
                    quantidade: number
                    categoria: 'massa' | 'cobertura' | 'embalagem'
                    created_at: string
                }
                Insert: any
                Update: any
            }
            vendas: {
                Row: {
                    id: number
                    data: string
                    hora?: string | null
                    numero_venda?: number
                    // data: string (removed duplicate)
                    // hora?: string | null (removed duplicate)
                    forma_pagamento: 'pix' | 'cartao_debito' | 'cartao_credito' | 'dinheiro' | 'caderneta' | string
                    cliente_caderneta_id?: number | null
                    valor_total: number
                    valor_pago: number
                    valor_debito: number
                    valor_troco?: number
                    desconto?: number
                    status?: 'finalizada' | 'pendente' | 'cancelada' | string
                    observacoes?: string | null
                    caixa_diario_id?: number | null
                    created_at: string
                    updated_at?: string | null
                }
                Insert: Partial<{
                    numero_venda?: number
                    data: string
                    hora?: string | null
                    forma_pagamento: 'pix' | 'cartao_debito' | 'cartao_credito' | 'dinheiro' | 'caderneta' | string
                    cliente_caderneta_id?: number | null
                    valor_total: number
                    valor_pago: number
                    valor_debito: number
                    valor_troco?: number
                    desconto?: number
                    status?: 'finalizada' | 'pendente' | 'cancelada' | string
                    observacoes?: string | null
                    caixa_diario_id?: number | null
                    created_at?: string
                    updated_at?: string | null
                }>
                Update: Partial<{
                    numero_venda?: number
                    data?: string
                    hora?: string | null
                    forma_pagamento?: 'pix' | 'cartao_debito' | 'cartao_credito' | 'dinheiro' | 'caderneta' | string
                    cliente_caderneta_id?: number | null
                    valor_total?: number
                    valor_pago?: number
                    valor_debito?: number
                    valor_troco?: number
                    desconto?: number
                    status: string
                    observacoes?: string | null
                    caixa_diario_id?: number | null
                    created_at?: string
                    updated_at?: string | null
                }>
            }
            venda_itens: {
                Row: {
                    id: number
                    venda_id: number
                    tipo: 'receita' | 'varejo' | string
                    item_id?: number
                    varejo_id?: number
                    quantidade: number
                    preco_unitario: number
                    subtotal?: number
                    preco_total?: number
                    created_at: string
                }
                Insert: Partial<{
                    venda_id: number
                    tipo: 'receita' | 'varejo' | string
                    item_id?: number
                    varejo_id?: number
                    quantidade: number
                    preco_unitario: number
                    subtotal?: number
                    preco_total?: number
                    created_at?: string
                }>
                Update: Partial<{
                    venda_id?: number
                    tipo?: 'receita' | 'varejo' | string
                    item_id?: number
                    varejo_id?: number
                    quantidade?: number
                    preco_unitario?: number
                    subtotal?: number
                    preco_total?: number
                    created_at?: string
                }>
            }
            movimentacoes_caderneta: {
                Row: {
                    status: string
                    cliente_id: number
                    tipo: 'compra' | 'pagamento' | string
                    valor: number
                    saldo_anterior: number
                    saldo_atual: number
                    venda_id?: number | null
                    observacoes?: string | null
                    created_at: string
                }
                Insert: Partial<{
                    cliente_id: number
                    tipo: 'compra' | 'pagamento' | string
                    valor: number
                    saldo_anterior: number
                    saldo_atual: number
                    venda_id?: number | null
                    observacoes?: string | null
                    created_at?: string
                }>
                Update: Partial<{
                    cliente_id?: number
                    tipo?: 'compra' | 'pagamento' | string
                    valor?: number
                    saldo_anterior?: number
                    saldo_atual?: number
                    venda_id?: number | null
                    observacoes?: string | null
                    created_at?: string
                }>
            }
            caixa_movimentacoes: {
                Row: {
                    id: number
                    caixa_diario_id: number
                    tipo: 'entrada' | 'saida' | string
                    valor: number
                    motivo?: string | null
                    observacoes?: string | null
                    created_at: string
                }
                Insert: Partial<{
                    caixa_diario_id: number
                    tipo: 'entrada' | 'saida' | string
                    valor: number
                    motivo?: string | null
                    observacoes?: string | null
                    created_at?: string
                }>
                Update: Partial<{
                    caixa_diario_id?: number
                    tipo?: 'entrada' | 'saida' | string
                    valor?: number
                    motivo?: string | null
                    observacoes?: string | null
                    created_at?: string
                }>
            }
            precos_venda: {
                Row: {
                    id: number
                    item_id: number
                    tipo: 'receita' | 'varejo'
                    preco_venda: number
                    margem_lucro?: number | null
                    ativo: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: any
                Update: any
            }
            fluxo_caixa: {
                Row: {
                    id: number
                    data: string
                    tipo: 'entrada' | 'saida'
                    categoria: string
                    descricao: string
                    valor: number
                    observacoes?: string | null
                    usuario?: string | null
                    created_at: string
                }
                Insert: any
                Update: any
            }
            caixa_diario: {
                Row: {
                    id: number
                    data: string
                    status: string
                    valor_abertura: number
                    valor_fechamento?: number | null
                    total_vendas?: number | null
                    total_entradas?: number | null
                    valor_saidas?: number | null
                    total_saidas?: number | null
                    total_pix?: number | null
                    total_debito?: number | null
                    total_credito?: number | null
                    total_dinheiro?: number | null
                    total_caderneta?: number | null
                    diferenca?: number | null
                    observacoes_abertura?: string | null
                    observacoes_fechamento?: string | null
                    usuario_abertura?: string | null
                    usuario_fechamento?: string | null
                    data_abertura: string
                    data_fechamento?: string | null
                    valor_dinheiro_informado?: number | null
                    valor_pix_informado?: number | null
                    valor_debito_informado?: number | null
                    valor_credito_informado?: number | null
                    diferenca_dinheiro?: number | null
                    diferenca_pix?: number | null
                    diferenca_debito?: number | null
                    diferenca_credito?: number | null
                }
                Insert: Partial<{
                    id: number
                    data: string
                    status: string
                    valor_abertura: number
                    valor_fechamento?: number | null
                    total_vendas?: number | null
                    total_entradas?: number | null
                    valor_saidas?: number | null
                    total_saidas?: number | null
                    total_pix?: number | null
                    total_debito?: number | null
                    total_credito?: number | null
                    total_dinheiro?: number | null
                    total_caderneta?: number | null
                    diferenca?: number | null
                    observacoes_abertura?: string | null
                    observacoes_fechamento?: string | null
                    usuario_abertura?: string | null
                    usuario_fechamento?: string | null
                    data_abertura: string
                    data_fechamento?: string | null
                    valor_dinheiro_informado?: number | null
                    valor_pix_informado?: number | null
                    valor_debito_informado?: number | null
                    valor_credito_informado?: number | null
                    diferenca_dinheiro?: number | null
                    diferenca_pix?: number | null
                    diferenca_debito?: number | null
                    diferenca_credito?: number | null
                }>
                Update: Partial<{
                    id: number
                    data: string
                    status: string
                    valor_abertura: number
                    valor_fechamento?: number | null
                    total_vendas?: number | null
                    total_entradas?: number | null
                    valor_saidas?: number | null
                    total_saidas?: number | null
                    total_pix?: number | null
                    total_debito?: number | null
                    total_credito?: number | null
                    total_dinheiro?: number | null
                    total_caderneta?: number | null
                    diferenca?: number | null
                    observacoes_abertura?: string | null
                    observacoes_fechamento?: string | null
                    usuario_abertura?: string | null
                    usuario_fechamento?: string | null
                    data_abertura: string
                    data_fechamento?: string | null
                    valor_dinheiro_informado?: number | null
                    valor_pix_informado?: number | null
                    valor_debito_informado?: number | null
                    valor_credito_informado?: number | null
                    diferenca_dinheiro?: number | null
                    diferenca_pix?: number | null
                    diferenca_debito?: number | null
                    diferenca_credito?: number | null
                }>
            }
            [key: string]: {
                Row: any
                Insert: any
                Update: any
            }
        }
        Views: Record<string, unknown>
        Functions: Record<string, unknown>
        Enums: Record<string, string>
    }
}

// Não exportar `default` para evitar conflitos de resolução de tipos
