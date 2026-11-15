import { t, onLang } from '../lang.js';
import { ULTRA, supportsUltra, switchUltra } from '../ultra-flag.js';

export function createQualitySettings(stage, beforeOpen) {
  const dialog = document.getElementById('qualityDialog');
  const title = document.getElementById('qualityTitle');
  const description = document.getElementById('qualityDescription');
  const warning = document.getElementById('qualityWarning');
  const confirm = document.getElementById('qualityConfirm');
  const cancel = document.getElementById('qualityCancel');
  const supported = supportsUltra(stage.renderer);
  const packButton = document.getElementById('materialPackButton');
  let fallback = false;

  function label() {
    packButton.querySelector('span').textContent = t('材质包', 'Texture');
    packButton.setAttribute('aria-pressed', String(ULTRA));
    const packName = ULTRA ? t('\u9ad8\u6e05\u6750\u8d28\u5305', 'HD Material Pack') : t('\u666e\u901a\u6750\u8d28\u5305', 'Normal Material Pack');
    packButton.title = t(`\u6750\u8d28\u5305\u5207\u6362\uff1a${packName}`, `Material pack switch: ${packName}`);
    packButton.setAttribute('aria-label', packButton.title);
    title.textContent = fallback ? t('\u5df2\u6062\u590d\u666e\u901a\u6750\u8d28\u5305', 'Normal Material Pack restored') : t('\u542f\u7528\u9ad8\u6e05\u6750\u8d28\u5305\uff1f', 'Enable HD Material Pack?');
    description.textContent = fallback
      ? t('超清模式启动失败，已自动恢复普通模式，可以继续游览。', 'Ultra could not start. Normal mode has been restored.')
      : t('开启更清晰的画面、水面反射、环境遮蔽、阳光光束与电影级泛光。', 'Enable a sharper image, water reflections, ambient occlusion, sun shafts and cinematic bloom.');
    warning.textContent = !supported
      ? t('当前浏览器或显卡不支持超清渲染，请使用普通模式。', 'Your browser or GPU does not support Ultra. Please use Normal mode.')
      : t('需要较强显卡，会增加显存、发热与耗电，低配设备可能卡顿。切换会刷新页面、重置当前位置，可随时从画质菜单恢复普通模式。', 'Requires a capable GPU; uses more memory and power and may cause heat or stuttering. Switching reloads the page and resets your position. Switch back using the material pack button.');
    if (supported && stage.quality.mobile) warning.textContent = t('手机和平板建议保持普通模式。', 'Normal mode is recommended on phones and tablets. ') + warning.textContent;
    confirm.hidden = fallback || !supported;
    cancel.textContent = fallback || !supported ? t('知道了', 'Got it') : t('保持普通', 'Keep Normal');
  }

  function open(isFallback = false) {
    fallback = isFallback;
    beforeOpen();
    label();
    if (!dialog.open) dialog.showModal();
    cancel.focus({ preventScroll: true });
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  packButton.addEventListener('click', () => {
    if (ULTRA) switchUltra(false);
    else open();
  });
  cancel.addEventListener('click', close);
  confirm.addEventListener('click', () => {
    if (!supported || fallback) return;
    confirm.disabled = true;
    switchUltra(true);
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => packButton.focus({ preventScroll: true }));
  onLang(label);
  label();

  return {
    isOpen: () => dialog.open,
    close,
    showFallback() {
      const url = new URL(location.href);
      if (!url.searchParams.has('quality-fallback')) return;
      url.searchParams.delete('quality-fallback');
      history.replaceState(history.state, '', url.href);
      open(true);
    },
  };
}
