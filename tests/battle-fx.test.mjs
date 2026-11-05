import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HIT_MS, IMPACT_MS, hitPlan, planTracks } from '../js/ui/battle-fx.js';

const AMPLITUDE = (frames) => Math.max(0, ...frames.map(Math.abs));

test('연출 길이: HIT_MS는 0.8초 이하이고, 모든 움직임이 그 안에 끝난다(지연 + 길이)', () => {
  assert.ok(HIT_MS <= 800);
  for (const lastHit of [false, true]) {
    for (const streak of [1, 2, 3, 6]) {
      for (const still of [false, true]) {
        const tracks = planTracks(hitPlan({ streak, lastHit, still }));
        assert.ok(tracks.length > 0);
        for (const t of tracks) {
          assert.ok(t.delay >= 0 && t.duration > 0, `${t.name}`);
          assert.ok(t.delay + t.duration <= HIT_MS, `streak ${streak} last ${lastHit} still ${still}: ${t.name} ${t.delay}+${t.duration} > ${HIT_MS}`);
        }
      }
    }
  }
});

test('움직임 줄이기: 날아가기·흔들림·화면 흔들림·파동 없이 서서히 나타나기만', () => {
  for (const lastHit of [false, true]) {
    const plan = hitPlan({ streak: 5, lastHit, still: true });
    assert.equal(plan.still, true);
    assert.deepEqual(plan.monsterShake, [], '몬스터 흔들림 프레임 없음');
    assert.deepEqual(plan.screenShake, [], '화면 흔들림 프레임 없음');
    assert.equal(plan.fly, null);
    assert.deepEqual(plan.rings, []);
    assert.equal(plan.sparks, 0);
    assert.ok(plan.glow, '금빛이 서서히 켜졌다 꺼진다');
    assert.equal(!!plan.dissolve, lastHit, '마지막 일격은 몬스터가 서서히 흐려짐');
  }
});

test('보통: 몬스터 ±12px, 화면 ±4px 흔들림, 알갱이 12~16개, 파동 1겹, 낱말은 몬스터에 닿는 순간 터진다', () => {
  const plan = hitPlan({ streak: 1 });
  assert.equal(AMPLITUDE(plan.monsterShake), 12);
  assert.equal(AMPLITUDE(plan.screenShake), 4);
  assert.ok(plan.monsterShake[0] === 0 && plan.monsterShake.at(-1) === 0, '흔들림은 제자리에서 시작해 제자리로 돌아온다');
  assert.equal(plan.screenShakeTrack.duration, 120);
  assert.ok(plan.sparks >= 12 && plan.sparks <= 16, `알갱이 ${plan.sparks}`);
  assert.equal(plan.rings.length, 1);
  assert.equal(plan.fly.delay + plan.fly.duration, IMPACT_MS, '날아가기가 끝나는 때 = 맞는 때');
  assert.ok(plan.rings.every((r) => r.delay >= IMPACT_MS) && plan.cell.delay >= IMPACT_MS);
  assert.equal(plan.mist, null);
  assert.equal(plan.dissolve, null);
});

test('연속 정답 3번부터: 파동 2겹, 알갱이 1.5배', () => {
  const two = hitPlan({ streak: 2 });
  const three = hitPlan({ streak: 3 });
  assert.equal(two.rings.length, 1);
  assert.equal(three.rings.length, 2);
  assert.equal(three.sparks, Math.round(two.sparks * 1.5));
  assert.equal(hitPlan({ streak: 9 }).rings.length, 2);
});

test('마지막 일격: 몬스터는 흔들리지 않고 안개 조각으로 흩어지며 그 자리에 빛이 퍼진다', () => {
  const plan = hitPlan({ streak: 1, lastHit: true });
  assert.deepEqual(plan.monsterShake, []);
  assert.ok(plan.mist.count >= 10);
  assert.ok(plan.bloom && plan.dissolve);
  assert.ok(plan.dissolve.delay >= IMPACT_MS);
});
