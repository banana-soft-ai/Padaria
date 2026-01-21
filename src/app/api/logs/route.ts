import { NextRequest, NextResponse } from 'next/server'
import { LogEntry } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const logEntry: LogEntry = await request.json()

    // Validação estruturada
    if (
      typeof logEntry.level !== 'string' ||
      typeof logEntry.message !== 'string' ||
      typeof logEntry.timestamp !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Estrutura inválida de log' },
        { status: 400 }
      )
    }

    // Aceitar somente níveis conhecidos
    const validLevels = ['info', 'warn', 'error', 'debug']
    if (!validLevels.includes(logEntry.level)) {
      return NextResponse.json(
        { error: 'Nível de log inválido' },
        { status: 400 }
      )
    }

    // Simulação: enviar log para console
    console.log('📝 Log recebido:', {
      level: logEntry.level,
      message: logEntry.message,
      context: logEntry.context || null,
      timestamp: logEntry.timestamp
    })

    // Simular processamento
    await new Promise(resolve => setTimeout(resolve, 10))

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erro ao processar log:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Logs API endpoint',
    endpoints: {
      POST: 'Enviar log para o servidor'
    }
  })
}
