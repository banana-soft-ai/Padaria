import { useState, useCallback, useMemo } from 'react'

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  min?: number
  max?: number
  custom?: (value: any) => string | null
}

export interface ValidationRules {
  [key: string]: ValidationRule
}

export interface FormErrors {
  [key: string]: string | null
}

export interface UseFormValidationReturn {
  errors: FormErrors
  isValid: boolean
  validate: (values: Record<string, any>) => FormErrors
  validateField: (name: string, value: any) => string | null
  clearErrors: () => void
  setError: (name: string, error: string | null) => void
}

/**
 * Hook para validação de formulários
 */
export function useFormValidation(
  rules: ValidationRules,
  initialValues: Record<string, any> = {}
): UseFormValidationReturn {
  const [errors, setErrors] = useState<FormErrors>({})

  const validateField = useCallback((name: string, value: any): string | null => {
    const rule = rules[name]
    if (!rule) return null

    // Required validation
    if (rule.required && (!value || value.toString().trim() === '')) {
      return 'Este campo é obrigatório'
    }

    // Skip other validations if value is empty and not required
    if (!value || value.toString().trim() === '') {
      return null
    }

    // Min length validation
    if (rule.minLength && value.toString().length < rule.minLength) {
      return `Deve ter pelo menos ${rule.minLength} caracteres`
    }

    // Max length validation
    if (rule.maxLength && value.toString().length > rule.maxLength) {
      return `Deve ter no máximo ${rule.maxLength} caracteres`
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(value.toString())) {
      return 'Formato inválido'
    }

    // Min value validation
    if (rule.min !== undefined && Number(value) < rule.min) {
      return `Valor mínimo é ${rule.min}`
    }

    // Max value validation
    if (rule.max !== undefined && Number(value) > rule.max) {
      return `Valor máximo é ${rule.max}`
    }

    // Custom validation
    if (rule.custom) {
      return rule.custom(value)
    }

    return null
  }, [rules])

  const validate = useCallback((values: Record<string, any>): FormErrors => {
    const newErrors: FormErrors = {}

    Object.keys(rules).forEach(name => {
      const error = validateField(name, values[name])
      if (error) {
        newErrors[name] = error
      }
    })

    setErrors(newErrors)
    return newErrors
  }, [rules, validateField])

  const isValid = useMemo(() => {
    return Object.values(errors).every(error => error === null)
  }, [errors])

  const clearErrors = useCallback(() => {
    setErrors({})
  }, [])

  const setError = useCallback((name: string, error: string | null) => {
    setErrors(prev => ({
      ...prev,
      [name]: error
    }))
  }, [])

  return {
    errors,
    isValid,
    validate,
    validateField,
    clearErrors,
    setError
  }
}

/**
 * Validações comuns para reutilização
 */
export const commonValidations = {
  required: { required: true },
  email: { 
    required: true, 
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
  },
  phone: { 
    pattern: /^\(\d{2}\)\s\d{4,5}-\d{4}$/ 
  },
  cpf: { 
    pattern: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
    custom: (value: string) => {
      // Validação básica de CPF
      const cpf = value.replace(/\D/g, '')
      if (cpf.length !== 11) return 'CPF deve ter 11 dígitos'
      
      // Validação de CPF (algoritmo básico)
      let sum = 0
      for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i)
      }
      let remainder = 11 - (sum % 11)
      if (remainder === 10 || remainder === 11) remainder = 0
      if (remainder !== parseInt(cpf.charAt(9))) return 'CPF inválido'

      sum = 0
      for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i)
      }
      remainder = 11 - (sum % 11)
      if (remainder === 10 || remainder === 11) remainder = 0
      if (remainder !== parseInt(cpf.charAt(10))) return 'CPF inválido'

      return null
    }
  },
  cep: { 
    pattern: /^\d{5}-?\d{3}$/ 
  },
  price: { 
    min: 0,
    custom: (value: string | number) => {
      const numValue = typeof value === 'string' ? parseFloat(value) : value
      if (isNaN(numValue)) return 'Valor deve ser um número'
      if (numValue < 0) return 'Valor não pode ser negativo'
      return null
    }
  },
  positiveNumber: { 
    min: 1,
    custom: (value: string | number) => {
      const numValue = typeof value === 'string' ? parseFloat(value) : value
      if (isNaN(numValue)) return 'Deve ser um número'
      if (numValue <= 0) return 'Deve ser maior que zero'
      return null
    }
  }
}
