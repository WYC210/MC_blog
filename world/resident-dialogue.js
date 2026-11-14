import { Raycaster, Vector2 } from 'three';
import { t, onLang, langSwitch } from '@engine/lang.js';
import { RESIDENT_TOPICS, RESIDENT_WELCOME, residentWithinTalkingDistance } from './resident-dialogue-data.js';

export function createResidentDialogue({ resident, player, stage, rig, sound, name, qinIsland }) {
  const map = document.querySelector('#bigmap'), weather = document.querySelector('#weatherMenu'), phone = document.querySelector('#phone');
  const prompt = document.createElement('button');
  prompt.id = 'residentPrompt'; prompt.type = 'button'; prompt.className = 'gui'; prompt.hidden = true;
  prompt.setAttribute('aria-haspopup', 'dialog'); prompt.setAttribute('aria-controls', 'residentDialogue');
  prompt.innerHTML = '<kbd>F</kbd><span></span>';
  document.querySelector('#hud').append(prompt);
  const dialog = document.createElement('dialog');
  dialog.id = 'residentDialogue'; dialog.className = 'gui'; dialog.setAttribute('aria-labelledby', 'residentDialogueTitle');
  dialog.innerHTML = '<header><div><small></small><h2 id="residentDialogueTitle"></h2></div><button type="button" class="gui" data-close></button></header><div class="resident-dialogue-body"><section class="resident-answer" aria-live="polite" aria-atomic="true"><b></b><p></p></section><h3 id="residentTopicsTitle"></h3><div class="resident-topics" role="group" aria-labelledby="residentTopicsTitle"></div></div>';
  const header = dialog.querySelector('header'), closeButton = dialog.querySelector('[data-close]');
  const language = langSwitch(); language.classList.add('gui'); header.insertBefore(language, closeButton);
  const title = dialog.querySelector('h2'), subtitle = dialog.querySelector('small'), topicTitle = dialog.querySelector('h3');
  const speaker = dialog.querySelector('.resident-answer b'), answer = dialog.querySelector('.resident-answer p');
  const choices = dialog.querySelector('.resident-topics'), promptLabel = prompt.querySelector('span');
  const buttons = RESIDENT_TOPICS.map(topic => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'gui'; button.dataset.topic = topic.id; button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      selected = topic; labels(); dialog.querySelector('.resident-dialogue-body').scrollTop = 0; sound?.play('click');
    });
    choices.append(button);
    return button;
  });
  document.body.append(dialog);
  const raycaster = new Raycaster(), screen = new Vector2(), hits = [];
  let selected = null, shown = false, clock = 0, heldExit = '';

  function labels() {
    promptLabel.textContent = t(`和 ${name} 聊一聊`, `Talk to ${name}`);
    title.textContent = t(`和 ${name} 聊聊`, `A chat with ${name}`);
    subtitle.textContent = t('世界开发者', 'World developer');
    closeButton.textContent = t('结束对话', 'Goodbye');
    topicTitle.textContent = t('想聊些什么？', 'What would you like to know?');
    speaker.textContent = name;
    answer.textContent = t(...(selected?.answer || RESIDENT_WELCOME));
    for (const [index, button] of buttons.entries()) {
      button.textContent = t(...RESIDENT_TOPICS[index].label);
      button.setAttribute('aria-pressed', String(selected === RESIDENT_TOPICS[index]));
    }
  }

  function blocked() {
    return document.hidden || rig.introActive || !map.hidden || !weather.hidden || phone.classList.contains('up') ||
      document.body.classList.contains('lookout-viewing') || document.body.classList.contains('coaster-riding') ||
      document.body.classList.contains('coaster-available') ||
      qinIsland?.encounter.active || !!document.querySelector('dialog[open]:not(#residentDialogue)');
  }

  function available() {
    return residentWithinTalkingDistance(player, resident) && !player.travelling && !blocked() && !qinIsland?.encounter.ready;
  }

  function showPrompt(visible) {
    prompt.hidden = !visible;
    if (shown === visible) return;
    shown = visible; document.body.classList.toggle('resident-talk-available', visible);
  }

  function close() {
    if (!dialog.open) return false;
    dialog.close();
    document.body.classList.remove('resident-talking');
    dispatchEvent(new Event('blur'));
    return true;
  }

  function interact() {
    if (dialog.open) return true;
    if (!available()) return false;
    selected = null; labels(); player.cancel(); resident.save();
    dispatchEvent(new Event('blur'));
    showPrompt(false); document.body.classList.add('resident-talking');
    dialog.showModal(); dialog.querySelector('.resident-dialogue-body').scrollTop = 0;
    buttons[0].focus({ preventScroll: true }); sound?.play('click');
    return true;
  }

  function tap(clientX, clientY, picked) {
    if (dialog.open) return true;
    if (!available()) return false;
    screen.set(clientX / innerWidth * 2 - 1, 1 - clientY / innerHeight * 2);
    raycaster.setFromCamera(screen, stage.camera); resident.root.updateWorldMatrix(true, true);
    hits.length = 0; raycaster.intersectObject(resident.root, true, hits);
    if (!hits.length) return false;
    const distance = hits[0].distance;
    if (picked?.block?.t < distance - 0.2 || picked?.island?.t < distance - 0.2) return false;
    return interact();
  }

  prompt.addEventListener('click', interact);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { if (!dialog.open) { document.body.classList.remove('resident-talking'); dispatchEvent(new Event('blur')); } });
  addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (!dialog.open && key !== heldExit) return;
    event.stopImmediatePropagation();
    if (key === heldExit || key === 'escape' || key === 'f') {
      event.preventDefault();
      if (!event.repeat) { heldExit = key; close(); }
    } else if (key !== 'tab' && key !== 'enter' && key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) event.preventDefault();
  }, true);
  addEventListener('keyup', event => { if (event.key.toLowerCase() === heldExit) heldExit = ''; }, true);
  onLang(labels); labels();
  return {
    get active() { return dialog.open; },
    interact, tap, close,
    update(dt) {
      if (dialog.open && (!residentWithinTalkingDistance(player, resident) || blocked())) close();
      clock += dt;
      if (clock < 0.1) return;
      clock = 0; showPrompt(!dialog.open && available());
    },
  };
}
