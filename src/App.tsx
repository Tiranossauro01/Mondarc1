import { useState } from 'react';
import { Layout, type PageKey } from '@/components/Layout';
import { PainelPage } from '@/pages/PainelPage';
import { MaterialPage } from '@/pages/MaterialPage';
import { EstoquePage } from '@/pages/EstoquePage';
import { SaidaPage } from '@/pages/SaidaPage';
import { SaldoPage } from '@/pages/SaldoPage';
import { CompraPage } from '@/pages/CompraPage';
import { HistoricoPage } from '@/pages/HistoricoPage';
import { RelatorioPage } from '@/pages/RelatorioPage';
import { AjustePage } from '@/pages/AjustePage';
import { LogPage } from '@/pages/LogPage';
import { ConfigPage } from '@/pages/ConfigPage';

function App() {
  const [page, setPage] = useState<PageKey>('painel');

  return (
    <Layout current={page} onNavigate={setPage}>
      {page === 'painel' && <PainelPage onNavigate={setPage} />}
      {page === 'material' && <MaterialPage />}
      {page === 'estoque' && <EstoquePage />}
      {page === 'saida' && <SaidaPage />}
      {page === 'saldo' && <SaldoPage />}
      {page === 'compra' && <CompraPage />}
      {page === 'historico' && <HistoricoPage />}
      {page === 'relatorio' && <RelatorioPage />}
      {page === 'ajuste' && <AjustePage />}
      {page === 'log' && <LogPage />}
      {page === 'config' && <ConfigPage />}
    </Layout>
  );
}

export default App;
