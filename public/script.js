const form = document.getElementById('upload-form');
const fileInput = document.getElementById('pdf-input');
const fileNameLabel = document.getElementById('file-name');
const analyseerBtn = document.getElementById('analyseer-btn');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const summaryTextEl = document.getElementById('summary-text');
const focusPointsEl = document.getElementById('focus-points');
const companyCardsEl = document.getElementById('company-cards');

fileInput.addEventListener('change', () => {
  fileNameLabel.textContent = fileInput.files[0]
    ? fileInput.files[0].name
    : 'Choose a PDF file...';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const file = fileInput.files[0];
  if (!file) return;

  setLoading(true);
  resultEl.hidden = true;

  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const response = await fetch('/analyseer', {
      method: 'POST',
      body: formData,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid response from the server.');
    }

    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong during the analysis.');
    }

    setStatus('Analysis complete.', 'success');
    renderResult(data);
    resultEl.hidden = false;
  } catch (err) {
    setStatus(
      err.message || 'Something went wrong. Please try again.',
      'error',
    );
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  analyseerBtn.disabled = isLoading;
  fileInput.disabled = isLoading;

  if (isLoading) {
    analyseerBtn.textContent = 'Analyzing...';
    setStatus('Analyzing, this may take a few minutes...', 'loading');
  } else {
    analyseerBtn.textContent = 'Analyze';
  }
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.hidden = false;
  statusEl.className = 'status' + (type ? ` ${type}` : '');
}

function renderResult(data) {
  summaryTextEl.textContent = data.summary || '';

  focusPointsEl.innerHTML = '';

  (data.focusPoints || []).forEach((point) => {
    const chip = document.createElement('span');
    chip.className = 'focus-chip';
    chip.textContent = point;
    focusPointsEl.appendChild(chip);
  });

  companyCardsEl.innerHTML = '';

  (data.companies || []).forEach((company) => {
    const card = document.createElement('div');
    card.className = 'company-card';

    const name = document.createElement('h3');
    name.textContent = company.name || '';

    const desc = document.createElement('p');
    desc.textContent = company.description || '';

    const link = document.createElement('a');
    link.href = company.url || '#';
    link.textContent = company.url || '';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(link);
    companyCardsEl.appendChild(card);
  });
}
