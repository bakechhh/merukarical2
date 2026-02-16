-- ============================================================
-- フリマ売却管理 - Supabase スキーマ
-- ============================================================
-- 使い方:
--   1. Supabaseダッシュボード → SQL Editor → New query
--   2. このファイルの内容を貼り付けて Run
-- ============================================================

-- ユーザーデータテーブル
CREATE TABLE IF NOT EXISTS user_data (
    user_id    TEXT PRIMARY KEY,
    data       JSONB NOT NULL DEFAULT '{}'::jsonb,
    device_id  TEXT,
    sync_version INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_user_data_updated_at ON user_data (updated_at DESC);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
-- anon キーでの読み書きを許可（認証なし運用のため）

ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーがあれば削除（再実行対応）
DROP POLICY IF EXISTS "Allow anon select"  ON user_data;
DROP POLICY IF EXISTS "Allow anon insert"  ON user_data;
DROP POLICY IF EXISTS "Allow anon update"  ON user_data;

-- SELECT: 誰でも自分の user_id を指定すれば読める
CREATE POLICY "Allow anon select"
    ON user_data FOR SELECT
    TO anon
    USING (true);

-- INSERT: 誰でも挿入可能
CREATE POLICY "Allow anon insert"
    ON user_data FOR INSERT
    TO anon
    WITH CHECK (true);

-- UPDATE: 誰でも更新可能
CREATE POLICY "Allow anon update"
    ON user_data FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_data_updated_at ON user_data;

CREATE TRIGGER trg_user_data_updated_at
    BEFORE UPDATE ON user_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
