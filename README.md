# うさぽんメモ

スマホの中にある「うさぎの付箋ボード」です。自由メモとチェックリストを付箋として貼れます。

## 使い方

```bash
npm install
npm run dev
```

ローカル保存には `localStorage` の `usapon_memo_data` を使います。`usapondays` 本体の `usapondays_data` は使いません。

秋素材の購入済み確認には、共有Supabaseと同じ公開設定だけを `.env.local` に置きます。購入済みのスタンプ26点と文房具12点は非公開Storageの `package-theme-pack-assets/autumn-letter-set/` から、Googleログイン済みの同じAuth UIDで `package.theme_pack_entitlements` の `autumn-letter-set` を確認して読み込みます。無料お試し5点は公開PNGで、ログインなしで表示します。有料素材の購入済み判定を端末保存や合言葉では行いません。旧IMG9803の端末保存データは引き続き読み込めます。

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

## 機能

- PWA対応
- 手書きメモ（端末内保存・スタンプPNG保存）
- 付箋ボード上での自由配置
- 自由メモ / チェックリスト作成
- メモ編集
- 4色の付箋
- ピン留め
- 今日のメモ
- 完了管理
- 削除
