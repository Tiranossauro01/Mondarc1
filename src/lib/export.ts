import html2canvas from 'html2canvas';

const BRAND_BLUE = '#0B7EC4';
const BRAND_TEAL = '#2FBFAE';
const TEXT_DARK = '#1e293b';
const TEXT_MUTED = '#64748b';
const BORDER = '#e2e8f0';
const ROW_ALT = '#f8fafc';
const HEADER_BG = '#f1f5f9';
const CAT_BG = '#e0f2fe';
const CAT_TEXT = '#0c4a6e';

function logoSVG(size = 48) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block">
    <path d="M50 8C27.9 8 10 25.9 10 48c0 13.2 6.4 24.9 16.3 32.3" stroke="url(#lg1)" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M26.3 80.3L34 82l-1.2-8" stroke="url(#lg1)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M50 92C72.1 92 90 74.1 90 52c0-13.2-6.4-24.9-16.3-32.3" stroke="url(#lg1)" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M73.7 19.7L66 18l1.2 8" stroke="url(#lg1)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <text x="50" y="62" text-anchor="middle" font-size="42" font-weight="700" fill="url(#lg1)" font-family="Inter, Arial, sans-serif">m</text>
    <defs><linearGradient id="lg1" x1="10" y1="8" x2="90" y2="92" gradientUnits="userSpaceOnUse"><stop stop-color="${BRAND_BLUE}"/><stop offset="1" stop-color="${BRAND_TEAL}"/></linearGradient></defs>
  </svg>`;
}

export interface ExportColumn {
  header: string;
  align?: 'left' | 'right' | 'center';
}

export interface ExportTableData {
  columns: ExportColumn[];
  rows: (string | number)[][];
}

export interface ExportGroup {
  categoryName: string;
  table: ExportTableData;
}

export interface ExportConfig {
  title: string;
  subtitle?: string;
  table?: ExportTableData;
  groups?: ExportGroup[];
  emptyMessage?: string;
  filename: string;
}

function renderTable(table: ExportTableData): string {
  const tableHead = table.columns.map(c => {
    const align = c.align ?? 'left';
    return `<th style="text-align:${align}">${c.header}</th>`;
  }).join('');

  const tableBody = table.rows.length === 0
    ? `<tr><td colspan="${table.columns.length}" style="text-align:center;padding:24px;color:#94a3b8">Nenhum item nesta categoria.</td></tr>`
    : table.rows.map(row => {
      const cells = row.map((cell, i) => {
        const align = table.columns[i]?.align ?? 'left';
        return `<td style="text-align:${align}">${cell}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');

  return `<table><thead><tr>${tableHead}</tr></thead><tbody>${tableBody}</tbody></table>`;
}

function buildBodyHTML(cfg: ExportConfig): string {
  const today = new Date().toLocaleDateString('pt-BR');
  const subtitle = cfg.subtitle ?? `Data: ${today}`;

  let content: string;
  const hasGroups = cfg.groups && cfg.groups.length > 0;

  if (hasGroups) {
    content = cfg.groups!.map(g => {
      return `<div class="cat-section">
        <div class="cat-header">${g.categoryName}</div>
        ${renderTable(g.table)}
      </div>`;
    }).join('');
  } else if (cfg.table) {
    content = renderTable(cfg.table);
  } else {
    content = `<p style="text-align:center;padding:24px;color:#94a3b8">${cfg.emptyMessage ?? 'Nenhum registro encontrado.'}</p>`;
  }

  const totalRows = hasGroups
    ? cfg.groups!.reduce((sum, g) => sum + g.table.rows.length, 0)
    : (cfg.table?.rows.length ?? 0);

  return `<div class="doc-header">
    ${logoSVG(48)}
    <div class="brand">
      <h1>mondarc</h1>
      <p>Ar Condicionado</p>
    </div>
  </div>
  <h2>${cfg.title}</h2>
  <p class="meta">${subtitle}</p>
  ${content}
  <p class="total-row">Total de registros: ${totalRows}</p>
  <div class="footer">MONDARC — Sistema de Gestão de Estoque | Gerado em ${today}</div>`;
}

function buildStyles(): string {
  return `* { margin: 0; padding: 0; box-sizing: border-box; }
  .export-doc {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    background: #ffffff;
    color: ${TEXT_DARK};
    padding: 40px;
    width: 794px;
  }
  .doc-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; border-bottom: 3px solid ${BRAND_BLUE}; padding-bottom: 16px; }
  .doc-header svg { flex-shrink: 0; }
  .brand h1 { font-size: 28px; font-weight: 700; color: ${BRAND_BLUE}; line-height: 1; }
  .brand p { font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: ${TEXT_MUTED}; margin-top: 4px; }
  h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .meta { color: ${TEXT_MUTED}; font-size: 13px; margin-bottom: 16px; }
  .cat-section { margin-bottom: 24px; }
  .cat-header { background: ${CAT_BG}; color: ${CAT_TEXT}; font-size: 14px; font-weight: 700; padding: 8px 14px; border-radius: 6px 6px 0 0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0; }
  .cat-section table { margin-top: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: ${HEADER_BG}; padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: ${TEXT_MUTED}; border-bottom: 2px solid ${BORDER}; }
  td { padding: 8px 14px; border-bottom: 1px solid ${BORDER}; }
  tr:nth-child(even) td { background: ${ROW_ALT}; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid ${BORDER}; font-size: 11px; color: #94a3b8; }
  .total-row { margin-top: 16px; font-size: 13px; font-weight: 700; color: ${TEXT_DARK}; }`;
}

export function printDocument(cfg: ExportConfig) {
  const existing = document.getElementById('mondarc-print-area');
  if (existing) existing.remove();

  const printArea = document.createElement('div');
  printArea.id = 'mondarc-print-area';
  printArea.style.position = 'fixed';
  printArea.style.left = '0';
  printArea.style.top = '0';
  printArea.style.width = '100%';
  printArea.style.zIndex = '9999';
  printArea.style.background = '#ffffff';
  printArea.innerHTML = `<style>${buildStyles()}\n@media screen { #mondarc-print-area { display: none; } }\n@media print { body * { visibility: hidden !important; } #mondarc-print-area, #mondarc-print-area * { visibility: visible !important; } #mondarc-print-area { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; } @page { size: A4; margin: 15mm; } thead { display: table-header-group; } tr { page-break-inside: avoid; } .cat-section { page-break-inside: avoid; } }</style><div class="export-doc">${buildBodyHTML(cfg)}</div>`;
  document.body.appendChild(printArea);

  const cleanup = () => {
    printArea.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1000);
  }, 100);
}

export async function saveAsPNG(cfg: ExportConfig) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '-1';
  container.innerHTML = `<style>${buildStyles()}</style><div class="export-doc">${buildBodyHTML(cfg)}</div>`;
  document.body.appendChild(container);

  const target = container.querySelector('.export-doc') as HTMLElement;

  try {
    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      alert('Erro ao gerar imagem.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cfg.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    alert('Erro ao gerar imagem. Tente novamente.');
  } finally {
    if (container.parentNode) document.body.removeChild(container);
  }
}
