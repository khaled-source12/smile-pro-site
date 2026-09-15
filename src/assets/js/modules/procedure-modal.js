let loadPromise;
let dialog;
let activeTrigger;
let returnFocus;

function loadStylesheet(href) {
  if (!href) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = [...document.styleSheets].some((sheet) => sheet.href?.endsWith(href));
    if (existing) return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = resolve;
    link.onerror = () => reject(new Error('Comparison styles failed to load'));
    document.head.append(link);
  });
}

function closeDialog() {
  if (!dialog) return;
  if (typeof dialog.close === 'function') dialog.close();
  else {
    dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
  }
}

function syncChoice() {
  const currentValue = activeTrigger?.closest('form')?.querySelector('select[name="procedure"]')?.value || 'not-sure';
  dialog.querySelectorAll('[data-procedure-choice]').forEach((button) => {
    const selected = button.dataset.procedureChoice === currentValue;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function bindDialog() {
  dialog.querySelectorAll('[data-procedure-comparison-close]').forEach((button) => button.addEventListener('click', closeDialog));
  dialog.querySelectorAll('[data-procedure-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      const form = activeTrigger?.closest('form');
      const select = form?.querySelector('select[name="procedure"]');
      const selectedProcedure = button.dataset.procedureChoice;
      if (!select || !selectedProcedure) return;
      select.value = selectedProcedure;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      returnFocus = select;
      window.trackSiteEvent?.('procedure_comparison_choice', {
        form_position: form.dataset.formPosition || 'unknown',
        procedure: selectedProcedure
      });
      closeDialog();
    });
  });
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) closeDialog();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('has-open-dialog');
    (returnFocus || activeTrigger)?.focus();
    returnFocus = null;
  });
}

async function loadDialog() {
  if (dialog) return dialog;
  if (!loadPromise) {
    loadPromise = Promise.all([
      loadStylesheet(document.body.dataset.procedureComparisonCss),
      fetch(document.body.dataset.procedureComparisonUrl, { credentials: 'same-origin' }).then((response) => {
        if (!response.ok) throw new Error('Comparison content failed to load');
        return response.text();
      })
    ]).then(([, html]) => {
      document.body.insertAdjacentHTML('beforeend', html);
      dialog = document.getElementById('procedure-comparison-dialog');
      if (!dialog) throw new Error('Comparison dialog is missing');
      bindDialog();
      return dialog;
    });
  }
  return loadPromise;
}

export async function openProcedureComparison(trigger) {
  try {
    await loadDialog();
    activeTrigger = trigger;
    returnFocus = null;
    syncChoice();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.body.classList.add('has-open-dialog');
    window.trackSiteEvent?.('procedure_comparison_open', {
      form_position: trigger.closest('form')?.dataset.formPosition || 'unknown'
    });
  } catch (_error) {
    trigger.closest('form')?.querySelector('select[name="procedure"]')?.focus();
  }
}
