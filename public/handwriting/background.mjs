// Preview only: CSS backgrounds never enter the drawing document or PNG export.
const surface = document.getElementById('surface');
const paper = document.getElementById('paper');
const label = paper.closest('label');
const picker = document.createElement('select');
picker.id = 'background';
picker.setAttribute('aria-label', '背景');
for (const [value, text] of [['plain', '白紙'], ['ruled', '罫線'], ['grid', '方眼'], ['checker', '透過確認'], ['dark', '濃いグレー']]) {
  picker.add(new Option(text, value));
}
// Keep the original input hidden for the existing host adapter's initialization.
paper.hidden = true;
paper.checked = false;
label.replaceChildren(document.createTextNode('背景'), picker, paper);
function updateBackground() {
  surface.classList.remove('paper');
  surface.dataset.background = picker.value;
}
picker.addEventListener('change', updateBackground);
updateBackground();
