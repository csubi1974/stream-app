# ✅ Quality Scoring System - Implementación Completa

## 🎯 Resumen

Se ha implementado exitosamente un **sistema de scoring de calidad** para todas las señales de trading generadas por el sistema.

---

## 📊 ¿Qué se Implementó?

### 1. **Nuevos Interfaces (TypeScript)**

```typescript
export interface QualityFactors {
    moveExhaustion: number;      // 0-10 (10 = fresh, 0 = exhausted)
    expectedMoveUsage: number;    // 0-10 (10 = not used, 0 = exceeded)
    wallProximity: number;        // 0-10 (10 = very close to wall)
    timeRemaining: number;        // 0-10 (10 = lots of time)
    regimeStrength: number;       // 0-10 (10 = very stable)
    driftAlignment: number;       // 0-10 (10 = perfect alignment)
}

export interface AlertMetadata {
    openPrice: number;
    moveFromOpen: number;
    movePercent: number;
    moveRatio: number;           // Cuántas veces se consumió el expected move
    wallDistance: number;
    hoursRemaining: number;
    generatedAtPrice: number;
}

export interface QualityMetrics {
    qualityScore: number;                               // 0-100
    qualityLevel: 'PREMIUM' | 'STANDARD' | 'AGGRESSIVE';
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    qualityFactors: QualityFactors;
    metadata: AlertMetadata;
}
```

### 2. **Actualización del TradeAlert**

```typescript
export interface TradeAlert {
    // ... campos existentes ...
    
    // NUEVOS CAMPOS:
    qualityScore?: number;
    qualityLevel?: 'PREMIUM' | 'STANDARD' | 'AGGRESSIVE';
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    qualityFactors?: QualityFactors;
    metadata?: AlertMetadata;
}
```

---

## 🧮 Algoritmo de Cálculo

### Factores de Calidad (0-10 cada uno)

#### 1. **Move Exhaustion** (Peso: 25%)
```
Move Ratio = |Precio Actual - Precio Apertura| / Expected Move

Score:
  < 0.5:  10 puntos (movimiento fresco)
  < 0.7:   8 puntos
  < 1.0:   6 puntos
  < 1.5:   4 puntos
  < 2.0:   2 puntos
  > 2.0:   0 puntos (movimiento agotado)
```

#### 2. **Expected Move  Usage** (Peso: 20%)
Similar a Move Exhaustion pero con umbrales ligeramente diferentes.

#### 3. **Wall Proximity** (Peso: 20%)
```
Wall Distance = |Strike Vendido - Wall|

Score:
  < 10:  10 puntos (muy cerca del muro)
  < 20:   9 puntos
  < 30:   7 puntos
  < 40:   5 puntos
  < 50:   3 puntos
  > 50:   1 punto (muy lejos del muro)
```

#### 4. **Time Remaining** (Peso: 15%)
```
Hours Until Close

Score:
  > 5:   10 puntos (mucho tiempo)
  > 3.5:  9 puntos
  > 2.5:  7 puntos
  > 1.5:  5 puntos
  > 1:    3 puntos
  < 1:    1 punto (expira pronto)
```

#### 5. **Regime Strength** (Peso: 10%)
```
Score:
  stable + |GEX| > 1M:  10 puntos
  stable + |GEX| > 500k: 8 puntos
  stable:                7 puntos
  neutral:               5 puntos
  volatile:              1 punto
```

#### 6. **Drift Alignment** (Peso: 10%)
```
Para Bull Put Spread (quiere drift positivo):
  drift > 1.0:  10 puntos
  drift > 0.7:   9 puntos
  drift > 0.5:   8 puntos
  drift > 0.2:   6 puntos
  drift > 0:     5 puntos
  drift < 0:     3 puntos (contra drift)

Para Bear Call Spread (quiere drift negativo):
  drift < -1.0:  10 puntos
  drift < -0.7:   9 puntos
  drift < -0.5:   8 puntos
  drift < -0.2:   6 puntos
  drift < 0:      5 puntos
  drift > 0:      3 puntos (contra drift)
```

---

### Quality Score Final

```typescript
qualityScore = Math.round(
    moveExhaustion * 0.25 * 10 +
    expectedMoveUsage * 0.20 * 10 +
    wallProximity * 0.20 * 10 +
    timeRemaining * 0.15 * 10 +
    regimeStrength * 0.10 * 10 +
    driftAlignment * 0.10 * 10
);
```

**Rango:** 0-100

---

### Quality Level

```typescript
if (qualityScore >= 80) → PREMIUM
else if (qualityScore >= 60) → STANDARD
else → AGGRESSIVE
```

---

### Risk Level

```typescript
if (moveRatio > 1.5 || hoursRemaining < 1.5) → HIGH
else if (moveRatio > 1.0 || hoursRemaining < 2.5 || wallDistance > 35) → MEDIUM
else → LOW
```

---

## 💻 Funciones Implementadas

### 1. `getHoursUntilClose()`
Calcula las horas restantes hasta las 4:00 PM ET (cierre del mercado).

### 2. `getOpenPrice(chain, currentPrice)`
Extrae el precio de apertura del chain de opciones, o usa el precio actual como fallback.

### 3. `calculateQualityScore(...)`
Función principal que calcula todos los factores de calidad y retorna el objeto `QualityMetrics`.

**Parámetros:**
- `gexContext`: Contexto GEX completo
- `shortStrike`: Strike vendido del spread
- `currentPrice`: Precio actual de SPX
- `openPrice`: Precio de apertura
- `expectedMove`: Movimiento esperado del día
- `wall`: Put Wall o Call Wall (según el tipo de spread)
- `type`: 'BULL_PUT' o 'BEAR_CALL'

---

## 📝 Cambios en Funciones Existentes

### `generateAlerts()`
- Ahora obtiene el `openPrice` del chain
- Agrega `openPrice` y `totalGEX` al `gexContext`
- Log mejorado muestra el precio de apertura

### `generateBullPutSpread()`
- Calcula `quality` antes del return
- Agrega campos de quality al objeto retornado

### `generateBearCallSpread()`
- Calcula `quality` antes del return
- Agrega campos de quality al objeto retornado

### `generateIronCondor()`
- Los spreads individuales ya tienen quality scores
- El Iron Condor heredará el score del spread más débil

---

## 📺 Salida en Console

El sistema ahora logea información detallada:

```
📊 Generating alerts for SPX | Regime: stable | Drift: +0.68 | Expected Move: ±32.50 | Open: $5900.00

📍 Bull Put Spread: Expected Range $5867 - $5932

📊 Quality Score: 85 (PREMIUM) | Risk: LOW | Move Ratio: 0.42× | Hours: 5.2
```

---

## 🎯 Ejemplo de Señal Completa

```json
{
  "id": "BPS-2026-01-25-5890",
  "strategy": "BULL_PUT_SPREAD",
  "strategyLabel": "Bull Put Spread",
  "underlying": "SPX",
  "expiration": "2026-01-25",
  "legs": [...],
  "netCredit": 2.30,
  "maxLoss": 2.70,
  "maxProfit": 2.30,
  "probability": 80,
  "riskReward": "1:1.2",
  "status": "ACTIVE",
  
  // NUEVO: Quality Scoring
  "qualityScore": 85,
  "qualityLevel": "PREMIUM",
  "riskLevel": "LOW",
  
  "qualityFactors": {
    "moveExhaustion": 10,        // Movimiento muy fresco
    "expectedMoveUsage": 10,     // Expected move no consumido
    "wallProximity": 9,          // Muy cerca del Put Wall
    "timeRemaining": 9,          // 5+ horas restantes
    "regimeStrength": 8,         // Régimen estable
    "driftAlignment": 8          // Buen alineamiento con drift
  },
  
  "metadata": {
    "openPrice": 5900.00,
    "moveFromOpen": 25.00,
    "movePercent": 0.42,
    "moveRatio": 0.77,           // Solo 77% del expected move usado
    "wallDistance": 10,
    "hoursRemaining": 5.3,
    "generatedAtPrice": 5925.00
  }
}
```

---

## ✅ Beneficios Implementados

### 1. **No se filtran señales** ✅
- Todas las señales se gener an
- Solo se clasifican por calidad

### 2. **Información Transparente** ✅
- El usuario ve EXACTAMENTE por qué una señal tiene cierto score
- 6 factores individuales mostrados

### 3. **Datos para Aprendizaje** ✅
- Metadata completa guardada en cada señal
- Análisis retrospectivo posible

### 4. **Flexibilidad del Usuario** ✅
- Usuario puede filtrar por quality level
- O ver todas y decidir basado en su perfil de riesgo

---

## 🔜 Próximos Pasos

### Backend: ✅ COMPLETADO

### Frontend: PENDIENTE
- [ ] Mostrar quality score y badges en Signals.tsx
- [ ] Agregar filtros por quality level
- [ ] Visualizar factores de calidad (breakdown)
- [ ] Mostrar metadata en tooltip/modal

### Base de Datos: PENDIENTE
- [ ] Agregar columnas a trade_alerts tabla
- [ ] Query de análisis retrospectivo

---

## 🎨 Diseño Propuesto para Frontend

### Badge de Calidad
```jsx
{alert.qualityLevel === 'PREMIUM' && (
    <span className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-xs font-bold rounded-full">
        ✨ PREMIUM {alert.qualityScore}
    </span>
)}

{alert.qualityLevel === 'STANDARD' && (
    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
        👍 STANDARD {alert.qualityScore}
    </span>
)}

{alert.qualityLevel === 'AGGRESSIVE' && (
    <span className="px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded-full">
        ⚠️ AGGRESSIVE {alert.qualityScore}
    </span>
)}
```

### Quality Breakdown
```jsx
<div className="quality-factors">
    <h4>Factores de Calidad</h4>
    {Object.entries(alert.qualityFactors).map(([key, value]) => (
        <div key={key} className="factor">
            <span>{formatFactorName(key)}</span>
            <ProgressBar value={value} max={10} />
            <span>{value}/10</span>
        </div>
    ))}
</div>
```

---

## 📊 Ejemplo de Análisis (Después de 1 mes)

```sql
SELECT 
    quality_level,
    COUNT(*) as total,
    AVG(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) * 100 as win_rate,
    AVG(profit) as avg_profit
FROM trade_alerts
WHERE generated_at > date('now', '-30 days')
GROUP BY quality_level;
```

**Resultado Esperado:**
```
PREMIUM:     86% Win Rate, $225 Avg Profit
STANDARD:    78% Win Rate, $195 Avg Profit
AGGRESSIVE:  64% Win Rate, $145 Avg Profit
```

Esto permite **ajustar el sistema** basado en evidencia real.

---

**Estado:** Backend Completado ✅  
**Próximo:** Actualizar Frontend para mostrar quality scores
