# OS業務受託管理システム - ダッシュボード設計仕様書

**Dashboard Design Specification Document**

---

**Version:** 2.0  
**Date:** December 2024  
**Author:** Tuấn Anh (Esutech Co., Ltd.)  
**Status:** Production Ready

---

## 📋 目次 (Table of Contents)

1. [ダッシュボード概要](#1-ダッシュボード概要)
2. [レイアウト構造](#2-レイアウト構造)
3. [カード詳細仕様](#3-カード詳細仕様)
4. [プロジェクトパフォーマンステーブル](#4-プロジェクトパフォーマンステーブル)
5. [財務サマリーフッター](#5-財務サマリーフッター)
6. [カラーシステム](#6-カラーシステム)
7. [タイポグラフィー](#7-タイポグラフィー)
8. [データフロー](#8-データフロー)
9. [レスポンシブデザイン](#9-レスポンシブデザイン)
10. [実装メモ](#10-実装メモ)

---

## 1. ダッシュボード概要

### 🎯 目的 (Purpose)

OS部門の業務パフォーマンスと財務状況をリアルタイムで可視化し、CADライセンスコストを考慮した実収益（純収益）を正確に管理するための総合ダッシュボード。

### 主要機能

- ✅ 計画時間と実績時間のトラッキング
- ✅ CADライセンスコストの管理と自動計算
- ✅ 総収益（Gross Revenue）と純収益（Net Revenue）の可視化
- ✅ プロジェクト別パフォーマンス分析
- ✅ 損益分岐点とコスト分析
- ✅ 日本通貨フォーマット（¥ and 万円）対応
- ✅ リアルタイムデータ更新

### ターゲットユーザー

- **Primary:** OS部門マネージャー（編集・管理権限）
- **Secondary:** 経営層（閲覧専用）
- **Technical Level:** 非技術者、Excel経験者
- **Language:** 日本語・ベトナム語バイリンガル環境

---

## 2. レイアウト構造

### 全体構成 (Overall Structure)

```
┌─────────────────────────────────────────────────────────────────┐
│                         HEADER BAR                               │
│        Title: OS業務受託ダッシュボード | Period Selector         │
└─────────────────────────────────────────────────────────────────┘

┌────────────┬────────────┬────────────┬────────────┐
│  CARD 1    │  CARD 2    │  CARD 3    │  CARD 4    │  Row 1
│ 総計画時間   │ 総実績時間   │  達成率     │  時間単価   │  4 Cards
└────────────┴────────────┴────────────┴────────────┘

┌─────────────────────────────────────────────────────────────────┐
│             LICENSE COST MANAGEMENT CARD                         │  Row 2
│  [コンピュータ台数] [1台ライセンス料] [年間総額（自動計算）]      │  Full Width
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┬──────────────────────────────┐
│         CARD 5               │         CARD 6               │  Row 3
│     総収益（計画）            │     総収益（実績）            │  2 Cards
│   Gross Revenue (Plan)       │   Gross Revenue (Actual)     │  (2 col each)
└──────────────────────────────┴──────────────────────────────┘

┌──────────────────────────────┬──────────────────────────────┐
│         CARD 7               │         CARD 8               │  Row 4
│     純収益（計画）            │     純収益（実績）            │  2 Cards
│    Net Revenue (Plan)        │    Net Revenue (Actual)      │  (2 col each)
└──────────────────────────────┴──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 COST ANALYSIS CARD                               │  Row 5
│  [License/Hour] [Net Rate] [Break-even Hours] (3 metrics)       │  Full Width
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            PROJECT PERFORMANCE TABLE                             │  Row 6
│  Company | Project | Plan | Actual | Rate | Revenue | Status    │  Full Width
│  ─────────────────────────────────────────────────────────      │  
│  [Project rows...]                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               FINANCIAL SUMMARY FOOTER                           │  Row 7
│  [総収益] [ライセンス] [純収益] [利益率] (4 metrics)              │  Full Width
└─────────────────────────────────────────────────────────────────┘
```

### レイアウトルール

| 項目 | 仕様 |
|------|------|
| **グリッドシステム** | 4列グリッド (1 row = 4 cards) |
| **カード配置** | 横並び（horizontal layout） |
| **カード間隔** | 20px gap |
| **最大幅** | 1400px container |
| **パディング** | Container: 40px, Cards: 20-25px |
| **背景色** | Page: #F8F9FA, Cards: #FFFFFF |

### レスポンシブブレークポイント

| Device | Width | Columns | Layout |
|--------|-------|---------|--------|
| **Desktop** | ≥1280px | 4 columns | 4 cards per row |
| **Laptop** | 1024-1279px | 4 columns | 4 cards per row, smaller fonts |
| **Tablet** | 768-1023px | 2 columns | 2 cards per row, horizontal scroll for table |
| **Mobile** | <768px | 1 column | Vertical stack, simplified table |

---

## 3. カード詳細仕様

### Row 1: 基本メトリクス（4 Cards - Horizontal）

#### Card 1: 総計画時間

**Display:**
```
総計画時間
14,690 h
Total planned hours
```

| 項目 | 仕様 |
|------|------|
| **Data Source** | `sum(project_hours.hours WHERE type='plan')` |
| **Icon** | Clock ⏰ |
| **Color** | Blue (#3B82F6) |
| **Border** | Left border 4px blue |
| **Background** | White |
| **Value Format** | `{number.toLocaleString()}h` |
| **Update** | Real-time |

---

#### Card 2: 総実績時間

**Display:**
```
総実績時間
782 h
5.3% 達成 [↓]
```

| 項目 | 仕様 |
|------|------|
| **Data Source** | `sum(project_hours.hours WHERE type='actual')` |
| **Icon** | CheckCircle ✓ |
| **Color** | Green (#10B981) |
| **Border** | Left border 4px green |
| **Subtitle** | Achievement rate + trend icon |
| **Trend Logic** | Up: ≥100%, Neutral: 80-99%, Down: <80% |
| **Update** | Real-time |

---

#### Card 3: 達成率

**Display:**
```
達成率
5.3%
残り 13,908h
```

| 項目 | 仕様 |
|------|------|
| **Formula** | `(totalActualHours / totalPlanHours) × 100` |
| **Icon** | BarChart3 📊 |
| **Color Logic** | Red: <80%, Yellow: 80-99%, Green: ≥100% |
| **Border** | Left border 4px (dynamic color) |
| **Subtitle** | Remaining hours: `plan - actual` |
| **Value Format** | `{rate.toFixed(1)}%` |

**Color Rules:**
```javascript
if (achievementRate >= 100) return 'green';
if (achievementRate >= 80) return 'yellow';
return 'red';
```

---

#### Card 4: 時間単価

**Display:**
```
時間単価
¥2,300
Per hour rate
```

| 項目 | 仕様 |
|------|------|
| **Data Source** | `settings.unit_price` |
| **Icon** | DollarSign 💰 |
| **Color** | Purple (#8B5CF6) |
| **Border** | Left border 4px purple |
| **Editable** | Via settings modal |
| **Default Value** | ¥2,300 |

---

### Row 2: CADライセンスコスト管理（Full-width Card）

**Display Layout (Horizontal 3 Fields):**
```
┌──────────────────────────────────────────────────────────────┐
│  CADライセンスコスト管理                                       │
│  ┌──────────────┬──────────────┬──────────────────────────┐  │
│  │コンピュータ台数│1台ライセンス料│ 年間ライセンス総額         │  │
│  │              │              │                          │  │
│  │      7       │ ¥2,517,143   │   ¥17,620,000           │  │
│  │      台      │              │   1,762万円             │  │
│  └──────────────┴──────────────┴──────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

#### Field Specifications

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| **numberOfComputers** | Number Input | 7 | Integer > 0 | コンピュータ台数 |
| **pricePerComputer** | Currency Input | ¥2,517,143 | Number ≥ 0 | 1台あたりライセンス料 |
| **totalLicenseCost** | Calculated (Read-only) | ¥17,620,000 | Auto-calc | 年間ライセンス総額 |

#### Calculation Formula

```javascript
totalLicenseCost = numberOfComputers × pricePerComputer

Example:
7 × ¥2,517,143 = ¥17,620,000
```

#### Styling Specifications

| 項目 | 仕様 |
|------|------|
| **Background** | Linear gradient: Purple (#9333ea) to Purple-dark (#7c3aed) |
| **Text Color** | White |
| **Field Background** | White with 20% opacity (rgba(255,255,255,0.2)) |
| **Layout** | 3 columns, equal width |
| **Padding** | 20-25px |
| **Border Radius** | 8px |
| **Icon** | Cpu 💻 |

#### Display Format

- **Field 3 (Total Cost):** Show both formats:
  - Primary: `¥17,620,000` (full yen)
  - Secondary: `1,762万円` (man format)

---

### Row 3: 総収益（2 Cards - Each spans 2 columns）

#### Card 5: 総収益（計画）- Gross Revenue (Plan)

**Display:**
```
総収益（計画）
Gross Revenue (Plan)

¥33,787,000
3,378.7万円

─────────────────────
計画時間 × 単価
14,690h × ¥2,300
```

| 項目 | 仕様 |
|------|------|
| **Formula** | `grossRevenuePlan = totalPlanHours × unitPrice` |
| **Example** | `14,690h × ¥2,300 = ¥33,787,000` |
| **Background** | Blue gradient (#3b82f6 → #2563eb) |
| **Text Color** | White |
| **Icon** | TrendingUp ↗ |
| **Grid Span** | 2 columns |

**Display Format:**
- **Primary Value:** `¥{amount.toLocaleString()}` (36px, bold)
- **Secondary Value:** `{(amount/10000).toFixed(1)}万円` (20px)
- **Breakdown:** Show calculation formula in small text

---

#### Card 6: 総収益（実績）- Gross Revenue (Actual)

**Display:**
```
総収益（実績）
Gross Revenue (Actual)

¥1,798,600
179.9万円

─────────────────────
実績時間 × 単価
782h × ¥2,300
```

| 項目 | 仕様 |
|------|------|
| **Formula** | `grossRevenueActual = totalActualHours × unitPrice` |
| **Example** | `782h × ¥2,300 = ¥1,798,600` |
| **Background** | Green gradient (#10b981 → #059669) |
| **Text Color** | White |
| **Icon** | DollarSign 💰 |
| **Grid Span** | 2 columns |

---

### Row 4: 純収益（2 Cards - Each spans 2 columns）⭐ KEY METRICS

#### Card 7: 純収益（計画）- Net Revenue (Plan)

**Display:**
```
純収益（計画）
Net Revenue (Plan) after license cost

¥16,167,000
1,616.7万円

─────────────────────
総収益（計画）      ¥33,787,000
− ライセンスコスト  ¥17,620,000
═══════════════════════════════
純収益             ¥16,167,000
利益率             47.8%
```

| 項目 | 仕様 |
|------|------|
| **Formula** | `netRevenuePlan = grossRevenuePlan - totalLicenseCost` |
| **Example** | `¥33,787,000 - ¥17,620,000 = ¥16,167,000` |
| **Background** | White |
| **Border** | Left border 8px Indigo (#6366f1) |
| **Grid Span** | 2 columns |

**Profit Margin Calculation:**
```javascript
profitMarginPlan = (netRevenuePlan / grossRevenuePlan) × 100
Example: (¥16,167,000 / ¥33,787,000) × 100 = 47.8%
```

**Breakdown Display:**
1. 総収益（計画）: Right-aligned, normal weight
2. − ライセンスコスト: Red text, bold
3. Border separator
4. 純収益: Bold
5. 利益率: Indigo color, bold

---

#### Card 8: 純収益（実績）- Net Revenue (Actual) ⭐

**Display:**
```
純収益（実績）
Net Revenue (Actual) after license cost

-¥15,821,400
-1,582.1万円

─────────────────────
総収益（実績）      ¥1,798,600
− ライセンスコスト  ¥17,620,000
═══════════════════════════════
純収益             -¥15,821,400
利益率             -879.7%
```

| 項目 | 仕様 |
|------|------|
| **Formula** | `netRevenueActual = grossRevenueActual - totalLicenseCost` |
| **Example** | `¥1,798,600 - ¥17,620,000 = -¥15,821,400` |
| **Background** | White |
| **Border** | Dynamic: Green if positive, Red if negative |
| **Grid Span** | 2 columns |

**Dynamic Styling:**
```javascript
if (netRevenueActual > 0) {
  borderColor = '#10B981'; // Green
  textColor = '#065f46';   // Dark green
} else {
  borderColor = '#EF4444'; // Red
  textColor = '#dc2626';   // Dark red
}
```

**Profit Margin Calculation:**
```javascript
profitMarginActual = (netRevenueActual / grossRevenueActual) × 100
Example: (-¥15,821,400 / ¥1,798,600) × 100 = -879.7%
```

---

### Row 5: コスト分析（Full-width Card, 3 Metrics Horizontal）

**Display Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠ コスト分析 (Cost Analysis)                                │
│                                                              │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │1時間あたり   │  実質時間単価 │  損益分岐点時間           │ │
│  │ライセンスコスト│              │                          │ │
│  │              │              │                          │ │
│  │   ¥1,199     │   ¥1,101     │      7,661h             │ │
│  │              │              │                          │ │
│  │License cost  │ Net hourly   │  Break-even hours       │ │
│  │  per hour    │    rate      │                          │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Metric Specifications

| Metric | Formula | Example | Description |
|--------|---------|---------|-------------|
| **1時間あたりライセンスコスト** | `totalLicenseCost / totalPlanHours` | `¥17,620,000 / 14,690h = ¥1,199/h` | License cost per hour |
| **実質時間単価** | `unitPrice - licenseCostPerHour` | `¥2,300 - ¥1,199 = ¥1,101/h` | Net hourly rate after license cost |
| **損益分岐点時間** | `totalLicenseCost / unitPrice` | `¥17,620,000 / ¥2,300 = 7,661h` | Break-even hours needed |

#### Styling

| 項目 | 仕様 |
|------|------|
| **Background** | White |
| **Border** | 2px solid Orange (#f97316) |
| **Icon** | AlertCircle ⚠ (Orange) |
| **Layout** | 3 equal-width columns (horizontal) |
| **Metric Background** | Light gray (#f8fafc) |
| **Value Font Size** | 28px, bold |
| **Label Font Size** | 12px |

---

## 4. プロジェクトパフォーマンステーブル

### Table Structure

| Column | Field Name | Type | Width | Align | Special |
|--------|-----------|------|-------|-------|---------|
| **1** | 社名 / Company | Text + subtitle | 200px | Left | Bold company name<br>Software in small text below |
| **2** | 業務内容 / Project | Text | 250px | Left | Wrap text if long |
| **3** | 計画時間 | Number | 120px | Right | Monospace font<br>Add "h" suffix |
| **4** | 実績時間 | Number | 120px | Right | **Bold**, monospace<br>Add "h" suffix |
| **5** | 達成率 | Percentage | 100px | Right | Color badge with % |
| **6** | 総収益 | Currency | 180px | Right | ¥ format (primary)<br>万円 (secondary below) |
| **7** | Status | Icon | 80px | Center | Color-coded icon |

### Column Details

#### Column 1: 社名 / Company
```
ISJ (HCM)
CATIA
```
- **Font:** 14px bold (company), 11px normal (software)
- **Color:** #0f172a (company), #64748b (software)

#### Column 4: 実績時間 (Actual Hours)
```
782h
```
- **Font:** 14px bold, monospace
- **Color:** #0f172a
- **Highlight:** This is the key metric

#### Column 5: 達成率 (Achievement Rate)

**Badge Colors:**

| Achievement | Badge Color | Background | Text Color |
|-------------|-------------|------------|------------|
| ≥ 100% | Excellent | #d1fae5 | #065f46 |
| 80-99% | Good | #fef3c7 | #92400e |
| 1-79% | Warning | #fed7aa | #9a3412 |
| 0% | Pending | #f1f5f9 | #475569 |

**Display Format:**
```html
<badge color="green">100.0%</badge>
<badge color="yellow">85.3%</badge>
<badge color="orange">45.2%</badge>
<badge color="gray">0%</badge>
```

#### Column 6: 総収益 (Gross Revenue)

**Display Format:**
```
¥1,798,600
179.9万円
```
- **Primary:** `¥{amount.toLocaleString()}` (14px, bold)
- **Secondary:** `{(amount/10000).toFixed(1)}万円` (11px, gray)

#### Column 7: Status

**Icon Mapping:**

| Achievement | Icon | Color |
|-------------|------|-------|
| ≥ 100% | CheckCircle ✓ | #10b981 |
| 80-99% | CheckCircle ✓ | #f59e0b |
| 1-79% | AlertCircle ⚠ | #f97316 |
| 0% | Minus − | #94a3b8 |

### Table Header

| 項目 | 仕様 |
|------|------|
| **Background** | Blue gradient (#1e40af) |
| **Text Color** | White |
| **Font Size** | 12px |
| **Font Weight** | 600 (semibold) |
| **Text Transform** | Uppercase |
| **Padding** | 12px |
| **Position** | Sticky (stays visible on scroll) |

### Table Body

| 項目 | 仕様 |
|------|------|
| **Row Background** | White |
| **Row Hover** | #f8fafc |
| **Border** | Bottom 1px solid #e2e8f0 |
| **Padding** | 10-12px |
| **Font Size** | 14px |

### Table Footer (Total Row)

```
┌─────────┬──────────┬──────┬──────┬──────┬────────────┬────────┐
│ Total   │          │14,690h│ 782h │ 5.3% │¥1,798,600 │        │
│         │          │      │      │      │179.9万円   │        │
└─────────┴──────────┴──────┴──────┴──────┴────────────┴────────┘
```

| 項目 | 仕様 |
|------|------|
| **Background** | #f9fafb |
| **Font Weight** | Bold |
| **Content** | Columns 1-2: "Total" text<br>Columns 3-6: Sum of all projects<br>Column 7: Empty |

---

## 5. 財務サマリーフッター

### Display Layout (4 Metrics Horizontal)

```
┌─────────────────────────────────────────────────────────────┐
│  財務サマリー (Financial Summary)                             │
│                                                              │
│  ┌───────────┬───────────┬───────────┬───────────────────┐  │
│  │総収益（実績）│ライセンス │純収益（実績）│   利益率         │  │
│  │           │   コスト   │           │                  │  │
│  │  179.9万  │  1,762万  │-1,582.1万 │    -879.7%       │  │
│  │           │           │           │                  │  │
│  │¥1,798,600 │¥17,620,000│-¥15,821,400│  Profit Margin  │  │
│  └───────────┴───────────┴───────────┴───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Specifications

| 項目 | 仕様 |
|------|------|
| **Background** | Linear gradient: Indigo (#4f46e5) to Purple (#7c3aed) |
| **Text Color** | White |
| **Layout** | 4 equal-width columns (horizontal) |
| **Padding** | 25px |
| **Border Radius** | 8px |

### Metric Display Format

Each metric:
- **Title:** 11px, opacity 0.8
- **Primary Value:** 32px bold (万円 format)
- **Secondary Value:** 11px, opacity 0.7 (¥ format)

### Negative Value Styling

```javascript
if (value < 0) {
  textColor = '#fca5a5'; // Light red
} else {
  textColor = 'white';
}
```

**Example:**
- ライセンスコスト: Red text (cost)
- 純収益（実績）: Red text if negative, green if positive

---

## 6. カラーシステム

### Primary Colors

| Color Name | Hex Code | Tailwind | Usage |
|------------|----------|----------|--------|
| **Blue** | #3B82F6 | blue-500 | Primary actions, Card 1, Card 5 |
| **Green** | #10B981 | green-500 | Success, Card 2, Card 6, Positive values |
| **Indigo** | #6366F1 | indigo-500 | Card 7 (Net Revenue Plan) |
| **Emerald** | #10B981 | emerald-500 | Card 8 when positive |
| **Red** | #EF4444 | red-500 | Danger, Card 8 when negative, Alerts |
| **Orange** | #F97316 | orange-500 | Warning, Cost analysis |
| **Purple** | #8B5CF6 | purple-500 | Card 4, License cost card |
| **Yellow** | #F59E0B | yellow-500 | Warning state (80-99% achievement) |

### Neutral Colors

| Color Name | Hex Code | Tailwind | Usage |
|------------|----------|----------|--------|
| **Background** | #F8F9FA | gray-50 | Page background |
| **White** | #FFFFFF | white | Card backgrounds |
| **Gray 500** | #64748B | gray-500 | Secondary text, labels |
| **Gray 600** | #475569 | gray-600 | Tertiary text |
| **Gray 900** | #0F172A | gray-900 | Primary text, headings |
| **Light Gray** | #F1F5F9 | gray-100 | Table rows, backgrounds |

### Gradient Definitions

#### Blue Gradient
```css
background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
```
**Usage:** Card 5 (Gross Revenue Plan)

#### Green Gradient
```css
background: linear-gradient(135deg, #10b981 0%, #059669 100%);
```
**Usage:** Card 6 (Gross Revenue Actual)

#### Purple Gradient
```css
background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
```
**Usage:** License Cost Management Card

#### Indigo-Purple Gradient
```css
background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
```
**Usage:** Financial Summary Footer

### Status Colors

| Status | Background | Text Color | Border |
|--------|-----------|------------|--------|
| **Excellent (≥100%)** | #d1fae5 | #065f46 | #10b981 |
| **Good (80-99%)** | #fef3c7 | #92400e | #f59e0b |
| **Warning (<80%)** | #fed7aa | #9a3412 | #f97316 |
| **Pending (0%)** | #f1f5f9 | #475569 | #94a3b8 |

---

## 7. タイポグラフィー

### Font Families

| Purpose | Font Family |
|---------|-------------|
| **Primary Text** | 'Segoe UI', 'Meiryo', sans-serif |
| **Numbers** | 'Consolas', 'Courier New', monospace |
| **Japanese** | 'Meiryo', 'MS PGothic', sans-serif |

### Font Size Scale

| Element | Size | Weight | Line Height | Example |
|---------|------|--------|-------------|---------|
| **Page Title** | 32px (2xl) | Bold (700) | 1.2 | OS業務受託管理 |
| **Section Title** | 24px (xl) | Bold (700) | 1.3 | プロジェクト一覧 |
| **Card Title** | 14px (sm) | Medium (500) | 1.4 | 総計画時間 |
| **Card Value (XL)** | 36-40px (3xl-4xl) | Bold (700) | 1.0 | ¥33,787,000 |
| **Card Value (L)** | 28-32px (2xl-3xl) | Bold (700) | 1.0 | 14,690h |
| **Japanese Units** | 20px (lg) | Medium (500) | 1.2 | 3,378.7万円 |
| **Card Subtitle** | 12px (xs) | Normal (400) | 1.4 | Total planned hours |
| **Table Header** | 12px (xs) | Semibold (600) | 1.4 | COMPANY (uppercase) |
| **Table Cell** | 14px (sm) | Normal (400) | 1.5 | ISJ (HCM) |
| **Numbers (Mono)** | 14px (sm) | Semibold (600) | 1.5 | 1,234,567 |

### Typography Guidelines

#### Numbers Display
- Use monospace font for all numeric values
- Add thousand separators: `1,234,567`
- Align right in tables
- Bold for emphasis (actual hours, totals)

#### Japanese Currency Format
```
Primary:   ¥33,787,000    (36px, bold)
Secondary: 3,378.7万円     (20px, medium)
```

#### Bilingual Labels
```
総収益（計画）              (14px, Japanese)
Gross Revenue (Plan)       (11px, English, lighter)
```

---

## 8. データフロー

### Database Schema

```sql
-- Projects table
projects
├── id (UUID)
├── company (TEXT)
├── project_type (TEXT)
├── software (TEXT)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

-- Project hours table
project_hours
├── id (UUID)
├── project_id (UUID FK)
├── period (TEXT) -- 'H1-2025', 'H2-2025'
├── month (INTEGER) -- 1-12
├── type (TEXT) -- 'plan' or 'actual'
├── hours (INTEGER)
└── updated_at (TIMESTAMP)

-- License costs table
license_costs
├── id (UUID)
├── period (TEXT)
├── number_of_computers (INTEGER)
├── price_per_computer (DECIMAL)
├── total_cost (DECIMAL) -- Generated column
└── updated_at (TIMESTAMP)

-- Settings table
settings
├── id (UUID)
├── key (TEXT)
├── value (JSONB)
└── updated_at (TIMESTAMP)
```

### Calculation Flow

#### Step 1: Get Base Data
```javascript
// From database
const projects = await db.projects.findAll();
const projectHours = await db.project_hours.findAll({ period: activePeriod });
const unitPrice = await db.settings.get('unit_price');
const licenseConfig = await db.license_costs.findOne({ period: activePeriod });
```

#### Step 2: Calculate Totals
```javascript
const totalPlanHours = projectHours
  .filter(h => h.type === 'plan')
  .reduce((sum, h) => sum + h.hours, 0);

const totalActualHours = projectHours
  .filter(h => h.type === 'actual')
  .reduce((sum, h) => sum + h.hours, 0);

const totalLicenseCost = 
  licenseConfig.number_of_computers * licenseConfig.price_per_computer;
```

#### Step 3: Calculate Achievement
```javascript
const achievementRate = (totalActualHours / totalPlanHours) * 100;
```

#### Step 4: Calculate Gross Revenue
```javascript
const grossRevenuePlan = totalPlanHours * unitPrice;
const grossRevenueActual = totalActualHours * unitPrice;
```

#### Step 5: Calculate Net Revenue
```javascript
const netRevenuePlan = grossRevenuePlan - totalLicenseCost;
const netRevenueActual = grossRevenueActual - totalLicenseCost;
```

#### Step 6: Calculate Profit Margins
```javascript
const profitMarginPlan = (netRevenuePlan / grossRevenuePlan) * 100;
const profitMarginActual = (netRevenueActual / grossRevenueActual) * 100;
```

#### Step 7: Calculate Cost Metrics
```javascript
const licenseCostPerHour = totalLicenseCost / totalPlanHours;
const netHourlyRate = unitPrice - licenseCostPerHour;
const breakEvenHours = totalLicenseCost / unitPrice;
```

### Complete Formula Reference

| Metric | Formula | Example |
|--------|---------|---------|
| **Total Plan Hours** | `sum(hours where type='plan')` | 14,690h |
| **Total Actual Hours** | `sum(hours where type='actual')` | 782h |
| **Achievement Rate** | `(actual / plan) × 100` | (782 / 14,690) × 100 = 5.3% |
| **Total License Cost** | `computers × pricePerComputer` | 7 × ¥2,517,143 = ¥17,620,000 |
| **Gross Revenue (Plan)** | `planHours × unitPrice` | 14,690 × ¥2,300 = ¥33,787,000 |
| **Gross Revenue (Actual)** | `actualHours × unitPrice` | 782 × ¥2,300 = ¥1,798,600 |
| **Net Revenue (Plan)** | `grossPlan - licenseCost` | ¥33,787,000 - ¥17,620,000 = ¥16,167,000 |
| **Net Revenue (Actual)** | `grossActual - licenseCost` | ¥1,798,600 - ¥17,620,000 = -¥15,821,400 |
| **Profit Margin (Plan)** | `(netPlan / grossPlan) × 100` | (¥16,167,000 / ¥33,787,000) × 100 = 47.8% |
| **Profit Margin (Actual)** | `(netActual / grossActual) × 100` | (-¥15,821,400 / ¥1,798,600) × 100 = -879.7% |
| **License Cost/Hour** | `licenseCost / planHours` | ¥17,620,000 / 14,690 = ¥1,199/h |
| **Net Hourly Rate** | `unitPrice - licenseCost/hour` | ¥2,300 - ¥1,199 = ¥1,101/h |
| **Break-even Hours** | `licenseCost / unitPrice` | ¥17,620,000 / ¥2,300 = 7,661h |

---

## 9. レスポンシブデザイン

### Breakpoint Strategy

| Breakpoint | Width | Grid | Layout Strategy |
|------------|-------|------|-----------------|
| **Desktop** | ≥1280px | 4 cols | Full layout, 4 cards per row |
| **Laptop** | 1024-1279px | 4 cols | Same as desktop, slightly smaller fonts |
| **Tablet** | 768-1023px | 2 cols | 2 cards per row, stack some sections |
| **Mobile** | <768px | 1 col | Vertical stack everything |

### Desktop Layout (≥1280px)
```
[Card1] [Card2] [Card3] [Card4]        (4 columns)
[    License Cost Card (full)    ]     (full width)
[  Gross Plan  ] [  Gross Actual ]     (2 + 2 columns)
[   Net Plan   ] [  Net Actual   ]     (2 + 2 columns)
[     Cost Analysis (full)       ]     (full width)
[      Project Table (full)      ]     (full width)
[   Financial Summary (full)     ]     (full width)
```

### Tablet Layout (768-1023px)
```
[Card1] [Card2]                        (2 columns)
[Card3] [Card4]                        (2 columns)
[  License Cost  ]                     (stack vertically)
[  Gross Plan    ]                     (full width)
[  Gross Actual  ]                     (full width)
[  Net Plan      ]                     (full width)
[  Net Actual    ]                     (full width)
[  Cost Analysis ]                     (full width)
[  Project Table ] → horizontal scroll
[Financial Summary]                    (full width)
```

### Mobile Layout (<768px)
```
[Card1]                                (1 column)
[Card2]                                (1 column)
[Card3]                                (1 column)
[Card4]                                (1 column)
[License: Computers]                   (vertical stack)
[License: Price]                       (vertical stack)
[License: Total]                       (vertical stack)
[Gross Plan]                           (full width)
[Gross Actual]                         (full width)
[Net Plan]                             (full width)
[Net Actual]                           (full width)
[Cost: Metric 1]                       (vertical stack)
[Cost: Metric 2]                       (vertical stack)
[Cost: Metric 3]                       (vertical stack)
[Project Cards] → card-based list view
[Financial: Metric 1]                  (vertical stack)
[Financial: Metric 2]                  (vertical stack)
[Financial: Metric 3]                  (vertical stack)
[Financial: Metric 4]                  (vertical stack)
```

### Mobile Optimizations

#### Touch Targets
- Minimum size: 44px × 44px
- Spacing between targets: 8px minimum

#### Font Size Adjustments
```javascript
// Desktop → Mobile
Page Title: 32px → 24px
Card Value: 36px → 28px
Card Title: 14px → 13px
Table Text: 14px → 12px
```

#### Table → Card List Conversion (Mobile)
```
Instead of table:
┌──────────────────────────────────┐
│ ISJ (HCM)                        │
│ 開発設計・機械設計                │
│                                  │
│ 計画: 3,490h | 実績: 0h          │
│ 達成率: 0% [Pending]             │
│ 総収益: ¥0 (0万円)               │
└──────────────────────────────────┘
```

---

## 10. 実装メモ

### Critical Requirements

#### ✅ Must-Have Features

1. **Real-time Calculation**
   - All metrics recalculate immediately when license cost changes
   - No page refresh required
   - Debounce input changes (500ms)

2. **万円 Conversion**
   ```javascript
   const toMan = (amount) => (amount / 10000).toFixed(1);
   ```

3. **Negative Value Styling**
   ```javascript
   if (netRevenue < 0) {
     borderColor = '#EF4444';
     textColor = '#dc2626';
   }
   ```

4. **Horizontal Layouts**
   - Row 1: 4 cards horizontal
   - License Cost: 3 fields horizontal
   - Cost Analysis: 3 metrics horizontal
   - Financial Summary: 4 metrics horizontal

5. **Responsive Grid**
   ```css
   .grid {
     display: grid;
     grid-template-columns: repeat(4, 1fr);
     gap: 20px;
   }
   
   @media (max-width: 1023px) {
     grid-template-columns: repeat(2, 1fr);
   }
   
   @media (max-width: 767px) {
     grid-template-columns: 1fr;
   }
   ```

### React State Management

```javascript
// State structure
const [licenseConfig, setLicenseConfig] = useState({
  numberOfComputers: 7,
  pricePerComputer: 2517143,
});

const [projects, setProjects] = useState([]); // From Supabase
const [unitPrice, setUnitPrice] = useState(2300);
const [activePeriod, setActivePeriod] = useState('H2-2024');

// Computed values with useMemo
const totalLicenseCost = useMemo(() => 
  licenseConfig.numberOfComputers * licenseConfig.pricePerComputer,
  [licenseConfig]
);

const calculations = useMemo(() => {
  const totalPlanHours = projects.reduce((sum, p) => 
    sum + (p.plan[activePeriod]?.total || 0), 0
  );
  
  const totalActualHours = projects.reduce((sum, p) => 
    sum + (p.actual[activePeriod]?.total || 0), 0
  );
  
  const grossRevenuePlan = totalPlanHours * unitPrice;
  const grossRevenueActual = totalActualHours * unitPrice;
  
  const netRevenuePlan = grossRevenuePlan - totalLicenseCost;
  const netRevenueActual = grossRevenueActual - totalLicenseCost;
  
  const profitMarginPlan = grossRevenuePlan > 0 
    ? (netRevenuePlan / grossRevenuePlan) * 100 
    : 0;
    
  const profitMarginActual = grossRevenueActual > 0 
    ? (netRevenueActual / grossRevenueActual) * 100 
    : 0;
  
  return {
    totalPlanHours,
    totalActualHours,
    grossRevenuePlan,
    grossRevenueActual,
    netRevenuePlan,
    netRevenueActual,
    profitMarginPlan,
    profitMarginActual,
    achievementRate: totalPlanHours > 0 
      ? (totalActualHours / totalPlanHours) * 100 
      : 0,
    licenseCostPerHour: totalPlanHours > 0 
      ? totalLicenseCost / totalPlanHours 
      : 0,
    netHourlyRate: unitPrice - (totalLicenseCost / totalPlanHours),
    breakEvenHours: totalLicenseCost / unitPrice,
  };
}, [projects, unitPrice, totalLicenseCost, activePeriod]);
```

### Performance Optimization

1. **Use useMemo for calculations** - Prevent unnecessary recalculations
2. **Debounce inputs** - Wait 500ms after user stops typing
3. **Lazy load projects** - If > 50 projects, implement pagination
4. **Virtual scrolling** - For large project tables
5. **Memoize components** - Use React.memo for card components

### Accessibility (a11y)

1. **ARIA Labels**
   ```html
   <input 
     aria-label="コンピュータ台数" 
     aria-describedby="computers-help"
   />
   ```

2. **Keyboard Navigation**
   - Tab order follows visual order
   - Enter key saves input
   - Esc key cancels editing

3. **Screen Reader Announcements**
   ```javascript
   // Announce value changes
   <div role="status" aria-live="polite" aria-atomic="true">
     純収益が更新されました: {formatCurrency(netRevenue)}
   </div>
   ```

4. **Focus Indicators**
   ```css
   input:focus {
     outline: 2px solid #3b82f6;
     outline-offset: 2px;
   }
   ```

5. **Color Contrast**
   - All text meets WCAG AA standard (4.5:1 ratio minimum)
   - Important values use bold weight for better visibility

### Data Validation

```javascript
// License cost inputs
const validateLicenseConfig = (config) => {
  if (config.numberOfComputers < 1) {
    throw new Error('コンピュータ台数は1以上である必要があります');
  }
  
  if (config.pricePerComputer < 0) {
    throw new Error('ライセンス料は0以上である必要があります');
  }
  
  return true;
};

// Hours input
const validateHours = (hours) => {
  const parsed = parseInt(hours);
  
  if (isNaN(parsed)) {
    return 0;
  }
  
  if (parsed < 0) {
    throw new Error('時間数は0以上である必要があります');
  }
  
  return parsed;
};
```

### Error Handling

```javascript
// Supabase operations
const updateLicenseCost = async (config) => {
  try {
    validateLicenseConfig(config);
    
    const { data, error } = await supabase
      .from('license_costs')
      .upsert(config);
    
    if (error) throw error;
    
    // Show success notification
    toast.success('ライセンスコストを更新しました');
    
    return data;
  } catch (error) {
    console.error('License cost update failed:', error);
    toast.error(`更新失敗: ${error.message}`);
    throw error;
  }
};
```

### Export to Excel

```javascript
import * as XLSX from 'xlsx';

const exportDashboardToExcel = (calculations, projects, licenseConfig) => {
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Summary
  const summaryData = [
    ['OS業務受託管理システム - Dashboard Export'],
    [],
    ['総計画時間', `${calculations.totalPlanHours}h`],
    ['総実績時間', `${calculations.totalActualHours}h`],
    ['達成率', `${calculations.achievementRate.toFixed(1)}%`],
    [],
    ['総収益（計画）', formatCurrency(calculations.grossRevenuePlan)],
    ['総収益（実績）', formatCurrency(calculations.grossRevenueActual)],
    ['ライセンスコスト', formatCurrency(licenseConfig.total)],
    ['純収益（計画）', formatCurrency(calculations.netRevenuePlan)],
    ['純収益（実績）', formatCurrency(calculations.netRevenueActual)],
    ['利益率（計画）', `${calculations.profitMarginPlan.toFixed(1)}%`],
    ['利益率（実績）', `${calculations.profitMarginActual.toFixed(1)}%`],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  
  // Sheet 2: Projects
  const projectData = [
    ['社名', '業務内容', '計画時間', '実績時間', '達成率', '総収益'],
    ...projects.map(p => [
      p.company,
      p.projectType,
      p.planHours,
      p.actualHours,
      `${((p.actualHours / p.planHours) * 100).toFixed(1)}%`,
      formatCurrency(p.actualHours * unitPrice),
    ]),
  ];
  
  const wsProjects = XLSX.utils.aoa_to_sheet(projectData);
  XLSX.utils.book_append_sheet(wb, wsProjects, 'Projects');
  
  // Export
  const fileName = `OS_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
```

---

## 付録: Quick Reference

### Key Formulas Summary

```javascript
// Basic Metrics
totalPlanHours = sum(project_hours where type='plan')
totalActualHours = sum(project_hours where type='actual')
achievementRate = (totalActualHours / totalPlanHours) × 100

// License Cost
totalLicenseCost = numberOfComputers × pricePerComputer

// Gross Revenue
grossRevenuePlan = totalPlanHours × unitPrice
grossRevenueActual = totalActualHours × unitPrice

// Net Revenue
netRevenuePlan = grossRevenuePlan - totalLicenseCost
netRevenueActual = grossRevenueActual - totalLicenseCost

// Profit Margin
profitMarginPlan = (netRevenuePlan / grossRevenuePlan) × 100
profitMarginActual = (netRevenueActual / grossRevenueActual) × 100

// Cost Analysis
licenseCostPerHour = totalLicenseCost / totalPlanHours
netHourlyRate = unitPrice - licenseCostPerHour
breakEvenHours = totalLicenseCost / unitPrice

// 万円 Conversion
toMan = (amount) => (amount / 10000).toFixed(1)
```

### Color Quick Reference

```
Blue:    #3B82F6  → Primary, Plan metrics
Green:   #10B981  → Success, Actual metrics, Positive
Red:     #EF4444  → Danger, Negative values
Orange:  #F97316  → Warning, Cost analysis
Purple:  #8B5CF6  → Settings, License
Indigo:  #6366F1  → Net Revenue Plan
Yellow:  #F59E0B  → Warning state (80-99%)
```

---

**End of Document**

このドキュメントは、OS業務受託管理システムのダッシュボードを構築するための完全な設計仕様を提供します。すべての計算式、レイアウト、カラー、タイポグラフィー、および実装の詳細が含まれています。

**For questions or clarifications, contact:**  
Tuấn Anh - Esutech Co., Ltd. - OS Team  
Email: [your-email]  
Version: 2.0 | Date: December 2024
