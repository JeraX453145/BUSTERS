import * as THREE from 'three';
import { PARTY_DATA } from './characters.js';
import { Boss } from './boss.js';
import { InputController } from './controls.js';

// シーン・カメラ・レンダラー初期化
const container = document.getElementById('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x161b2e); // 夜の鬼時間風ネイビー
scene.fog = new THREE.Fog(0x161b2e, 35, 85);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 150);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// ライティング
const ambientLight = new THREE.AmbientLight(0x8899cc, 1.2);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(20, 40, 20);
dirLight.castShadow = true;
scene.add(dirLight);

// 広いマップ（夜の町広場）
const MAP_SIZE = 70;
const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x262d42, roughness: 0.8 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// マップ上のグリッド線と障害物（ビル・鳥居風の柱など）
const grid = new THREE.GridHelper(MAP_SIZE, 28, 0x3b466b, 0x2f3856);
grid.position.y = 0.02;
scene.add(grid);

const obstacles = [];
const pillarGeo = new THREE.BoxGeometry(3, 5, 3);
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x3d486b });
const pillarCoords = [[-12, -12], [12, -12], [-12, 12], [12, 12], [0, -18], [0, 18]];
pillarCoords.forEach(([x, z]) => {
  const mesh = new THREE.Mesh(pillarGeo, pillarMat);
  mesh.position.set(x, 2.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  obstacles.push({ x, z, radius: 2.2 });
});

// ゲーム状態変数
let onidamaCount = 0;
let ultCharge = 0; // 0 ~ 100
let activeIndex = 0; // 操作中のキャラ番号
let isGameOver = false;

// エフェクト管理
const effects = [];
function spawnEffect(pos, color, radius) {
  const geo = new THREE.RingGeometry(0.2, radius, 24);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(pos.x, 0.15, pos.z);
  scene.add(mesh);
  effects.push({ mesh, life: 0.35 });
}

// 鬼玉（ドロップアイテム）
const onidamas = [];
function spawnOnidama(pos, count = 3) {
  for (let i = 0; i < count; i++) {
    const geo = new THREE.OctahedronGeometry(0.45);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xff8800, emissiveIntensity: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      pos.x + (Math.random() - 0.5) * 3,
      0.6,
      pos.z + (Math.random() - 0.5) * 3
    );
    scene.add(mesh);
    onidamas.push(mesh);
  }
}

// 4人パーティの生成
const partyMembers = PARTY_DATA.map((data, idx) => {
  const group = new THREE.Group();
  const bodyGeo = new THREE.CapsuleGeometry(0.6, 0.9, 8, 16);
  const bodyMat = new THREE.MeshStandardMaterial({ color: data.color });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);

  // 向きがわかる目（バイザー）
  const eyeGeo = new THREE.BoxGeometry(0.7, 0.25, 0.3);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eye = new THREE.Mesh(eyeGeo, eyeMat);
  eye.position.set(0, 1.35, 0.5);
  group.add(eye);

  // 操作中リング
  const ringGeo = new THREE.RingGeometry(0.85, 1.05, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  ring.visible = idx === 0;
  group.add(ring);

  group.position.set((idx - 1.5) * 2.5, 0, 22);
  scene.add(group);

  return {
    ...data,
    hp: data.maxHp,
    isDead: false,
    mesh: group,
    ring,
    cooldown: 0,
    shieldTimer: 0,
    tauntTimer: 0
  };
});

// パーティHUDの構築と更新
const partyHud = document.getElementById('party-hud');
function renderPartyHud() {
  partyHud.innerHTML = '';
  partyMembers.forEach((m, idx) => {
    const card = document.createElement('div');
    card.className = `member-card ${idx === activeIndex ? 'active' : ''} ${m.isDead ? 'dead' : ''}`;
    card.innerHTML = `
      <div class="member-dot" style="background:${m.cssColor}"></div>
      <div class="member-info">
        <div>${m.name.split('（')[0]}</div>
        <div class="mini-hp-bg">
          <div class="mini-hp-fill" style="width:${(m.hp / m.maxHp) * 100}%"></div>
        </div>
      </div>
    `;
    card.addEventListener('pointerdown', () => {
      if (!m.isDead) switchCharacter(idx);
    });
    partyHud.appendChild(card);
  });
}

function switchCharacter(newIdx) {
  partyMembers[activeIndex].ring.visible = false;
  activeIndex = newIdx;
  partyMembers[activeIndex].ring.visible = true;
  document.getElementById('btn-skill1').textContent = partyMembers[activeIndex].skill1Name;
  document.getElementById('btn-skill2').textContent = partyMembers[activeIndex].skill2Name;
  renderPartyHud();
}

// 雑魚敵の生成
const minions = [];
function spawnMinions(count) {
  for (let i = 0; i < count; i++) {
    const geo = new THREE.ConeGeometry(0.7, 1.5, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9b59b6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((Math.random() - 0.5) * 50, 0.75, (Math.random() - 0.5) * 40);
    mesh.castShadow = true;
    scene.add(mesh);
    minions.push({ mesh, hp: 45, cooldown: 0 });
  }
}
spawnMinions(10);

// 巨大ボスの生成
const boss = new Boss(scene, new THREE.Vector3(0, 0, -16));

// ダメージ・回復処理
function damageMember(member, amount) {
  if (member.isDead) return;
  const finalDmg = member.shieldTimer > 0 ? Math.floor(amount * 0.3) : amount;
  member.hp = Math.max(0, member.hp - finalDmg);
  if (member.hp <= 0) {
    member.isDead = true;
    member.mesh.rotation.z = Math.PI / 2; // 気絶表現
    // 操作キャラが倒れたら生存キャラへ自動切り替え
    if (partyMembers[activeIndex] === member) {
      const nextAlive = partyMembers.findIndex(m => !m.isDead);
      if (nextAlive !== -1) switchCharacter(nextAlive);
    }
  }
  renderPartyHud();
}

function addUltCharge(val) {
  ultCharge = Math.min(100, ultCharge + val);
  const btn = document.getElementById('btn-ult');
  btn.disabled = ultCharge < 100;
  btn.textContent = ultCharge < 100 ? `${Math.floor(ultCharge)}%` : '必殺!';
}

// アクション実行関数
function performAttack(attacker) {
  if (attacker.isDead || attacker.cooldown > 0) return;
  attacker.cooldown = attacker.attackCooldown;

  // 一番近い敵（ボスまたは雑魚）をオートエイム
  let targetPos = null;
  let minDist = attacker.attackRange;

  if (!boss.isDead) {
    const d = attacker.mesh.position.distanceTo(boss.mesh.position);
    if (d <= minDist + 2.0) {
      minDist = d;
      targetPos = boss.mesh.position;
      boss.takeDamage(attacker.attackDamage);
      addUltCharge(8);
    }
  }

  for (let i = minions.length - 1; i >= 0; i--) {
    const min = minions[i];
    const d = attacker.mesh.position.distanceTo(min.mesh.position);
    if (d <= attacker.attackRange) {
      targetPos = min.mesh.position;
      min.hp -= attacker.attackDamage;
      addUltCharge(6);
      if (min.hp <= 0) {
        spawnOnidama(min.mesh.position, 3);
        scene.remove(min.mesh);
        minions.splice(i, 1);
      }
      break;
    }
  }

  if (targetPos) {
    attacker.mesh.lookAt(targetPos.x, attacker.mesh.position.y, targetPos.z);
    spawnEffect(targetPos, attacker.color, 1.5);
  } else {
    // 空振りエフェクト
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(attacker.mesh.quaternion);
    spawnEffect(attacker.mesh.position.clone().addScaledVector(forward, 1.5), attacker.color, 1.2);
  }
}

// コントローラー接続
const controller = new InputController({
  onAttack: () => performAttack(partyMembers[activeIndex]),
  onSkill1: () => {
    const p = partyMembers[activeIndex];
    if (p.isDead) return;
    // 回避ダッシュ＆短時間ダメージ軽減
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(p.mesh.quaternion);
    p.mesh.position.addScaledVector(forward, 4.5);
    p.shieldTimer = 1.0;
    spawnEffect(p.mesh.position, 0x00ffff, 1.8);
  },
  onSkill2: () => {
    const p = partyMembers[activeIndex];
    if (p.isDead) return;
    if (p.role === 'HEALER') {
      // 回復の陣
      spawnEffect(p.mesh.position, 0x2ed573, 5.0);
      partyMembers.forEach(m => {
        if (!m.isDead && m.mesh.position.distanceTo(p.mesh.position) <= 5.0) {
          m.hp = Math.min(m.maxHp, m.hp + 45);
        }
      });
      renderPartyHud();
    } else if (p.role === 'TANK') {
      p.tauntTimer = 5.0;
      p.shieldTimer = 4.0;
      spawnEffect(p.mesh.position, 0xffa502, 4.0);
    } else {
      // 周囲範囲攻撃
      spawnEffect(p.mesh.position, p.color, 4.5);
      if (!boss.isDead && boss.mesh.position.distanceTo(p.mesh.position) <= 5.5) {
        boss.takeDamage(45);
      }
      minions.forEach(m => {
        if (m.mesh.position.distanceTo(p.mesh.position) <= 4.5) m.hp -= 45;
      });
    }
  },
  onUlt: () => {
    if (ultCharge < 100) return;
    ultCharge = 0;
    addUltCharge(0);
    const p = partyMembers[activeIndex];
    spawnEffect(p.mesh.position, 0xffd700, 9.0);

    // 必殺技：全体回復＋周囲の敵に超大ダメージ
    partyMembers.forEach(m => {
      if (m.isDead) {
        m.isDead = false;
        m.mesh.rotation.z = 0;
      }
      m.hp = Math.min(m.maxHp, m.hp + 60);
    });
    renderPartyHud();

    if (!boss.isDead && boss.mesh.position.distanceTo(p.mesh.position) <= 10.0) {
      boss.takeDamage(160);
    }
  }
});

switchCharacter(0);

// メインゲームループ
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (isGameOver) return;

  const leader = partyMembers[activeIndex];

  // 1. 操作キャラの移動
  if (!leader.isDead) {
    const move = controller.getMovement();
    if (move.x !== 0 || move.z !== 0) {
      leader.mesh.position.x += move.x * leader.speed * dt;
      leader.mesh.position.z += move.z * leader.speed * dt;
      const targetAngle = Math.atan2(move.x, move.z);
      leader.mesh.rotation.y = targetAngle;
    }
  }

  // 2. お供AI（3人の仲間）の追従＆自動戦闘＆お祓い蘇生
  partyMembers.forEach((member, idx) => {
    if (member.cooldown > 0) member.cooldown -= dt;
    if (member.shieldTimer > 0) member.shieldTimer -= dt;
    if (member.tauntTimer > 0) member.tauntTimer -= dt;

    // マップ端制限
    const limit = MAP_SIZE / 2 - 1.5;
    member.mesh.position.x = Math.max(-limit, Math.min(limit, member.mesh.position.x));
    member.mesh.position.z = Math.max(-limit, Math.min(limit, member.mesh.position.z));

    if (idx === activeIndex || member.isDead) return;

    // 倒れている仲間がいれば近づいてお祓い（蘇生）
    const fallen = partyMembers.find(m => m.isDead);
    if (fallen) {
      const toFallen = new THREE.Vector3().subVectors(fallen.mesh.position, member.mesh.position).setY(0);
      if (toFallen.length() > 1.5) {
        toFallen.normalize();
        member.mesh.position.addScaledVector(toFallen, member.speed * 0.9 * dt);
      } else {
        fallen.isDead = false;
        fallen.hp = Math.floor(fallen.maxHp * 0.5);
        fallen.mesh.rotation.z = 0;
        spawnEffect(fallen.mesh.position, 0x00ffcc, 2.5);
        renderPartyHud();
      }
      return;
    }

    // リーダーについていきつつ、近くの敵を攻撃
    const distToLeader = member.mesh.position.distanceTo(leader.mesh.position);
    if (distToLeader > 4.5) {
      const dir = new THREE.Vector3().subVectors(leader.mesh.position, member.mesh.position).setY(0).normalize();
      member.mesh.position.addScaledVector(dir, member.speed * 0.95 * dt);
      member.mesh.lookAt(leader.mesh.position.x, member.mesh.position.y, leader.mesh.position.z);
    } else {
      performAttack(member);
    }
  });

  // 3. 雑魚敵のAI
  minions.forEach(min => {
    if (min.cooldown > 0) min.cooldown -= dt;
    const d = min.mesh.position.distanceTo(leader.mesh.position);
    if (d < 16 && d > 1.8) {
      const dir = new THREE.Vector3().subVectors(leader.mesh.position, min.mesh.position).setY(0).normalize();
      min.mesh.position.addScaledVector(dir, 3.8 * dt);
    } else if (d <= 1.8 && min.cooldown <= 0) {
      damageMember(leader, 8);
      min.cooldown = 1.5;
    }
  });

  // 4. ボス更新
  boss.update(dt, partyMembers, damageMember, spawnEffect);

  // 5. 鬼玉の吸い込み処理
  for (let i = onidamas.length - 1; i >= 0; i--) {
    const orb = onidamas[i];
    orb.rotation.y += 3 * dt;
    const d = orb.position.distanceTo(leader.mesh.position);
    if (d < 6.0) {
      const pull = new THREE.Vector3().subVectors(leader.mesh.position, orb.position).normalize();
      orb.position.addScaledVector(pull, 14 * dt);
    }
    if (d < 1.2) {
      onidamaCount += 10;
      document.getElementById('onidama-count').textContent = onidamaCount;
      scene.remove(orb);
      onidamas.splice(i, 1);
    }
  }

  // 6. エフェクト更新
  for (let i = effects.length - 1; i >= 0; i--) {
    const ef = effects[i];
    ef.life -= dt;
    ef.mesh.scale.addScalar(2 * dt);
    ef.mesh.material.opacity = ef.life * 2;
    if (ef.life <= 0) {
      scene.remove(ef.mesh);
      effects.splice(i, 1);
    }
  }

  // 7. カメラ追従（ブロスタ風の斜め見下ろし視点）
  const camTarget = new THREE.Vector3(leader.mesh.position.x, 22, leader.mesh.position.z + 20);
  camera.position.lerp(camTarget, 0.1);
  camera.lookAt(leader.mesh.position.x, 0, leader.mesh.position.z - 2);

  // 8. 勝敗判定
  if (boss.isDead) {
    isGameOver = true;
    document.getElementById('result-title').textContent = 'BIG BOSS 撃破！';
    document.getElementById('result-desc').textContent = `獲得した鬼玉: ${onidamaCount}`;
    document.getElementById('result-modal').classList.remove('hidden');
  } else if (partyMembers.every(m => m.isDead)) {
    isGameOver = true;
    document.getElementById('result-title').textContent = '全滅してしまった…';
    document.getElementById('result-title').style.color = '#ff4757';
    document.getElementById('result-desc').textContent = `獲得した鬼玉: ${onidamaCount}`;
    document.getElementById('result-modal').classList.remove('hidden');
  }

  renderer.render(scene, camera);
}

document.getElementById('btn-restart').addEventListener('click', () => location.reload());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
