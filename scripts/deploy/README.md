# mufa.ai 自动部署（推 main 即上线）

服务器上装一次，之后每次向 `main` 推送代码，网站会在 1–2 分钟内自动更新：
定时器每分钟对比一次 `origin/main`，发现新提交就自动 `git pull` → `npm install` →
`npm run build:packages` → `npm run build` → 重启应用服务。**构建失败会自动回滚**
到上一个可用提交并重建，网站不会因为一次坏推送而挂掉。

不改动现有的应用 systemd 服务、Nginx 或 Cloudflare 配置——只新增一个独立的
`mufa-autodeploy.timer`。

## 一次性安装（在服务器上执行）

```bash
cd /path/to/Open-Generative-AI   # 服务器上的仓库目录
git pull origin main             # 先拿到本目录 scripts/deploy/
sudo bash scripts/deploy/install-autodeploy.sh <你的应用服务名>
```

`<你的应用服务名>` 是运行 `next start` 的 systemd 服务，不确定的话：

```bash
systemctl list-units --type=service | grep -iE 'mufa|next|node'
```

## 查看状态 / 日志

```bash
systemctl list-timers mufa-autodeploy.timer   # 下次检查时间
systemctl status mufa-autodeploy.service      # 最近一次运行
tail -f /path/to/Open-Generative-AI/.deploy/auto-update.log
```

## 卸载

```bash
sudo systemctl disable --now mufa-autodeploy.timer
sudo rm /etc/systemd/system/mufa-autodeploy.{service,timer}
sudo systemctl daemon-reload
```

## 不想用 systemd？用 cron 也行

```cron
* * * * * root /usr/bin/env bash /path/to/Open-Generative-AI/scripts/deploy/auto-update.sh
```

脚本自带文件锁，重复触发不会并发执行。

## 注意事项

- 服务器上的仓库目录会被当作**纯部署目标**：每次部署执行
  `git reset --hard origin/main`，该目录里的手工改动会被丢弃。
  要改代码请改在 Git 里，推到 main。
- 如果服务器的 Node 是用 nvm 装的，脚本会自动尝试加载
  `~/.nvm/nvm.sh`；仍找不到 npm 时会在日志里报错。
- 部署日志在 `.deploy/auto-update.log`（已加入 .gitignore，不会被提交）。
