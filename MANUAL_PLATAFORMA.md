# Manual Completo y Documentación de la Plataforma TapeReading (v1.3)

## 1. Introducción
**TapeReading Platform** es una herramienta avanzada de análisis de mercado en tiempo real, diseñada específicamente para traders que operan con opciones 0DTE (Cero Días hasta el Vencimiento) y Swing Trading. La plataforma se centra en la "lectura de cinta" (Tape Reading) y el análisis de flujo institucional, permitiendo a los usuarios visualizar dónde se está posicionando el dinero inteligente ("Smart Money") en el mercado.

La versión actual **v1.3** incluye soporte completo en español e inglés, integración con APIs financieras (Schwab) y herramientas robustas de backtesting.

---

## 2. Ventajas Competitivas
¿Por qué operar con esta plataforma?

*   **Visión Institucional:** A diferencia de los gráficos tradicionales, esta plataforma revela la *intención* detrás del movimiento de precios mediante el análisis de bloques de órdenes, barridos (sweeps) y muros de opciones (gamma/call/put walls).
*   **Enfoque 0DTE:** Herramientas optimizadas para la velocidad y volatilidad de las opciones que vencen el mismo día.
*   **Detección en Tiempo Real:** Los escáneres funcionan con datos en vivo (vía WebSocket), alertando instantáneamente sobre anomalías de volumen o presión de compra/venta agresiva.
*   **Privacidad y Seguridad:** Las credenciales de API (como las de Charles Schwab) se almacenan estrictamente en el almacenamiento local (Local Storage) del navegador del usuario. Nunca se envían a servidores externos de terceros, garantizando la máxima seguridad.
*   **Simulación y Práctica:** El motor de Backtest permite grabar sesiones de mercado y reproducirlas para practicar estrategias sin arriesgar capital real.

---

## 3. Funcionalidades Detalladas

### A. Dashboard (Panel Principal)
El centro de comando para el trader.
*   **Estado del Mercado:** Indicador visual (Abierto/Cerrado) sincronizado con el horario de Nueva York (ET).
*   **Conexión WebSocket:** Monitor de latencia y estado de conexión de datos en vivo.
*   **Vistas Rápidas:** Acceso inmediato a escaleras de Calls y Puts del SPXW, y widgets resumidos de los escáneres principales.
*   **Estadísticas de Mercado:** Resumen de símbolos activos y velocidad de actualización.

### B. Escáneres de Mercado
La plataforma cuenta con tres motores de búsqueda especializados:

1.  **Escáner de Opciones 0DTE:**
    *   Filtra miles de contratos para encontrar aquellos con mayor actividad.
    *   **Métricas:** Volumen alto, Interés Abierto (OI), y Ratio Call/Put.
    *   **Muros:** Identifica niveles de soporte y resistencia basados en grandes concentraciones de contratos (Call/Put Walls).

2.  **Escáner de Volumen (Stocks):**
    *   Detecta acciones con volumen inusual.
    *   **RVOL (Volumen Relativo):** Encuentra acciones negociando multiples veces su volumen promedio normal (ej. >3x).
    *   **Presión:** Indicador visual de presión de compra vs. venta.

3.  **Escáner Swing (Tendencias):**
    *   Analiza el sesgo general del mercado (Market Bias) basado en SPY y QQQ.
    *   Mide la amplitud del mercado (Gainers vs. Losers) y el flujo de dinero hacia sectores específicos.

### C. Lectura de Cinta (Tape Reading & Ladder)
La herramienta más potente para la ejecución precisa.
*   **Options Ladder (Escalera):**
    *   Visualización vertical de precios (DOM - Depth of Market).
    *   Muestra Bids (Compradores) y Asks (Vendedores) en tiempo real.
    *   **Griegas:** Cálculo dinámico de Delta, Gamma y Theta para cada strike.
*   **Time & Sales (Tiempo y Ventas):**
    *   Registro cronológico de cada transacción ejecutada.
    *   **Clasificación de Agresión:** Colorea las operaciones según si fueron ejecuciones agresivas al Bid (Venta) o al Ask (Compra).
    *   **Cálculo de Presión:** Barra de porcentaje que muestra qué lado está dominando el flujo de órdenes actual.

### D. Alertas de Barrido (Sweep Alerts)
Sistema de detección de "Smart Money".
*   Identifica órdenes grandes que "barren" múltiples niveles de precios en los libros de órdenes.
*   Diferencia entre barridos de compra (Bullish - Verde) y de venta (Bearish - Rojo).
*   Configurable por umbral de contratos (ej. alertar solo si > 500 contratos).

### E. Motor de Backtesting
*   **Grabadora de Datos:** Permite guardar la sesión de trading actual en una base de datos local (IndexedDB).
*   **Modo Replay:** Reproduce sesiones grabadas a velocidad normal o acelerada para volver a vivir el mercado y probar estrategias fuera de horario.

### F. Watchlist (Lista de Seguimiento)
*   Gestión personalizada de símbolos favoritos.
*   Configuración de alertas de precio específicas para cada activo.

---

## 4. Información que Maneja
La plataforma procesa y visualiza los siguientes tipos de datos financieros:

*   **Cotizaciones de Nivel 1 y 2:** Precios Bid/Ask y tamaños de órdenes.
*   **Datos de Opciones:** Strikes, Vencimientos, Volatilidad Implícita (IV), Griegas.
*   **Ejecuciones (Trades):** Precio, Tamaño, Exchange y Timestamp de cada operación.
*   **Indicadores Derivados:** RVOL, VWAP (Precio Promedio Ponderado por Volumen), CVD (Delta de Volumen Acumulado).

---

## 5. Guía de Uso Rápida

### 1. Configuración Inicial
1.  Vaya a la pestaña **Configuración (Settings)**.
2.  Si desea operar con datos reales de Schwab, ingrese su `App Key` y `App Secret` en la sección "Configuración API".
3.  Seleccione su idioma preferido (Español/Inglés) en la esquina superior derecha.

### 2. Rutina Diaria
1.  **Pre-Mercado:** Revise el *Swing Scanner* para entender el sesgo general del mercado.
2.  **Apertura (9:30 AM ET):** Observe el *Volume Scanner* para detectar qué acciones tienen noticias o momentum.
3.  **Durante el Día:** Utilice el *0DTE Scanner* y las *Sweep Alerts* para encontrar oportunidades en SPX/SPY.
4.  **Ejecución:** Al encontrar una oportunidad, haga clic en "Ver Escalera" para abrir el *Options Ladder* y afinar su entrada observando el *Time & Sales*.

### 3. Personalización
*   Ajuste los umbrales de alerta en Configuración para reducir el ruido.
*   Active/desactive alertas sonoras según su entorno de trabajo.
*   Use el "Modo Replay" los fines de semana para mantener sus habilidades afiladas.

---

## 6. Requisitos del Sistema
*   **Navegador:** Google Chrome, Firefox, Edge o Safari (versiones recientes).
*   **Conexión:** Internet de banda ancha estable (crucial para datos WebSocket).
*   **Dispositivo:** Optimizado para escritorio/laptop, funcional en tablets.
