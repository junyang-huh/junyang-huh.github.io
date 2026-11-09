# Availability

Jun Yang 的只读双周忙闲时间表。目标地址：`https://junyang-huh.github.io/availability/`。

前端使用 Vite、TypeScript 和 CSS Grid；数据来自独立的 Cloudflare Worker，不保存 Google 凭据或日历详情。

## 本地运行

需要 Node.js 24。

```sh
npm ci
npm run dev
```

- 真实数据页：`http://127.0.0.1:5173/availability/`
- 本地演示页：`http://127.0.0.1:5173/availability/?demo=1`
- 演示仅在开发环境通过 `?demo=1` 启用，展示模拟数据；生产构建不支持演示参数。

将 `.env.example` 复制为 `.env.local`，填写公开的 Worker 完整接口地址，例如 `VITE_AVAILABILITY_API_URL=https://YOUR-WORKER.workers.dev/availability`。不要填写 Google 凭据。修改后重启开发服务器。开发服务器通过 `/availability-api` 转发请求，生产页面直接请求 Worker。

接口格式：

```json
{
  "updatedAt": "2026-11-09T00:00:00Z",
  "range": { "start": "2026-11-09T00:00:00Z", "end": "2026-11-23T00:00:00Z" },
  "busy": [{ "start": "2026-11-09T01:10:00Z", "end": "2026-11-09T01:50:00Z" }]
}
```

所有时间戳须带时区。已开始的半小时格标灰（09:10 灰至 09:30）；忙碌区间向外取整到半小时（09:10—09:50 显示为 09:00—10:00）。仅在响应完整覆盖且没有 busy 的未来半小时格显示空闲。首次失败保持无数据，刷新失败保留旧数据并提示。每分钟更新过去时段显示，不自动轮询接口。

## 检查与构建

```sh
npm test
npm run build
npm run preview
```

预览构建地址：`http://127.0.0.1:4173/availability/`。未配置接口时显示配置提示，不能当作真实忙闲页面。

## 后续部署

当前仅本地交付，不设 remote，不推送。确认目标 GitHub 仓库后：

1. 设置仓库变量 `VITE_AVAILABILITY_API_URL` 为公开 Worker 接口地址。
2. 在仓库 Settings → Pages 将 Source 设为 GitHub Actions。
3. 将验收通过的功能分支合入 `main` 并推送，或手动运行 Pages 工作流。
4. 工作流测试并构建，将 `dist` 放入 artifact 的 `availability/` 子目录，发布后检查 `/availability/`。

Pages 部署会替换整个站点 artifact；今后若新增首页或其他页面，须一起放入 `site/`。当前工作流只包含 availability 页面。

## 验证记录

- 自动测试：北京时间日期/周边界、跨月跨年、区间重叠与跨日、时间裁剪、数据覆盖范围、无效响应、失败保留旧数据及 HTTP 错误。
- 浏览器：检查 320、390、650、960、1100、1280、1440px 七种宽度，周表与页面均无横向溢出。宽度足够时双周并排，否则上下排列，每周七列自适应显示。忙碌区块为静态展示，无交互、详情或动画，右侧保留 10% 空隙。
- 真实接口已通过本地开发代理联调：HTTP 200，页面成功显示忙碌区块。地址仅存于被 Git 忽略的 `.env.local`，不写入源码、文档或提交历史。
- 上线时通过 GitHub Actions 仓库变量 `VITE_AVAILABILITY_API_URL` 注入地址；地址会进入前端构建产物并可在浏览器网络请求中看到，不属于保密凭据。
- 字体来自现有博客，Monaspace 使用 SIL Open Font License，见 `public/fonts/OFL.txt`。
