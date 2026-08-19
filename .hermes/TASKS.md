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
| 5 | パッケージマネージャを npm → pnpm に切替 | ✅ | packageManager + pnpm-lock.yaml |
| 6 | `schemas/benchmark.schema.json` / `rubric.schema.json` | ✅ | draft 2020-12、Ajv2020 で検証 |
| 7 | schema 検証テスト (実在ベンチ/json) | ✅ | `node:test` 20件に増加 |
| 8 | コミット & PR 更新 | ✅ | スタック化: #6 metrics → #7 pnpm → #8 schemas |
| 9 | `src/runners/previewServer.ts` — local preview server | ✅ | SECURITY.md 準拠、loopback・path traversal拒否 |
| 10 | preview server テスト | ✅ | `node:test` 29件に増加 |
| 11 | コミット & スタックに PR を積む | ✅ | `topic/04-preview-server`, base: topic/03-schemas → PR #10 |
| 12 | `src/evaluators/staticChecks.ts` — 決定的静的チェック | ✅ | BENCHMARK_DESIGN.md 準拠、browser 不要 |
| 13 | static checks テスト | ✅ | `node:test` 37件に増加 |
| 14 | コミット & スタックに PR を積む | ✅ | `topic/05-static-eval`, base: topic/04-preview-server → PR #11 |
| 15 | `src/evaluators/browserChecks.ts` — Playwright チェック | ✅ | 実行時エラー・横スクロール・必須セクション・ハンバーガー/CTA |
| 16 | Playwright 導入 (Chromium) + テスト | ✅ | `node:test` 40件に増加 |
| 17 | コミット & スタックに PR を積む | ✅ | `topic/06-playwright`, base: main → PR #12 |
| 18 | `src/result/resultBuilder.ts` — result.json 組み立て | ✅ | schemas/result.schema.json 契約、efficiency/artifact を統合 |
| 19 | result builder テスト (schema検証含む) | ✅ | `node:test` 48件に増加 |
| 20 | コミット & スタックに PR を積む | 🚧 | `topic/07-result-builder`, base: topic/06-playwright |

## 実装方針

- このリポジトリは **pnpm 管理** (`packageManager: pnpm@9.15.4`)。npm/yarn は使用しない。`pnpm-lock.yaml` のみ追跡
- 各 metric は純粋関数にする(副作用なし、テスト容易)
- 入力が unknown / null / 0 の場合は `undefined` を返し、無理な数値化をしない(設計原則 #4)
- 品質スコアと効率メトリクスは混ぜない(設計原則 #3)
