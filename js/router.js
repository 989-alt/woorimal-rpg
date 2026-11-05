// 장면 전환기. 장면은 { mount(root, params, ctx) -> unmount? } 모양이다.
// services({ store, getState, setState })는 main.js가 넣어 ctx에 그대로 실린다.
export function createRouter(root, services = {}) {
  const scenes = new Map();
  let current = null;
  let unmount = null;

  const router = {
    register(name, scene) {
      scenes.set(name, scene);
    },
    show(name, params = {}) {
      const scene = scenes.get(name);
      if (!scene) throw new Error(`알 수 없는 장면: ${name}`);
      if (unmount) {
        const done = unmount;
        unmount = null;
        current = null;
        done();
      }
      const ctx = { store: null, getState: () => null, setState: () => {}, ...services, router };
      const result = scene.mount(root, params, ctx);
      // 그리기에 성공한 뒤에만 지금 장면으로 삼는다.
      unmount = typeof result === 'function' ? result : null;
      current = name;
    },
    get current() {
      return current;
    },
  };
  return router;
}
