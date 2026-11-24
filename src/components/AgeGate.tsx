import { useEffect, useState } from 'react';

const KEY = 'anima:nsfw-ok';

interface Props {
  /** 受保护的内容容器 id；确认后移除其 hidden 属性 */
  targetId: string;
  /** 返回课程首页的链接 */
  backHref: string;
}

/**
 * 成人附录的选择加入门槛。纯前端：确认状态存 localStorage（anima:nsfw-ok）。
 * 页面本身 noindex、不进搜索索引；未确认时内容以 hidden 呈现。
 */
export default function AgeGate({ targetId, backHref }: Props) {
  const [ok, setOk] = useState<boolean | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(KEY) === '1';
    setOk(v);
    if (v) document.getElementById(targetId)?.removeAttribute('hidden');
  }, [targetId]);

  const unlock = () => {
    if (!checked) return;
    localStorage.setItem(KEY, '1');
    setOk(true);
    document.getElementById(targetId)?.removeAttribute('hidden');
    window.scrollTo({ top: 0 });
  };

  // 读取 localStorage 期间不闪烁表单
  if (ok === null) return <p className="verified">正在检查确认状态…</p>;
  if (ok) return null;

  return (
    <form className="agegate" onSubmit={(e) => { e.preventDefault(); unlock(); }}>
      <h1>成人内容附录</h1>
      <p>
        这一部分是 Anima 提示词体系中涉及成人内容的标签与规则的<strong>词典式参考资料</strong>：
        解释每个标签的含义、来源与常见误用，用于理解与排错，不含图片。
      </p>
      <ul>
        <li>模型许可是非商业许可，生成物的使用须遵守你所在地区与平台的规定。</li>
        <li>内容边界：涉及未成年人的性内容在任何情况下都不应生成；本附录对极端标签只做识别、不给用法。</li>
      </ul>
      <label>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>我已年满 18 周岁，了解上述说明，并选择查看这部分内容。</span>
      </label>
      <button type="submit" disabled={!checked}>确认并查看</button>
      <a className="back" href={backHref}>返回课程</a>
    </form>
  );
}
