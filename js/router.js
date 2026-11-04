// 장면 전환기. 장면은 { mount(root, params, ctx) -> unmount? } 모양이다.
export function createRouter(root) {
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
      // store와 state는 뒤 작업(Task 5·7)에서 채운다.
      const ctx = { router, store: null, getState: () => null, setState: () => {} };
      current = name;
      const result = scene.mount(root, params, ctx);
      unmount = typeof result === 'function' ? result : null;
    },
    get current() {
      return current;
    },
  };
  return router;
}
