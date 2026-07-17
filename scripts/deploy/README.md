# mufa.ai 自动部署（推 main 即上线）

服务器上装一次，之后每次向 `main` 推送代码，网站会在 1–2 分钟内自动更新：
定时器每分钟对比一次 `origin/main`，发现新提交就自动快进合并 → `npm install` →
`npm run build:packages` → `npm run build` → 重启应用服务。

不改动现有的应用 systemd 服务、Nginx 或 Cloudflare 配置——只新增一个独立的
`mufa-autodeploy.timer`。

## 安全保证

- **不会覆盖 `.env`**：`.env` 未被 Git 跟踪，脚本不使用 `git clean`，
  正向更新只用 `git merge --ff-only`，未跟踪文件永远不被触碰。
- **不会覆盖服务器本地改动**：部署前检查被跟踪文件是否有本地修改，
  有则拒绝部署并写日志，等你手工处理。
- **构建失败不重启服务**：构建前先备份 `.next`，失败时恢复备份、
  把检出退回已部署的提交，正在运行的旧进程完全不受影响。
- **坏提交不会无限重试**：失败的提交记录在 `.deploy/failed-sha`，
  之后每分钟只静默跳过；向 main 推一个新提交即自动恢复部署。
- **safe.directory**：安装器和脚本都会为仓库目录写入 git safe.directory，
  root 维护的检出不会因 "dubious ownership" 拉取失败。
- 文件锁防并发；日志自动截断。

## 一次性安装（在服务器上执行）

```bash
cd /opt/open-generative-ai
git pull origin main
sudo bash scripts/deploy/install-autodeploy.sh open-generative-ai
```

第一个参数是运行 `next start` 的 systemd 服务名；分支默认 `main`。

## 查看状态 / 日志

```bash
systemctl list-timers mufa-autodeploy.timer      # 定时器已启用 + 下次检查时间
systemctl status mufa-autodeploy.service         # 最近一次运行结果
tail -f /opt/open-generative-ai/.deploy/auto-update.log   # 部署日志
```

## 卸载

```bash
sudo systemctl disable --now mufa-autodeploy.timer
sudo rm /etc/systemd/system/mufa-autodeploy.{service,timer}
sudo systemctl daemon-reload
```

## 不想用 systemd？用 cron 也行

```cron
* * * * * root /usr/bin/env bash /opt/open-generative-ai/scripts/deploy/auto-update.sh
```

## 注意事项

- 服务器目录应当作纯部署目标：要改代码请提交并推到 main。
  如果曾在服务器上直接改过被跟踪的文件，部署会拒绝执行并在日志中提示，
  处理后（`git stash` 或提交）会自动恢复。
- 如果 Node 是 nvm 安装的，脚本会自动尝试加载 `~/.nvm/nvm.sh`；
  仍找不到 npm 时会在日志里报错。
- 构建失败后旧版本继续运行；修复代码推上 main 即自动恢复部署。
