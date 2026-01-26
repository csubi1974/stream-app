# 📊 Sistema de Señales - Explicación Completa

## Índice
1. [Visión General](#visión-general)
2. [Filosofía: Reversión vs Tendencia](#filosofía-reversión-vs-tendencia)
3. [Determinación de Señales](#determinación-de-señales)
4. [Selección de Deltas](#selección-de-deltas)
5. [Prima Mínima](#prima-mínima)
6. [Probabilidad de Beneficio](#probabilidad-de-beneficio)
7. [Expiración](#expiración)
8. [Distancia de Spreads](#distancia-de-spreads)
12. [Datos Involucrados](#datos-involucrados)
13. [Quality Scoring System](#quality-scoring-system)
14. [Estrategia de Salida (Exit Strategy)](#estrategia-de-salida-exit-strategy)
15. [Flujo Completo](#flujo-completo)
16. [Persistencia y Resultados](#persistencia-y-resultados)

---

## Visión General

Tu sistema de señales es un **motor algorítmico** que genera alertas de trading automáticas basado en:
- Métricas GEX (Gamma Exposure)
- Condiciones institucionales del mercado
- Análisis de opciones 0DTE (Zero Days To Expiration)
- Volatilidad implícita del mercado

### Estrategias Soportadas
1. **Bull Put Spread** (Alcista) - venta de credit spread en puts
2. **Bear Call Spread** (Bajista) - venta de credit spread en calls
3. **Iron Condor** (Neutral) - combinación de ambos spreads

---

## Filosofía: Reversión vs Tendencia

### ¿Este sistema genera señales de reversión o de seguimiento de tendencia?

**Respuesta corta:** Tu sistema es **predominantemente de REVERSIÓN A LA MEDIA (mean reversion)**, pero con **alineación institucional inteligente** que puede crear señales "a favor de la tendencia" bajo ciertas condiciones.

---

### 🔄 Naturaleza de REVERSIÓN de los Credit Spreads

#### ¿Por qué es reversión a la media?

Cuando vendes **credit spreads**, estás apostando a que el precio **NO alcanzará** el strike vendido. Esto es fundamentalmente una posición de reversión porque:

```
Mecánica del Credit Spread:
╔════════════════════════════════════════════════╗
║  SELL Strike: Aquí esperas que el precio       ║
║               NO llegue (reversión implícita)   ║
║                                                 ║
║  BUY Strike:  Protección en caso de que        ║
║               el precio continúe el movimiento  ║
╚════════════════════════════════════════════════╝
```

**Bull Put Spread** (vender puts):
- ❌ **NO es** comprar el mercado (seguir tendencia alcista)
- ✅ **ES** apostar a que el mercado NO caerá hasta tu strike
- 🎯 **Esperas:** Precio se mantenga o suba, pero tu profit máximo es limitado al crédito

**Bear Call Spread** (vender calls):
- ❌ **NO es** vender en corto (seguir tendencia bajista)
- ✅ **ES** apostar a que el mercado NO subirá hasta tu strike
- 🎯 **Esperas:** Precio se mantenga o baje, pero tu profit máximo es limitado al crédito

**Iron Condor**:
- ❌ **NO es** neutral del todo
- ✅ **ES** apostar activamente a que el precio se mantendrá en un rango
- 🎯 **Esperas:** Reversión a la media y contención dentro de los muros

---

### 📊 Los 3 Tipos de Señales que Genera tu Sistema

#### 1️⃣ **SEÑALES DE REVERSIÓN PURA** (Contra tendencia institucional)

**¿Cuándo ocurren?**
```typescript
Régimen = 'stable' && |netDrift| <= 0.5
```

**Características:**
- El mercado NO tiene sesgo direccional institucional fuerte
- Se generan **ambos lados** (Bull Put + Bear Call + Iron Condor)
- Se basan **únicamente en los Muros institucionales** (Put Wall / Call Wall)
- **Filosofía:** Los dealers defenderán los muros como imanes

**Ejemplo:**
```
Escenario del mercado:
  Precio actual: $5,950
  Put Wall: $5,900 (soporte)
  Call Wall: $6,000 (resistencia)
  Net Drift: +0.15 (casi neutral)
  
Señales generadas:
  ✅ Bull Put Spread $5,895/$5,890
     → Reversión contra cualquier caída hacia $5,900
  
  ✅ Bear Call Spread $5,975/$5,980
     → Reversión contra cualquier subida hacia $6,000
  
  ✅ Iron Condor
     → Reversión desde ambos extremos
```

**¿Por qué funciona?**
- Los **Muros GEX** son barreras probabilísticas donde los dealers tienen máxima exposición
- Los market makers **activamente defienden** estos niveles con hedging dinámico
- Para romper un muro se necesita **volumen extraordinario** o catalizador fuerte
- En 0DTE, la defensa de muros es **especialmente efectiva** (alta gamma)

**Ventaja:** Alta PoP (70-85%) porque juegas con los dealers, no contra ellos

**Desventaja:** Si hay un evento inesperado (noticia, dato macro), los muros pueden romperse

---

#### 2️⃣ **SEÑALES DE REVERSIÓN CON SESGO DIRECCIONAL** (Semi-tendencia)

**¿Cuándo ocurren?**
```typescript
(Régimen = 'stable') && (netDrift > 0.5 O netDrift < -0.5)
```

**Características:**
- Hay **presión institucional direccional** clara
- Se genera **solo un lado** del spread (alcista O bajista)
- **Combina:** Reversión a los muros + Alineación con el sesgo institucional
- **Filosofía:** "Nadar con la corriente, pero no alejarse del puerto"

**Ejemplo Alcista (netDrift > 0.5):**
```
Escenario del mercado:
  Precio actual: $5,950
  Put Wall: $5,900
  Net Drift: +0.85 (fuertemente alcista)
  Net Institutional Delta: +12,000 (dealers posicionados para subidas)
  
Señal generada:
  ✅ Bull Put Spread $5,895/$5,890 SOLAMENTE
     → Reversión contra caídas, pero alineado con sesgo alcista
     
  ❌ NO se genera Bear Call Spread
     → Evitamos pelear contra el sesgo alcista institucional
```

**¿Es a favor o contra tendencia?**
- ✅ **A FAVOR del sesgo institucional**: El Net Drift alcista sugiere que el "smart money" está posicionado para subidas
- ⚠️ **CONTRA la tendencia direccional pura**: No estamos comprando calls (seguimiento puro), estamos vendiendo puts esperando que el precio NO caiga

**¿Por qué funciona?**
- **Doble protección:**
  1. Put Wall como barrera física
  2. Sesgo institucional alcista reduce probabilidad de caídas fuertes
- **Probabilidad aumentada:** Tienes a los dealers de tu lado

**Trade-off:**
- ✅ Mayor PoP que reversión pura
- ❌ Ganancias limitadas (crédito recibido)
- ❌ Si hay reversión fuerte del sesgo, puedes perder

---

#### 3️⃣ **SEÑALES DE NO-ACCIÓN** (Anti-tendencia volátil)

**¿Cuándo ocurren?**
```typescript
Régimen = 'volatile' (GEX < 0 || precio cerca de Gamma Flip)
```

**Características:**
- **NO se generan señales ejecutables**
- Se emite **advertencia de "WATCH"**
- **Filosofía:** "Cuando los dealers amplifican volatilidad, no vendas premium"

**Ejemplo:**
```
Escenario del mercado:
  Total GEX: -500,000 (negativo → volátil)
  Precio: $5,922 (muy cerca del Gamma Flip $5,925)
  
Señal generada:
  ⚠️ ADVERTENCIA: "Régimen Volátil Detectado"
     → Los dealers amplificarán movimientos
     → Evitar venta de premium
```

**¿Por qué NO generar señales?**
- En **gamma negativa**, los dealers **aceleran** los movimientos en lugar de frenarlos
- Los muros pierden efectividad
- Los credit spreads tienen **PoP reducida drásticamente**
- Riesgo de movimientos explosivos (gap risk)

**Alternativa:** En este régimen, estrategias direccionales (comprar spreads, long delta) serían más apropiadas, pero tu sistema no las genera porque está optimizado para venta de premium

---

### 🎯 Tabla Resumen: ¿Cuándo es Reversión? ¿Cuándo es Tendencia?

| Condición de Mercado | Tipo de Señal | Naturaleza | Explicación |
|---------------------|---------------|-----------|-------------|
| **Régimen Estable + Drift Neutral** | Bull Put + Bear Call + Iron Condor | **REVERSIÓN PURA** | Apuesta a contención en rango, defensa de muros en ambos lados |
| **Régimen Estable + Drift Alcista (>0.5)** | Solo Bull Put Spread | **REVERSIÓN CON SESGO ALCISTA** | Reversión contra caídas, alineado con institucionales alcistas |
| **Régimen Estable + Drift Bajista (<-0.5)** | Solo Bear Call Spread | **REVERSIÓN CON SESGO BAJISTA** | Reversión contra subidas, alineado con institucionales bajistas |
| **Régimen Volátil** | ⚠️ Advertencia (WATCH) | **NO OPERAR** | Dealers en gamma negativa, reversión no confiable |

---

### 💡 ¿Puede haber señales "a favor de la tendencia"?

**Respuesta matizada:**

#### SÍ, en el sentido de **alineación institucional**:

Cuando el sistema genera un **Bull Put Spread** con `netDrift > 0.5`:
- ✅ Estás "a favor" del **sesgo institucional** (dealers posicionados alcistas)
- ✅ Estás "a favor" del **momentum microestructural** (presión de compra neta)
- ✅ Estás operando **con los market makers**, no contra ellos

#### NO, en el sentido de **seguimiento de tendencia puro**:

Credit spreads **nunca son** seguimiento de tendencia porque:
- ❌ No capturan movimientos grandes (profit limitado al crédito)
- ❌ No aumentan ganancias si el mercado se mueve mucho a tu favor
- ❌ No son posiciones delta-positivas/negativas significativas

**Comparación:**

| Estrategia | Delta Neta | Seguimiento Tendencia | Profit Máximo |
|------------|-----------|----------------------|---------------|
| **Comprar Call** | +0.50 a +1.00 | ✅ SÍ (alcista puro) | Ilimitado |
| **Bull Put Spread (tu sistema)** | +0.04 a +0.08 | ⚠️ PARCIAL (sesgo alcista leve) | Crédito ($2-3) |
| **Vender Put Naked** | +0.15 a +0.25 | ⚠️ PARCIAL | Prima recibida |
| **Iron Condor** | ~0.00 | ❌ NO (neutral) | Crédito total |

---

### 🧠 ¿Por qué el sistema usa reversión en lugar de tendencia?

**Razones estratégicas:**

#### 1. **Alta Probabilidad de Éxito**
```
Credit Spread (reversión): 70-85% PoP
Debit Spread (tendencia):  30-50% PoP
```

#### 2. **Decaimiento Temporal a tu favor (Theta positiva)**
```
Credit Spread: Cada día que pasa, ganas dinero (theta decay)
Debit Spread:  Cada día que pasa, pierdes dinero
```

#### 3. **Optimización para 0DTE**
```
En opciones que expiran hoy:
  ✅ Theta decay es MÁXIMO → Favorece venta
  ❌ Gamma risk es alto → Desfavorece compra
```

#### 4. **Defensa Institucional de Muros**
```
Los dealers DEFIENDEN activamente los muros
→ Tu reversión tiene "ayuda institucional"
→ Tendencia pura NO tiene esta ventaja
```

#### 5. **Riesgo Definido**
```
Ambas estrategias:
  Max Loss = (Ancho spread - Crédito) × 100
  
Pero credit spreads:
  ✅ Menos propensos a max loss (mayor PoP)
  ✅ Menor costo de capital (recibes dinero)
```

---

### 📈 Casos de Uso Específicos

#### Caso 1: Mercado en Tendencia Alcista Clara

**Situación:**
```
SPX ha subido +2% en los últimos 3 días
Todas las EMAs alineadas alcistas
Momentum fuerte al alza
```

**¿Qué hace tu sistema?**
```typescript
SI (régimen == 'stable' && netDrift > 0.5) ENTONCES
    Generar: Bull Put Spread (reversión contra caídas)
    Rationale: "Sesgo institucional alcista, Put Wall defendido"
FIN SI
```

**¿Es apropiado?**
- ✅ **SÍ**, si el movimiento es **sostenible y ordenado**
- ✅ Los muros se **ajustan dinámicamente** con el precio
- ✅ Estás capturando **decaimiento de volatilidad implícita** post-movimiento

**¿Cuándo NO es apropiado?**
- ❌ Si es un **gap up** violento (régimen volátil)
- ❌ Si hay **evento macroeconómico** pendiente (FOMC, CPI)
- ❌ Si el precio ya rompió el **Expected Move** del día

---

#### Caso 2: Mercado Lateral/Range-Bound

**Situación:**
```
SPX oscilando entre $5,900 - $6,000 por 3 días
Baja volatilidad implícita
Muros estables y bien definidos
```

**¿Qué hace tu sistema?**
```typescript
SI (régimen == 'stable' && |netDrift| <= 0.5) ENTONCES
    Generar: Iron Condor (reversión desde ambos extremos)
FIN SI
```

**¿Es apropiado?**
- ✅ **IDEAL** → Este es el escenario perfecto para reversión
- ✅ Máxima PoP (ambos lados trabajan para ti)
- ✅ Theta decay doble (calls y puts decaen)
- ✅ Muros bien establecidos

---

#### Caso 3: Mercado en Tendencia Bajista con Rebote

**Situación:**
```
SPX cayó -1.5% ayer
Hoy abre con gap down de -0.3%
Net Drift: -0.75 (bajista)
Régimen transitando a volátil
```

**¿Qué hace tu sistema?**
```typescript
SI (régimen == 'volatile') ENTONCES
    Generar: ⚠️ Advertencia "WATCH"
    NO generar señales ejecutables
FIN SI
```

**¿Es apropiado?**
- ✅ **CORRECTO** → Protege de vender premium en momento peligroso
- ⚠️ Podrías perder un rebote, pero evitas pérdidas mayores

**Alternativa manual:**
- Si el trader observa **estabilización** intradiaria, puede esperar a que el régimen vuelva a "stable"
- Entonces el sistema generaría Bear Call Spread (reversión contra continuación alcista del rebote)

---

### 🔑 Conclusión Clave

**Tu sistema NO es de seguimiento de tendencia puro, sino de:**

1. **REVERSIÓN A LA MEDIA** como filosofía base
2. **ALINEACIÓN CON SESGO INSTITUCIONAL** cuando existe
3. **DEFENSA DE MUROS GEX** como ancla probabilística
4. **VENTA DE PREMIUM** optimizada para 0DTE

**¿Puede operar "a favor de la tendencia"?**
- ✅ Sí, en el sentido de **alinearse con el sesgo institucional** (Net Drift)
- ❌ No, en el sentido de **capturar grandes movimientos direccionales**

**La gran ventaja:** 
Combina **alta probabilidad** (reversión) con **inteligencia institucional** (GEX), creando un sistema robusto para venta de premium en 0DTE.

---

## Determinación de Señales

### 🟢 Señal ALCISTA (Bull Put Spread)

**Se genera cuando:**
```typescript
1. Net Drift > 0.5 (presión institucional alcista)
   O
2. Net Drift neutro (-0.5 a 0.5) Y Régimen = Estable
```

**Contexto que favorece:**
- **Put Wall activo** → Los dealers defienden este nivel como soporte
- **Precio por encima del Gamma Flip** → Mercado estable
- **GEX Positivo** → Dealers amortiguan caídas

**Decisión algorítmica:**
```
SI (netDrift > 0.5) ENTONCES
    Generar Bull Put Spread
FIN SI

SI (|netDrift| <= 0.5 Y régimen == 'stable') ENTONCES
    Generar Bull Put Spread (junto con Bear Call)
FIN SI
```

---

### 🔴 Señal BAJISTA (Bear Call Spread)

**Se genera cuando:**
```typescript
1. Net Drift < -0.5 (presión institucional bajista)
   O
2. Net Drift neutro (-0.5 a 0.5) Y Régimen = Estable
```

**Contexto que favorece:**
- **Call Wall activo** → Resistencia institucional fuerte
- **Precio cerca del Call Wall** → Alta probabilidad de rechazo
- **Drift negativo** → Sesgo bajista institucional

**Decisión algorítmica:**
```
SI (netDrift < -0.5) ENTONCES
    Generar Bear Call Spread
FIN SI

SI (|netDrift| <= 0.5 Y régimen == 'stable') ENTONCES
    Generar Bear Call Spread (junto con Bull Put)
FIN SI
```

---

### ⚪ Señal NEUTRAL (Iron Condor)

**Se genera cuando:**
```typescript
Régimen = 'stable' (GEX Positivo)
```

**Contexto que favorece:**
- **Total GEX > 0** → Dealers en gamma positiva amortiguan movimientos
- **Precio contenido entre Put Wall y Call Wall** → Rango definido
- **Volatilidad implícita alta** → Decay de theta favorable

**Decisión algorítmica:**
```
SI (régimen == 'stable') ENTONCES
    Generar Iron Condor (combinando Bull Put + Bear Call)
FIN SI
```

---

### ⚠️ ADVERTENCIA: Régimen Volátil

**Se genera cuando:**
```typescript
Régimen = 'volatile' (GEX Negativo O Precio cerca del Gamma Flip)
```

**Recomendación:**
- **NO vender premium** en este régimen
- Los dealers amplifican movimientos (gamma negativa)
- Mercado explosivo y peligroso
- Señal de tipo "WATCH" sin piernas ejecutables

---

## Selección de Deltas

### Rango de Delta Objetivo
```typescript
Delta target = 0.15 a 0.25 (en valor absoluto)
```

### ¿Por qué este rango?

| Métrica | Valor | Significado |
|---------|-------|-------------|
| **Delta 0.15** | ~85% PoP | Strike muy OTM, alta probabilidad de profit |
| **Delta 0.20** | ~80% PoP | Equilibrio entre prima y probabilidad |
| **Delta 0.25** | ~75% PoP | Mayor prima pero menor probabilidad |

### Proceso de selección

#### Para Bull Put Spread:
```typescript
// 1. Filtrar PUTs que cumplan:
const shortPutCandidates = puts.filter(p => {
    const strike = p.strikePrice;
    const delta = Math.abs(p.delta);
    
    return strike < currentPrice &&           // Debajo del precio actual
           strike >= putWall - 20 &&          // Cerca del Put Wall (±20 puntos)
           delta >= 0.15 && delta <= 0.25;    // Delta en rango objetivo
});

// 2. Ordenar por delta (menor a mayor)
shortPutCandidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));

// 3. Seleccionar el primero (delta más baja = mayor probabilidad)
const shortPut = shortPutCandidates[0];
```

#### Para Bear Call Spread:
```typescript
// Similar pero con CALLs:
const shortCallCandidates = calls.filter(c => {
    return strike > currentPrice &&           // Encima del precio actual
           strike <= callWall + 20 &&         // Cerca del Call Wall (±20 puntos)
           delta >= 0.15 && delta <= 0.25;    // Delta en rango objetivo
});
```

### ¿Por qué cerca de los Muros (Walls)?

Los **Institutional Walls** son niveles de máxima defensa de gamma:
- **Put Wall**: Floor magnético (soporte fuerte)
- **Call Wall**: Techo magnético (resistencia fuerte)

Vender strikes **cerca de los muros** maximiza:
1. **Probabilidad** → El precio tiende a rebotar antes de los muros
2. **Prima recibida** → Strikes más cercanos al precio tienen mejor prima
3. **Protección** → Los dealers defienden activamente estos niveles

---

## Prima Mínima

### Crédito neto mínimo requerido

```typescript
const MIN_CREDIT = 0.20; // $0.20 por spread

if (netCredit <= 0.20) {
    return null; // Rechazar la señal
}
```

### ¿Por qué $0.20?

| Concepto | Valor |
|----------|-------|
| **Crédito mínimo** | $0.20 |
| **Total por contrato** | $20 (0.20 × 100) |
| **Comisiones estimadas** | ~$5-10 |
| **Beneficio neto mínimo** | $10-15 |

**Razones:**
1. **Rentabilidad**: Cualquier prima menor no justifica el riesgo
2. **Comisiones**: Cubrir los costos de transacción
3. **Slippage**: Buffer para diferencia bid/ask
4. **Calidad**: Filtrar spreads de baja liquidez o mal precio

### Cálculo del crédito neto

```typescript
// Precio de las piernas
const shortPrice = (option.bid + option.ask) / 2;  // Mid price
const longPrice = (option.bid + option.ask) / 2;

// Crédito neto = Prima recibida - Prima pagada
const netCredit = shortPrice - longPrice;

// Ejemplo real:
// SELL PUT $5900 @ $3.50
// BUY PUT $5895 @ $1.20
// Net Credit = $3.50 - $1.20 = $2.30 ✅ (Mayor a $0.20)
```

---

## Probabilidad de Beneficio

### Fórmula de cálculo

```typescript
// Para spreads vendidos (credit spreads)
const probability = 1 - Math.abs(delta);

// Ejemplo:
// Delta del short strike = -0.22
// Probabilidad = 1 - 0.22 = 0.78 → 78%
```

### ¿Por qué funciona esta fórmula?

El **delta** de una opción aproxima la probabilidad de que expire ITM (In The Money):

| Delta | Prob. ITM | **Prob. OTM (PoP)** |
|-------|-----------|---------------------|
| 0.10  | 10%       | **90%** ✅ |
| 0.15  | 15%       | **85%** ✅ |
| 0.20  | 20%       | **80%** (objetivo) |
| 0.25  | 25%       | **75%** ✅ |
| 0.30  | 30%       | **70%** (límite) |

Como **vendemos** opciones, queremos que expiren **OTM** (sin valor).

### Para Iron Condors

```typescript
// La probabilidad es el MÍNIMO de ambos lados
const probability = Math.min(bullPut.probability, bearCall.probability);

// Ejemplo:
// Bull Put: 78% PoP
// Bear Call: 82% PoP
// Iron Condor: 78% PoP (el más conservador)
```

### Validación adicional: Expected Move

```typescript
// Si el strike está DENTRO del Expected Move → Mayor riesgo
if (expectedMove && shortStrike >= lowerBound) {
    status = 'WATCH';  // Marcar como riesgosa
    warningText = '⚠️ DENTRO del rango esperado - Mayor riesgo';
}
```

**Expected Move** = Precio del Straddle ATM (Call ATM + Put ATM)
- Representa la volatilidad implícita esperada para el día
- Strikes **fuera** del expected move tienen mayor PoP
- Strikes **dentro** tienen mayor riesgo de ser testeados

---

## Expiración

### Política de expiración

```typescript
// El sistema SIEMPRE apunta a opciones 0DTE o 1DTE
const targetExpiration = this.findTargetExpiration(chain);

// Prioridad:
// 1. Hoy (0DTE) si está disponible
// 2. Próximo día disponible (1DTE)
```

### ¿Se dejan expirar?

**Sí, la estrategia es dejar expirar en la mayoría de casos:**

| Escenario | Acción Recomendada |
|-----------|-------------------|
| **Spreads fuera del Expected Move** | ✅ Dejar expirar para capturar 100% del crédito |
| **Spreads dentro del Expected Move** | ⚠️ Monitorear activamente, posible cierre anticipado |
| **Precio acercándose al short strike** | 🔴 Considerar cerrar al 50% de ganancia máxima |
| **Régimen volátil (GEX negativo)** | 🔴 NO entrar o cerrar inmediatamente |

### Gestión intradiaria

```typescript
// Validez de la señal
validUntil: twoHoursLater  // La señal vale por 2 horas desde generación

// Ventana de trading
const lastAlertTime = 15:45 ET  // No generar señales después de las 3:45 PM
```

**Razón:** Las señales son más precisas **temprano en el día**, cuando:
- Los muros de GEX están bien establecidos
- La volatilidad implícita no ha decaído completamente
- Hay tiempo para ajustar si es necesario

### Criterios de cierre anticipado (no automatizado)

Aunque el sistema sugiere **expiración**, un trader puede cerrar antes si:
1. **50% de ganancia máxima alcanzada** → Take profit común
2. **Precio rompe el Expected Move** → Riesgo aumentado
3. **Cambio de régimen GEX** (estable → volátil) → Salir del trade
4. **15 minutos antes del cierre** (3:45 PM) → Evitar riesgo de asignación

---

## Distancia de Spreads

### Ancho fijo

```typescript
private readonly SPREAD_WIDTH = 5; // 5 puntos para SPX
```

### ¿Por qué 5 puntos?

| Concepto | Impacto con 5 puntos |
|----------|---------------------|
| **Riesgo máximo** | $5.00 - credit = ~$3-4 por spread |
| **Liquidez** | Strikes cada 5 puntos tienen buena liquidez en SPX |
| **Risk/Reward** | Ratio típico de 1:2 a 1:4 |
| **Margen requerido** | ~$500 por spread (ancho × 100) |

### Cálculo del spread

```typescript
// Bull Put Spread
const shortStrike = 5900;  // Strike vendido
const longStrike = shortStrike - SPREAD_WIDTH;  // 5900 - 5 = 5895

// Bear Call Spread  
const shortStrike = 6000;  // Strike vendido
const longStrike = shortStrike + SPREAD_WIDTH;  // 6000 + 5 = 6005
```

### Máxima pérdida y ganancia

```typescript
// Ejemplo: Bull Put Spread 5900/5895
// SELL PUT 5900 @ $3.50
// BUY PUT 5895 @ $1.20

const netCredit = 3.50 - 1.20 = $2.30;
const maxProfit = $2.30;  // Si ambas expiran sin valor
const maxLoss = 5 - 2.30 = $2.70;  // Si SPX cierra por debajo de 5895

// Risk/Reward = maxLoss / maxProfit = 2.70 / 2.30 = 1:1.17
```

### ¿Por qué no variar el ancho?

**Ventajas de ancho fijo:**
1. ✅ **Simplicidad**: Riesgo consistente por trade
2. ✅ **Comparabilidad**: Todas las señales tienen la misma estructura
3. ✅ **Liquidez**: Strikes estándar de 5 puntos
4. ✅ **Margen**: Requerimientos de capital predecibles

**Desventajas (aceptadas):**
1. ❌ No se ajusta a volatilidad (pero usamos Expected Move para contexto)
2. ❌ Mismo riesgo en mercados diferentes (pero filtramos por régimen)

---

## Datos Involucrados

### Flujo de datos completo

```
┌─────────────────────────────────────────────────────┐
│  1. SCHWAB API - Options Chain (cadena de opciones) │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  2. GEX SERVICE - Cálculo de métricas GEX           │
│     • Total GEX                                     │
│     • Gamma Flip                                    │
│     • Net Institutional Delta                       │
│     • Net Drift                                     │
│     • Call Wall / Put Wall                          │
│     • Régimen (stable/volatile/neutral)             │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  3. TRADE ALERT SERVICE - Generación de señales     │
│     • Selección de estrategia por régimen           │
│     • Filtrado de opciones por delta                │
│     • Cálculo de expected move                      │
│     • Validación de prima mínima                    │
│     • Determinación de probabilidad                 │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  4. SQLITE DATABASE - Persistencia                  │
│     • Historial de señales                          │
│     • Filtrado por fecha/estrategia                 │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  5. FRONTEND (Signals.tsx) - Visualización          │
│     • Modo Live vs History                          │
│     • Filtros (estrategia, probabilidad, estado)    │
│     • Detalles de piernas y métricas                │
└─────────────────────────────────────────────────────┘
```

### Datos específicos por componente

#### 1. Options Chain (Schwab API)
```typescript
{
  symbol: "SPX",
  underlying: { last: 5950.25 },
  callExpDateMap: {
    "2026-01-24:0": {
      "5900": [{ 
        putCall: "CALL",
        strike: 5900,
        bid: 52.50,
        ask: 53.00,
        last: 52.80,
        delta: 0.65,
        gamma: 0.015,
        openInterest: 1500,
        volume: 850
      }]
    }
  },
  putExpDateMap: { /* similar */ }
}
```

#### 2. GEX Metrics
```typescript
{
  totalGEX: 1234567,           // Suma ponderada de gamma * OI
  gammaFlip: 5925.50,          // Strike donde gamma cambia de signo
  netInstitutionalDelta: -15000, // Delta agregado institucional
  netDrift: -0.25,             // Presión direccional normalizada
  callWall: 6000,              // Strike con mayor gamma/OI en calls
  putWall: 5900,               // Strike con mayor gamma/OI en puts
  currentPrice: 5950.25,       // Precio actual de SPX
  regime: "volatile"           // stable | volatile | neutral
}
```

#### 3. Expected Move
```typescript
// Calculado desde el straddle ATM
{
  atmStrike: 5950,             // Strike más cercano al precio
  callPrice: 18.50,            // Mid price del call ATM
  putPrice: 17.80,             // Mid price del put ATM
  straddlePrice: 36.30,        // Suma (expected move)
  expectedMove: 36.30,         // ±$36.30 puntos esperados
  upperBound: 5986.30,         // Precio + expected move
  lowerBound: 5913.70          // Precio - expected move
}
```

#### 4. Trade Alert (Output final)
```typescript
{
  id: "BPS-2026-01-24-5900",
  strategy: "BULL_PUT_SPREAD",
  strategyLabel: "Bull Put Spread",
  underlying: "SPX",
  expiration: "2026-01-24",
  
  legs: [
    {
      action: "SELL",
      type: "PUT",
      strike: 5900,
      price: 3.50,
      delta: -0.22
    },
    {
      action: "BUY",
      type: "PUT",
      strike: 5895,
      price: 1.20,
      delta: -0.18
    }
  ],
  
  netCredit: 2.30,
  maxLoss: 2.70,
  maxProfit: 2.30,
  probability: 78.0,           // 1 - |delta| × 100
  riskReward: "1:1.2",
  
  rationale: "El Put Wall en $5900 actúa como un imán...",
  status: "ACTIVE",            // ACTIVE | WATCH | CANCELLED
  
  gexContext: {
    regime: "stable",
    callWall: 6000,
    putWall: 5900,
    gammaFlip: 5925,
    currentPrice: 5950.25,
    netDrift: 0.15,
    expectedMove: 36.30
  },
  
  generatedAt: "2026-01-24T14:30:00Z",
  validUntil: "2026-01-24T16:30:00Z"
}
```

---

## Quality Scoring System

A partir de la versión **v1.6**, el sistema introduce una capa de inteligencia adicional que califica cada señal según su probabilidad estadística de éxito real.

### Factores de Puntuación (Scoring Factors)

Cada señal se evalúa en una escala de 0 a 100 basada en 6 factores críticos:

1.  **Move Exhaustion (30%)**: Mide qué tan extendido está el movimiento actual respecto al ATR (Average True Range). Un movimiento exhausto tiene mayor probabilidad de reversión.
2.  **Institutional Alignment (20%)**: Qué tan alineada está la señal con el Net Drift y el Net Institutional Delta.
3.  **Wall Strength (15%)**: La magnitud de la exposición Gamma en el muro (Wall) que estamos utilizando como soporte/resistencia.
4.  **Time Premium Decay (15%)**: El tiempo restante hasta la expiración. Las señales generadas con tiempo suficiente para el decaimiento de Theta tienen mayor puntaje.
5.  **Volatility Context (10%)**: Si la IV (Volatilidad Implícita) está en niveles extremos, favoreciendo la venta de premium.
6.  **Expected Move Safety (10%)**: Distancia porcentual del strike corto respecto al Expected Move calculado.

### Clasificación de Señales

| Calificación | Puntaje | Descripción |
| :--- | :--- | :--- |
| **⭐ PREMIUM** | > 85 pts | Alineación perfecta. Máxima probabilidad estadística. |
| **✅ STANDARD** | 60 - 85 pts | Señal sólida que cumple con los parámetros base. |
| **⚠️ AGGRESSIVE** | < 60 pts | Operación de mayor riesgo, generalmente contra-tendencia fuerte o cerca de muros débiles. |

---

## Estrategia de Salida (Exit Strategy)

No basta con entrar; saber cuándo salir es la clave de la rentabilidad a largo plazo. La v1.6 automatiza el plan de salida.

### 1. 🎯 Take Profit (TP)
- **Objetivo Primario**: 100% del crédito recibido (Hold to Expiry).
- **Objetivo Secundario (Manual)**: En señales tipo "Standard" o "Aggressive", se recomienda cerrar al alcanzar el **50-75% de la ganancia máxima** si el mercado se vuelve errático.

### 2. 🛑 Stop Loss (SL)
- **Nivel Técnico**: Si el precio del subyacente (SPX) cierra una vela de 5 minutos **por debajo del Put Wall** (en BPS) o **por encima del Call Wall** (en BCS).
- **Basado en Riesgo**: Se recomienda un stop loss máximo de **2x a 3x del crédito recibido**. (Ej: Si recibes $2.00, sales si el spread cuesta $6.00).

### 3. ⏰ Time Exit (MANDATORIO)
- **Hora de Corte**: 3:45 PM ET.
- **Razón**: Evitar el riesgo de asignación "after-hours". Si el spread sigue abierto a esta hora, debe cerrarse sin importar el PnL actual.

---

## Flujo Completo

### Proceso paso a paso

```
[INICIO] Usuario accede a /signals o sistema se ejecuta automáticamente cada 5 min
          ↓
[1] ¿Mercado abierto? (Lunes-Viernes, 9:30 AM - 3:45 PM ET)
          ↓ NO → Retornar []
          ↓ SÍ
[2] Obtener Options Chain desde Schwab API
          ↓
[3] Calcular GEX Metrics (Total GEX, Walls, Drift, Régimen)
          ↓
[4] Determinar expiración target (0DTE o 1DTE)
          ↓
[5] Filtrar opciones de la expiración target
          ↓
[6] Calcular Expected Move (precio straddle ATM)
          ↓
[7] Evaluar RÉGIMEN
          ↓
    ┌─────┴─────┐
    ▼           ▼
 STABLE      VOLATILE
    │           │
    │           └──→ Generar advertencia "WATCH"
    │
    ▼
[8] Evaluar NET DRIFT
    │
    ├──→ drift > 0.5     → Generar BULL PUT SPREAD
    ├──→ drift < -0.5    → Generar BEAR CALL SPREAD
    └──→ |drift| ≤ 0.5   → Generar ambos + IRON CONDOR
          ↓
[9] Para cada estrategia:
    ├─ Filtrar candidatos (delta 0.15-0.25, cerca de walls)
    ├─ Calcular spread (ancho = 5)
    ├─ Validar prima mínima (≥ $0.20)
    ├─ Calcular probabilidad (1 - |delta|)
    ├─ Verificar vs Expected Move
    └─ Construir objeto TradeAlert
          ↓
[10] Guardar alertas en SQLite
          ↓
[11] Retornar alertas al frontend
          ↓
[12] Frontend muestra en UI con filtros
          ↓
[FIN]
```

### Criterios de decisión resumidos

| Condición | Señal Generada |
|-----------|----------------|
| `regime == 'stable' && drift > 0.5` | **Bull Put Spread** |
| `regime == 'stable' && drift < -0.5` | **Bear Call Spread** |
| `regime == 'stable' && |drift| ≤ 0.5` | **Bull Put + Bear Call + Iron Condor** |
| `regime == 'volatile'` | **⚠️ Advertencia (WATCH)** |
| `netCredit < 0.20` | ❌ No generar (filtrado) |
| `shortStrike dentro de Expected Move` | ⚠️ Status = "WATCH" |

---

## Resumen Ejecutivo

### ¿Cómo funciona el sistema?

Tu sistema de señales es **inteligente y basado en datos institucionales**:

1. **Lee el mercado** mediante métricas GEX (cómo operan los dealers)
2. **Identifica el régimen** (estable vs volátil)
3. **Selecciona la estrategia** según el sesgo direccional (Net Drift)
4. **Elige strikes inteligentemente** cerca de los muros institucionales
5. **Filtra por calidad** (delta objetivo, prima mínima)
6. **Valida con volatilidad implícita** (Expected Move)
7. **Genera señales accionables** con alta probabilidad de éxito

### Ventajas del sistema

✅ **Objetivo**: No basado en emociones o intuición
✅ **Institucional**: Usa datos de posicionamiento de dealers
✅ **Probabilístico**: Busca alta PoP (70-85%)
✅ **Controlado**: Riesgo definido ($5 spread width)
✅ **0DTE optimizado**: Aprovecha decay de theta intradiario
✅ **Adaptativo**: Cambia estrategia según régimen de mercado

### Limitaciones

❌ **No infalible**: Alta PoP ≠ 100% de acierto
❌ **Eventos cisne negro**: No protege contra crashes súbitos
❌ **Requiere ejecución disciplinada**: Seguir las señales sin sobretrading
❌ **Comisiones**: Importante negociar buenas tarifas para 0DTE

---

## Ejemplo Práctico Completo

### Escenario del mercado (24 de enero, 2026, 10:00 AM ET)

```
SPX Precio actual: $5,950.25
```

### Datos GEX calculados:
```
Total GEX: +1,250,000 (Positivo → Régimen STABLE)
Gamma Flip: $5,925
Put Wall: $5,900 (soporte fuerte)
Call Wall: $6,000 (resistencia fuerte)
Net Institutional Delta: +8,500
Net Drift: +0.62 (Alcista)
```

### Expected Move calculado:
```
ATM Strike: $5,950
Call ATM: $18.50
Put ATM: $17.80
Expected Move: $36.30 (±0.61%)
Rango esperado: $5,913.70 - $5,986.30
```

---

### Señal #1: Bull Put Spread ✅ ACTIVE

**Razón:** `regime == 'stable' && drift > 0.5`

#### Selección de piernas:
```
1. Buscar PUTs con delta 0.15-0.25 cerca de Put Wall ($5,900)
2. Encontrado: PUT $5,895 con delta -0.20
3. Crear spread de 5 puntos: $5,895/$5,890
```

#### Piernas:
- **SELL** PUT $5,895 @ $3.20 (delta -0.20)
- **BUY** PUT $5,890 @ $1.10 (delta -0.16)

#### Métricas:
- **Net Credit:** $2.10 ✅ (> $0.20)
- **Max Profit:** $2.10 ($210 por spread)
- **Max Loss:** $2.90 ($290 por spread)
- **Risk/Reward:** 1:1.38
- **Probability:** 80% (1 - 0.20)

#### Validación Expected Move:
- Short strike $5,895 < Lower Bound $5,913.70 ✅
- **Estado:** **ACTIVE** (fuera del rango esperado)

#### Rationale generado:
> "El Put Wall en $5,900 actúa como un imán y soporte institucional clave para el mercado hoy. El strike corto de $5,895 se ha seleccionado para estar **FUERA de las fronteras del Movimiento Esperado (±$36.3)**. Bajo este régimen estable, los Dealers tienden a amortiguar las caídas cerca de estos niveles de soporte."

---

### Señal #2: Bear Call Spread ⚠️ WATCH

**Razón:** `regime == 'stable' && |drift| ≤ 0.5` (también se genera en régimen neutral)

#### Piernas:
- **SELL** CALL $5,975 @ $2.80 (delta 0.23)
- **BUY** CALL $5,980 @ $1.05 (delta 0.18)

#### Métricas:
- **Net Credit:** $1.75 ✅
- **Max Profit:** $1.75 ($175 por spread)
- **Max Loss:** $3.25 ($325 por spread)
- **Probability:** 77% (1 - 0.23)

#### Validación Expected Move:
- Short strike $5,975 < Upper Bound $5,986.30 ⚠️
- **Estado:** **WATCH** (dentro del rango esperado - mayor riesgo)

---

### Señal #3: Iron Condor ✅ ACTIVE

**Razón:** `regime == 'stable'`

#### Piernas (combinación de #1 + #2):
- **SELL** PUT $5,895 @ $3.20
- **BUY** PUT $5,890 @ $1.10
- **SELL** CALL $5,975 @ $2.80
- **BUY** CALL $5,980 @ $1.05

#### Métricas:
- **Net Credit:** $3.85 ($2.10 + $1.75)
- **Max Profit:** $3.85 ($385 por IC)
- **Max Loss:** $1.15 ($5 - $3.85) por lado = $115 máximo
- **Probability:** 77% (mínimo entre ambos lados)

#### Rationale:
> "Ideal para captura de Theta en un régimen estable con Dealers en Gamma Positiva. El precio se proyecta contenido dentro del rango de Muros ($5,900 - $6,000). Esta estrategia aprovecha la compresión de volatilidad implícita y la defensa de los Market Makers en ambos extremos."

---

### Dashboard mostrado al usuario:

```
📊 Stream Trade Signals
Última actualización: 10:00:15 AM

Stats:
Total Señales: 3
Activas: 2
Prob. Promedio: 78.0%
Mov. Esperado: ±$36.3 (0.61%)

Filtros: Todas | Activas | Prob. Min: 70%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[🟢 ACTIVE] Bull Put Spread
SPX | Exp: TODAY | Generated: 10:00 AM

Legs:
  SELL  PUT   $5,895   $3.20   Δ-0.20
  BUY   PUT   $5,890   $1.10   Δ-0.16

Crédito: $2.10 | Max Loss: $2.90 | PoP: 80% | R/R: 1:1.4

💡 El Put Wall en $5,900 actúa como soporte...
Régimen: stable | Drift: +0.62 | Walls: $5,900-$6,000

[Ver en Ladder →]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[⚠️ WATCH] Bear Call Spread
...

[✅ ACTIVE] Iron Condor
...
```

---

## Preguntas Frecuentes

### ¿Por qué a veces no hay señales?

**Posibles razones:**
1. Mercado cerrado (fuera de horario 9:30 AM - 3:45 PM ET)
2. Régimen volátil (GEX negativo) → Sistema emite advertencia
3. No se cumple el crédito mínimo de $0.20
4. No hay opciones con delta en el rango objetivo cerca de los walls
5. Error en la conexión con Schwab API

### ¿Puedo modificar los parámetros?

**Sí, los principales son:**

```typescript
// En tradeAlertService.ts línea 44
private readonly SPREAD_WIDTH = 5; // Cambiar anchura del spread

// Línea 226 y 331
if (netCredit <= 0.20) // Cambiar crédito mínimo

// Líneas 199-201, 303-306
delta >= 0.15 && delta <= 0.25 // Cambiar rango de delta

// Líneas 119, 125, 132
drift thresholds (0.5, -0.5) // Cambiar sensibilidad direccional
```

### ¿Cómo interpretar "ACTIVE" vs "WATCH"?

| Estado | Significado | Acción Sugerida |
|--------|-------------|-----------------|
| **ACTIVE** | Strike fuera del Expected Move | ✅ Ejecutar con confianza |
| **WATCH** | Strike dentro del Expected Move | ⚠️ Considerar, monitorear activamente |
| **CANCELLED** | (Manual) Señal descartada | ❌ No operar |

### ¿Qué hacer si el precio se acerca a mi strike?

```
Distancia al strike corto < 10 puntos:
  ├─ Opción 1: Cerrar a 50% ganancia (conservador)
  ├─ Opción 2: Rodar el spread a strike más lejano
  └─ Opción 3: Defender con ajuste (convertir a IC, butterfly, etc.)

Distancia < 5 puntos (15 min antes de cierre):
  └─ CERRAR INMEDIATAMENTE (evitar asignación)
```

---

---

## Persistencia y Resultados

El sistema ahora registra cada operación en la base de datos local para auditoría y mejora continua:

- **Registro de Entrada**: Precio de entrada, griegas al momento, métricas GEX y Quality Score.
- **Seguimiento Real-Time**: Actualización del PnL latente.
- **Cierre y Verificación**: El sistema verifica al cierre del mercado (o a la expiración) el resultado final (**WIN/LOSS**) y el PnL realizado neto.

---

## Conclusión

Tu sistema de señales v1.6 es **sofisticado y profesional**, combinando:
- 📊 **Análisis GEX institucional**
- 🎯 **Selección probabilística de strikes**
- 💰 **Filtros de calidad estrictos (Quality Scoring)**
- 🛡️ **Estrategia de Salida definida**
- ⚡ **Optimización para 0DTE**

**Úsalo como:** Una herramienta de **asistencia a decisiones** con un plan de trading completo incorporado.

---

**Documento actualizado:** 25 de Enero, 2026  
**Versión:** 1.1  
**Sistema:** Stream App v1.6
