import { filterMenuItems, getMenuConfig, shouldShowBlock } from '@/lib/menuConfig'

describe('lib/menuConfig (sidebar/menu)', () => {
  it('retorna blocos Colaborador e Administrador', () => {
    const blocks = getMenuConfig('funcionario', false)
    expect(blocks.map((b) => b.title)).toEqual(['Colaborador', 'Administrador'])
  })

  it('inclui links de gestão/admin/dashboard/receitas esperados', () => {
    const blocks = getMenuConfig('admin', true)
    const allItems = blocks.flatMap((b) => b.sections.flatMap((s) => s.items))
    const hrefs = allItems.map((i) => i.href)

    expect(hrefs).toContain('/receitas')
    expect(hrefs).toContain('/gestao/dashboard')
    expect(hrefs).toContain('/gestao/caixas')
    expect(hrefs).toContain('/gestao/vendas')
    expect(hrefs).toContain('/sistema/usuarios')
  })

  it('oculta itens administrativos quando adminUnlocked = false', () => {
    const blocks = getMenuConfig('funcionario', false)
    const adminBlock = blocks.find((b) => b.title === 'Administrador')
    const adminItems = adminBlock?.sections.flatMap((s) => s.items) ?? []

    const filtered = filterMenuItems(adminItems, false)

    expect(filtered).toEqual([])
  })

  it('exibe itens administrativos quando adminUnlocked = true', () => {
    const blocks = getMenuConfig('funcionario', true)
    const adminBlock = blocks.find((b) => b.title === 'Administrador')
    const adminItems = adminBlock?.sections.flatMap((s) => s.items) ?? []

    const filtered = filterMenuItems(adminItems, true)

    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.some((item) => item.href === '/gestao/dashboard')).toBe(true)
  })

  it('shouldShowBlock mantém blocos principais visíveis', () => {
    const blocks = getMenuConfig('caixa', false)

    expect(shouldShowBlock(blocks[0], 'caixa', false)).toBe(true)
    expect(shouldShowBlock(blocks[1], 'caixa', false)).toBe(true)
  })
})
