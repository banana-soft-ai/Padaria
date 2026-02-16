import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * Mock genérico do Supabase Client para testes
 *
 * Fornece implementação fake das operações mais comuns do Supabase
 * para uso em testes unitários sem depender de banco real.
 */

export type MockSupabaseResponse<T> = {
  data: T | null
  error: any | null
}

/**
 * Cria mock do Supabase Client com respostas customizáveis
 */
export function createSupabaseMock<T = any>(
  defaultData: T | null = null,
  defaultError: any | null = null
) {
  // ✅ Criar queryBuilder com placeholder
  const queryBuilder: any = {}

  // ✅ Usar implementação que retorna queryBuilder (avaliado em runtime)
  const selectMock = jest.fn(() => queryBuilder)
  const insertMock = jest.fn(() => queryBuilder)
  const updateMock = jest.fn(() => queryBuilder)
  const deleteMock = jest.fn(() => queryBuilder)
  const eqMock = jest.fn(() => queryBuilder)
  const neqMock = jest.fn(() => queryBuilder)
  const gtMock = jest.fn(() => queryBuilder)
  const ltMock = jest.fn(() => queryBuilder)
  const gteMock = jest.fn(() => queryBuilder)
  const lteMock = jest.fn(() => queryBuilder)
  const inMock = jest.fn(() => queryBuilder)
  const isMock = jest.fn(() => queryBuilder)
  const orderMock = jest.fn(() => queryBuilder)
  const limitMock = jest.fn(() => queryBuilder)
  const singleMock = jest.fn().mockResolvedValue({ data: defaultData, error: defaultError })
  const maybeSingleMock = jest.fn().mockResolvedValue({ data: defaultData, error: defaultError })

  // ✅ Tornar queryBuilder "thenable": then(resolve, reject) deve invocar resolve para await funcionar
  const defaultResponse = { data: defaultData, error: defaultError }
  const thenMock = jest.fn().mockImplementation((onFulfilled?: (value: unknown) => void) => {
    const p = Promise.resolve(defaultResponse)
    if (typeof onFulfilled === 'function') p.then(onFulfilled)
    return p
  })

  // ✅ Preencher queryBuilder AGORA com as funções (serão retornadas quando chamadas)
  Object.assign(queryBuilder, {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
    delete: deleteMock,
    eq: eqMock,
    neq: neqMock,
    gt: gtMock,
    lt: ltMock,
    gte: gteMock,
    lte: lteMock,
    in: inMock,
    is: isMock,
    order: orderMock,
    limit: limitMock,
    single: singleMock,
    maybeSingle: maybeSingleMock,
    then: thenMock, // ✅ Permite await direto em queryBuilder
  })

  const fromMock = jest.fn(() => queryBuilder)

  const supabaseMock = {
    from: fromMock,
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      signIn: jest.fn(),
      signOut: jest.fn(),
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        download: jest.fn(),
        getPublicUrl: jest.fn(),
      })),
    },
  } as unknown as SupabaseClient<Database>

  // Helpers para configurar respostas dos mocks
  const mockHelpers = {
    /**
     * Configura resposta de sucesso para próxima query
     */
    mockSelectSuccess: (data: T | T[]) => {
      selectMock.mockResolvedValueOnce({ data, error: null })
      return mockHelpers
    },

    /**
     * Configura resposta de erro para próxima query
     */
    mockSelectError: (error: any) => {
      selectMock.mockResolvedValueOnce({ data: null, error })
      return mockHelpers
    },

    /**
     * Configura resposta de sucesso para insert
     */
    mockInsertSuccess: (data: T) => {
      insertMock.mockResolvedValueOnce({ data, error: null })
      return mockHelpers
    },

    /**
     * Configura resposta de erro para insert
     */
    mockInsertError: (error: any) => {
      insertMock.mockResolvedValueOnce({ data: null, error })
      return mockHelpers
    },

    /**
     * Configura resposta de sucesso para update
     */
    mockUpdateSuccess: (data: T) => {
      updateMock.mockResolvedValueOnce({ data, error: null })
      return mockHelpers
    },

    /**
     * Configura resposta de erro para update
     */
    mockUpdateError: (error: any) => {
      updateMock.mockResolvedValueOnce({ data: null, error })
      return mockHelpers
    },

    /**
     * Configura resposta de sucesso para delete
     */
    mockDeleteSuccess: () => {
      deleteMock.mockResolvedValueOnce({ data: null, error: null })
      return mockHelpers
    },

    /**
     * Configura resposta de erro para delete
     */
    mockDeleteError: (error: any) => {
      deleteMock.mockResolvedValueOnce({ data: null, error })
      return mockHelpers
    },

    /**
     * Reseta todos os mocks
     */
    reset: () => {
      selectMock.mockClear()
      insertMock.mockClear()
      updateMock.mockClear()
      deleteMock.mockClear()
      eqMock.mockClear()
      neqMock.mockClear()
      gtMock.mockClear()
      ltMock.mockClear()
      gteMock.mockClear()
      lteMock.mockClear()
      inMock.mockClear()
      isMock.mockClear()
      orderMock.mockClear()
      limitMock.mockClear()
      singleMock.mockClear()
      maybeSingleMock.mockClear()
      thenMock.mockClear()
      fromMock.mockClear()
      return mockHelpers
    },

    // Acesso aos mocks individuais para asserções (e queryBuilder para implementações que precisam retornar a cadeia)
    mocks: {
      from: fromMock,
      select: selectMock,
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
      eq: eqMock,
      neq: neqMock,
      gt: gtMock,
      lt: ltMock,
      gte: gteMock,
      lte: lteMock,
      in: inMock,
      is: isMock,
      order: orderMock,
      limit: limitMock,
      single: singleMock,
      maybeSingle: maybeSingleMock,
      then: thenMock,
      queryBuilder,
    },
  }

  return {
    supabase: supabaseMock,
    ...mockHelpers,
  }
}

/**
 * Helper para criar mock de erro do Supabase
 */
export function createSupabaseError(message: string, code?: string) {
  return {
    message,
    code: code || 'PGRST_ERROR',
    details: null,
    hint: null,
  }
}

/**
 * Exemplos de erros comuns do Supabase
 */
export const SUPABASE_ERRORS = {
  NOT_FOUND: createSupabaseError('Registro não encontrado', 'PGRST116'),
  DUPLICATE: createSupabaseError('Registro duplicado', '23505'),
  CONSTRAINT_VIOLATION: createSupabaseError('Violação de constraint', '23503'),
  NETWORK_ERROR: createSupabaseError('Erro de conexão', 'NETWORK_ERROR'),
  TIMEOUT: createSupabaseError('Timeout na operação', 'TIMEOUT'),
  UNAUTHORIZED: createSupabaseError('Não autorizado', '401'),
}

/**
 * Helper para uso em testes
 *
 * @example
 * ```typescript
 * const { supabase, mockSelectSuccess, mocks } = createSupabaseMock()
 *
 * // Configurar resposta
 * mockSelectSuccess([CAIXA_ABERTO_MOCK])
 *
 * // Executar código que usa supabase
 * const result = await fetchCaixasAbertos(supabase)
 *
 * // Asserções
 * expect(mocks.from).toHaveBeenCalledWith('caixa_diario')
 * expect(result).toEqual([CAIXA_ABERTO_MOCK])
 * ```
 */
export default createSupabaseMock
