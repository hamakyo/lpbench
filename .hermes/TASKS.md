# Hermes Agent — LPBench 着手タスク

このファイルは Hermes Agent が着手したタスクの進捗を追跡するためのものです。
`docs/` に定義された設計契約に従い、`src/metrics/` から順に小さく実装していきます。

## 現在の作業ブランチ

`feat/hermes-metrics-efficiency`

## 進捗

### ✅ 実施済み / 🚧 進行中 / ⬜ 未着手

| # | タスク | ステータス | 備考 |
|---|--------|-----------|------|
| 1 | `src/metrics/efficiency.ts` — 効率メトリクス計算 | ✅ | RESULTS_AND_METRICS.md の数式に従う |
| 2 | `src/metrics/artifact.ts` — LOC / bytes 計測 | ✅ | TextEncoder 使用、Node 依存なし |
| 3 | ユニットテスト (efficiency / artifact) | ✅ | `node:test` 12件、fixture ベース |
| 4 | `npm run check` で型チェック & テスト実行 | ✅ | どちらも pass |
| 5 | コミット & PR 作成 | 🚧 | ブランチ `feat/hermes-metrics-efficiency` |

## 実装方針

- 各 metric は純粋関数にする(副作用なし、テスト容易)
- 入力が unknown / null / 0 の場合は `undefined` を返し、無理な数値化をしない(設計原則 #4)
- 品質スコアと効率メトリクスは混ぜない(設計原則 #3)
