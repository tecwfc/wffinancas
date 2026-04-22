// ========== CONFIGURAÇÃO ==========

const API_URL = "https://script.google.com/macros/s/AKfycbxsmpl2FN0DhoB7Eqkw5T9fR_fzpcHh4GsmX67cNGjQR7HLQrMKUrSC1ZXOpAPE8jSD/exec";

let usuarioLogado = null;
let dados = { metas: {}, lancamentos: [], cartoes: [], faturas: [], pagamentos: [] };
let chartPizza = null, chartLinha = null;
let isAdmin = false;

const CATEGORIAS = ["Alimentação", "Transporte", "Entretenimento", "Saúde", "Moradia", "Educação", "Outros"];
const METAS_PADRAO = { "Alimentação": 2500, "Transporte": 2500, "Entretenimento": 2500, "Saúde": 2400, "Moradia": 1200, "Educação": 2000, "Outros": 1000 };

// ========== UTILITÁRIOS ==========
function mostrarLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}

function mostrarToast(mensagem, tipo = 'success') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const message = document.getElementById('toastMessage');
  icon.className = 'fas ' + (tipo === 'success' ? 'fa-check-circle' : tipo === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
  message.innerText = mensagem;
  toast.className = `toast ${tipo} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function fecharModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarData(data) {
  if (!data) return '';
  const partes = data.split('-');
  if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  return data;
}

function getIconeCategoria(cat) {
  const icones = { 'Alimentação':'fa-utensils','Transporte':'fa-car','Entretenimento':'fa-film','Saúde':'fa-heartbeat','Moradia':'fa-home','Educação':'fa-graduation-cap','Outros':'fa-box' };
  return icones[cat] || 'fa-tag';
}

function gerarAnos() {
  const anoAtual = new Date().getFullYear();
  const anos = [];
  for (let i = 2024; i <= anoAtual + 2; i++) anos.push(i);
  return anos;
}

function popularSelectAnos() {
  const anos = gerarAnos();
  const selects = ['filtroAnoDashboard', 'filtroAnoFatura', 'filtroHistoricoAno', 'relatorioAno'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (select) {
      select.innerHTML = anos.map(a => `<option value="${a}" ${a == new Date().getFullYear() ? 'selected' : ''}>${a}</option>`).join('');
    }
  });
}

function popularMeses() {
  const meses = [{value:"01", nome:"Janeiro"},{value:"02", nome:"Fevereiro"},{value:"03", nome:"Março"},{value:"04", nome:"Abril"},{value:"05", nome:"Maio"},{value:"06", nome:"Junho"},{value:"07", nome:"Julho"},{value:"08", nome:"Agosto"},{value:"09", nome:"Setembro"},{value:"10", nome:"Outubro"},{value:"11", nome:"Novembro"},{value:"12", nome:"Dezembro"}];
  const selects = ['filtroMesDashboard', 'filtroMesFatura', 'filtroHistoricoMes', 'relatorioMes'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (select) select.innerHTML = '<option value="">Todos</option>' + meses.map(m => `<option value="${m.value}">${m.nome}</option>`).join('');
  });
}

// ========== COMUNICAÇÃO COM O BACKEND ==========
async function carregarDados() {
  mostrarLoading(true);
  try {
    const response = await fetch(`${API_URL}?action=carregarDados&t=${Date.now()}`);
    const resultado = await response.json();
    
    if (resultado.sucesso && resultado.dados) {
      dados = resultado.dados;
      if (!dados.metas) dados.metas = { ...METAS_PADRAO };
      if (!dados.lancamentos) dados.lancamentos = [];
      if (!dados.cartoes) dados.cartoes = [];
      if (!dados.faturas) dados.faturas = [];
      if (!dados.pagamentos) dados.pagamentos = [];
      
      // Atualizar selects
      const catOptions = CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('');
      document.getElementById('lancamentoCategoria').innerHTML = catOptions;
      document.getElementById('filtroCategoriaLancamentos').innerHTML = '<option value="">Todas</option>' + CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('');
      
      const cartaoOptions = dados.cartoes.map(c => `<option value="${c.id}">${c.nome} (${formatarMoeda(c.limite)})</option>`).join('');
      document.getElementById('lancamentoCartao').innerHTML = cartaoOptions;
      document.getElementById('filtroCartaoFatura').innerHTML = '<option value="">Todos</option>' + dados.cartoes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
      
      // Carregar todas as views
      carregarDashboard();
      carregarLancamentos();
      carregarListaCartoes();
      carregarFaturas();
      carregarHistorico();
    } else {
      mostrarToast(resultado.erro || 'Erro ao carregar dados', 'error');
    }
  } catch(e) {
    console.error('Erro:', e);
    mostrarToast('Erro de conexão com o servidor', 'error');
  } finally {
    mostrarLoading(false);
  }
}

async function salvarDados() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'salvarDados', dados: dados })
    });
    const resultado = await response.json();
    return resultado.sucesso;
  } catch(e) {
    console.error('Erro ao salvar:', e);
    return false;
  }
}

// ========== LOGIN ==========
async function fazerLogin() {
  const usuario = document.getElementById('loginUsuario').value.trim();
  const senha = document.getElementById('loginSenha').value;
  
  if (!usuario || !senha) {
    mostrarToast('Preencha usuário e senha!', 'error');
    return;
  }
  
  mostrarLoading(true);
  try {
    const response = await fetch(`${API_URL}?action=login&usuario=${encodeURIComponent(usuario)}&senha=${encodeURIComponent(senha)}`);
    const resultado = await response.json();
    
    if (resultado.sucesso) {
      usuarioLogado = { usuario, senha, admin: resultado.admin };
      isAdmin = resultado.admin === true;
      
      localStorage.setItem('sessao', JSON.stringify(usuarioLogado));
      
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appContainer').classList.add('active');
      document.getElementById('usuarioNomeSidebar').innerText = usuario;
      
      if (isAdmin) {
        document.getElementById('btnAdmin').style.display = 'flex';
        carregarListaUsuarios();
      }
      
      await carregarDados();
      mostrarToast(`Bem-vindo, ${usuario}!`);
    } else {
      mostrarToast(resultado.erro || 'Usuário ou senha inválidos', 'error');
    }
  } catch(e) {
    console.error('Erro:', e);
    mostrarToast('Erro de conexão!', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function fazerLogout() {
  localStorage.removeItem('sessao');
  location.reload();
}

// ========== CRUD LANÇAMENTOS ==========
function abrirModalLancamento(editar = null) {
  document.getElementById('modalLancamentoTitulo').innerHTML = editar ? '<i class="fas fa-edit"></i> Editar Lançamento' : '<i class="fas fa-plus"></i> Novo Lançamento';
  document.getElementById('editLancamentoId').value = editar ? editar.id : '';
  document.getElementById('lancamentoData').value = editar ? editar.data : new Date().toISOString().split('T')[0];
  document.getElementById('lancamentoDescricao').value = editar ? editar.descricao : '';
  document.getElementById('lancamentoCategoria').value = editar ? editar.categoria : CATEGORIAS[0];
  document.getElementById('lancamentoValor').value = editar ? editar.valor : '';
  document.getElementById('lancamentoParcelas').value = '1';
  calcularParcela();
  document.getElementById('modalLancamento').classList.add('active');
}

function calcularParcela() {
  const total = parseFloat(document.getElementById('lancamentoValor').value) || 0;
  const parcelas = parseInt(document.getElementById('lancamentoParcelas').value) || 1;
  document.getElementById('lancamentoValorParcela').value = formatarMoeda(total / parcelas);
}

async function salvarLancamento() {
  const id = document.getElementById('editLancamentoId').value;
  const data = document.getElementById('lancamentoData').value;
  const descricao = document.getElementById('lancamentoDescricao').value.trim();
  const categoria = document.getElementById('lancamentoCategoria').value;
  const cartaoId = document.getElementById('lancamentoCartao').value;
  const valorTotal = parseFloat(document.getElementById('lancamentoValor').value);
  const numParcelas = parseInt(document.getElementById('lancamentoParcelas').value);
  
  if (!data || !descricao || !cartaoId || !valorTotal) {
    mostrarToast('Preencha todos os campos!', 'error');
    return;
  }
  
  mostrarLoading(true);
  
  try {
    const cartao = dados.cartoes.find(c => c.id === cartaoId);
    if (!cartao) throw new Error('Cartão não encontrado');
    
    const valorParcela = valorTotal / numParcelas;
    const parcelas = [];
    for (let i = 0; i < numParcelas; i++) {
      let vencimento = new Date(data);
      vencimento.setMonth(vencimento.getMonth() + i + 1);
      vencimento.setDate(cartao.diaVencimento);
      parcelas.push({
        numero: i+1,
        valor: valorParcela,
        dataVencimento: vencimento.toISOString().split('T')[0],
        pago: false
      });
    }
    
    if (id) {
      const index = dados.lancamentos.findIndex(l => l.id == id);
      if (index !== -1) dados.lancamentos.splice(index, 1);
      dados.faturas = dados.faturas.filter(f => f.faturaId !== `FAT-${id}`);
    }
    
    const faturaId = `FAT-${id || Date.now()}`;
    parcelas.forEach((p, idx) => {
      dados.faturas.push({
        id: `${faturaId}-${idx}`,
        faturaId: faturaId,
        cartaoId: cartao.id,
        cartaoNome: cartao.nome,
        descricao: descricao,
        categoria: categoria,
        dataCompra: data,
        valorTotal: valorTotal,
        numParcelas: numParcelas,
        parcelaAtual: p.numero,
        valorParcela: p.valor,
        dataVencimento: p.dataVencimento,
        pago: false,
        dataPagamento: null
      });
    });
    
    dados.lancamentos.push({
      id: id || Date.now(),
      data: data,
      descricao: descricao,
      categoria: categoria,
      valor: valorTotal,
      data_cadastro: new Date().toISOString()
    });
    
    cartao.limiteUsado = (cartao.limiteUsado || 0) + valorTotal;
    
    const salvou = await salvarDados();
    if (salvou) {
      mostrarToast(`✅ ${id ? 'Editado' : 'Adicionado'} com sucesso!`);
      fecharModal('modalLancamento');
      await carregarDados();
      mudarPagina('faturas');
    } else {
      throw new Error('Erro ao salvar');
    }
  } catch (error) {
    mostrarToast(error.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}

async function excluirLancamento(id) {
  if (!confirm('Tem certeza que deseja excluir este lançamento?')) return;
  
  mostrarLoading(true);
  try {
    const lancamento = dados.lancamentos.find(l => l.id == id);
    if (lancamento) {
      dados.faturas = dados.faturas.filter(f => !f.id.includes(`FAT-${id}`));
      dados.lancamentos = dados.lancamentos.filter(l => l.id != id);
      await salvarDados();
      mostrarToast('✅ Lançamento excluído!');
      await carregarDados();
    }
  } catch (error) {
    mostrarToast(error.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}

function carregarLancamentos() {
  const mes = document.getElementById('filtroMesLancamentos').value;
  const categoria = document.getElementById('filtroCategoriaLancamentos').value;
  
  let lista = [...dados.lancamentos];
  if (mes) lista = lista.filter(l => l.data.startsWith(mes));
  if (categoria) lista = lista.filter(l => l.categoria === categoria);
  lista.sort((a,b) => b.data.localeCompare(a.data));
  
  const tbody = document.getElementById('listaLancamentos');
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum lançamento encontrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = lista.map(l => `
    <tr>
      <td>${formatarData(l.data)}</td>
      <td><strong>${l.descricao}</strong></td>
      <td><i class="fas ${getIconeCategoria(l.categoria)}"></i> ${l.categoria}</td>
      <td style="color:#ef4444; font-weight:600">-${formatarMoeda(l.valor)}</td>
      <td class="action-buttons">
        <button class="btn-icon btn-edit" onclick='abrirModalLancamento(${JSON.stringify(l).replace(/'/g, "&apos;")})'><i class="fas fa-edit"></i></button>
        <button class="btn-icon btn-delete" onclick="excluirLancamento(${l.id})"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

// ========== CRUD CARTÕES ==========
function abrirModalCartao(editar = null) {
  document.getElementById('editCartaoId').value = editar ? editar.id : '';
  document.getElementById('cartaoNome').value = editar ? editar.nome : '';
  document.getElementById('cartaoLimite').value = editar ? editar.limite : '';
  document.getElementById('cartaoFechamento').value = editar ? editar.diaFechamento : '10';
  document.getElementById('cartaoVencimento').value = editar ? editar.diaVencimento : '25';
  document.getElementById('modalCartao').classList.add('active');
}

async function salvarCartao() {
  const id = document.getElementById('editCartaoId').value;
  const nome = document.getElementById('cartaoNome').value.trim();
  const limite = parseFloat(document.getElementById('cartaoLimite').value);
  const diaFechamento = parseInt(document.getElementById('cartaoFechamento').value);
  const diaVencimento = parseInt(document.getElementById('cartaoVencimento').value);
  
  if (!nome || !limite) {
    mostrarToast('Preencha nome e limite!', 'error');
    return;
  }
  
  mostrarLoading(true);
  try {
    if (id) {
      const index = dados.cartoes.findIndex(c => c.id == id);
      if (index !== -1) {
        dados.cartoes[index] = { ...dados.cartoes[index], nome, limite, diaFechamento, diaVencimento };
      }
    } else {
      dados.cartoes.push({
        id: 'CRT-' + Date.now(),
        nome,
        limite,
        limiteUsado: 0,
        diaFechamento,
        diaVencimento,
        cor: '#2563eb'
      });
    }
    await salvarDados();
    mostrarToast(`✅ Cartão ${id ? 'editado' : 'adicionado'}!`);
    fecharModal('modalCartao');
    await carregarDados();
  } catch (error) {
    mostrarToast(error.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}

async function excluirCartao(id) {
  if (!confirm('Excluir este cartão? Todas as faturas associadas serão removidas.')) return;
  
  mostrarLoading(true);
  try {
    dados.cartoes = dados.cartoes.filter(c => c.id != id);
    dados.faturas = dados.faturas.filter(f => f.cartaoId != id);
    await salvarDados();
    mostrarToast('✅ Cartão excluído!');
    await carregarDados();
  } catch (error) {
    mostrarToast(error.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}

function carregarListaCartoes() {
  const tbody = document.getElementById('listaCartoes');
  if (dados.cartoes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Nenhum cartão cadastrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = dados.cartoes.map(c => {
    const usado = c.limiteUsado || 0;
    const percentual = (usado / c.limite) * 100;
    let corPercent = percentual >= 90 ? '#ef4444' : percentual >= 70 ? '#f59e0b' : '#10b981';
    return `
      <tr>
        <td><strong><i class="fas fa-credit-card"></i> ${c.nome}</strong></td>
        <td>${formatarMoeda(c.limite)}</td>
        <td style="color:#ef4444">${formatarMoeda(usado)}</td>
        <td style="color:#10b981">${formatarMoeda(c.limite - usado)}</td>
        <td><div style="background:#e2e8f0; border-radius:10px; height:8px; width:100px"><div style="background:${corPercent}; width:${Math.min(percentual,100)}%; height:8px; border-radius:10px"></div></div> ${percentual.toFixed(0)}%</td>
        <td class="action-buttons">
          <button class="btn-icon btn-edit" onclick='abrirModalCartao(${JSON.stringify(c).replace(/'/g, "&apos;")})'><i class="fas fa-edit"></i></button>
          <button class="btn-icon btn-delete" onclick="excluirCartao('${c.id}')"><i class="fas fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
}

// ========== FATURAS ==========
function carregarFaturas() {
  const cartaoId = document.getElementById('filtroCartaoFatura').value;
  const mesFiltro = document.getElementById('filtroMesFatura').value;
  const anoFiltro = document.getElementById('filtroAnoFatura').value;
  
  let faturas = dados.faturas;
  if (cartaoId) faturas = faturas.filter(f => f.cartaoId === cartaoId);
  
  const faturasPorMes = {};
  faturas.forEach(fatura => {
    if (!fatura.pago && fatura.dataVencimento) {
      const dataVenc = new Date(fatura.dataVencimento);
      const mes = String(dataVenc.getMonth()+1).padStart(2,'0');
      const ano = dataVenc.getFullYear();
      if ((!mesFiltro || mes === mesFiltro) && (!anoFiltro || ano == anoFiltro)) {
        const chave = `${ano}-${mes}`;
        if (!faturasPorMes[chave]) {
          faturasPorMes[chave] = {
            nome: dataVenc.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}),
            total: 0,
            itens: [],
            cartoes: new Set()
          };
        }
        faturasPorMes[chave].total += fatura.valorParcela;
        faturasPorMes[chave].itens.push(fatura);
        faturasPorMes[chave].cartoes.add(fatura.cartaoNome);
      }
    }
  });
  
  const totalGeral = Object.values(faturasPorMes).reduce((sum, d) => sum + d.total, 0);
  document.getElementById('resumoFaturas').innerHTML = `
    <div class="stat-card"><div class="icon"><i class="fas fa-calendar"></i></div><div class="label">Faturas em Aberto</div><div class="value">${Object.keys(faturasPorMes).length}</div></div>
    <div class="stat-card"><div class="icon"><i class="fas fa-dollar-sign"></i></div><div class="label">Total a Pagar</div><div class="value" style="color:#f59e0b">${formatarMoeda(totalGeral)}</div></div>
  `;
  
  const container = document.getElementById('listaFaturas');
  if (Object.keys(faturasPorMes).length === 0) {
    container.innerHTML = '<div class="chart-card" style="text-align:center">Nenhuma fatura pendente</div>';
    return;
  }
  
  container.innerHTML = Object.entries(faturasPorMes).map(([chave, data], idx) => `
    <div class="chart-card fatura-mensal-card">
      <div class="fatura-header" onclick="toggleFatura(${idx})">
        <h3><i class="fas fa-file-invoice"></i> ${data.nome}</h3>
        <div><span style="font-size:24px; font-weight:900">${formatarMoeda(data.total)}</span> <i class="fas fa-chevron-down"></i></div>
      </div>
      <div id="faturaContent-${idx}" style="display:none; margin-top:16px">
        <div style="margin-bottom:16px; color:#64748b">
          <i class="fas fa-credit-card"></i> ${Array.from(data.cartoes).join(', ')} • 📦 ${data.itens.length} parcelas
        </div>
        <button class="btn-primary" style="width:100%; margin-bottom:16px" onclick="pagarFatura('${chave}')">
          <i class="fas fa-check-circle"></i> Pagar Fatura (${formatarMoeda(data.total)})
        </button>
        ${data.itens.map(item => `
          <div style="background:#f8fafc; border-radius:12px; padding:12px; margin-bottom:8px; border-left:4px solid #2563eb">
            <div><strong>${item.descricao}</strong><span style="float:right">${formatarMoeda(item.valorParcela)}</span></div>
            <div style="font-size:12px; color:#64748b"><i class="fas fa-credit-card"></i> ${item.cartaoNome} • Parcela ${item.parcelaAtual}/${item.numParcelas} • Vence: ${formatarData(item.dataVencimento)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function toggleFatura(index) {
  const content = document.getElementById(`faturaContent-${index}`);
  if (content) content.style.display = content.style.display === 'none' ? 'block' : 'none';
}

async function pagarFatura(chaveMes) {
  const [ano, mes] = chaveMes.split('-');
  const nomeMes = new Date(parseInt(ano), parseInt(mes)-1, 1).toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
  
  const faturasParaPagar = [];
  let totalPagar = 0;
  let cartoesEnvolvidos = new Set();
  
  dados.faturas.forEach(fatura => {
    if (!fatura.pago && fatura.dataVencimento) {
      const dataVenc = new Date(fatura.dataVencimento);
      if (dataVenc.getFullYear() === parseInt(ano) && String(dataVenc.getMonth()+1).padStart(2,'0') === mes) {
        faturasParaPagar.push(fatura);
        totalPagar += fatura.valorParcela;
        cartoesEnvolvidos.add(fatura.cartaoNome);
      }
    }
  });
  
  if (faturasParaPagar.length === 0) {
    mostrarToast('Nenhuma parcela para pagar!', 'warning');
    return;
  }
  
  if (!confirm(`Pagar fatura de ${nomeMes} no valor de ${formatarMoeda(totalPagar)}?`)) return;
  
  mostrarLoading(true);
  try {
    const dataPagamento = new Date().toISOString().split('T')[0];
    for (const fatura of faturasParaPagar) {
      fatura.pago = true;
      fatura.dataPagamento = dataPagamento;
      const cartao = dados.cartoes.find(c => c.id === fatura.cartaoId);
      if (cartao) cartao.limiteUsado = Math.max(0, (cartao.limiteUsado || 0) - fatura.valorParcela);
    }
    
    dados.pagamentos.push({
      id: Date.now(),
      dataPagamento: dataPagamento,
      mesReferencia: mes,
      anoReferencia: ano,
      valorTotal: totalPagar,
      quantidadeParcelas: faturasParaPagar.length,
      cartoes: Array.from(cartoesEnvolvidos).join(', ')
    });
    
    await salvarDados();
    mostrarToast(`✅ Fatura de ${nomeMes} paga! Total: ${formatarMoeda(totalPagar)}`);
    await carregarDados();
  } catch (error) {
    mostrarToast(error.message, 'error');
  } finally {
    mostrarLoading(false);
  }
}

// ========== HISTÓRICO ==========
function carregarHistorico() {
  const mes = document.getElementById('filtroHistoricoMes').value;
  const ano = document.getElementById('filtroHistoricoAno').value;
  
  let lista = [...dados.pagamentos];
  if (mes) lista = lista.filter(p => p.mesReferencia === mes);
  if (ano) lista = lista.filter(p => p.anoReferencia == ano);
  lista.sort((a,b) => b.dataPagamento.localeCompare(a.dataPagamento));
  
  const tbody = document.getElementById('listaHistorico');
  if (lista.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">Nenhum pagamento registrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = lista.map(p => `
    <tr>
      <td><strong>${new Date(p.anoReferencia, parseInt(p.mesReferencia)-1, 1).toLocaleDateString('pt-BR', {month:'long', year:'numeric'})}</strong></td>
      <td>${formatarData(p.dataPagamento)}</td>
      <td>${p.cartoes}</td>
      <td>${p.quantidadeParcelas} parcelas</td>
      <td style="color:#10b981; font-weight:600">${formatarMoeda(p.valorTotal)}</td>
    </tr>
  `).join('');
}

// ========== DASHBOARD ==========
function carregarDashboard() {
  const mesFiltro = document.getElementById('filtroMesDashboard').value;
  let totalGasto = 0, totalFaturas = 0, gastosPorCategoria = {}, gastosPorMes = {};
  
  CATEGORIAS.forEach(c => gastosPorCategoria[c] = 0);
  
  dados.lancamentos.forEach(l => {
    if (!mesFiltro || l.data.startsWith(mesFiltro)) {
      totalGasto += l.valor;
      gastosPorCategoria[l.categoria] = (gastosPorCategoria[l.categoria] || 0) + l.valor;
      const mes = l.data.substring(0,7);
      gastosPorMes[mes] = (gastosPorMes[mes] || 0) + l.valor;
    }
  });
  
  dados.faturas.forEach(f => {
    if (!f.pago) totalFaturas += f.valorParcela;
  });
  
  const totalMetas = Object.values(dados.metas).reduce((a,b) => a + b, 0);
  
  document.getElementById('statsDashboard').innerHTML = `
    <div class="stat-card"><div class="icon"><i class="fas fa-arrow-down"></i></div><div class="label">Total Gasto</div><div class="value" style="color:#ef4444">-${formatarMoeda(totalGasto)}</div></div>
    <div class="stat-card"><div class="icon"><i class="fas fa-clock"></i></div><div class="label">Em Faturas</div><div class="value" style="color:#f59e0b">${formatarMoeda(totalFaturas)}</div></div>
    <div class="stat-card"><div class="icon"><i class="fas fa-bullseye"></i></div><div class="label">% Metas</div><div class="value">${totalMetas > 0 ? ((totalGasto/totalMetas)*100).toFixed(1) : 0}%</div></div>
    <div class="stat-card"><div class="icon"><i class="fas fa-credit-card"></i></div><div class="label">Cartões</div><div class="value">${dados.cartoes.length}</div></div>
  `;
  
  const grid = document.getElementById('categoriasGrid');
  grid.innerHTML = CATEGORIAS.map(cat => {
    const real = gastosPorCategoria[cat] || 0;
    const meta = dados.metas[cat] || 0;
    const percent = meta > 0 ? (real/meta)*100 : 0;
    let status = percent >= 100 ? '#ef4444' : percent >= 80 ? '#f59e0b' : '#10b981';
    return `
      <div class="stat-card">
        <div><i class="fas ${getIconeCategoria(cat)}"></i> <strong>${cat}</strong><span style="float:right">${percent.toFixed(1)}%</span></div>
        <div style="font-size:20px; font-weight:700; margin:12px 0">${formatarMoeda(real)} <span style="font-size:12px; color:#64748b">/ ${formatarMoeda(meta)}</span></div>
        <div style="background:#e2e8f0; border-radius:10px; height:8px"><div style="background:${status}; width:${Math.min(percent,100)}%; height:8px; border-radius:10px"></div></div>
      </div>
    `;
  }).join('');
  
  if (chartPizza) chartPizza.destroy();
  const ctxPizza = document.getElementById('graficoPizza');
  if (ctxPizza) {
    chartPizza = new Chart(ctxPizza, {
      type: 'doughnut',
      data: { labels: CATEGORIAS, datasets: [{ data: CATEGORIAS.map(c => gastosPorCategoria[c] || 0), backgroundColor: ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#06b6d4','#64748b'] }] },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }
  
  if (chartLinha) chartLinha.destroy();
  const ctxLinha = document.getElementById('graficoLinha');
  if (ctxLinha) {
    const meses = Object.keys(gastosPorMes).sort();
    chartLinha = new Chart(ctxLinha, {
      type: 'line',
      data: { labels: meses.map(m => m.substring(5)+'/'+m.substring(0,4)), datasets: [{ label: 'Gastos Mensais', data: meses.map(m => gastosPorMes[m]), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', tension: 0.3, fill: true }] },
      options: { responsive: true, maintainAspectRatio: true }
    });
  }
}

// ========== ADMIN ==========
async function carregarListaUsuarios() {
  try {
    const response = await fetch(`${API_URL}?action=listarUsuarios&t=${Date.now()}`);
    const resultado = await response.json();
    
    if (resultado.usuarios) {
      const tbody = document.getElementById('listaUsuarios');
      tbody.innerHTML = resultado.usuarios.map(u => `
        <tr>
          <td><strong>${u.usuario}</strong></td>
          <td>${u.nome}</td>
          <td><span style="background:${u.admin ? '#2563eb' : '#64748b'}; color:white; padding:4px 12px; border-radius:20px; font-size:12px">${u.admin ? 'Admin' : 'Usuário'}</span></td>
          <td class="action-buttons">
            <button class="btn-icon btn-edit" onclick="editarUsuario('${u.usuario}', '${u.nome}', ${u.admin})"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-delete" onclick="excluirUsuario('${u.usuario}')"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }
  } catch(e) { console.error(e); }
}

function abrirModalUsuario() {
  document.getElementById('editUsuarioOriginal').value = '';
  document.getElementById('usuarioLogin').value = '';
  document.getElementById('usuarioSenha').value = '';
  document.getElementById('usuarioNome').value = '';
  document.getElementById('usuarioAdmin').checked = false;
  document.getElementById('modalUsuario').classList.add('active');
}

function editarUsuario(usuario, nome, isAdmin) {
  document.getElementById('editUsuarioOriginal').value = usuario;
  document.getElementById('usuarioLogin').value = usuario;
  document.getElementById('usuarioNome').value = nome;
  document.getElementById('usuarioAdmin').checked = isAdmin;
  document.getElementById('usuarioSenha').value = '';
  document.getElementById('modalUsuario').classList.add('active');
}

async function salvarUsuario() {
  const usuarioOriginal = document.getElementById('editUsuarioOriginal').value;
  const usuario = document.getElementById('usuarioLogin').value.trim();
  const senha = document.getElementById('usuarioSenha').value;
  const nome = document.getElementById('usuarioNome').value.trim();
  const isAdmin = document.getElementById('usuarioAdmin').checked;
  
  if (!usuario || (!usuarioOriginal && !senha)) {
    mostrarToast('Preencha usuário e senha!', 'error');
    return;
  }
  
  mostrarLoading(true);
  try {
    let response;
    if (usuarioOriginal) {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'editarUsuario', usuarioOriginal, usuario, senha, nomeEmpresa: nome, isAdmin })
      });
    } else {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'criarUsuario', usuario, senha, nomeEmpresa: nome, isAdmin })
      });
    }
    const data = await response.json();
    if (data.sucesso) {
      mostrarToast(data.mensagem);
      fecharModal('modalUsuario');
      carregarListaUsuarios();
    } else {
      mostrarToast(data.erro, 'error');
    }
  } catch(e) {
    mostrarToast('Erro ao salvar usuário', 'error');
  } finally {
    mostrarLoading(false);
  }
}

async function excluirUsuario(usuario) {
  if (!confirm(`Excluir usuário ${usuario}?`)) return;
  
  mostrarLoading(true);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'excluirUsuario', usuario })
    });
    const data = await response.json();
    if (data.sucesso) {
      mostrarToast(data.mensagem);
      carregarListaUsuarios();
    } else {
      mostrarToast(data.erro, 'error');
    }
  } catch(e) {
    mostrarToast('Erro ao excluir usuário', 'error');
  } finally {
    mostrarLoading(false);
  }
}

// ========== RELATÓRIOS PDF ==========
async function gerarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const tipo = document.getElementById('relatorioTipo').value;
  const mes = document.getElementById('relatorioMes').value;
  const ano = document.getElementById('relatorioAno').value;
  
  doc.setFontSize(20);
  doc.setTextColor(37, 99, 235);
  doc.text('💰 Meu Financeiro', 105, 20, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Relatório de ${tipo === 'faturas' ? 'Faturas' : tipo === 'gastos' ? 'Gastos' : tipo === 'cartoes' ? 'Cartões' : 'Pagamentos'}`, 105, 30, { align: 'center' });
  doc.text(`Período: ${mes ? `${mes}/${ano}` : ano}`, 105, 38, { align: 'center' });
  
  let tableData = [];
  if (tipo === 'faturas') {
    let total = 0;
    dados.faturas.forEach(f => {
      if (!f.pago && (!mes || f.dataVencimento?.substring(5,7) === mes) && f.dataVencimento?.substring(0,4) === ano) {
        tableData.push([f.descricao, f.cartaoNome, `${f.parcelaAtual}/${f.numParcelas}`, formatarData(f.dataVencimento), formatarMoeda(f.valorParcela)]);
        total += f.valorParcela;
      }
    });
    doc.text(`Total: ${formatarMoeda(total)}`, 14, 50);
    doc.autoTable({ startY: 60, head: [['Descrição', 'Cartão', 'Parcela', 'Vencimento', 'Valor']], body: tableData, theme: 'striped', headStyles: { fillColor: [37, 99, 235] } });
  } else if (tipo === 'gastos') {
    let gastos = {};
    CATEGORIAS.forEach(c => gastos[c] = 0);
    dados.lancamentos.forEach(l => {
      if (l.data.substring(0,4) === ano && (!mes || l.data.substring(5,7) === mes)) {
        gastos[l.categoria] += l.valor;
      }
    });
    tableData = CATEGORIAS.map(c => [c, formatarMoeda(gastos[c]), dados.metas[c] ? formatarMoeda(dados.metas[c]) : '-']);
    doc.autoTable({ startY: 50, head: [['Categoria', 'Gasto', 'Meta']], body: tableData, theme: 'striped', headStyles: { fillColor: [37, 99, 235] } });
  } else if (tipo === 'cartoes') {
    tableData = dados.cartoes.map(c => [c.nome, formatarMoeda(c.limite), formatarMoeda(c.limiteUsado || 0), formatarMoeda(c.limite - (c.limiteUsado || 0))]);
    doc.autoTable({ startY: 50, head: [['Cartão', 'Limite', 'Usado', 'Disponível']], body: tableData, theme: 'striped', headStyles: { fillColor: [37, 99, 235] } });
  } else if (tipo === 'historico') {
    let pagamentos = dados.pagamentos.filter(p => p.anoReferencia == ano && (!mes || p.mesReferencia === mes));
    tableData = pagamentos.map(p => [p.mesReferencia, p.anoReferencia, formatarData(p.dataPagamento), p.cartoes, p.quantidadeParcelas, formatarMoeda(p.valorTotal)]);
    doc.autoTable({ startY: 50, head: [['Mês', 'Ano', 'Data Pagto', 'Cartões', 'Parcelas', 'Valor']], body: tableData, theme: 'striped', headStyles: { fillColor: [37, 99, 235] } });
  }
  
  doc.save(`relatorio_${tipo}_${ano}_${mes || 'todos'}.pdf`);
  mostrarToast('PDF gerado com sucesso!');
}

// ========== NAVEGAÇÃO ==========
function mudarPagina(pagina) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page${pagina.charAt(0).toUpperCase() + pagina.slice(1)}`).classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  if (event && event.target) {
    const navItem = event.target.closest('.nav-item');
    if (navItem) navItem.classList.add('active');
  }
  
  if (pagina === 'dashboard') carregarDashboard();
  if (pagina === 'lancamentos') carregarLancamentos();
  if (pagina === 'cartoes') carregarListaCartoes();
  if (pagina === 'faturas') carregarFaturas();
  if (pagina === 'historico') carregarHistorico();
  if (pagina === 'admin' && isAdmin) carregarListaUsuarios();
  
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('mobile-open');
  }
}

function toggleMobileMenu() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

// ========== INICIALIZAÇÃO ==========
window.addEventListener('DOMContentLoaded', () => {
  popularMeses();
  popularSelectAnos();
  document.getElementById('lancamentoData').value = new Date().toISOString().split('T')[0];
  
  const sessao = localStorage.getItem('sessao');
  if (sessao) {
    try {
      usuarioLogado = JSON.parse(sessao);
      isAdmin = usuarioLogado.admin === true;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appContainer').classList.add('active');
      document.getElementById('usuarioNomeSidebar').innerText = usuarioLogado.usuario;
      if (isAdmin) document.getElementById('btnAdmin').style.display = 'flex';
      carregarDados();
      if (isAdmin) carregarListaUsuarios();
    } catch(e) {
      localStorage.removeItem('sessao');
    }
  }
});