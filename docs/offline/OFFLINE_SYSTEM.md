# Sistema Offline - Rey dos Pães

Este documento explica como funciona o sistema offline implementado no projeto Rey dos Pães.

## 🚀 Funcionalidades

### ✅ **Online e Offline**
- ✅ Funciona perfeitamente online
- ✅ Funciona completamente offline
- ✅ Sincronização automática quando volta online
- ✅ Resolução automática de conflitos
- ✅ Cache inteligente de dados

### 📱 **PWA (Progressive Web App)**
- ✅ Instalável como app nativo
- ✅ Service Worker para cache
- ✅ Funciona sem conexão
- ✅ Notificações push (opcional)

## 🏗️ **Arquitetura do Sistema**

### 1. **Detecção de Status**
```typescript
// Hook para detectar online/offline
const { isOnline, isReconnecting } = useOnlineStatus()
```

### 2. **Armazenamento Offline (IndexedDB)**
```typescript
// Sistema de armazenamento local
import { offlineStorage } from '@/lib/offlineStorage'

// Salvar dados offline
await offlineStorage.saveOfflineData('vendas', vendasData)

// Carregar dados offline
const vendas = await offlineStorage.getOfflineData('vendas')
```

### 3. **Sincronização Automática**
```typescript
// Serviço de sincronização
import { syncService } from '@/lib/syncService'

// Sincronizar manualmente
await syncService.forceSync()

// Verificar operações pendentes
const hasPending = await syncService.hasPendingOperations()
```

### 4. **Hook para Dados Offline**
```typescript
// Hook que funciona online e offline
const {
  data: vendas,
  loading,
  error,
  addItem,
  updateItem,
  deleteItem,
  sync,
  isOffline,
  pendingSync
} = useOfflineData<Venda>({
  table: 'vendas',
  autoSync: true
})
```

## 🔧 **Como Usar**

### **1. Em Componentes Existentes**

Substitua hooks que fazem requisições diretas ao Supabase:

```typescript
// ❌ Antes (apenas online)
const { data: vendas } = await supabase.from('vendas').select('*')

// ✅ Depois (online + offline)
const { data: vendas, addItem, updateItem } = useOfflineData<Venda>({
  table: 'vendas',
  autoSync: true
})
```

### **2. Exemplo Prático - Vendas**

```typescript
import { useVendasOffline } from '@/hooks/useVendasOffline'

function VendasPage() {
  const {
    vendas,
    vendasHoje,
    totais,
    loading,
    isOffline,
    pendingSync,
    criarVenda,
    syncVendas
  } = useVendasOffline()

  const handleNovaVenda = async (formData) => {
    const result = await criarVenda(formData)
    
    if (result.success) {
      if (isOffline) {
        alert('Venda salva offline. Será sincronizada quando online.')
      } else {
        alert('Venda registrada com sucesso!')
      }
    }
  }

  return (
    <div>
      {/* Status Offline */}
      {isOffline && (
        <div className="bg-orange-100 p-2 rounded">
          Modo Offline - Dados serão sincronizados quando online
        </div>
      )}

      {/* Operações Pendentes */}
      {pendingSync && (
        <div className="bg-blue-100 p-2 rounded">
          Sincronizando dados...
        </div>
      )}

      {/* Sua interface normal */}
      <VendasList vendas={vendas} />
      <button onClick={syncVendas}>Sincronizar Agora</button>
    </div>
  )
}
```

### **3. Componentes Automáticos**

O sistema já inclui componentes que funcionam automaticamente:

```typescript
// Status offline (canto inferior direito)
<OfflineStatus />

// Resolver conflitos (modal automático)
<ConflictResolver />

// Provider principal (já no layout)
<OfflineProvider>
  {children}
</OfflineProvider>
```

## 📊 **Fluxo de Dados**

### **Online**
1. Usuário faz ação → Dados salvos no Supabase
2. Dados também salvos no cache local (IndexedDB)
3. Interface atualizada imediatamente

### **Offline**
1. Usuário faz ação → Dados salvos apenas localmente (IndexedDB)
2. Operação adicionada à fila de sincronização
3. Interface atualizada imediatamente
4. Quando voltar online → Sincronização automática

### **Conflitos**
1. Sistema detecta dados modificados em ambos os lados
2. Modal de resolução de conflitos aparece automaticamente
3. Usuário escolhe qual versão usar
4. Dados são sincronizados

## 🛠️ **Configuração**

### **1. Variáveis de Ambiente**
```env
# Já configurado no env.example
NEXT_PUBLIC_SUPABASE_URL=sua_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave
```

### **2. Service Worker**
O Service Worker é registrado automaticamente e gerencia:
- Cache de arquivos estáticos
- Cache de APIs
- Sincronização em background
- Páginas offline

### **3. IndexedDB**
Criado automaticamente com as seguintes stores:
- `pendingOperations`: Operações pendentes de sincronização
- `offlineData`: Cache de dados por tabela
- `offlineConfig`: Configurações offline

## 📱 **PWA - Instalação**

### **No Desktop**
1. Abra o site no Chrome/Edge
2. Clique no ícone de instalação na barra de endereço
3. Confirme a instalação

### **No Mobile**
1. Abra o site no navegador
2. Toque no menu "Adicionar à tela inicial"
3. Confirme a instalação

### **Funcionalidades PWA**
- ✅ Funciona como app nativo
- ✅ Ícone na tela inicial
- ✅ Tela de splash
- ✅ Funciona offline
- ✅ Notificações (se habilitadas)

## 🔍 **Monitoramento**

### **Console do Navegador**
```javascript
// Verificar status offline
console.log('Online:', navigator.onLine)

// Verificar dados offline
import { offlineStorage } from '@/lib/offlineStorage'
const stats = await offlineStorage.getOfflineStats()
console.log('Stats:', stats)

// Verificar operações pendentes
import { syncService } from '@/lib/syncService'
const pending = await syncService.hasPendingOperations()
console.log('Pending operations:', pending)
```

### **Interface Visual**
- Status online/offline no canto inferior direito
- Contador de operações pendentes
- Notificações de sincronização
- Modal de resolução de conflitos

## 🚨 **Solução de Problemas**

### **1. Dados não sincronizam**
- Verifique se está online
- Clique em "Sincronizar" no status offline
- Verifique o console para erros

### **2. Conflitos não resolvidos**
- Modal de conflitos deve aparecer automaticamente
- Escolha "Usar Versão Remota" para dados mais recentes
- Ou resolva manualmente cada conflito

### **3. Service Worker não funciona**
- Verifique se o navegador suporta Service Workers
- Abra DevTools → Application → Service Workers
- Force update se necessário

### **4. IndexedDB não funciona**
- Verifique se o navegador suporta IndexedDB
- Limpe dados do site se necessário
- Verifique espaço disponível

## 📈 **Performance**

### **Vantagens**
- ✅ Carregamento instantâneo offline
- ✅ Sincronização em background
- ✅ Cache inteligente
- ✅ Resolução automática de conflitos

### **Limitações**
- ⚠️ IndexedDB tem limite de espaço (geralmente 50MB+)
- ⚠️ Sincronização pode demorar com muitos dados
- ⚠️ Conflitos complexos podem precisar resolução manual

## 🔮 **Próximos Passos**

### **Melhorias Futuras**
- [ ] Sincronização incremental
- [ ] Compressão de dados offline
- [ ] Notificações push
- [ ] Sincronização entre dispositivos
- [ ] Backup automático na nuvem

---

**Sistema implementado com sucesso! 🎉**

O Rey dos Pães agora funciona perfeitamente online e offline, garantindo que nenhuma venda seja perdida mesmo sem conexão com a internet.
