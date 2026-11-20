export class InputController {
  constructor(callbacks) {
    this.moveVector = { x: 0, z: 0 };
    this.callbacks = callbacks;
    this.keys = {};

    this.initJoystick();
    this.initButtons();
    this.initKeyboard();
  }

  initJoystick() {
    const zone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    const maxRadius = 38;
    let activeTouchId = null;
    let center = { x: 0, y: 0 };

    const updateStick = (clientX, clientY) => {
      const dx = clientX - center.x;
      const dy = clientY - center.y;
      const dist = Math.min(Math.hypot(dx, dy), maxRadius);
      const angle = Math.atan2(dy, dx);

      const stickX = Math.cos(angle) * dist;
      const stickY = Math.sin(angle) * dist;
      stick.style.transform = `translate(${stickX}px, ${stickY}px)`;

      // 正規化した移動ベクトル（-1 ~ 1）
      this.moveVector.x = (stickX / maxRadius);
      this.moveVector.z = (stickY / maxRadius);
    };

    const resetStick = () => {
      activeTouchId = null;
      stick.style.transform = 'translate(0px, 0px)';
      this.moveVector.x = 0;
      this.moveVector.z = 0;
    };

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      activeTouchId = touch.identifier;
      const rect = zone.getBoundingClientRect();
      center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateStick(touch.clientX, touch.clientY);
    });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === activeTouchId) {
          updateStick(touch.clientX, touch.clientY);
        }
      }
    });

    zone.addEventListener('touchend', (e) => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === activeTouchId) resetStick();
      }
    });

    // PCマウスでもスティック操作テスト可能にする
    let mouseDown = false;
    zone.addEventListener('mousedown', (e) => {
      mouseDown = true;
      const rect = zone.getBoundingClientRect();
      center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateStick(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => {
      if (mouseDown) updateStick(e.clientX, e.clientY);
    });
    window.addEventListener('mouseup', () => {
      if (mouseDown) {
        mouseDown = false;
        resetStick();
      }
    });
  }

  initButtons() {
    document.getElementById('btn-attack').addEventListener('pointerdown', () => this.callbacks.onAttack());
    document.getElementById('btn-skill1').addEventListener('pointerdown', () => this.callbacks.onSkill1());
    document.getElementById('btn-skill2').addEventListener('pointerdown', () => this.callbacks.onSkill2());
    document.getElementById('btn-ult').addEventListener('pointerdown', () => this.callbacks.onUlt());
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.callbacks.onAttack();
      if (e.code === 'ShiftLeft') this.callbacks.onSkill1();
      if (e.code === 'KeyE') this.callbacks.onSkill2();
      if (e.code === 'KeyQ') this.callbacks.onUlt();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  getMovement() {
    let x = this.moveVector.x;
    let z = this.moveVector.z;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z };
  }
}
