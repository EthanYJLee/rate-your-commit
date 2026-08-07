<div align="center">

# RateYourCommit

**让开发团队的贡献透明、可解释 — 面向开发团队的开源绩效可视化工具**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](#license)
[![Self-hosted](https://img.shields.io/badge/deploy-docker%20compose-2496ED.svg)](#5分钟快速开始)
[![Version](https://img.shields.io/badge/version-0.0.1-lightgrey.svg)](#路线图)

<a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a> · <b>中文</b> · <a href="README.es.md">Español</a>

[痛点](#你是否遇到过这些情况) · [功能](#核心功能) · [快速开始](#5分钟快速开始) · [AI 使用原则](#ai-用在哪里不用在哪里) · [路线图](#路线图)

</div>

---

## 你是否遇到过这些情况?

如果你在管理一个中小型开发团队，大概率遇到过这些时刻。

- "我知道某某做得不错，但真要拿出证据来说服别人，却说不出个所以然。"
- "同一个人用了好几个 GitHub/GitLab 账号提交代码，统计谁做了什么根本对不上。"
- "每到考核季就凭感觉打分，一旦有人提出异议，我们拿不出实际依据。"
- "考虑过用绩效管理 SaaS，但把代码和人事数据交给别人的服务器，总觉得不放心。"

RateYourCommit 就是为了用**可自托管的开源方案**解决这个问题而生的项目。

## 核心功能

- **🔗 身份自动匹配** — 即使一个人用多个 git 账号/邮箱提交代码，也能自动找出候选并合并为同一个人。（基于规则匹配，最终确认始终由人工点击完成）
- **📊 可解释的绩效卡片** — 交付、代码质量、协作等指标，按组织自定义的权重计算。计算公式完全公开，甚至可以在 Excel 里手动核算。
- **🧹 自动排除异常值** — 类似"把整个第三方库一次性提交"这种情况会被自动检测并从评分中排除。
- **🔌 连接器架构** — 直接接入你已经在用的工具：GitHub、GitLab、Jira、Linear 等。新增一个集成只需要添加一个插件。
- **🔒 完全自托管** — 代码和评估数据都不会离开你自己的服务器。

## AI 用在哪里，不用在哪里

这是本项目最重要的原则。

> **任何直接影响薪酬或评级的计算，我们都不使用 AI。** 全部基于人工可以手动核算的规则和统计方法。

AI（LLM）仅在两个与最终分数无关的**纯参考性辅助功能**中选择性使用（提交信息摘要、同行评审评论摘要）。即便如此，我们也计划支持在内部本地 LLM 与外部 API 之间自由选择。详见 [`docs/AI-POLICY.md`](docs/AI-POLICY.md)。

## 5分钟快速开始

```bash
git clone https://github.com/<your-username>/rate-your-commit
cd rate-your-commit
cp .env.example .env       # 最简配置：GitHub token 等
docker compose up -d       # 一次性启动 web + worker + postgres
```

在浏览器中打开 `http://localhost:3000` → 连接一个仓库 → 几分钟后即可查看第一份看板。不需要专职运维人员，团队里一名开发者就足够。完整架构见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 截图

> _(公开仓库整理中 — 真实的看板截图将随首个正式版本一起发布)_

## 路线图

- [x] **0.0.1** — 界面设计、架构设计、许可证/治理、README、初始仓库脚手架搭建（当前版本）
- [ ] v1.0 — 身份映射 + Git/工单系统集成 + 个人绩效卡片（GitHub 连接器）
- [ ] v1.1 — 新增 GitLab / Jira / Linear 连接器
- [ ] v2.0 — 同行评价（360°）模块
- [ ] v2.1 — 薪酬等级核算报告模块（支持组织自定义规则）
- [ ] RateYourCommit Cloud — 托管服务 + LLM 辅助功能（付费）

## 参与贡献

项目刚完成初始脚手架搭建。欢迎通过 Issue 留下你的想法，或按照 `CONTRIBUTING.md` 参与进来。**涉及评分逻辑（`packages/scoring`）的 PR 必须至少获得一位代码所有者（code owner）批准** — 因为本项目的信任基础，正是"计算过程透明可查"这一承诺。

## License

[GNU AGPL v3.0](LICENSE)。你可以自由地自托管、修改和再分发，但如果将本代码作为网络服务对外提供，也必须公开你修改后的源代码。这是为了让开源核心永久保持免费而做出的选择。

---

<div align="center">
<sub>如果这个项目对你有帮助，欢迎点个 ⭐ — 有多少团队真正需要它，正是我们判断下一步投入的依据。</sub>
</div>
