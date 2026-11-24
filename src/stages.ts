/** 课程主线的六个阶段。内容迁移进度用 status 标记。 */
export interface Stage {
  id: number;
  title: string;
  short: string;
  days: string;
  levels: string;
  status: 'ready' | 'partial' | 'pending';
}

export const STAGES: Stage[] = [
  { id: 0, title: '准备', short: '认识 Anima 与 ComfyUI，装好，出第一张图', days: 'Day 1 上午', levels: '—', status: 'ready' },
  { id: 1, title: '搭起来·写出来', short: 'L0–L1 从零搭管线；提示词三种写法与硬规则', days: 'Day 1–2', levels: 'L0–L1', status: 'ready' },
  { id: 2, title: '像做实验一样调参', short: 'L2 批量与参数扫描；多人与场景', days: 'Day 3–4', levels: 'L2', status: 'ready' },
  { id: 3, title: '从草稿到成品', short: 'img2img、LoRA、放大', days: 'Day 5–9', levels: 'L3–L4', status: 'pending' },
  { id: 4, title: '精确控制', short: 'LLLite 结构控制、局部重绘与扩图', days: 'Day 10–11', levels: 'L5–L6', status: 'pending' },
  { id: 5, title: '拆开采样器·流水线化', short: '自定义采样、子图与蓝图、循环', days: 'Day 12–14', levels: 'L7–L8', status: 'pending' },
];

export const STAGE_STATUS_LABEL: Record<Stage['status'], string> = {
  ready: '已上线',
  partial: '部分上线',
  pending: '待迁移',
};

/** 四条纪律：贯穿全部级别，首页与每课底部展示 */
export const DISCIPLINES = [
  '固定种子：K采样器 seed 右侧控件设为 fixed，否则分不清是参数的功劳还是运气。',
  '一次只改一个变量；改完用图像表格把结果拼在一张图里看。',
  '先用 Turbo 调提示词和构图，再用 Base / Aesthetic 出成品。',
  '固定分辨率：噪声张量的形状跟着画布尺寸走，同种子换画幅就是另一张图。',
];
