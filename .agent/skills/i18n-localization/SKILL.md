---
name: i18n-localization
description: Internationalization (i18n) patterns using LanguageContext. Covers adding translations for Japanese, English, and Vietnamese, translation key conventions, and language switching.
---

# Internationalization (i18n)

## Architecture

This project uses a **React Context-based** i18n system (no external library):

**File**: `contexts/LanguageContext.tsx` (~37KB, comprehensive)

## Supported Languages

| Code | Language | Label |
|---|---|---|
| `ja` | Japanese (日本語) | Default |
| `en` | English | Alternate |
| `vn` | Vietnamese (Tiếng Việt) | Alternate |

## Usage in Components

```tsx
import { useLanguage } from '../contexts/LanguageContext';

const MyComponent = () => {
  const { t, language, toggleLanguage } = useLanguage();

  return (
    <div>
      <h1>{t('nav.dashboard')}</h1>
      <button onClick={toggleLanguage}>
        {t('buttons.language.' + language)}
      </button>
    </div>
  );
};
```

## Translation Key Structure

Keys are organized by feature area using dot notation:

```
app.title                    → App title
nav.dashboard                → Navigation labels
nav.tracking
nav.catiaLicense
nav.yearlyData
nav.totalView
nav.longTermPlan
nav.monthlyPlanActual
nav.periodManagement
nav.signOut

buttons.export               → Button labels
buttons.project
buttons.language.jp
buttons.language.en
buttons.language.vn

search.placeholder           → Search input

alerts.exportFailed          → Alert messages

table.headers.*              → Table column headers
table.status.*               → Status labels

kpi.*                        → Dashboard KPI labels

chart.*                      → Chart labels and legends
```

## Adding New Translations

### Step 1: Define keys in all three language objects

In `contexts/LanguageContext.tsx`, find the translations object and add entries for all three languages:

```typescript
const translations = {
  ja: {
    // ... existing
    'feature.newKey': '新しいキー',
  },
  en: {
    // ... existing
    'feature.newKey': 'New Key',
  },
  vn: {
    // ... existing
    'feature.newKey': 'Khóa mới',
  },
};
```

### Step 2: Use in component
```tsx
<span>{t('feature.newKey')}</span>
```

## Rules

1. **All user-facing strings** must use `t()` — no hardcoded text in JSX
2. **Key naming**: Use lowercase dot-notation (`section.subsection.label`)
3. **Consistency**: Always add all three language translations simultaneously
4. **Fallback**: If a key is missing, it returns the key itself
5. **Context**: Japanese is the primary language (business users are Japanese)

## Language Cycling Order

```
ja → en → vn → ja (cycles on toggle)
```

The `toggleLanguage` function cycles through languages in this order.
