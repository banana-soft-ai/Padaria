/**
 * Sistema de Logging Profissional para Rey dos Pães
 * Suporte a diferentes níveis de log e persistência
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  data?: any
  userId?: string
  sessionId?: string
  url?: string
  userAgent?: string
}

import { NODE_ENV } from '../env/server-env'

class Logger {
  private static instance: Logger
  private logLevel: LogLevel
  private logs: LogEntry[] = []
  private maxLogs: number = 1000

  private constructor() {
    // Determinar nível de log baseado no ambiente
    this.logLevel = NODE_ENV === 'production'
      ? LogLevel.WARN
      : LogLevel.DEBUG
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
    data?: any
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data,
      userId: this.getCurrentUserId(),
      sessionId: this.getSessionId(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined
    }
  }

  private getCurrentUserId(): string | undefined {
    // Implementar lógica para obter ID do usuário atual
    // Por exemplo, do contexto de autenticação
    return undefined
  }

  private getSessionId(): string | undefined {
    // Implementar lógica para obter ID da sessão
    return typeof window !== 'undefined'
      ? sessionStorage.getItem('sessionId') || undefined
      : undefined
  }

  private addLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return

    // Adicionar ao array de logs
    this.logs.push(entry)

    // Manter apenas os últimos N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Log no console para desenvolvimento
    if (NODE_ENV === 'development') {
      this.logToConsole(entry)
    }

    // Enviar para serviço de logging em produção
    if (NODE_ENV === 'production' && entry.level >= LogLevel.ERROR) {
      this.sendToLoggingService(entry)
    }
  }

  private logToConsole(entry: LogEntry): void {
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL']
    const colors = {
      [LogLevel.DEBUG]: '#6B7280',
      [LogLevel.INFO]: '#3B82F6',
      [LogLevel.WARN]: '#F59E0B',
      [LogLevel.ERROR]: '#EF4444',
      [LogLevel.CRITICAL]: '#DC2626'
    }

    const levelName = levelNames[entry.level]
    const color = colors[entry.level]

    console.group(
      `%c${levelName}%c ${entry.timestamp}`,
      `color: white; background: ${color}; padding: 2px 6px; border-radius: 3px; font-weight: bold;`,
      'color: #6B7280; font-size: 12px;'
    )

    console.log(`Message: ${entry.message}`)

    if (entry.context) {
      console.log(`Context: ${entry.context}`)
    }

    if (entry.data) {
      console.log('Data:', entry.data)
    }

    if (entry.userId) {
      console.log(`User ID: ${entry.userId}`)
    }

    if (entry.url) {
      console.log(`URL: ${entry.url}`)
    }

    console.groupEnd()
  }

  private async sendToLoggingService(entry: LogEntry): Promise<void> {
    try {
      // Implementar envio para serviço de logging
      // Por exemplo, Sentry, LogRocket, ou serviço customizado
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      })
    } catch (error) {
      // Falha silenciosa para não quebrar a aplicação
      console.warn('Failed to send log to service:', error)
    }
  }

  debug(message: string, context?: string, data?: any): void {
    this.addLog(this.createLogEntry(LogLevel.DEBUG, message, context, data))
  }

  info(message: string, context?: string, data?: any): void {
    this.addLog(this.createLogEntry(LogLevel.INFO, message, context, data))
  }

  warn(message: string, context?: string, data?: any): void {
    this.addLog(this.createLogEntry(LogLevel.WARN, message, context, data))
  }

  error(message: string, context?: string, data?: any): void {
    this.addLog(this.createLogEntry(LogLevel.ERROR, message, context, data))
  }

  critical(message: string, context?: string, data?: any): void {
    this.addLog(this.createLogEntry(LogLevel.CRITICAL, message, context, data))
  }

  // Métodos para análise de logs
  getLogs(filter?: Partial<LogEntry>): LogEntry[] {
    if (!filter) return [...this.logs]

    return this.logs.filter(log => {
      return Object.entries(filter).every(([key, value]) => {
        return log[key as keyof LogEntry] === value
      })
    })
  }

  getErrors(): LogEntry[] {
    return this.getLogs({ level: LogLevel.ERROR })
  }

  getWarnings(): LogEntry[] {
    return this.getLogs({ level: LogLevel.WARN })
  }

  clearLogs(): void {
    this.logs = []
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }
}

// Instância singleton
export const logger = Logger.getInstance()

// Hooks para usar o logger em componentes React
export function useLogger(context?: string) {
  return {
    debug: (message: string, data?: any) => logger.debug(message, context, data),
    info: (message: string, data?: any) => logger.info(message, context, data),
    warn: (message: string, data?: any) => logger.warn(message, context, data),
    error: (message: string, data?: any) => logger.error(message, context, data),
    critical: (message: string, data?: any) => logger.critical(message, context, data)
  }
}

// Utilitários para logging de performance
export function logPerformance(name: string, startTime: number, context?: string): void {
  const duration = performance.now() - startTime
  logger.info(`Performance: ${name} took ${duration.toFixed(2)}ms`, context, { duration })
}

export function withPerformanceLogging<T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  context?: string
): T {
  return ((...args: any[]) => {
    const startTime = performance.now()
    try {
      const result = fn(...args)

      // Se for uma Promise, logar quando resolver
      if (result instanceof Promise) {
        return result.finally(() => {
          logPerformance(name, startTime, context)
        })
      }

      // Se for síncrono, logar imediatamente
      logPerformance(name, startTime, context)
      return result
    } catch (error) {
      logger.error(`Error in ${name}`, context, error)
      throw error
    }
  }) as T
}
