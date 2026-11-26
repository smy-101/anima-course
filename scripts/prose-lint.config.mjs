/**
 * prose-lint 的棘轮名单（site-voice 票 02）。
 *
 * 列在这里的文件必须通过 docs/文风.md 的全部硬规则，否则 `npm run check:site` 退出码 1；
 * 名单外的文件只出报告。写内容 id（`01-03-prompt-basics`）、文件名或相对仓库根的路径都行，
 * 写了仓库里不存在的条目也会退出码 1，免得拼错后名单形同虚设。
 * 最后一张票（11）把名单换成全量硬失败，这个文件随之退场。
 */
export const rewritten = [
  '00-01-setup',
  '01-01-l0-minimal',
  '01-02-l1-controllable',
  '01-03-prompt-basics',
  '02-01-l2-sweeps',
  '02-02-prompt-multi',
  '03-01-l3-img2img',
  '03-02-l3-lora',
  '03-03-review-blueprint',
  '03-04-l4-upscale',
  '03-05-l4-large',
  '04-01-l5-lllite',
];
