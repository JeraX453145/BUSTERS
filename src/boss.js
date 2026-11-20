import * as THREE from 'three';

export class Boss {
  constructor(scene, position) {
    this.scene = scene;
    this.maxHp = 1200;
    this.hp = this.maxHp;
    this.isDead = false;
    this.speed = 4.2;

    // ボスの3Dモデル（仮：角の生えた巨大赤鬼風シルエット）
    this.mesh = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(1.8, 2.2, 4.2, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb30000, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 2.1;
    body.castShadow = true;
    this.mesh.add(body);

    // 2本の角
    const hornGeo = new THREE.ConeGeometry(0.35, 1.4, 8);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xffeaa7 });
    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(-0.8, 4.5, 0.4);
    leftHorn.rotation.z = 0.2;
    const rightHorn = new THREE.Mesh(hornGeo, hornMat);
    rightHorn.position.set(0.8, 4.5, 0.4);
    rightHorn.rotation.z = -0.2;
    this.mesh.add(leftHorn, rightHorn);

    // 巨大な金棒
    const clubGeo = new THREE.CylinderGeometry(0.45, 0.25, 3.8, 10);
    const clubMat = new THREE.MeshStandardMaterial({ color: 0x2d3436 });
    const club = new THREE.Mesh(clubGeo, clubMat);
    club.position.set(2.3, 2.2, 0.8);
    club.rotation.x = Math.PI / 4;
    this.mesh.add(club);

    this.mesh.position.copy(position);
    this.scene.add(this.mesh);

    // 攻撃AIステート
    this.state = 'CHASE'; // CHASE, TELEGRAPH (赤床予兆中), COOLDOWN
    this.timer = 0;
    this.telegraphMesh = null;
    this.attackType = 'CIRCLE'; // CIRCLE or LINE
    this.chargeDir = new THREE.Vector3();
  }

  update(dt, partyMembers, onDamageMember, spawnEffect) {
    if (this.isDead) return;

    // 一番近い生存メンバーを探す（タンクの挑発があれば優先）
    const alive = partyMembers.filter(m => !m.isDead);
    if (alive.length === 0) return;

    let target = alive[0];
    let minDist = Infinity;
    for (const m of alive) {
      const d = this.mesh.position.distanceTo(m.mesh.position) * (m.tauntTimer > 0 ? 0.3 : 1.0);
      if (d < minDist) {
        minDist = d;
        target = m;
      }
    }

    const actualDist = this.mesh.position.distanceTo(target.mesh.position);

    if (this.state === 'CHASE') {
      // ターゲットへ移動
      const dir = new THREE.Vector3().subVectors(target.mesh.position, this.mesh.position);
      dir.y = 0;
      if (dir.length() > 0.1) {
        dir.normalize();
        this.mesh.position.addScaledVector(dir, this.speed * dt);
        this.mesh.lookAt(target.mesh.position.x, this.mesh.position.y, target.mesh.position.z);
      }

      // 近づいたら赤床攻撃開始
      if (actualDist < 9.5) {
        this.startTelegraph(target.mesh.position);
      }
    } else if (this.state === 'TELEGRAPH') {
      this.timer -= dt;
      if (this.telegraphMesh) {
        // 予兆の点滅演出
        this.telegraphMesh.material.opacity = 0.35 + Math.sin(this.timer * 18) * 0.15;
      }
      if (this.timer <= 0) {
        this.executeAttack(alive, onDamageMember, spawnEffect);
      }
    } else if (this.state === 'COOLDOWN') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'CHASE';
      }
    }
  }

  startTelegraph(targetPos) {
    this.state = 'TELEGRAPH';
    this.timer = 1.6; // 1.6秒の猶予（避ける時間）
    this.attackType = Math.random() < 0.55 ? 'CIRCLE' : 'LINE';

    if (this.attackType === 'CIRCLE') {
      // ボス周囲の広範囲衝撃波（赤床）
      const geo = new THREE.CircleGeometry(7.5, 32);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
      this.telegraphMesh = new THREE.Mesh(geo, mat);
      this.telegraphMesh.rotation.x = -Math.PI / 2;
      this.telegraphMesh.position.set(this.mesh.position.x, 0.08, this.mesh.position.z);
    } else {
      // 直線突進（赤床）
      this.chargeDir.subVectors(targetPos, this.mesh.position).setY(0).normalize();
      this.mesh.lookAt(this.mesh.position.clone().add(this.chargeDir));
      const geo = new THREE.PlaneGeometry(4.2, 16);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
      this.telegraphMesh = new THREE.Mesh(geo, mat);
      this.telegraphMesh.rotation.x = -Math.PI / 2;
      const angle = Math.atan2(this.chargeDir.x, this.chargeDir.z);
      this.telegraphMesh.rotation.z = -angle;
      const center = this.mesh.position.clone().addScaledVector(this.chargeDir, 8);
      this.telegraphMesh.position.set(center.x, 0.08, center.z);
    }
    this.scene.add(this.telegraphMesh);
  }

  executeAttack(aliveMembers, onDamageMember, spawnEffect) {
    if (this.telegraphMesh) {
      this.scene.remove(this.telegraphMesh);
      this.telegraphMesh = null;
    }

    if (this.attackType === 'CIRCLE') {
      spawnEffect(this.mesh.position, 0xff3300, 7.5);
      for (const m of aliveMembers) {
        if (m.mesh.position.distanceTo(this.mesh.position) <= 7.5) {
          onDamageMember(m, 45);
        }
      }
    } else {
      // 突進移動＆ヒット判定
      const startPos = this.mesh.position.clone();
      this.mesh.position.addScaledVector(this.chargeDir, 13);
      spawnEffect(this.mesh.position, 0xff6600, 4.0);

      for (const m of aliveMembers) {
        // 線分と点の距離で当たり判定
        const toMember = new THREE.Vector3().subVectors(m.mesh.position, startPos).setY(0);
        const proj = toMember.dot(this.chargeDir);
        if (proj >= -1 && proj <= 15) {
          const perpDist = toMember.clone().addScaledVector(this.chargeDir, -proj).length();
          if (perpDist <= 2.5) {
            onDamageMember(m, 55);
          }
        }
      }
    }

    this.state = 'COOLDOWN';
    this.timer = 1.2;
  }

  takeDamage(amount) {
    if (this.isDead) return;
    this.hp = Math.max(0, this.hp - amount);
    document.getElementById('boss-hp-fill').style.width = `${(this.hp / this.maxHp) * 100}%`;
    if (this.hp <= 0) {
      this.isDead = true;
      this.scene.remove(this.mesh);
    }
  }
}
