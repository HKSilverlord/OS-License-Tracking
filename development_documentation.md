# OS業務受託管理システム - 開発ドキュメント
# OS Outsourcing Management System - Development Documentation

## 📋 目次 (Table of Contents)

1. [システム概要](#システム概要)
2. [機能要件](#機能要件)
3. [技術スタック](#技術スタック)
4. [データベース設計](#データベース設計)
5. [実装ガイド](#実装ガイド)
6. [展開手順](#展開手順)
7. [将来の拡張](#将来の拡張)

---

## システム概要

### 目的
従来のExcelベースの工数管理を、より効率的で使いやすいWebアプリケーションに置き換える。

### 主な利点
- ✅ リアルタイムデータ同期
- ✅ 複数ユーザーの同時編集対応
- ✅ 自動計算とバリデーション
- ✅ 履歴管理とバックアップ
- ✅ モバイル対応
- ✅ Excel形式でのエクスポート

---

## 機能要件

### 1. 時間追跡 (Time Tracking)

#### 1.1 プロジェクト管理
- **追加**: 新規プロジェクトの作成
  - 社名 (Company Name)
  - 業務内容 (Project Type)
  - 使用ソフト (Software)
  
- **編集**: 既存プロジェクトの情報更新
- **削除**: プロジェクトの削除（確認ダイアログ付き）

#### 1.2 工数入力
- **計画時間 (Plan)**: 月次の計画工数を入力
- **実績時間 (Actual)**: 月次の実績工数を入力
- **自動計算**: 
  - 期間別合計
  - プロジェクト別合計
  - 全体合計

#### 1.3 期間管理
- **表示期間**: 
  - 半期単位で管理 (H1: 1-6月, H2: 7-12月)
  - 最大3期間を同時表示
  - 古い期間は自動的にアーカイブ

- **アーカイブ機能**:
  - 過去データの保存
  - 必要時に閲覧可能
  - データの復元機能

### 2. ダッシュボード (Dashboard)

#### 2.1 サマリーカード
- 総計画時間
- 総実績時間
- 達成率
- 総収益

#### 2.2 プロジェクト一覧
- プロジェクト別の実績表示
- 達成率の可視化（色分け）
  - 緑: ≥100%
  - 黄: 80-99%
  - 赤: <80%

### 3. データエクスポート
- Excel形式でのエクスポート
- 現在の表示データをそのまま出力
- フォーマットの保持

### 4. 設定管理
- 単価設定 (¥/hour)
- ユーザー権限管理（将来実装）

---

## 技術スタック

### Frontend
```
- React 18+
- Tailwind CSS (スタイリング)
- Lucide React (アイコン)
- XLSX / ExcelJS (Excel出力)
```

### Backend & Database
```
- Supabase
  - PostgreSQL (データベース)
  - Row Level Security (RLS)
  - Realtime subscriptions
  - Authentication
```

### Hosting
```
- Vercel / Netlify (推奨)
- または Supabase Hosting
```

---

## データベース設計

### テーブル構造

#### 1. `projects` テーブル
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company TEXT NOT NULL,
  project_type TEXT NOT NULL,
  software TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id)
);

-- インデックス
CREATE INDEX idx_projects_archived ON projects(is_archived);
CREATE INDEX idx_projects_created_by ON projects(created_by);
```

#### 2. `project_hours` テーブル
```sql
CREATE TABLE project_hours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  period TEXT NOT NULL,  -- 'H1-2025', 'H2-2025', etc.
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  type TEXT NOT NULL CHECK (type IN ('plan', 'actual')),
  hours INTEGER DEFAULT 0 CHECK (hours >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 同一プロジェクト、同一期間、同一月、同一タイプは1レコードのみ
  UNIQUE(project_id, period, month, type)
);

-- インデックス
CREATE INDEX idx_project_hours_project ON project_hours(project_id);
CREATE INDEX idx_project_hours_period ON project_hours(period);
CREATE INDEX idx_project_hours_composite ON project_hours(project_id, period, type);
```

#### 3. `periods` テーブル
```sql
CREATE TABLE periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_code TEXT UNIQUE NOT NULL,  -- 'H1-2025', 'H2-2025'
  year INTEGER NOT NULL,
  half INTEGER NOT NULL CHECK (half IN (1, 2)),
  start_month INTEGER NOT NULL,
  end_month INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_periods_active ON periods(is_active);
CREATE INDEX idx_periods_year_half ON periods(year, half);
```

#### 4. `settings` テーブル
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- デフォルト設定を挿入
INSERT INTO settings (key, value) VALUES
  ('unit_price', '{"amount": 2300, "currency": "JPY"}'),
  ('active_periods', '["H2-2024", "H1-2025", "H2-2025"]');
```

#### 5. `archived_data` テーブル
```sql
CREATE TABLE archived_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period TEXT NOT NULL,
  data JSONB NOT NULL,  -- プロジェクトと工数の完全なスナップショット
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived_by UUID REFERENCES auth.users(id)
);

-- インデックス
CREATE INDEX idx_archived_data_period ON archived_data(period);
```

### Row Level Security (RLS) ポリシー

```sql
-- projectsテーブルのRLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "プロジェクトは全員が閲覧可能"
  ON projects FOR SELECT
  USING (true);

CREATE POLICY "認証ユーザーはプロジェクトを作成可能"
  ON projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "認証ユーザーはプロジェクトを更新可能"
  ON projects FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "認証ユーザーはプロジェクトを削除可能"
  ON projects FOR DELETE
  USING (auth.role() = 'authenticated');

-- project_hoursテーブルのRLS
ALTER TABLE project_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "工数データは全員が閲覧可能"
  ON project_hours FOR SELECT
  USING (true);

CREATE POLICY "認証ユーザーは工数を入力可能"
  ON project_hours FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "認証ユーザーは工数を更新可能"
  ON project_hours FOR UPDATE
  USING (auth.role() = 'authenticated');
```

---

## 実装ガイド

### Step 1: Supabaseプロジェクトのセットアップ

```bash
# 1. Supabaseアカウント作成
# https://supabase.com でアカウント作成

# 2. 新しいプロジェクトを作成
# プロジェクト名: OS Tracking System
# リージョン: 最寄りのリージョンを選択

# 3. データベースURLとAPIキーを取得
# Settings > API > Project URL
# Settings > API > anon/public key
```

### Step 2: データベースの初期化

```sql
-- Supabase SQL Editor で実行
-- 上記のテーブル構造をすべて実行
```

### Step 3: React アプリケーションのセットアップ

```bash
# プロジェクトの作成
npx create-react-app os-tracking-system
cd os-tracking-system

# 必要なパッケージのインストール
npm install @supabase/supabase-js
npm install lucide-react
npm install xlsx
npm install date-fns
npm install recharts  # グラフ用（オプション）

# Tailwind CSS のセットアップ
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 4: Supabase クライアントの設定

**`src/lib/supabase.js`**
```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

**`.env`**
```env
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 5: データアクセス層の実装

**`src/services/projectService.js`**
```javascript
import { supabase } from '../lib/supabase';

export const projectService = {
  // プロジェクト取得
  async getAllProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // プロジェクト作成
  async createProject(projectData) {
    const { data, error } = await supabase
      .from('projects')
      .insert([projectData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // プロジェクト更新
  async updateProject(id, updates) {
    const { data, error } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // プロジェクト削除
  async deleteProject(id) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  // 工数データ取得
  async getProjectHours(projectId, period) {
    const { data, error } = await supabase
      .from('project_hours')
      .select('*')
      .eq('project_id', projectId)
      .eq('period', period);
    
    if (error) throw error;
    return data;
  },

  // 工数データ更新（UPSERT）
  async upsertHours(hoursData) {
    const { data, error } = await supabase
      .from('project_hours')
      .upsert(hoursData, { 
        onConflict: 'project_id,period,month,type',
        returning: 'minimal'
      });
    
    if (error) throw error;
    return data;
  },

  // 期間別全データ取得
  async getAllDataForPeriod(period) {
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select(`
        *,
        project_hours!inner(*)
      `)
      .eq('project_hours.period', period)
      .eq('is_archived', false);
    
    if (projError) throw projError;
    return projects;
  }
};
```

**`src/services/settingsService.js`**
```javascript
import { supabase } from '../lib/supabase';

export const settingsService = {
  async getSetting(key) {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error) throw error;
    return data.value;
  },

  async updateSetting(key, value) {
    const { data, error } = await supabase
      .from('settings')
      .update({ value, updated_at: new Date() })
      .eq('key', key);
    
    if (error) throw error;
    return data;
  }
};
```

### Step 6: Excel エクスポート機能

**`src/utils/excelExport.js`**
```javascript
import * as XLSX from 'xlsx';

export const exportToExcel = (projects, periods, unitPrice) => {
  // ワークブックを作成
  const wb = XLSX.utils.book_new();
  
  // データを配列形式に変換
  const data = [];
  
  // ヘッダー行
  const header = ['No', '社名', '業務内容', 'ソフト', ''];
  periods.forEach(period => {
    const months = period === 'H1-2025' 
      ? [1, 2, 3, 4, 5, 6] 
      : [7, 8, 9, 10, 11, 12];
    months.forEach(m => header.push(`${m}月`));
    header.push('計');
  });
  data.push(header);
  
  // プロジェクトデータ
  projects.forEach((project, index) => {
    // 計画行
    const planRow = [
      index + 1,
      project.company,
      project.projectType,
      project.software,
      '計画'
    ];
    
    periods.forEach(period => {
      const months = period.includes('H1') 
        ? [1, 2, 3, 4, 5, 6] 
        : [7, 8, 9, 10, 11, 12];
      
      let periodTotal = 0;
      months.forEach(month => {
        const hours = project.plan[period]?.[month] || 0;
        planRow.push(hours);
        periodTotal += hours;
      });
      planRow.push(periodTotal);
    });
    
    data.push(planRow);
    
    // 実績行
    const actualRow = ['', '', '', '', '実績'];
    periods.forEach(period => {
      const months = period.includes('H1') 
        ? [1, 2, 3, 4, 5, 6] 
        : [7, 8, 9, 10, 11, 12];
      
      let periodTotal = 0;
      months.forEach(month => {
        const hours = project.actual[period]?.[month] || 0;
        actualRow.push(hours);
        periodTotal += hours;
      });
      actualRow.push(periodTotal);
    });
    
    data.push(actualRow);
  });
  
  // ワークシートを作成
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // 列幅の設定
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 20 },  // 社名
    { wch: 25 },  // 業務内容
    { wch: 10 },  // ソフト
    { wch: 8 }    // 計画/実績
  ];
  
  // ワークブックにシートを追加
  XLSX.utils.book_append_sheet(wb, ws, 'OS業務受託見込み');
  
  // ファイルとして保存
  const fileName = `OS業務受託見込み_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
```

### Step 7: リアルタイム更新の実装

**`src/hooks/useRealtimeProjects.js`**
```javascript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useRealtimeProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初期データ取得
    fetchProjects();

    // リアルタイムサブスクリプション
    const subscription = supabase
      .channel('projects_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects'
        },
        (payload) => {
          console.log('Change received!', payload);
          fetchProjects();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_archived', false);
    
    if (error) {
      console.error('Error fetching projects:', error);
    } else {
      setProjects(data);
    }
    setLoading(false);
  };

  return { projects, loading, refetch: fetchProjects };
};
```

---

## 展開手順

### Vercel へのデプロイ

```bash
# 1. Vercelアカウント作成
# https://vercel.com

# 2. Vercel CLI のインストール
npm install -g vercel

# 3. プロジェクトルートでログイン
vercel login

# 4. デプロイ
vercel

# 5. 環境変数の設定
# Vercelダッシュボード > Settings > Environment Variables
# REACT_APP_SUPABASE_URL
# REACT_APP_SUPABASE_ANON_KEY
```

### Netlify へのデプロイ

```bash
# 1. Netlifyアカウント作成
# https://netlify.com

# 2. Netlify CLI のインストール
npm install -g netlify-cli

# 3. ログイン
netlify login

# 4. デプロイ
netlify deploy --prod

# 5. 環境変数の設定
# Netlifyダッシュボード > Site settings > Environment variables
```

---

## 将来の拡張

### Phase 2: ユーザー管理
- [ ] ログイン/ログアウト機能
- [ ] ユーザーロール (閲覧者、編集者、管理者)
- [ ] 編集履歴の記録

### Phase 3: 高度な分析
- [ ] グラフとチャートの追加
  - 月次トレンド
  - プロジェクト別比較
  - 達成率の推移
- [ ] カスタムレポート生成
- [ ] PDFエクスポート

### Phase 4: 通知機能
- [ ] 期限アラート
- [ ] 目標達成通知
- [ ] メール通知

### Phase 5: モバイルアプリ
- [ ] React Native版の開発
- [ ] オフライン対応
- [ ] プッシュ通知

---

## トラブルシューティング

### よくある問題

#### 1. Supabase接続エラー
```javascript
// エラーハンドリングの追加
try {
  const { data, error } = await supabase.from('projects').select('*');
  if (error) throw error;
} catch (error) {
  console.error('Database error:', error.message);
  // ユーザーにエラー表示
}
```

#### 2. RLSポリシーの問題
```sql
-- 認証なしでテストする場合
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;

-- 本番環境では必ず有効化
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
```

#### 3. データ同期の遅延
```javascript
// 手動リフレッシュボタンの追加
<button onClick={() => refetch()}>
  データを更新
</button>
```

---

## サポートとメンテナンス

### 定期メンテナンス
- データベースバックアップ: 毎日自動（Supabase標準）
- パフォーマンスモニタリング: 週次確認
- セキュリティアップデート: 随時適用

### サポート連絡先
- 開発者: [連絡先]
- Supabaseサポート: https://supabase.com/support
- ドキュメント: https://supabase.com/docs

---

## ライセンス

MIT License - 社内利用のため制限なし

---

**最終更新日**: 2024年12月
**バージョン**: 1.0.0
**作成者**: Tuấn Anh (Esutech - OS Team)
