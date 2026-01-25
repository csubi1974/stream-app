# Changelog

All notable changes to this project will be documented in this file.

## [1.6.0] - 2026-01-25

### Feat (Características Nuevas)
- **Quality Scoring System**: Algoritmo inteligente que clasifica cada señal en PREMIUM, STANDARD o AGGRESSIVE basado en 6 factores ponderados (Move Exhaustion, Expected Move Usage, Wall Proximity, Time Remaining, Regime Strength, Drift Alignment).
- **Exit Strategy**: Cada señal ahora incluye instrucciones claras de salida:
    - **Target Profit**: Generalmente 100% (Hold to Expiration) para credit spreads.
    - **Stop Loss**: Nivel de precio técnico basado en ruptura de estructura.
    - **Time Exit**: Regla de las 3:45 PM para mitigar Gamma Risk.
- **Database Persistence**: Se agregaron columnas a la tabla `trade_alerts` para guardar el puntaje de calidad, nivel de riesgo y criterios de salida para futuro análisis.
- **UI de Señales**:
    - Nuevos filtros por Calidad y Riesgo.
    - Badges visuales para identificación rápida.
    - Barra de progreso visual para entender los factores de calidad de cada señal.

### Fix
- Restaurada la integridad del módulo de base de datos (`sqlite.ts`) tras una corrupción de archivo.

## [1.5.1] - 2025-12-XX
- Mejoras en la detección de regímenes de mercado.
- Optimización de cálculos GEX.

---
