# 装法 · DSH_X-Wide-Thought-Chain v0.1.12

> 本插件**不写、不改、也不读** profile 的 patch 配置；它只写自己目录下的 `data\`。
> 装载那一行由你自己加——那个文件是 DSH 启动关键路径，改坏就起不来。

## 方式 A · 本地插件目录（推荐，零 npm）

1. 把本目录放到 `<profile>/local-plugins/dsh-xwide-thought-chain/`
2. **先备份** profile 的 patch 配置文件为 `<文件名>.bak-<时间戳>`
3. 在它的 loader 段末尾加这一行（一次只加这一行，别顺手改别的）：

   ```yaml
     - insert: './local-plugins/dsh-xwide-thought-chain/index.js'
       id: xwide-thought-chain
       type: module
   ```

   `id` 必须全 profile 唯一——重复 loader id 会让 DSH 启动崩溃（官方有专门的 skill 修这个病）。
4. **重启 DSH**（插件在启动时装载，不重启不生效）
5. 验证：让助手跑 `dsh_xwide_thought_chain_selfcheck` → 末行应是 `SELFCHECK = PASS 6/6`

### （可选）在装载行里直接覆盖设置（优先级高于 `data/settings.json`）

```yaml
    config:
      prompt.enabled: true
      chain.stuckAfterFailures: 2
      selfcheck.pathDrift: true
      selfcheck.scanDirs: 'D:\你的工作区\_session_fix'
      safety.allowMutate: false
```

## 方式 B · npm 发布后安装

```bash
npm i dsh-xwide-thought-chain
```

## 不装插件也能用

自检内核是独立 ESM 脚本，命令行直跑：

```bash
node lib/selfcheck.mjs          # 人读红绿表
node lib/selfcheck.mjs --json   # 机器读（可进 CI）
node lib/selfcheck.mjs --deep   # 连 local-plugins 一起扫路径漂移
```

## 卸载 / 回滚

1. 删掉你加的那一行（或用第 2 步的备份覆盖回去）→ 重启 → 插件消失；
2. 想连数据一起清：删插件目录里的 `data/`（设置、账本、备份都在里面；插件本体不含用户数据）。
