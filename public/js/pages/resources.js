const RESOURCES = [
  {
    title: 'Book Junior',
    description: 'Book scanning app for pricing and identification.',
    url: 'https://book-scanner-jkk.web.app/',
    urlLabel: 'Open Book Junior',
  },
  {
    title: 'The REPORT',
    description: 'Directory search analytics — published web view.',
    url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7EnETclCNEeKrvERGFrONac38PjEkK31zavycYpJWIAK0Ho60Yoxb_r2jPxtttq4qMIjVh96yOxzY/pubhtml?gid=245625725&single=true',
    urlLabel: 'View Report',
  },
  {
    title: 'Subject Directory',
    description: 'The public-facing store subject directory.',
    url: 'https://directory.johnkingbooksdetroit.com',
    urlLabel: 'Open Directory',
  },
  {
    title: 'John K. King Books',
    description: 'Main store website.',
    url: 'https://johnkingbooksdetroit.com',
    urlLabel: 'Visit Site',
  },
  {
    title: 'RareBookLink',
    description: 'Rare book listing and research resource.',
    url: 'https://rarebooklink.com',
    urlLabel: 'Open RareBookLink',
  },
  {
    title: 'Standard Operating Procedures',
    description: 'Staff SOPs and operational documentation.',
    url: null,
    comingSoon: true,
  },
];

export function mountResources(container) {
  container.innerHTML = `
    <h1 class="page-heading">Resources</h1>
    <p class="page-subheading">Tools and references for staff use.</p>
    <div class="resource-grid">
      ${RESOURCES.map(r => buildCard(r)).join('')}
    </div>
  `;
}

function buildCard(r) {
  if (r.comingSoon) {
    return `
      <div class="resource-card disabled">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.35rem">
          <span class="resource-card-title">${escHtml(r.title)}</span>
          <span class="badge badge-coming-soon">Coming Soon</span>
        </div>
        <p class="resource-card-desc">${escHtml(r.description)}</p>
      </div>
    `;
  }

  const linkHtml = r.url
    ? `<a href="${escHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="resource-card-link">${escHtml(r.urlLabel)} ↗</a>`
    : `<span class="resource-card-link" style="color:var(--text-muted);cursor:default">[URL Pending]</span>`;

  return `
    <div class="resource-card">
      <div class="resource-card-title">${escHtml(r.title)}</div>
      <p class="resource-card-desc">${escHtml(r.description)}</p>
      ${linkHtml}
    </div>
  `;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
