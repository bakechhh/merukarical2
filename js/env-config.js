// env-config.js - 環境変数の設定
// ローカル開発時は以下のプレースホルダーを実際のSupabase値に置き換えてください
// 1. https://supabase.com でプロジェクトを作成
// 2. Settings → API から Project URL と anon key を取得
// 3. 下記の '__SUPABASE_URL__' と '__SUPABASE_ANON_KEY__' を置き換え
// ※ Netlifyデプロイ時は build.sh が環境変数から自動注入します
window.ENV = {
    SUPABASE_URL: '__SUPABASE_URL__',
    SUPABASE_ANON_KEY: '__SUPABASE_ANON_KEY__'
};