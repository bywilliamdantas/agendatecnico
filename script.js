(function(){
  const WEEKDAYS = ["Seg","Ter","Qua","Qui","Sex","Sáb"];
  const MOTIVO_PALETTE = ["#2C5F8A","#C98A2E","#6B5CA5","#C1443D","#2F7A62","#8A5A44","#4A6FA5","#A5477A"];
  const STORAGE_KEY = "painelEquipeDados";
  const FILTROS_KEY = "painelEquipeFiltros";

  let state = {
    activeTab: 'agenda',
    weekOffset: 0,
    data: null,
    modal: null, // {mode:'new'|'edit', pessoaId, data, eventoId, showNewMotivo}
    loading: true,
    filtros: { tipo:'todos', motivo:'todos', supervisor:'todos', busca:'', somenteSemana:false, dias:[0,1,2,3,4,5] }
  };

  function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  const MOBILE_BP = 640;
  function isMobile(){ return window.innerWidth <= MOBILE_BP; }

  // re-renderiza só quando o layout realmente muda de modo (tabela <-> cartões)
  let ultimoModoMobile = null;
  let resizeTimer = null;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(()=>{
      const agora = isMobile();
      if(ultimoModoMobile !== null && agora !== ultimoModoMobile && !state.loading){
        ultimoModoMobile = agora;
        render();
      } else {
        ultimoModoMobile = agora;
      }
    }, 200);
  });

  function defaultData(){
    return {
      nomeEmpresa: "Equipe de Campo",
      pessoas: [],
      motivos: [
        {id:uid('m'), nome:'Manutenção de veículo', cor:'#2C5F8A'},
        {id:uid('m'), nome:'Consulta médica', cor:'#6B5CA5'},
        {id:uid('m'), nome:'Falta', cor:'#C1443D'},
        {id:uid('m'), nome:'Folga', cor:'#2F7A62'}
      ],
      eventos: []
    };
  }

  // ---------- armazenamento ----------
  // Guarda os dados em localStorage, o que funciona em qualquer navegador
  // (GitHub Pages, servidor próprio, arquivo local, etc). Se o app ainda
  // estiver rodando dentro do preview da Claude (window.storage disponível)
  // e não houver nada em localStorage, ele migra os dados antigos uma vez.
  async function loadData(){
    let loaded = null;
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) loaded = JSON.parse(raw);
    }catch(e){ /* localStorage indisponível ou dado corrompido */ }

    if(!loaded && typeof window.storage !== 'undefined' && window.storage && typeof window.storage.get === 'function'){
      try{
        const res = await window.storage.get('agenda-data', false);
        if(res && res.value){ loaded = JSON.parse(res.value); }
      }catch(e){ /* nada salvo no armazenamento antigo */ }
    }

    carregarFiltros();

    state.data = loaded || defaultData();
    if(!state.data.nomeEmpresa) state.data.nomeEmpresa = "Equipe de Campo";
    if(!Array.isArray(state.data.pessoas)) state.data.pessoas = [];
    if(!Array.isArray(state.data.motivos)) state.data.motivos = defaultData().motivos;
    if(!Array.isArray(state.data.eventos)) state.data.eventos = [];

    // se o motivo salvo no filtro não existe mais, volta para "Todos"
    if(state.filtros.motivo!=='todos' && !motivoById(state.filtros.motivo)){
      state.filtros.motivo = 'todos';
      salvarFiltros();
    }
    // idem para o supervisor salvo no filtro
    if(state.filtros.supervisor!=='todos' && state.filtros.supervisor!=='__sem__'
       && listaSupervisores().indexOf(state.filtros.supervisor)===-1){
      state.filtros.supervisor = 'todos';
      salvarFiltros();
    }

    state.loading = false;
    saveData(true);
    render();
  }

  function carregarFiltros(){
    try{
      const raw = localStorage.getItem(FILTROS_KEY);
      if(!raw) return;
      const f = JSON.parse(raw);
      if(f && typeof f === 'object'){
        if(typeof f.tipo === 'string') state.filtros.tipo = f.tipo;
        if(typeof f.motivo === 'string') state.filtros.motivo = f.motivo;
        if(typeof f.supervisor === 'string') state.filtros.supervisor = f.supervisor;
        if(typeof f.busca === 'string') state.filtros.busca = f.busca;
        if(typeof f.somenteSemana === 'boolean') state.filtros.somenteSemana = f.somenteSemana;
        if(Array.isArray(f.dias) && f.dias.length>0){
          const dias = f.dias.filter(n=>Number.isInteger(n) && n>=0 && n<=5);
          if(dias.length>0) state.filtros.dias = dias.sort((a,b)=>a-b);
        }
      }
    }catch(e){ /* filtros corrompidos: segue com os padrões */ }
  }

  let filtrosTimer=null;
  function salvarFiltros(){
    clearTimeout(filtrosTimer);
    filtrosTimer = setTimeout(()=>{
      try{ localStorage.setItem(FILTROS_KEY, JSON.stringify(state.filtros)); }catch(e){}
    }, 200);
  }

  let saveTimer=null;
  function saveData(imediato){
    clearTimeout(saveTimer);
    const run = ()=>{
      try{
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      }catch(e){
        showToast('Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado.');
      }
    };
    if(imediato){ run(); } else { saveTimer = setTimeout(run, 150); }
  }

  function exportarDados(){
    const blob = new Blob([JSON.stringify(state.data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-painel-equipe-${iso(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    showToast('Backup exportado.');
  }

  function importarDados(file){
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const parsed = JSON.parse(e.target.result);
        if(!parsed || !Array.isArray(parsed.pessoas) || !Array.isArray(parsed.motivos) || !Array.isArray(parsed.eventos)){
          throw new Error('formato inválido');
        }
        if(!confirm('Importar este backup vai substituir os dados atuais do painel. Continuar?')) return;
        state.data = parsed;
        if(!state.data.nomeEmpresa) state.data.nomeEmpresa = "Equipe de Campo";
        saveData(true);
        render();
        showToast('Backup importado com sucesso.');
      }catch(err){
        showToast('Não foi possível importar: arquivo inválido.');
      }
    };
    reader.readAsText(file);
  }

  function atualizarTitulo(){
    const nome = (state.data && state.data.nomeEmpresa) ? state.data.nomeEmpresa : 'Equipe de Campo';
    document.title = nome + ' — Painel Semanal';
  }

  function showToast(msg, acaoFn, acaoLabel){
    const t = document.getElementById('toast');
    t.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = msg;
    t.appendChild(span);

    const duracao = acaoFn ? 7000 : 2200;

    if(acaoFn){
      const btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = acaoLabel || 'Desfazer';
      btn.addEventListener('click', ()=>{
        clearTimeout(t._timer);
        t.classList.remove('show');
        acaoFn();
      });
      t.appendChild(btn);
    }

    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(()=>t.classList.remove('show'), duracao);
  }

  // ---------- datas ----------
  function mondayOf(d){
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = (day===0? -6 : 1-day);
    dt.setDate(dt.getDate()+diff);
    dt.setHours(0,0,0,0);
    return dt;
  }
  function weekDates(offset){
    const base = mondayOf(new Date());
    base.setDate(base.getDate() + offset*7);
    const arr=[];
    for(let i=0;i<6;i++){
      const d = new Date(base);
      d.setDate(d.getDate()+i);
      arr.push(d);
    }
    return arr;
  }
  // usa a data LOCAL (toISOString converteria para UTC e poderia trocar o dia)
  function iso(d){
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function br(d){ return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }
  function brLong(d){ return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}); }

  function periodoLabel(p){
    if(p==='manha') return 'Manhã';
    if(p==='tarde') return 'Tarde';
    return 'Dia todo';
  }

  function motivoById(id){ return state.data.motivos.find(m=>m.id===id); }
  function pessoaById(id){ return state.data.pessoas.find(p=>p.id===id); }

  // dois períodos conflitam quando ocupam o mesmo espaço do dia:
  // "dia todo" conflita com tudo; manhã só com manhã; tarde só com tarde.
  function periodosConflitam(a, b){
    if(a==='dia' || b==='dia') return true;
    return a===b;
  }

  function eventosConflitantes(pessoaId, data, periodo, ignorarEventoId){
    return state.data.eventos.filter(e=>
      e.pessoaId===pessoaId &&
      e.data===data &&
      e.id!==ignorarEventoId &&
      periodosConflitam(e.periodo, periodo)
    );
  }

  function contarEventosPorPessoa(pessoaId){
    return state.data.eventos.filter(e=>e.pessoaId===pessoaId).length;
  }
  function contarEventosPorMotivo(motivoId){
    return state.data.eventos.filter(e=>e.motivoId===motivoId).length;
  }
  // texto do cabeçalho da imagem, conforme os dias escolhidos
  function legendaPeriodo(datasVisiveis, datasSemana){
    if(datasVisiveis.length===0) return '';
    if(datasVisiveis.length===1){
      const d = datasVisiveis[0];
      const diaSemana = d.toLocaleDateString('pt-BR',{weekday:'long'});
      return diaSemana.charAt(0).toUpperCase()+diaSemana.slice(1)+', '+brLong(d);
    }
    if(datasVisiveis.length===datasSemana.length){
      return 'Semana de '+brLong(datasSemana[0])+' a '+brLong(datasSemana[5]);
    }
    return 'Dias: '+datasVisiveis.map(br).join(', ')+' — '+brLong(datasSemana[0]).slice(6);
  }

  function listaSupervisores(){
    const set = [];
    state.data.pessoas.forEach(p=>{
      const s = (p.supervisor||'').trim();
      if(s && set.indexOf(s)===-1) set.push(s);
    });
    return set.sort((a,b)=>a.localeCompare(b,'pt-BR'));
  }

  // abaixo do nome mostramos o supervisor; sem supervisor, mostra o cargo
  function subtituloPessoa(p){
    if(p.supervisor && p.supervisor.trim()) return 'Sup.: ' + p.supervisor.trim();
    return p.tipo==='tecnico' ? 'Técnico' : 'Auxiliar';
  }

  function filtrosAtivos(){
    const f = state.filtros;
    return f.tipo!=='todos' || f.motivo!=='todos' || f.supervisor!=='todos' || !!f.busca || f.somenteSemana || (f.dias && f.dias.length!==6);
  }

  function plural(n, singular, pluralForma){
    return n + ' ' + (n===1 ? singular : pluralForma);
  }

  function irParaData(dateStr){
    if(!dateStr) return;
    const target = mondayOf(new Date(dateStr+'T00:00:00'));
    const base = mondayOf(new Date());
    const diffDays = Math.round((target - base)/(1000*60*60*24));
    state.weekOffset = Math.round(diffDays/7);
    render();
  }

  // ---------- render ----------
  function render(){
    const app = document.getElementById('app');

    // preserva foco/cursor de um campo de texto durante re-render (ex.: busca)
    const active = document.activeElement;
    const focusedId = active && active.id ? active.id : null;
    const selStart = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    const selEnd = active && typeof active.selectionEnd === 'number' ? active.selectionEnd : null;

    if(state.loading){ app.innerHTML = '<div style="padding:60px;text-align:center;color:#5B6B72;">Carregando painel...</div>'; return; }
    atualizarTitulo();
    ultimoModoMobile = isMobile();
    const dates = weekDates(state.weekOffset);
    const rangeLabel = br(dates[0]) + ' – ' + br(dates[5]);

    app.innerHTML = `
      <div class="topbar">
        <div class="topbar-left">
          <span class="topbar-label">Painel da equipe</span>
          <input class="brand-input" id="brandInput" value="${escapeAttr(state.data.nomeEmpresa)}" maxlength="60">
        </div>
        <div class="week-nav">
          <button data-action="prev-week" title="Semana anterior">‹</button>
          <div>
            <div class="week-range">${rangeLabel}</div>
            ${state.weekOffset!==0 ? '<div style="text-align:center;margin-top:4px;"><button class="week-today" data-action="today">voltar para hoje</button></div>' : ''}
          </div>
          <button data-action="next-week" title="Próxima semana">›</button>
          <div class="jump-date">
            <input type="date" id="irParaData" title="Ir para uma semana específica">
          </div>
        </div>
        <div class="topbar-right">
          <button class="btn btn-ghost btn-small" data-action="exportar-dados">Exportar backup</button>
          <button class="btn btn-ghost btn-small" data-action="importar-dados-click">Importar backup</button>
        </div>
      </div>

      <div class="tabs">
        <div class="tab ${state.activeTab==='agenda'?'active':''}" data-action="tab" data-tab="agenda">Agenda</div>
        <div class="tab ${state.activeTab==='equipe'?'active':''}" data-action="tab" data-tab="equipe">Técnicos &amp; auxiliares</div>
        <div class="tab ${state.activeTab==='motivos'?'active':''}" data-action="tab" data-tab="motivos">Motivos</div>
        <div class="tab ${state.activeTab==='relatorio'?'active':''}" data-action="tab" data-tab="relatorio">Relatório</div>
      </div>

      ${state.activeTab==='agenda' ? renderAgenda(dates) : ''}
      ${state.activeTab==='equipe' ? renderEquipe() : ''}
      ${state.activeTab==='motivos' ? renderMotivos() : ''}
      ${state.activeTab==='relatorio' ? renderRelatorio() : ''}

      ${state.activeTab==='agenda' ? '<button class="fab" data-action="novo-evento">+ Novo evento</button>' : ''}
      ${state.modal ? renderModal() : ''}
    `;
    attachHandlers();

    if(focusedId){
      const el = document.getElementById(focusedId);
      if(el){
        el.focus();
        if(selStart!==null && el.setSelectionRange){
          try{ el.setSelectionRange(selStart, selEnd); }catch(e){}
        }
      }
    }
  }

  function renderAgenda(datesSemana){
    const pessoasTodas = state.data.pessoas;
    if(pessoasTodas.length===0){
      return `<div class="panel"><div class="empty-list">Nenhum técnico ou auxiliar cadastrado ainda. Vá até a aba <b>Técnicos &amp; auxiliares</b> para cadastrar sua equipe.</div></div>`;
    }

    const f = state.filtros;
    // dias escolhidos para aparecer na tela e na imagem
    const indicesDias = (f.dias && f.dias.length) ? f.dias.slice().sort((a,b)=>a-b) : [0,1,2,3,4,5];
    const dates = indicesDias.map(i=>datesSemana[i]);
    const hojeIso = iso(new Date());

    const isosVisiveis = dates.map(iso);

    function eventosDaPessoaNaSemana(p){
      return state.data.eventos.filter(e=>{
        if(e.pessoaId!==p.id) return false;
        if(isosVisiveis.indexOf(e.data)===-1) return false;
        if(f.motivo!=='todos' && e.motivoId!==f.motivo) return false;
        return true;
      });
    }

    let pessoasFiltradas = pessoasTodas.filter(p=>{
      if(f.tipo!=='todos' && p.tipo!==f.tipo) return false;
      if(f.supervisor!=='todos'){
        const sup = (p.supervisor||'').trim();
        if(f.supervisor==='__sem__'){ if(sup) return false; }
        else if(sup !== f.supervisor) return false;
      }
      if(f.busca && !p.nome.toLowerCase().includes(f.busca.toLowerCase())) return false;
      return true;
    });

    if(f.somenteSemana || f.motivo!=='todos'){
      pessoasFiltradas = pessoasFiltradas.filter(p=> eventosDaPessoaNaSemana(p).length>0);
    }

    const tecnicos = pessoasFiltradas.filter(p=>p.tipo==='tecnico');
    const auxiliares = pessoasFiltradas.filter(p=>p.tipo==='auxiliar');

    function rowsFor(list){
      return list.map(p=>{
        const cells = dates.map(d=>{
          const diso = iso(d);
          let evs = state.data.eventos.filter(e=>e.pessoaId===p.id && e.data===diso);
          if(f.motivo!=='todos') evs = evs.filter(e=>e.motivoId===f.motivo);
          const chips = evs.map(e=>{
            const mo = motivoById(e.motivoId);
            const cor = mo ? mo.cor : '#888';
            const nome = mo ? mo.nome : '(motivo removido)';
            return `<div class="chip" style="background:${hexSoft(cor)};color:${cor};" data-action="editar-evento" data-evento="${e.id}">
              <span class="dot" style="background:${cor};"></span>
              <span>${escapeHtml(nome)} · ${periodoLabel(e.periodo)}</span>
            </div>`;
          }).join('');
          const hojeCls = (diso===hojeIso) ? ' is-today' : '';
          return `<div class="cell day-cell${hojeCls}" data-action="add-evento-cell" data-pessoa="${p.id}" data-data="${diso}">${chips}</div>`;
        }).join('');
        return `<div class="cell person-cell"><span class="person-name">${escapeHtml(p.nome)}</span><span class="person-tag">${escapeHtml(subtituloPessoa(p))}</span></div>${cells}`;
      }).join('');
    }

    // versão em cartões usada em telas estreitas
    function cardsFor(tecs, auxs, datas, hoje){
      function cardPessoa(p){
        const dias = datas.map((d,i)=>{
          const diso = iso(d);
          let evs = state.data.eventos.filter(e=>e.pessoaId===p.id && e.data===diso);
          if(f.motivo!=='todos') evs = evs.filter(e=>e.motivoId===f.motivo);
          if(evs.length===0) return '';
          const chips = evs.map(e=>{
            const mo = motivoById(e.motivoId);
            const cor = mo ? mo.cor : '#888';
            const nome = mo ? mo.nome : '(motivo removido)';
            return `<div class="chip" style="background:${hexSoft(cor)};color:${cor};" data-action="editar-evento" data-evento="${e.id}">
              <span class="dot" style="background:${cor};"></span>
              <span>${escapeHtml(nome)} · ${periodoLabel(e.periodo)}</span>
            </div>`;
          }).join('');
          return `<div class="mc-dia${diso===hoje?' is-today':''}">
            <div class="mc-dia-label">${WEEKDAYS[indicesDias[i]]} ${br(d)}${diso===hoje?'<span class="today-badge">HOJE</span>':''}</div>
            <div class="mc-dia-chips">${chips}</div>
          </div>`;
        }).join('');

        const vazio = dias==='';
        return `<div class="mobile-card">
          <div class="mc-head">
            <div>
              <div class="mc-nome">${escapeHtml(p.nome)}</div>
              <div class="mc-tag">${escapeHtml(subtituloPessoa(p))}</div>
            </div>
            <button class="btn btn-ghost btn-small" data-action="add-evento-cell" data-pessoa="${p.id}" data-data="${iso(datas[0])}">+ Lançar</button>
          </div>
          ${vazio ? '<div class="mc-vazio">Sem lançamentos nesta semana.</div>' : `<div class="mc-dias">${dias}</div>`}
        </div>`;
      }
      let out = '';
      if(tecs.length) out += `<div class="mc-grupo">Técnicos</div>` + tecs.map(cardPessoa).join('');
      if(auxs.length) out += `<div class="mc-grupo">Auxiliares</div>` + auxs.map(cardPessoa).join('');
      return `<div class="mobile-cards">${out}</div>`;
    }

    const headCells = dates.map((d,i)=>{
      const ehHoje = iso(d)===hojeIso;
      return `<div class="cell head-cell${ehHoje?' is-today':''}"><b>${WEEKDAYS[indicesDias[i]]}${ehHoje?'<span class="today-badge">HOJE</span>':''}</b>${br(d)}</div>`;
    }).join('');

    const motivosOptsFiltro = state.data.motivos.map(m=>`<option value="${m.id}" ${f.motivo===m.id?'selected':''}>${escapeHtml(m.nome)}</option>`).join('');

    const filtersHtml = `
      <div class="filters-row">
        <div class="filter-field">
          <label>Tipo</label>
          <select id="filtroTipo">
            <option value="todos" ${f.tipo==='todos'?'selected':''}>Todos</option>
            <option value="tecnico" ${f.tipo==='tecnico'?'selected':''}>Técnicos</option>
            <option value="auxiliar" ${f.tipo==='auxiliar'?'selected':''}>Auxiliares</option>
          </select>
        </div>
        <div class="filter-field">
          <label>Motivo</label>
          <select id="filtroMotivo">
            <option value="todos" ${f.motivo==='todos'?'selected':''}>Todos</option>
            ${motivosOptsFiltro}
          </select>
        </div>
        <div class="filter-field">
          <label>Supervisor</label>
          <select id="filtroSupervisor">
            <option value="todos" ${f.supervisor==='todos'?'selected':''}>Todos</option>
            ${listaSupervisores().map(s=>`<option value="${escapeAttr(s)}" ${f.supervisor===s?'selected':''}>${escapeHtml(s)}</option>`).join('')}
            <option value="__sem__" ${f.supervisor==='__sem__'?'selected':''}>Sem supervisor</option>
          </select>
        </div>
        <div class="filter-field">
          <label>Buscar por nome</label>
          <input type="text" id="filtroBusca" placeholder="Nome do técnico ou auxiliar" value="${escapeAttr(f.busca)}">
        </div>
        <div class="filter-field checkbox-field">
          <input type="checkbox" id="filtroSomenteSemana" ${f.somenteSemana?'checked':''}>
          <label for="filtroSomenteSemana">Mostrar só quem tem lançamento nesta semana</label>
        </div>
        ${filtrosAtivos() ? '<div class="filter-field"><button class="btn btn-ghost btn-small" data-action="limpar-filtros">Limpar filtros</button></div>' : ''}
      </div>
    `;

    const diasBar = `
      <div class="dias-bar">
        <span class="dias-bar-label">Dias exibidos</span>
        <div class="dias-bar-toggles">
          ${datesSemana.map((d,i)=>`
            <button class="dia-toggle${indicesDias.indexOf(i)!==-1?' on':''}${iso(d)===hojeIso?' hoje':''}"
                    data-action="toggle-dia" data-dia="${i}" title="${WEEKDAYS[i]} ${br(d)}">
              <span class="dt-wd">${WEEKDAYS[i]}</span><span class="dt-dt">${br(d)}</span>
            </button>`).join('')}
        </div>
        <div class="dias-bar-acoes">
          <button class="btn btn-ghost btn-small" data-action="dias-todos">Semana toda</button>
          <button class="btn btn-ghost btn-small" data-action="dias-hoje">Só hoje</button>
        </div>
      </div>`;

    const semResultado = (tecnicos.length + auxiliares.length) === 0;

    return `
      <div class="panel">
        <div class="agenda-toolbar">
          <div style="font-size:13px;color:var(--ink-soft);">${isMobile() ? 'Toque em "+ Lançar" no cartão da pessoa, ou em um lançamento para editá-lo.' : 'Clique em uma célula do dia para lançar um evento.'}</div>
          <button class="btn btn-accent" data-action="gerar-imagem">${
            indicesDias.length===1 ? 'Gerar imagem do dia' :
            (indicesDias.length===6 ? 'Gerar imagem da semana' : `Gerar imagem (${indicesDias.length} dias)`)
          }</button>
        </div>
        ${filtersHtml}
        ${diasBar}
        <div id="capture-area">
          <div class="capture-header" id="captureHeader">
            <h2>${escapeHtml(state.data.nomeEmpresa)}</h2>
            <span>${legendaPeriodo(dates, datesSemana)}</span>
          </div>
          ${semResultado ? '<div class="empty-list">Nenhum resultado para os filtros aplicados nesta semana.</div>' : (
            isMobile() ? cardsFor(tecnicos, auxiliares, dates, hojeIso) : `
          <div class="grid-wrap">
            <div class="agrid" style="grid-template-columns:170px repeat(${dates.length},minmax(130px,1fr));min-width:${170 + dates.length*130}px;">
              <div class="cell head-cell head-canto"></div>
              ${headCells}
              ${tecnicos.length ? `<div class="group-row">Técnicos</div>` + rowsFor(tecnicos) : ''}
              ${auxiliares.length ? `<div class="group-row">Auxiliares</div>` + rowsFor(auxiliares) : ''}
            </div>
          </div>`)}
        </div>
      </div>
    `;
  }

  function renderEquipe(){
    const tecnicos = state.data.pessoas.filter(p=>p.tipo==='tecnico');
    const auxiliares = state.data.pessoas.filter(p=>p.tipo==='auxiliar');
    function list(arr){
      if(arr.length===0) return '<div class="empty-list">Nenhum cadastrado ainda.</div>';
      return arr.map(p=>`
        <div class="list-item pessoa-item">
          <div class="pessoa-dados">
            <span class="name">${escapeHtml(p.nome)}</span>
            <div class="sup-row">
              <label for="sup-${p.id}">Supervisor</label>
              <input type="text" id="sup-${p.id}" class="sup-input" data-action="editar-supervisor" data-id="${p.id}"
                     value="${escapeAttr(p.supervisor||'')}" placeholder="sem supervisor" maxlength="40">
            </div>
          </div>
          <button class="btn-danger-text" data-action="remover-pessoa" data-id="${p.id}">Remover</button>
        </div>`).join('');
    }
    return `
      <div class="col-2">
        <div class="panel sub-panel">
          <h3>Técnicos</h3>
          <p class="hint">Quem faz o trabalho técnico em campo ou oficina. O supervisor aparece abaixo do nome na agenda.</p>
          <div class="add-row add-row-2">
            <input type="text" id="novoTecnico" placeholder="Nome do técnico">
            <input type="text" id="novoTecnicoSup" placeholder="Supervisor (opcional)">
            <button class="btn btn-accent" data-action="add-pessoa" data-tipo="tecnico">Adicionar</button>
          </div>
          ${list(tecnicos)}
        </div>
        <div class="panel sub-panel">
          <h3>Auxiliares</h3>
          <p class="hint">Quem apoia a equipe técnica.</p>
          <div class="add-row add-row-2">
            <input type="text" id="novoAuxiliar" placeholder="Nome do auxiliar">
            <input type="text" id="novoAuxiliarSup" placeholder="Supervisor (opcional)">
            <button class="btn btn-accent" data-action="add-pessoa" data-tipo="auxiliar">Adicionar</button>
          </div>
          ${list(auxiliares)}
        </div>
      </div>
    `;
  }

  function renderMotivos(){
    const motivos = state.data.motivos;
    const list = motivos.length===0 ? '<div class="empty-list">Nenhum motivo cadastrado.</div>' : motivos.map(m=>`
      <div class="list-item">
        <div class="motivo-item">
          <input type="color" class="swatch" value="${m.cor}" data-action="cor-motivo" data-id="${m.id}">
          <span class="name">${escapeHtml(m.nome)}</span>
        </div>
        <button class="btn-danger-text" data-action="remover-motivo" data-id="${m.id}">Remover</button>
      </div>`).join('');
    return `
      <div class="panel sub-panel" style="max-width:520px;">
        <h3>Motivos</h3>
        <p class="hint">Os motivos aparecem na agenda como etiquetas coloridas (ex.: manutenção de veículo, consulta médica, falta).</p>
        <div class="add-row">
          <input type="text" id="novoMotivo" placeholder="Novo motivo (ex.: Treinamento)">
          <input type="color" id="corNovoMotivo" class="swatch" value="${MOTIVO_PALETTE[motivos.length % MOTIVO_PALETTE.length]}" style="width:38px;">
          <button class="btn btn-accent" data-action="add-motivo">Adicionar</button>
        </div>
        ${list}
      </div>
    `;
  }

  function renderRelatorio(){
    const mesRef = state.relatorioMes || iso(new Date()).slice(0,7); // AAAA-MM
    const eventosMes = state.data.eventos.filter(e=>e.data.slice(0,7)===mesRef);

    const [ano, mes] = mesRef.split('-');
    const nomeMes = new Date(Number(ano), Number(mes)-1, 1)
      .toLocaleDateString('pt-BR',{month:'long', year:'numeric'});

    const motivos = state.data.motivos;
    const pessoas = state.data.pessoas;

    const seletor = `
      <div class="rel-toolbar">
        <div class="filter-field">
          <label>Mês de referência</label>
          <input type="month" id="relatorioMes" value="${mesRef}">
        </div>
        <button class="btn btn-ghost btn-small" data-action="exportar-relatorio-csv">Baixar em CSV</button>
      </div>`;

    if(pessoas.length===0){
      return `<div class="panel">${seletor}<div class="empty-list">Nenhum técnico ou auxiliar cadastrado ainda.</div></div>`;
    }
    if(eventosMes.length===0){
      return `<div class="panel">${seletor}<div class="empty-list">Nenhum evento lançado em ${nomeMes}.</div></div>`;
    }

    // só mostra colunas de motivos que aparecem no mês, para a tabela não ficar enorme
    const motivosUsados = motivos.filter(mo=> eventosMes.some(e=>e.motivoId===mo.id));
    const temOrfaos = eventosMes.some(e=> !motivoById(e.motivoId));

    function contar(pessoaId, motivoId){
      return eventosMes.filter(e=>e.pessoaId===pessoaId && e.motivoId===motivoId).length;
    }
    function contarOrfaos(pessoaId){
      return eventosMes.filter(e=>e.pessoaId===pessoaId && !motivoById(e.motivoId)).length;
    }

    // só lista quem teve algum evento no mês
    const pessoasComEventos = pessoas.filter(p=> eventosMes.some(e=>e.pessoaId===p.id));

    const head = `
      <tr>
        <th class="rel-nome">Pessoa</th>
        ${motivosUsados.map(mo=>`<th><span class="rel-dot" style="background:${mo.cor};"></span>${escapeHtml(mo.nome)}</th>`).join('')}
        ${temOrfaos ? '<th>(motivo removido)</th>' : ''}
        <th class="rel-total">Total</th>
      </tr>`;

    const linhas = pessoasComEventos.map(p=>{
      const cels = motivosUsados.map(mo=>{
        const n = contar(p.id, mo.id);
        return `<td class="${n===0?'zero':''}">${n}</td>`;
      }).join('');
      const orf = temOrfaos ? `<td class="${contarOrfaos(p.id)===0?'zero':''}">${contarOrfaos(p.id)}</td>` : '';
      const total = eventosMes.filter(e=>e.pessoaId===p.id).length;
      return `<tr>
        <td class="rel-nome">${escapeHtml(p.nome)}<span class="rel-tag">${p.tipo==='tecnico'?'Técnico':'Auxiliar'}</span></td>
        ${cels}${orf}
        <td class="rel-total">${total}</td>
      </tr>`;
    }).join('');

    const totaisCols = motivosUsados.map(mo=>{
      const n = eventosMes.filter(e=>e.motivoId===mo.id).length;
      return `<td>${n}</td>`;
    }).join('');
    const totalOrf = temOrfaos ? `<td>${eventosMes.filter(e=>!motivoById(e.motivoId)).length}</td>` : '';

    const rodape = `
      <tr class="rel-rodape">
        <td class="rel-nome">Total geral</td>
        ${totaisCols}${totalOrf}
        <td class="rel-total">${eventosMes.length}</td>
      </tr>`;

    return `
      <div class="panel">
        ${seletor}
        <h3 style="margin:4px 0 2px;font-size:15px;text-transform:capitalize;">${nomeMes}</h3>
        <p class="hint" style="margin:0 0 14px;">Quantidade de lançamentos por pessoa e motivo no mês.</p>
        <div class="rel-wrap">
          <table class="rel-table">
            <thead>${head}</thead>
            <tbody>${linhas}${rodape}</tbody>
          </table>
        </div>
      </div>`;
  }

  function renderModal(){
    const m = state.modal;
    const pessoasOpts = state.data.pessoas.map(p=>`<option value="${p.id}" ${p.id===m.pessoaId?'selected':''}>${escapeHtml(p.nome)} (${p.tipo==='tecnico'?'Técnico':'Auxiliar'})</option>`).join('');
    const motivosOpts = state.data.motivos.map(mo=>`<option value="${mo.id}" ${mo.id===m.motivoId?'selected':''}>${escapeHtml(mo.nome)}</option>`).join('');
    const isEdit = m.mode==='edit';
    return `
      <div class="overlay" data-action="close-modal-overlay">
        <div class="modal" data-stop="1">
          <h3>${isEdit?'Editar evento':'Novo evento'}</h3>
          <p class="sub">Registre manutenção, consulta ou ausência de um membro da equipe.</p>

          <div class="field">
            <label>Pessoa</label>
            <select id="modalPessoa">${pessoasOpts}</select>
          </div>
          <div class="field">
            <label>Data</label>
            <input type="date" id="modalData" value="${m.data}">
          </div>
          <div class="field">
            <label>Motivo</label>
            <select id="modalMotivo">${motivosOpts}<option value="__novo__">+ Criar novo motivo…</option></select>
            <div class="inline-new-motivo ${m.showNewMotivo?'show':''}" id="inlineNewMotivo">
              <div class="row">
                <input type="text" id="modalNovoMotivoNome" placeholder="Nome do motivo" style="flex:1;padding:8px;border:1px solid var(--line);border-radius:6px;">
                <input type="color" id="modalNovoMotivoCor" value="${MOTIVO_PALETTE[state.data.motivos.length % MOTIVO_PALETTE.length]}" class="swatch" style="width:34px;">
              </div>
            </div>
          </div>
          <div class="field">
            <label>Período</label>
            <div class="period-opts">
              <label><input type="radio" name="periodo" value="dia" ${m.periodo==='dia'?'checked':''}><span>Dia todo</span></label>
              <label><input type="radio" name="periodo" value="manha" ${m.periodo==='manha'?'checked':''}><span>Manhã</span></label>
              <label><input type="radio" name="periodo" value="tarde" ${m.periodo==='tarde'?'checked':''}><span>Tarde</span></label>
            </div>
          </div>

          ${!isEdit ? `
          <div class="field">
            <label>Repetir em outros dias da mesma semana <span style="font-weight:400;">(opcional)</span></label>
            <div class="days-multi" id="diasMulti">
              ${diasMultiHtml(m.data)}
            </div>
            <p class="days-hint">O dia escolhido acima já é lançado automaticamente. Marque aqui para repetir o mesmo motivo e período em outros dias.</p>
          </div>` : ''}

          <div class="modal-actions">
            <div>${isEdit?'<button class="btn-danger-text" data-action="excluir-evento">Excluir evento</button>':''}</div>
            <div class="right">
              <button class="btn btn-ghost" data-action="close-modal">Cancelar</button>
              <button class="btn btn-accent" data-action="salvar-evento">Salvar</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // monta os checkboxes dos dias da semana a que pertence a data escolhida
  function diasMultiHtml(dataBase){
    if(!dataBase) return '';
    const base = mondayOf(new Date(dataBase+'T00:00:00'));
    const marcados = state.modal && state.modal.diasExtras ? state.modal.diasExtras : [];
    let out = '';
    for(let i=0;i<6;i++){
      const d = new Date(base);
      d.setDate(d.getDate()+i);
      const diso = iso(d);
      const ehBase = diso===dataBase;
      const checked = ehBase || marcados.indexOf(diso)!==-1;
      out += `<label class="day-pick${ehBase?' is-base':''}" title="${ehBase?'Dia principal do lançamento':br(d)}">
        <input type="checkbox" class="dia-multi" value="${diso}" ${checked?'checked':''} ${ehBase?'disabled':''}>
        <span class="dp-wd">${WEEKDAYS[i]}</span>
        <span class="dp-dt">${br(d)}</span>
      </label>`;
    }
    return out;
  }

  // ---------- helpers ----------
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s){ return escapeHtml(s); }
  function hexSoft(hex){
    // gera uma versão bem clara da cor para fundo do chip
    try{
      const c = hex.replace('#','');
      const r = parseInt(c.substring(0,2),16), g = parseInt(c.substring(2,4),16), b = parseInt(c.substring(4,6),16);
      return `rgba(${r},${g},${b},0.14)`;
    }catch(e){ return '#eee'; }
  }

  // ---------- ações ----------
  function attachHandlers(){
    const app = document.getElementById('app');

    const brandInput = document.getElementById('brandInput');
    if(brandInput){
      brandInput.addEventListener('change', e=>{
        state.data.nomeEmpresa = e.target.value.trim() || 'Equipe de Campo';
        e.target.value = state.data.nomeEmpresa;
        atualizarTitulo();
        saveData();
      });
    }

    app.addEventListener('click', onAppClick);
    app.addEventListener('input', onAppInput);
  }

  function onAppInput(e){
    const t = e.target;
    if(t.dataset.action==='editar-supervisor'){
      const p = pessoaById(t.dataset.id);
      if(p){ p.supervisor = t.value.trim(); saveData(); }
      return;
    }
    if(t.dataset.action==='cor-motivo'){
      const mo = state.data.motivos.find(m=>m.id===t.dataset.id);
      if(mo){ mo.cor = t.value; saveData(); render(); }
      return;
    }
    if(t.id==='filtroBusca'){
      state.filtros.busca = t.value;
      salvarFiltros();
      render();
      return;
    }
  }

  function onAppClick(e){
    const el = e.target.closest('[data-action]');
    if(!el){
      // clique fora do modal fecha
      return;
    }
    const action = el.dataset.action;

    if(action==='prev-week'){ state.weekOffset--; render(); return; }
    if(action==='next-week'){ state.weekOffset++; render(); return; }
    if(action==='today'){ state.weekOffset=0; render(); return; }
    if(action==='tab'){ state.activeTab = el.dataset.tab; render(); return; }

    if(action==='toggle-dia'){
      const i = Number(el.dataset.dia);
      const atual = state.filtros.dias.slice();
      const pos = atual.indexOf(i);
      if(pos!==-1){
        if(atual.length===1){ showToast('Deixe pelo menos um dia visível.'); return; }
        atual.splice(pos,1);
      } else {
        atual.push(i);
      }
      state.filtros.dias = atual.sort((a,b)=>a-b);
      salvarFiltros(); render();
      return;
    }
    if(action==='dias-todos'){
      state.filtros.dias = [0,1,2,3,4,5];
      salvarFiltros(); render();
      return;
    }
    if(action==='dias-hoje'){
      const semana = weekDates(state.weekOffset);
      const hojeIso = iso(new Date());
      const idx = semana.findIndex(d=>iso(d)===hojeIso);
      if(idx===-1){ showToast('Hoje não está na semana que você está vendo.'); return; }
      state.filtros.dias = [idx];
      salvarFiltros(); render();
      return;
    }

    if(action==='limpar-filtros'){
      state.filtros = { tipo:'todos', motivo:'todos', supervisor:'todos', busca:'', somenteSemana:false, dias:[0,1,2,3,4,5] };
      salvarFiltros();
      render();
      return;
    }

    if(action==='exportar-dados'){ exportarDados(); return; }
    if(action==='importar-dados-click'){ document.getElementById('importarInput').click(); return; }

    if(action==='add-pessoa'){
      const tipo = el.dataset.tipo;
      const inputId = tipo==='tecnico' ? 'novoTecnico' : 'novoAuxiliar';
      const supId = tipo==='tecnico' ? 'novoTecnicoSup' : 'novoAuxiliarSup';
      const input = document.getElementById(inputId);
      const supInput = document.getElementById(supId);
      const nome = input.value.trim();
      if(!nome){ showToast('Digite um nome antes de adicionar.'); return; }
      state.data.pessoas.push({id:uid('p'), nome, tipo, supervisor: supInput ? supInput.value.trim() : ''});
      input.value='';
      if(supInput) supInput.value='';
      saveData(); render();
      return;
    }
    if(action==='remover-pessoa'){
      const id = el.dataset.id;
      const pessoa = pessoaById(id);
      const qtd = contarEventosPorPessoa(id);
      const nomePessoa = pessoa ? pessoa.nome : 'esta pessoa';
      const msg = qtd===0
        ? `Remover ${nomePessoa}? Não há nenhum evento lançado para ela.`
        : `Remover ${nomePessoa}? Ela tem ${plural(qtd,'evento lançado','eventos lançados')}, que deixarão de aparecer na agenda.`;
      if(!confirm(msg)) return;
      const idx = state.data.pessoas.findIndex(p=>p.id===id);
      const removida = state.data.pessoas[idx];
      state.data.pessoas = state.data.pessoas.filter(p=>p.id!==id);
      saveData(); render();
      showToast(`${nomePessoa} removido(a).`, ()=>{
        if(removida){
          state.data.pessoas.splice(Math.max(idx,0), 0, removida);
          saveData(); render(); showToast('Remoção desfeita.');
        }
      });
      return;
    }

    if(action==='add-motivo'){
      const nomeInput = document.getElementById('novoMotivo');
      const corInput = document.getElementById('corNovoMotivo');
      const nome = nomeInput.value.trim();
      if(!nome){ showToast('Digite um nome para o motivo.'); return; }
      state.data.motivos.push({id:uid('m'), nome, cor: corInput.value});
      nomeInput.value='';
      saveData(); render();
      return;
    }
    if(action==='remover-motivo'){
      const id = el.dataset.id;
      const motivo = motivoById(id);
      const qtd = contarEventosPorMotivo(id);
      const nomeMotivo = motivo ? `"${motivo.nome}"` : 'este motivo';
      const msg = qtd===0
        ? `Remover o motivo ${nomeMotivo}? Ele não está sendo usado em nenhum evento.`
        : `Remover o motivo ${nomeMotivo}? Ele é usado em ${plural(qtd,'evento','eventos')}, que passarão a aparecer como "(motivo removido)" na agenda.`;
      if(!confirm(msg)) return;
      const idxM = state.data.motivos.findIndex(m=>m.id===id);
      const removidoM = state.data.motivos[idxM];
      state.data.motivos = state.data.motivos.filter(m=>m.id!==id);
      if(state.filtros.motivo===id){ state.filtros.motivo='todos'; salvarFiltros(); }
      saveData(); render();
      showToast('Motivo removido.', ()=>{
        if(removidoM){
          state.data.motivos.splice(Math.max(idxM,0), 0, removidoM);
          saveData(); render(); showToast('Remoção desfeita.');
        }
      });
      return;
    }

    if(action==='novo-evento'){
      const primeiraPessoa = state.data.pessoas[0];
      if(!primeiraPessoa){ showToast('Cadastre ao menos um técnico ou auxiliar primeiro.'); state.activeTab='equipe'; render(); return; }
      const dates = weekDates(state.weekOffset);
      const todayIso = iso(new Date());
      const dataPadrao = (todayIso>=iso(dates[0]) && todayIso<=iso(dates[5])) ? todayIso : iso(dates[0]);
      state.modal = {
        mode:'new',
        pessoaId: primeiraPessoa.id,
        data: dataPadrao,
        motivoId: state.data.motivos[0] ? state.data.motivos[0].id : '',
        periodo: 'dia',
        showNewMotivo:false
      };
      render();
      return;
    }
    if(action==='add-evento-cell'){
      state.modal = {
        mode:'new',
        pessoaId: el.dataset.pessoa,
        data: el.dataset.data,
        motivoId: state.data.motivos[0] ? state.data.motivos[0].id : '',
        periodo: 'dia',
        showNewMotivo:false
      };
      render();
      return;
    }
    if(action==='editar-evento'){
      e.stopPropagation();
      const ev = state.data.eventos.find(x=>x.id===el.dataset.evento);
      if(!ev) return;
      state.modal = { mode:'edit', eventoId: ev.id, pessoaId: ev.pessoaId, data: ev.data, motivoId: ev.motivoId, periodo: ev.periodo, showNewMotivo:false };
      render();
      return;
    }
    if(action==='close-modal' || action==='close-modal-overlay'){
      if(action==='close-modal-overlay' && e.target.closest('[data-stop]')) return;
      state.modal = null;
      render();
      return;
    }
    if(action==='excluir-evento'){
      if(!confirm('Excluir este evento?')) return;
      const removido = state.data.eventos.find(x=>x.id===state.modal.eventoId);
      state.data.eventos = state.data.eventos.filter(x=>x.id!==state.modal.eventoId);
      state.modal = null;
      saveData(); render();
      showToast('Evento excluído.', ()=>{
        if(removido){ state.data.eventos.push(removido); saveData(); render(); showToast('Exclusão desfeita.'); }
      });
      return;
    }
    if(action==='salvar-evento'){
      salvarEvento();
      return;
    }

    if(action==='exportar-relatorio-csv'){
      exportarRelatorioCSV();
      return;
    }

    if(action==='gerar-imagem'){
      gerarImagem();
      return;
    }
  }

  // eventos que não são 'click' nem 'input' direto em #app (selects, checkboxes, arquivo)
  document.addEventListener('change', function(e){
    if(e.target.id==='modalMotivo'){
      syncModalFromDOM();
      if(e.target.value==='__novo__'){
        state.modal.showNewMotivo = true;
      } else {
        state.modal.motivoId = e.target.value;
        state.modal.showNewMotivo = false;
      }
      render();
      return;
    }
    if(e.target.id==='modalData'){
      if(state.modal){
        syncModalFromDOM();
        state.modal.data = e.target.value;
        // dias extras que saíram da semana da nova data deixam de valer
        if(state.modal.diasExtras && e.target.value){
          const base = mondayOf(new Date(e.target.value+'T00:00:00'));
          const fim = new Date(base); fim.setDate(fim.getDate()+5);
          const ini = iso(base), f2 = iso(fim);
          state.modal.diasExtras = state.modal.diasExtras.filter(d=> d>=ini && d<=f2 && d!==e.target.value);
        }
        render();
      }
      return;
    }
    if(e.target.classList && e.target.classList.contains('dia-multi')){
      if(state.modal){
        const v = e.target.value;
        if(!state.modal.diasExtras) state.modal.diasExtras = [];
        if(e.target.checked){
          if(state.modal.diasExtras.indexOf(v)===-1) state.modal.diasExtras.push(v);
        } else {
          state.modal.diasExtras = state.modal.diasExtras.filter(d=>d!==v);
        }
      }
      return;
    }
    if(e.target.id==='filtroTipo'){ state.filtros.tipo = e.target.value; salvarFiltros(); render(); return; }
    if(e.target.id==='filtroMotivo'){ state.filtros.motivo = e.target.value; salvarFiltros(); render(); return; }
    if(e.target.id==='filtroSupervisor'){ state.filtros.supervisor = e.target.value; salvarFiltros(); render(); return; }
    if(e.target.id==='filtroSomenteSemana'){ state.filtros.somenteSemana = e.target.checked; salvarFiltros(); render(); return; }
    if(e.target.id==='relatorioMes'){ state.relatorioMes = e.target.value; render(); return; }
    if(e.target.id==='irParaData'){ irParaData(e.target.value); return; }
    if(e.target.id==='importarInput'){
      if(e.target.files && e.target.files[0]){ importarDados(e.target.files[0]); }
      e.target.value = '';
      return;
    }
  });

  // guarda no estado o que já está preenchido na tela, para não perder
  // as escolhas quando o modal é re-renderizado
  function syncModalFromDOM(){
    if(!state.modal) return;
    const p = document.getElementById('modalPessoa');
    const d = document.getElementById('modalData');
    const mo = document.getElementById('modalMotivo');
    const per = document.querySelector('input[name="periodo"]:checked');
    if(p) state.modal.pessoaId = p.value;
    if(d && d.value) state.modal.data = d.value;
    if(mo && mo.value !== '__novo__') state.modal.motivoId = mo.value;
    if(per) state.modal.periodo = per.value;
    const nomeNovo = document.getElementById('modalNovoMotivoNome');
    if(nomeNovo) state.modal.novoMotivoNome = nomeNovo.value;
  }

  function salvarEvento(){
    const m = state.modal;
    const pessoaId = document.getElementById('modalPessoa').value;
    const data = document.getElementById('modalData').value;
    const motivoSelect = document.getElementById('modalMotivo');
    let motivoId = motivoSelect.value;
    const periodoEl = document.querySelector('input[name="periodo"]:checked');
    const periodo = periodoEl ? periodoEl.value : 'dia';

    if(!data){ showToast('Escolha uma data.'); return; }

    if(motivoId === '__novo__'){
      const nome = document.getElementById('modalNovoMotivoNome').value.trim();
      if(!nome){ showToast('Digite o nome do novo motivo.'); return; }
      const cor = document.getElementById('modalNovoMotivoCor').value;
      const novo = {id:uid('m'), nome, cor};
      state.data.motivos.push(novo);
      motivoId = novo.id;
    }

    // monta a lista de datas: a principal + as marcadas para repetir
    let datas = [data];
    if(m.mode!=='edit'){
      const marcados = Array.from(document.querySelectorAll('.dia-multi:checked:not(:disabled)')).map(c=>c.value);
      marcados.forEach(d=>{ if(datas.indexOf(d)===-1) datas.push(d); });
    }
    datas.sort();

    const pessoa = pessoaById(pessoaId);
    const nomePessoa = pessoa ? pessoa.nome : 'Esta pessoa';

    // checa conflitos em todas as datas de uma vez
    const datasComConflito = datas.filter(d=>
      eventosConflitantes(pessoaId, d, periodo, m.mode==='edit' ? m.eventoId : null).length > 0
    );
    if(datasComConflito.length > 0){
      const lista = datasComConflito.map(d=>{
        const [a,mes,dia] = d.split('-');
        const detalhes = eventosConflitantes(pessoaId, d, periodo, m.mode==='edit' ? m.eventoId : null)
          .map(c=>{ const mo = motivoById(c.motivoId); return (mo?mo.nome:'(motivo removido)')+' — '+periodoLabel(c.periodo); })
          .join('; ');
        return `• ${dia}/${mes}: ${detalhes}`;
      }).join('\n');
      const msg = `${nomePessoa} já tem lançamento no mesmo período (${periodoLabel(periodo)}) em:\n\n${lista}\n\nDeseja lançar mesmo assim?`;
      if(!confirm(msg)) return;
    }

    if(m.mode==='edit'){
      const ev = state.data.eventos.find(x=>x.id===m.eventoId);
      if(ev){ ev.pessoaId=pessoaId; ev.data=data; ev.motivoId=motivoId; ev.periodo=periodo; }
      state.modal = null;
      saveData();
      render();
      showToast('Evento atualizado.');
      return;
    }

    const novos = datas.map(d=>({id:uid('e'), pessoaId, data:d, motivoId, periodo}));
    novos.forEach(ev=>state.data.eventos.push(ev));
    const idsNovos = novos.map(ev=>ev.id);

    state.modal = null;
    saveData();
    render();
    showToast(
      novos.length===1 ? 'Evento salvo.' : `${novos.length} eventos salvos.`,
      ()=>{
        state.data.eventos = state.data.eventos.filter(ev=>idsNovos.indexOf(ev.id)===-1);
        saveData(); render();
        showToast('Lançamento desfeito.');
      },
      'Desfazer'
    );
  }

  function exportarRelatorioCSV(){
    const mesRef = state.relatorioMes || iso(new Date()).slice(0,7);
    const eventosMes = state.data.eventos.filter(e=>e.data.slice(0,7)===mesRef);
    if(eventosMes.length===0){ showToast('Não há lançamentos neste mês para exportar.'); return; }

    const motivosUsados = state.data.motivos.filter(mo=> eventosMes.some(e=>e.motivoId===mo.id));
    const pessoasComEventos = state.data.pessoas.filter(p=> eventosMes.some(e=>e.pessoaId===p.id));

    const esc = v => '"' + String(v).replace(/"/g,'""') + '"';
    const linhas = [];
    linhas.push(['Pessoa','Tipo', ...motivosUsados.map(m=>m.nome), 'Total'].map(esc).join(';'));
    pessoasComEventos.forEach(p=>{
      const cols = motivosUsados.map(mo=> eventosMes.filter(e=>e.pessoaId===p.id && e.motivoId===mo.id).length);
      const total = eventosMes.filter(e=>e.pessoaId===p.id).length;
      linhas.push([p.nome, p.tipo==='tecnico'?'Técnico':'Auxiliar', ...cols, total].map(esc).join(';'));
    });
    const totais = motivosUsados.map(mo=> eventosMes.filter(e=>e.motivoId===mo.id).length);
    linhas.push(['Total geral','', ...totais, eventosMes.length].map(esc).join(';'));

    // BOM para o Excel abrir os acentos corretamente
    const blob = new Blob(["\uFEFF" + linhas.join('\r\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${mesRef}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    showToast('Relatório exportado em CSV.');
  }

  function gerarImagem(){
    const header = document.getElementById('captureHeader');
    const target = document.getElementById('capture-area');
    header.style.display = 'block';
    showToast('Gerando imagem…');
    html2canvas(target, {backgroundColor:'#ffffff', scale:2}).then(canvas=>{
      header.style.display = 'none';
      canvas.toBlob(blob=>{
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const semana = weekDates(state.weekOffset);
        const dias = (state.filtros.dias && state.filtros.dias.length) ? state.filtros.dias : [0,1,2,3,4,5];
        const nome = dias.length===1
          ? `agenda-dia-${iso(semana[dias[0]])}.png`
          : (dias.length===6 ? `agenda-semana-${iso(semana[0])}.png` : `agenda-dias-${iso(semana[dias[0]])}.png`);
        a.href = url;
        a.download = nome;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(()=>URL.revokeObjectURL(url), 4000);
        showToast('Imagem baixada — é só anexar no WhatsApp.');
      });
    }).catch(()=>{
      header.style.display = 'none';
      showToast('Não foi possível gerar a imagem.');
    });
  }

  loadData();
})();
