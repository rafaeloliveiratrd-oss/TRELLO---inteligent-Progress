import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
});
after(async () => { await browser?.close(); });

async function openApp(viewport = { width: 960, height: 740 }) {
  const context = await browser.newContext({ viewport });
  await context.route('http://mvp.test/**', async route => {
    const pathname = new URL(route.request().url()).pathname.slice(1);
    const path = fileURLToPath(new URL(`../${pathname}`, import.meta.url));
    await route.fulfill({ path });
  });
  await context.route('https://p.trellocdn.com/power-up.min.js', route => route.fulfill({
    contentType: 'text/javascript', body: '',
  }));
  await context.addInitScript(() => {
    const stored = JSON.parse(localStorage.getItem('mock-plugin-data') || '{}');
    const mainItems = Array.from({ length: 5 }, (_, i) => ({
      id: `w${i}`, name: `Tarefa ${i}`, pos: i * 100,
      state: i < 3 ? 'complete' : 'incomplete',
    })).reverse();
    mainItems.find(item => item.id === 'w0').name = '<img src=x onerror="window.injected=true">';
    window.fixture = {
      stored, cardId: 'a', calls: [], failRead: false, failWrite: false,
      deferRead: false, pendingReads: [], closed: false,
      cards: {
        a: { id: 'a', name: 'dadas', checklists: [
          { id: 'notes', name: 'dasdsad', pos: 200, checkItems: [
            { id: 'n0', name: 'Lembrete concluído', state: 'complete', pos: 0 },
            { id: 'n1', name: 'Lembrete pendente', state: 'incomplete', pos: 100 },
          ] },
          { id: 'work', name: 'Checklist', pos: 100, checkItems: mainItems },
        ] },
        b: { id: 'b', name: 'Outro cartão', checklists: [] },
      },
    };
    window.testT = {
      async card(...fields) {
        fixture.calls.push(['card', ...fields]);
        if (fixture.failRead) throw new Error('falha de leitura');
        const card = structuredClone(fixture.cards[fixture.cardId]);
        const items = card.checklists?.flatMap(list => list.checkItems || []) || [];
        card.badges ??= { checkItems: items.length, checkItemsChecked: items.filter(item => item.state === 'complete').length };
        if (fixture.deferRead) return new Promise(resolve => fixture.pendingReads.push(() => resolve(card)));
        return card;
      },
      async get(scope, visibility, key, fallback) {
        fixture.calls.push(['get', scope, visibility, key, fallback]);
        return structuredClone(fixture.stored[fixture.cardId]?.[key] ?? fallback);
      },
      async set(scope, visibility, settings) {
        fixture.calls.push(['set', scope, visibility, structuredClone(settings)]);
        if (fixture.failWrite) throw new Error('falha de gravação');
        fixture.stored[fixture.cardId] ??= {};
        Object.assign(fixture.stored[fixture.cardId], settings);
        localStorage.setItem('mock-plugin-data', JSON.stringify(fixture.stored));
      },
      render(callback) { window.renderCallback = callback; void callback(); },
      async closeModal() { fixture.closed = true; },
      async modal(options) { window.modalOptions = options; },
    };
    window.TrelloPowerUp = {
      iframe: () => testT,
      initialize: capabilities => { window.capabilities = capabilities; },
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://mvp.test/settings.html');
  await page.waitForFunction(() => !document.querySelector('#save').disabled);
  return { page, context, errors };
}

async function save(page) {
  await page.locator('#save').click();
  await page.waitForFunction(() => document.querySelector('#message').textContent === 'Configuração salva.');
}

async function reload(page) {
  await page.locator('#reload').click();
  if (await page.locator('#discard-dialog').isVisible()) await page.locator('#discard').click();
  await page.waitForFunction(() => !document.querySelector('#save').disabled);
}

test('modal, ordem original, 57%, contadores e nomes seguros', async () => {
  const { page, context, errors } = await openApp();
  try {
    assert.equal(await page.locator('h1').innerText(), 'Progresso Inteligente');
    assert.equal(await page.locator('#card-name').innerText(), 'dadas');
    assert.deepEqual(await page.locator('.checklist h2').allTextContents(), ['Checklist', 'dasdsad']);
    assert.deepEqual(await page.locator('[data-item-id]').evaluateAll(items => items.map(item => item.dataset.itemId)), ['w0', 'w1', 'w2', 'w3', 'w4', 'n0', 'n1']);
    assert.equal(await page.locator('#percentage').innerText(), '57%');
    assert.equal(await page.locator('#progress-bar').getAttribute('value'), '57');
    assert.equal(await page.locator('#considered-count').innerText(), '7');
    assert.equal(await page.locator('#completed-count').innerText(), '4');
    assert.equal(await page.locator('#ignored-count').innerText(), '0');
    assert.equal(await page.locator('#checklists img').count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
    assert.equal(await page.evaluate(() => fixture.calls.some(call => call[0] === 'set')), false);
    await page.goto('http://mvp.test/index.html');
    await page.waitForFunction(() => !!window.capabilities);
    await page.evaluate(() => capabilities['card-buttons']()[0].callback(testT));
    assert.deepEqual(await page.evaluate(() => modalOptions), { title: 'Progresso Inteligente', url: './settings.html', height: 720, fullscreen: false });
    assert.deepEqual(await page.evaluate(() => capabilities['card-badges'](testT)), [{ text: '57%' }]);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('seleção individual, filtros, estado cinza e persistência ao reabrir', async () => {
  const { page, context, errors } = await openApp();
  try {
    const original = await page.evaluate(() => structuredClone(fixture.cards));
    await page.locator('[data-item-id=w4]').click();
    assert.equal(await page.locator('#percentage').innerText(), '67%');
    await page.locator('[data-item-id=n0]').click();
    assert.equal(await page.locator('#percentage').innerText(), '60%');
    assert.equal(await page.locator('#ignored-count').innerText(), '2');
    assert.equal(await page.locator('[data-item-id=n0]').innerText(), 'Ignorado');
    assert.equal(await page.locator('[data-item-id=n0]').getAttribute('aria-pressed'), 'true');
    const color = await page.locator('[data-item-id=n0]').evaluate(button => getComputedStyle(button.closest('li').querySelector('.item-name')).color);
    assert.equal(color, 'rgb(89, 101, 121)');
    await page.locator('[data-filter=ignored]').click();
    assert.equal(await page.locator('[data-item-id]').count(), 2);
    await page.locator('[data-filter=included]').click();
    assert.equal(await page.locator('[data-item-id]').count(), 5);
    assert.equal(await page.locator('#percentage').innerText(), '60%');
    await page.locator('[data-filter=all]').click();
    await save(page);
    assert.deepEqual(await page.evaluate(() => fixture.stored.a.ignoredCheckItemIds), ['w4', 'n0']);
    assert.deepEqual(await page.evaluate(() => fixture.cards), original);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#save').disabled);
    assert.equal(await page.locator('#percentage').innerText(), '60%');
    assert.equal(await page.locator('[data-item-id=n0]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-filter=ignored]').click();
    await page.locator('[data-item-id=n0]').click();
    assert.equal(await page.locator('[data-item-id=n0]').count(), 0);
    assert.equal(await page.locator('#percentage').innerText(), '67%');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('migração segura e preferências independentes por cartão', async () => {
  const { page, context, errors } = await openApp();
  try {
    await page.evaluate(async () => {
      fixture.stored.a = { ignoredChecklistIds: ['work', 'notes'] };
      await renderCallback();
    });
    assert.equal(await page.locator('#migration').isVisible(), true);
    assert.equal(await page.locator('#percentage').innerText(), '57%');
    await page.locator('[data-item-id=w4]').click();
    await save(page);
    assert.equal(await page.locator('#migration').isVisible(), false);
    assert.deepEqual(await page.evaluate(() => fixture.stored.a), { ignoredChecklistIds: [], ignoredCheckItemIds: ['w4'] });
    await page.evaluate(async () => { fixture.cardId = 'b'; await renderCallback(); });
    assert.equal(await page.locator('#card-name').innerText(), 'Outro cartão');
    assert.equal(await page.locator('#percentage').innerText(), '—');
    assert.equal(await page.locator('#counts').innerText(), 'Sem itens no cartão');
    await save(page);
    assert.deepEqual(await page.evaluate(() => fixture.stored.a.ignoredCheckItemIds), ['w4']);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('render preserva rascunho, considera novos itens, mantém renomeados e elimina excluídos ao salvar', async () => {
  const { page, context, errors } = await openApp();
  try {
    await page.locator('[data-item-id=w4]').click();
    await page.evaluate(async () => {
      const work = fixture.cards.a.checklists.find(list => list.id === 'work');
      work.checkItems.find(item => item.id === 'w4').name = 'Item renomeado';
      work.checkItems.push({ id: 'new', name: 'Novo item', state: 'incomplete', pos: 900 });
      await renderCallback();
    });
    assert.equal(await page.locator('[data-item-id=w4]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-item-id=new]').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#considered-count').innerText(), '7');
    await page.evaluate(async () => {
      const work = fixture.cards.a.checklists.find(list => list.id === 'work');
      work.checkItems = work.checkItems.filter(item => item.id !== 'w4');
      await renderCallback();
    });
    await save(page);
    assert.deepEqual(await page.evaluate(() => fixture.stored.a.ignoredCheckItemIds), []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('teclado e confirmação de alterações antes de fechar ou recarregar', async () => {
  const { page, context, errors } = await openApp();
  try {
    await page.locator('[data-item-id=w4]').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('[data-item-id=w4]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-item-id=w4]').evaluate(item => item === document.activeElement), true);
    await page.locator('#close').click();
    assert.equal(await page.locator('#discard-dialog').isVisible(), true);
    await page.locator('#keep-editing').click();
    assert.equal(await page.evaluate(() => fixture.closed), false);
    await page.locator('#reload').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-item-id=w4]').getAttribute('aria-pressed'), 'true');
    await reload(page);
    assert.equal(await page.locator('[data-item-id=w4]').getAttribute('aria-pressed'), 'false');
    await page.locator('[data-item-id=w4]').click();
    await page.locator('#close').click();
    await page.locator('#discard').click();
    assert.equal(await page.evaluate(() => fixture.closed), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('falhas, dados incompletos e recuperação sem falsa ausência de itens', async () => {
  const { page, context, errors } = await openApp();
  try {
    await page.evaluate(async () => { fixture.failRead = true; await renderCallback(); });
    assert.equal(await page.locator('#save').isDisabled(), true);
    assert.equal(await page.locator('#counts').innerText(), 'Progresso indisponível');
    assert.equal(await page.locator('#progress-bar').isVisible(), false);
    await page.evaluate(() => { fixture.failRead = false; });
    await reload(page);
    await page.evaluate(async () => {
      fixture.cards.a.badges = { checkItems: 7, checkItemsChecked: 4 };
      fixture.cards.a.checklists.find(list => list.id === 'work').checkItems = [];
      await renderCallback();
    });
    assert.match(await page.locator('#message').innerText(), /Dados incompletos/);
    assert.equal(await page.locator('#save').isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('falha de gravação permite retry e conflito impede sobrescrita observada', async () => {
  const { page, context, errors } = await openApp();
  try {
    await page.locator('[data-item-id=w4]').click();
    await page.evaluate(() => { fixture.failWrite = true; });
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#message').textContent.startsWith('Não foi possível salvar'));
    assert.equal(await page.locator('[data-item-id=w4]').getAttribute('aria-pressed'), 'true');
    await page.evaluate(() => { fixture.failWrite = false; });
    await save(page);
    await page.locator('[data-item-id=w3]').click();
    await page.evaluate(() => { fixture.stored.a.ignoredCheckItemIds = ['n0']; });
    const previousWrites = await page.evaluate(() => fixture.calls.filter(call => call[0] === 'set').length);
    await page.locator('#save').click();
    await page.waitForFunction(() => document.querySelector('#message').textContent.includes('configuração compartilhada mudou'));
    assert.equal(await page.locator('#save').isDisabled(), true);
    await page.locator('[data-item-id=w3]').click();
    assert.equal(await page.locator('#save').isDisabled(), true);
    assert.equal(await page.evaluate(() => fixture.calls.filter(call => call[0] === 'set').length), previousWrites);
    await reload(page);
    assert.equal(await page.locator('[data-item-id=n0]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-item-id=n1]').click();
    await page.evaluate(async () => { fixture.stored.a.ignoredCheckItemIds = ['w0']; await renderCallback(); });
    assert.equal(await page.locator('#save').isDisabled(), true);
    assert.match(await page.locator('#message').innerText(), /configuração compartilhada mudou/);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('respostas de leitura fora de ordem não substituem o cartão mais recente', async () => {
  const { page, context, errors } = await openApp();
  try {
    await page.evaluate(() => {
      fixture.deferRead = true;
      window.firstRead = renderCallback();
      fixture.cards.a.name = 'Nome atualizado';
      window.secondRead = renderCallback();
    });
    await page.evaluate(async () => {
      fixture.pendingReads[1]();
      await secondRead;
      fixture.pendingReads[0]();
      await firstRead;
    });
    assert.equal(await page.locator('#card-name').innerText(), 'Nome atualizado');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('responsividade, nomes longos, muitos itens e estados 0%, 100% e todos ignorados', async () => {
  const { page, context, errors } = await openApp();
  try {
    await page.evaluate(async () => {
      const items = fixture.cards.a.checklists.flatMap(list => list.checkItems);
      items.forEach(item => { item.state = 'incomplete'; });
      await renderCallback();
    });
    assert.equal(await page.locator('#percentage').innerText(), '0%');
    await page.evaluate(async () => {
      fixture.cards.a.checklists.flatMap(list => list.checkItems).forEach(item => { item.state = 'complete'; });
      await renderCallback();
    });
    assert.equal(await page.locator('#percentage').innerText(), '100%');
    await page.evaluate(async () => {
      fixture.stored.a = { ignoredCheckItemIds: fixture.cards.a.checklists.flatMap(list => list.checkItems.map(item => item.id)) };
      await renderCallback();
    });
    assert.equal(await page.locator('#counts').innerText(), 'Sem itens considerados');
    assert.equal(await page.locator('#percentage').innerText(), '—');
    await page.evaluate(async () => {
      fixture.stored.a.ignoredCheckItemIds = [];
      const work = fixture.cards.a.checklists.find(list => list.id === 'work');
      work.checkItems[0].name = 'Nome muito longo '.repeat(30);
      for (let index = 0; index < 50; index += 1) {
        work.checkItems.push({ id: `extra-${index}`, name: `Item adicional ${index}`, state: 'incomplete', pos: 1000 + index });
      }
      await renderCallback();
    });
    for (const width of [320, 480, 1024]) {
      await page.setViewportSize({ width, height: 740 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#save').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('#save').isVisible(), true);
    }
    await page.screenshot({ path: join(tmpdir(), 'trello-v11-desktop.png'), fullPage: false });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(tmpdir(), 'trello-v11-mobile.png'), fullPage: false });
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
