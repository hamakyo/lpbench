# LPBench

[English](./README.md) | 日本語

LLMが生成したランディングページやWeb UIを、同じ条件で継続的に評価・比較するためのベンチマーク基盤です。

## 目的

LPBenchでは、**生成・評価・保存・可視化**を分離します。

これにより、以下のような異なる生成経路から得られた成果物を、共通のベンチマーク条件で比較できるようにします。

- OpenAI / Anthropic / GeminiなどのAPI
- Codex CLI / Claude CodeなどのCoding Agent
- サブスクリプションで利用するCLI
- ChatGPTなどのWeb UIから手動で取得した結果
- 将来的なローカルLLM

LPBenchが比較したいのは、単純な「どのモデルが一番きれいなLPを作れるか」だけではありません。

品質に加えて、以下も独立した指標として記録・比較します。

- 生成時間
- 入力 / 出力トークン数
- APIコスト
- Quality / Cost
- Quality / Token
- Quality / Time
- 生成コード量

品質スコアと効率指標は混ぜず、**出力品質**と**実用上の効率**を別軸で評価します。

## ドキュメント

設計方針と実装上の契約は [`docs/`](./docs/README.md) にあります。

- [Architecture](./docs/ARCHITECTURE.md) — システム境界とデータフロー
- [Benchmark Design](./docs/BENCHMARK_DESIGN.md) — 公平性、再現性、ベンチマークのバージョニング
- [Results and Metrics](./docs/RESULTS_AND_METRICS.md) — スコア、トークン、時間、コスト、効率指標
- [Security Model](./docs/SECURITY.md) — LLM生成コードを安全に評価するための方針
- [Roadmap](./docs/ROADMAP.md) — v0.1以降の実装計画

## 想定フロー

```text
Benchmark Definition
        |
        v
Runner (API / CLI / Manual)
        |
        v
Generated Artifact
        |
        v
Evaluator
        |
        v
result.json
        |
        +--> Git history / GitHub Actions Artifact
        +--> GitHub Pages dashboard
```

重要なのは、RunnerとEvaluatorを分離することです。

API、Codex、Claude Code、手動生成など、生成経路が違っていても、最終的なHTML/CSS/JSは同じEvaluatorへ渡します。

## リポジトリ構成

```text
benchmarks/      バージョン管理されたPrompt・rubric・viewport定義
docs/            アーキテクチャ、ベンチ設計、メトリクス、セキュリティ、ロードマップ
src/runners/     API / CLI / Manualなどの生成Adapter
src/evaluators/  Playwright / Lighthouse / DOM検査などの共通評価処理
src/metrics/     Cost / Latency / Token / Efficiencyの計算
schemas/         result.jsonなどのJSON Schema
runs/            生成されたベンチマークrun
site/            GitHub Pages用Dashboard
.github/         GitHub Actions Workflow
```

## LP v1

最初のベンチマークでは、架空のAIタスク管理SaaSのランディングページを生成させます。

生成物は以下の3ファイルです。

```text
index.html
style.css
script.js
```

画像素材やUIライブラリには依存せず、HTML / CSS / Vanilla JavaScriptで実装させることで、モデル自身のWeb UI生成能力を比較します。

主な評価対象は以下です。

- Visual Quality
- Responsive Design
- Functionality
- Accessibility
- Instruction Compliance
- Code Quality
- Technical Quality

加えて、生成時間・トークン数・コストなども記録します。

## 評価

v0.1では、主に以下の自動評価を想定しています。

### Playwright

- ページが正常に表示されるか
- JavaScript / Console Errorがないか
- Desktop / Tablet / Mobileで横スクロールがないか
- 必須セクションが存在するか
- モバイルメニューやCTAが動作するか
- 各viewportのスクリーンショット取得

### Lighthouse

- Performance
- Accessibility
- Best Practices
- SEO

### Visual Quality

Visual Qualityは主観評価を含むため、初期バージョンでは自動採点の対象外にできます。

将来的にはVisual LLM Judgeや複数Judgeによる評価を追加する予定です。

評価できない項目を無理に数値化せず、`unknown` や `notEvaluated` として扱います。

## APIとCoding Agentの扱い

同じ系列のモデルであっても、以下は同条件とはみなしません。

```text
Raw API
Coding Agent
Subscription CLI
Web App
Manual Import
```

Coding Agentにはシステムプロンプト、ファイル操作、ツール利用、反復実行など、Raw APIにはない機能が含まれる可能性があります。

そのため、各runには生成経路を `surface` として保存し、Leaderboardでも区別できる設計にします。

## Cost / Token / Time

API runではProviderが返すusageを利用して、可能な範囲で以下を保存します。

```text
inputTokens
outputTokens
totalTokens
cachedTokens      optional
reasoningTokens   optional
```

生成時間は、APIリクエスト開始から生成結果全体を取得するまでのwall-clock timeを基本とします。

料金はRunnerへハードコードせず、`data/pricing/` のPricing Registryから計算します。

過去runの価格が料金改定によって変化しないよう、計算時の価格情報を結果へsnapshotとして残します。

サブスクリプション経由のrunについては、1回あたりの実コストを `$0` と扱いません。必要に応じてAPI換算額を別指標として表示します。

## セキュリティ

LLMが生成したHTML / JavaScriptは**信頼できない入力**として扱います。

Evaluatorでは、少なくとも以下を守る設計にします。

- APIキーを生成コードへ渡さない
- Secretや不要な環境変数をPreview環境へ公開しない
- 外部通信を検出または制限する
- path traversalを防ぐ
- 生成コードとDashboard / 評価基盤を分離する

## v0.1 の目標

最初のマイルストーンは、1モデル・1runのEnd-to-End Vertical Sliceです。

```text
LP v1 Prompt
    ↓
OpenAI API
    ↓
HTML / CSS / JS生成
    ↓
Playwright評価 + Screenshot
    ↓
Lighthouse
    ↓
Quality / Time / Tokens / Cost
    ↓
result.json
    ↓
GitHub Actions Artifact
```

v0.1では、まずこの一連の処理を安定して通すことを優先します。

その後、Codex CLI、Manual Import、他Provider、GitHub Pages Dashboard、Visual Judge、複数run統計などを段階的に追加していきます。
