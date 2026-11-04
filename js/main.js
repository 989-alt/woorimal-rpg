import { createRouter } from './router.js';

const boot = {
  mount(root) {
    const el = document.createElement('main');
    el.dataset.scene = 'boot';
    el.textContent = '말빛 한울';
    root.appendChild(el);
    return () => el.remove();
  },
};

const router = createRouter(document.getElementById('app'));
router.register('boot', boot);
router.show('boot');
