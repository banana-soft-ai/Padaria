/**
 * Formata CPF para exibição (000.000.000-00).
 * Aceita só dígitos ou string já formatada; formata parcialmente se menos de 11 dígitos.
 */
export function formatCpfDisplay(cpf: string): string {
    const digits = (cpf || '').replace(/\D/g, '').slice(0, 11)
    if (digits.length === 0) return ''
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}
