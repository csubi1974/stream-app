# Changelog

All notable changes to this project will be documented in this file.

## [1.7.4] - 2026-01-25

### Feat (Características Nuevas)
- **Engine Page Update**: Actualización de la documentación técnica en la página `/engine` para incluir las nuevas capacidades de Vanna, Charm y Quality Scoring.
- **Multilingual Consistency**: Asegurada la traducción completa de los nuevos conceptos institucionales en español e inglés.

## [1.7.3] - 2026-01-25

## [1.7.1] - 2026-01-25

### Feat (Características Nuevas)
- **Vanna Metrics Placeholder**: Preparación del HUD para métricas de volatilidad avanzada.
- **HUD Compact Layout**: Rediseño del panel de Inteligencia de Mercado para mostrar 8 métricas clave en una sola fila.

## [1.7.0] - 2026-01-25

### Feat (Características Nuevas)
- **Dynamic Delta Target**: Implementación de lógica adaptativa para la selección de Strikes en 0DTE:
    - **Ajuste por Volatilidad**:
        - IV Alta (>25): Target Δ **0.25** (Vender más OTM para capturar primas infladas).
        - IV Baja (<12): Target Δ **0.15** (Vender más cerca/conservador, protegiendo gamma risk).
    - **Protección por Drift**:
        - Si el movimiento intradía (Drift) supera el **0.7%**, el sistema fuerza un delta conservador (**0.20**) para evitar posiciones agresivas contra tendencia.
    - **Visualización en Scanner**: Nuevos indicadores en el dashboard mostrando el Target Δ, IV actual y Drift en tiempo real.

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
