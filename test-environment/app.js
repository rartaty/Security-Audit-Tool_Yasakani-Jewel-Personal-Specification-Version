const express = require('express');
const app = express();
const port = 3000;

// ⚠️ 脆弱性 1: APIキーのハードコード ＆ 危険なフォールバック
// ローカルで環境変数が設定されていない場合、本番用のDUMMYキーがフォールバックされる
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "DUMMY_API_KEY_FOR_TRAINING_ONLY";

// ⚠️ 脆弱性 2: 暗号ロジックの自作 (No Custom Crypto/Auth に抵触)
// 安全な標準 crypto モジュールや bcrypt を使用せず、手作りで文字列を反転させてXORするだけの脆弱な暗号化
function customEncrypt(text) {
  let key = 42;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key);
  }
  return Buffer.from(result).toString('base64');
}

// ⚠️ 脆弱性 3: API過剰データ返却 (Excessive Data Exposure)
// フロントエンドからは id と name しか要求されていないにもかかわらず、
// DBから取得した生オブジェクトをそのまま返却している（passwordHashやisAdmin権限フラグが漏洩）
app.get('/api/user/:id', (req, res) => {
  const mockUserFromDb = {
    id: req.params.id,
    name: "Example User",
    passwordHash: "$2b$12$e098dfa8a8c1f38bc1a76c8c93a0279e8c4e09abcf31c3c9", // 漏洩リスク
    isAdmin: true, // 権限漏洩リスク
    email: "example.user@example.test"
  };
  
  // DTO (シリアライザ) を通さず、丸ごと返却している
  res.json(mockUserFromDb);
});

// ⚠️ 脆弱性 4: 不適切なエラーハンドリングによる機密情報ダンプ
// エラー発生時、データベース接続エラーオブジェクトをそのままJSONで返却している。
// エラーオブジェクト内の「接続情報、ホスト名、DB内部構造」がクライアントに丸見えになる。
app.get('/api/db-test', (req, res) => {
  try {
    throw new Error("Failed to connect to mongodb://example:DUMMY_PASSWORD_DO_NOT_USE@db.example.test:27017/example-db");
  } catch (err) {
    console.error("Database connection error: ", err);
    // 危険: エラーインスタンスをそのままダンプしてクライアントに返している
    res.status(500).json({
      status: "error",
      message: err.message,
      errorDetails: err // エラーオブジェクト丸ごとダンプ
    });
  }
});

app.listen(port, () => {
  console.log(`Test app listening at http://localhost:${port}`);
  console.log(`Using API Key: ${GEMINI_API_KEY.substring(0, 8)}...`);
});
