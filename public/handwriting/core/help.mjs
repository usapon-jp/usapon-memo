export function setupHelp() {
  const menu = document.querySelector('.more');
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = '使い方';
  button.setAttribute('aria-haspopup', 'dialog');
  menu.querySelector('.menu').prepend(button);
  const dialog = document.createElement('dialog');
  dialog.className = 'handwriting-help';
  dialog.setAttribute('aria-labelledby', 'handwriting-help-title');
  const integrated = Boolean(document.getElementById('paste'));
  dialog.innerHTML = `
    <div class="help-heading"><h2 id="handwriting-help-title">手書きの使い方</h2><button type="button" aria-label="使い方を閉じる" autofocus>×</button></div>
    <div class="help-content">
      <details open><summary>描く・消す</summary>
        <p>道具を選んで、指やApple Pencilで描けます。消しゴムは選んだレイヤーだけを消します。</p>
        <p>ペンはなめらか、鉛筆は細かな質感、クレヨンはざらっとした風合い。マーカーは四角いペン先、水彩はやわらかな色ムラを楽しめます。</p>
      </details>
      <details><summary>太さ・濃さを変える</summary>
        <p>道具を押すと設定が開きます。5つの線の見本から太さを選び、バーや数字で微調整できます。不透明度を下げると薄く描けます。</p>
        <p>気に入った太さはバーを長押ししてキープ。道具ごとに2つまで保存できます。小さな印の近くをタップすると、その太さにぴったり合います。</p>
        <p>印をもう一度長押しすると解除。ドラッグでは印に止まらず微調整できます。キープは同じブラウザに保存されます。</p>
      </details>
      <details><summary>戻す・拡大する</summary>
        <p>左向きの矢印で1つ戻し、右向きの矢印でやり直せます。画面を二本指で軽くタップしても戻せます。</p>
        <p>二本指を広げると拡大、狭めると縮小。二本指を動かすと表示位置を移動できます。</p>
        <p>全部消したいときは「••• → まっさらにする」。間違えて消しても、戻す矢印で取り消せます。</p>
      </details>
      <details><summary>色を作る・集める</summary>
        <p>丸い色をタップすると描く色が変わります。色を作るボタンでは、円から好きな色を選べます。明るさやカラーコードでも調整できます。</p>
        <p>「この色に決定」で上の色の列に追加。色を長押しすると、パレットへの追加や削除を選べます。</p>
      </details>
      <details><summary>パレットを使う</summary>
        <p>パレットのボタンから「秋の色」などのセットを選ぶと、下の段の色がまとめて切り替わります。</p>
        <p>好きな色を選び、名前をつけて自分のセットも保存できます。パレットの色を長押しして「上に追加」を選ぶと、元の色を残したまま上の列にも置けます。</p>
      </details>
      <details><summary>レイヤー・クリップ</summary>
        <p>重なった紙のマークから、レイヤーを3つまで使えます。描きたいレイヤーを選び、絵や飾りを分けて描きましょう。</p>
        <p>小さなプレビューで中身を確認できます。表示・非表示、順番、濃さも変えられます。</p>
        <p>下向きに曲がった矢印のクリップをオンにすると、すぐ下のレイヤーに描いてある部分の内側だけに色が出ます。下が空白だと見えません。</p>
      </details>
      <details><summary>保存・スタンプにする</summary>
        <p>${integrated ? '右上の「保存」は、続きを描ける状態をこの端末の同じブラウザに残します。「保存した続きを開く」で戻せます。' : '右上の「保存」は、続きを描くためのファイルをダウンロードします。「保存した続きを開く」でそのファイルを選ぶと再開できます。'}</p>
        <p>「スタンプとして保存」は、描いた部分を背景のない画像にします。画像では筆跡やレイヤーをあとから編集できないので、続きを描くための保存もしておくと安心です。</p>
        ${integrated ? '<p>「貼り付ける」では背景あり・なしを選び、うさぽんメモへ渡せます。</p>' : ''}
        <p>絵は自動保存ではありません。閉じる前に「保存」を押してください。</p>
      </details>
    </div>`;
  document.body.append(dialog);
  const close = () => dialog.close();
  dialog.querySelector('.help-heading button').addEventListener('click', close);
  dialog.addEventListener('click', e => { if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  }});
  button.addEventListener('click', () => { menu.open = false; dialog.showModal(); });
  dialog.addEventListener('close', () => menu.querySelector('summary').focus());
}
