# Finnon — Componentes de Cuenta

## Estructura

```
finnon/
├── theme/
│   └── tokens.ts              # Tokens de diseño (colores, tipografía, spacing, radii, sombras)
├── types/
│   └── account.ts             # Interfaces TypeScript para los datos
├── utils/
│   └── currency.ts            # Formateo de moneda (formato europeo)
└── components/
    └── account/
        ├── index.ts           # Barrel exports
        ├── AccountScreen.tsx  # Pantalla completa (composición)
        ├── AccountHeader.tsx  # Header con nombre de cuenta + acciones
        ├── BalanceHero.tsx    # Balance principal (hero)
        ├── PeriodSelector.tsx # Selector de período temporal
        ├── FlowCards.tsx      # Cards de ingresos / gastos
        ├── MonthlyChart.tsx   # Gráfico de barras evolución mensual
        ├── CategoryList.tsx   # Lista de categorías de gasto
        ├── RecentTransactions.tsx  # Últimos movimientos
        └── SectionHeader.tsx  # Header de sección reutilizable
```

## Setup de fuentes

Los tokens referencian **DM Sans** y **JetBrains Mono**. Para Expo managed:

```bash
npx expo install expo-font @expo-google-fonts/dm-sans @expo-google-fonts/jetbrains-mono
```

En tu `_layout.tsx` raíz:

```tsx
import { useFonts } from 'expo-font';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    DMSans: DMSans_400Regular,
    'DMSans-Medium': DMSans_500Medium,
    'DMSans-SemiBold': DMSans_600SemiBold,
    'DMSans-Bold': DMSans_700Bold,
    JetBrainsMono: JetBrainsMono_400Regular,
    'JetBrainsMono-Medium': JetBrainsMono_500Medium,
  });

  if (!fontsLoaded) return null;
  // ... resto del layout
}
```

## Dependencias

- `@expo/vector-icons` (ya incluido en Expo)
- `expo-router` (ya lo tienes)
- `expo-font` + las fuentes de Google Fonts

No se usa ninguna librería de gráficos externa. El `MonthlyChart`
está hecho con Views puras de React Native — esto es intencional
para evitar dependencias pesadas y mantener el control total del estilo.

## Cómo integrar

1. Copia `theme/`, `types/`, `utils/`, y `components/account/` a tu proyecto
2. Instala las fuentes (ver arriba)
3. Crea la ruta en Expo Router: `app/account/index.tsx`
4. Importa y renderiza `AccountScreen`
5. Reemplaza `MOCK_DATA` por tu fuente de datos real

## Rutas que necesitarás crear

El `AccountScreen` navega a estas rutas al interactuar:

| Acción                    | Ruta                          |
|---------------------------|-------------------------------|
| Tocar categoría           | `/account/category/[id]`      |
| "Ver todas" categorías    | `/account/categories`         |
| "Ver todos" movimientos   | `/account/transactions`       |
| Ajustes de cuenta         | `/account/settings`           |

## Notas de arquitectura

- **Tokens centralizados**: Si cambias la paleta o tipografía, solo tocas `tokens.ts`.
  Ningún componente tiene colores o tamaños hardcodeados.

- **Datos desacoplados del UI**: Los tipos en `account.ts` definen el contrato.
  Los componentes solo reciben props tipadas — no saben de dónde vienen los datos.

- **Gráfico sin librerías**: `MonthlyChart` es puro RN. Con pocos datos
  (1-2 meses) se ve bien. Con 12+ meses se ajusta automáticamente.
  Si en el futuro necesitas interactividad avanzada (tooltips, zoom),
  migrar a `react-native-svg` + `victory-native` es directo.

- **Formato europeo**: `currency.ts` formatea con punto como separador
  de miles y coma para decimales (14.334,48). Ajusta si necesitas
  soportar otros locales.
