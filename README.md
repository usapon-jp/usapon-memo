# うさぽんメモ

スマホの中にある「うさぎの付箋ボード」です。自由メモとチェックリストを付箋として貼れます。

## 使い方

```bash
npm install
npm run dev
```

ローカル保存には `localStorage` の `usapon_memo_data` を使います。`usapondays` 本体の `usapondays_data` は使いません。

秋スタンプの購入済み確認には、共有Supabaseと同じ公開設定だけを `.env.local` に置きます。購入済み26点は非公開Storageの `package-theme-pack-assets/autumn-letter-set/` から、Googleログイン済みの同じAuth UIDで `package.theme_pack_entitlements` の `autumn-letter-set` を確認して読み込みます。購入済み判定を端末保存や合言葉では行いません。無料のIMG9803だけは公開素材です。

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

## 機能

- PWA対応
- 付箋ボード上での自由配置
- 自由メモ / チェックリスト作成
- メモ編集
- 4色の付箋
- ピン留め
- 今日のメモ
- 完了管理
- 削除
