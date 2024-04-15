# Simple Citations

Obsidianの個人用プラグインです
文献ノートを一括作成したり、一括更新したりできます

# インストール

公開していないので、ObsidianのBRATを使用してインストールできます

# 初期設定設定

Citationsプラグインとほぼ同じです

1. Zoteroから出力したBetter CSL JSONのパスを指定(注：英語非対応)
2. 文献ノートフォルダを作成して指定

# テンプレート

現時点ではテンプレートはいじれません
ファイル名は`@citekey`になり、フロントマターに下記の情報が入ります

- aliases: タイトル
- title: タイトル
- authors: 著者(リスト)
- journal: ジャーナル名
- year: 出版年
- doi: DOIリンク
- zotero: ZoteroへのURI

aliasesにタイトルが入るのでクイックスイッチャーでタイトルの検索ができます

# 使い方

2つしかコマンドはありません
コマンドパレットから使用できます

Add Literature Notes: Vault内にない文献ノートを一括作成
Update Literature Notes: 上記コマンドに加え、既存のノートのフロントマターを上記テンプレートに則って上書き更新(本文やテンプレート外の項目は変更されません)