(function(){
  const WEEKDAYS = ["Seg","Ter","Qua","Qui","Sex","Sáb"];
  const MOTIVO_PALETTE = ["#2C5F8A","#C98A2E","#6B5CA5","#C1443D","#2F7A62","#8A5A44","#4A6FA5","#A5477A"];
  const STORAGE_KEY = "painelEquipeDados";

  let state = {
    activeTab: 'agenda',
    weekOffset: 0,
    data: null,
    modal: null, // {mode:'new'|'edit', pessoaId, data, eventoId, showNewMotivo}
    loading: true,
    filtros: { tipo:'todos', motivo:'todos', busca:'', somenteSemana:false }
  };

  function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

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

    state.data = loaded || defaultData();
    if(!state.data.nomeEmpresa) state.data.nomeEmpresa = "Equipe de Campo";
    if(!Array.isArray(state.data.pessoas)) state.data.pessoas = [];
    if(!Array.isArray(state.data.motivos)) state.data.motivos = defaultData().motivos;
    if(!Array.isArray(state.data.eventos)) state.data.eventos = [];
    state.loading = false;
    saveData(true);
    render();
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

  function showToast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(()=>t.classList.remove('show'), 2200);
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
  function iso(d){ return d.toISOString().slice(0,10); }
  function br(d){ return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }
  function brLong(d){ return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}); }

  function periodoLabel(p){
    if(p==='manha') return 'Manhã';
    if(p==='tarde') return 'Tarde';
    return 'Dia todo';
  }

  function motivoById(id){ return state.data.motivos.find(m=>m.id===id); }
  function pessoaById(id){ return state.data.pessoas.find(p=>p.id===id); }

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
      </div>

      ${state.activeTab==='agenda' ? renderAgenda(dates) : ''}
      ${state.activeTab==='equipe' ? renderEquipe() : ''}
      ${state.activeTab==='motivos' ? renderMotivos() : ''}

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

  function renderAgenda(dates){
    const pessoasTodas = state.data.pessoas;
    if(pessoasTodas.length===0){
      return `<div class="panel"><div class="empty-list">Nenhum técnico ou auxiliar cadastrado ainda. Vá até a aba <b>Técnicos &amp; auxiliares</b> para cadastrar sua equipe.</div></div>`;
    }

    const f = state.filtros;
    const diso0 = iso(dates[0]), disoN = iso(dates[5]);

    function eventosDaPessoaNaSemana(p){
      return state.data.eventos.filter(e=>{
        if(e.pessoaId!==p.id) return false;
        if(e.data<diso0 || e.data>disoN) return false;
        if(f.motivo!=='todos' && e.motivoId!==f.motivo) return false;
        return true;
      });
    }

    let pessoasFiltradas = pessoasTodas.filter(p=>{
      if(f.tipo!=='todos' && p.tipo!==f.tipo) return false;
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
          return `<div class="cell day-cell" data-action="add-evento-cell" data-pessoa="${p.id}" data-data="${diso}">${chips}</div>`;
        }).join('');
        return `<div class="cell person-cell"><span class="person-name">${escapeHtml(p.nome)}</span><span class="person-tag">${p.tipo==='tecnico'?'Técnico':'Auxiliar'}</span></div>${cells}`;
      }).join('');
    }

    const headCells = dates.map(d=>`<div class="cell head-cell"><b>${WEEKDAYS[dates.indexOf(d)]}</b>${br(d)}</div>`).join('');

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
          <label>Buscar por nome</label>
          <input type="text" id="filtroBusca" placeholder="Nome do técnico ou auxiliar" value="${escapeAttr(f.busca)}">
        </div>
        <div class="filter-field checkbox-field">
          <input type="checkbox" id="filtroSomenteSemana" ${f.somenteSemana?'checked':''}>
          <label for="filtroSomenteSemana">Mostrar só quem tem lançamento nesta semana</label>
        </div>
      </div>
    `;

    const semResultado = (tecnicos.length + auxiliares.length) === 0;

    return `
      <div class="panel">
        <div class="agenda-toolbar">
          <div style="font-size:13px;color:var(--ink-soft);">Clique em uma célula do dia para lançar um evento.</div>
          <button class="btn btn-accent" data-action="gerar-imagem">Gerar imagem para WhatsApp</button>
        </div>
        ${filtersHtml}
        <div id="capture-area">
          <div class="capture-header" id="captureHeader">
            <h2>${escapeHtml(state.data.nomeEmpresa)}</h2>
            <span>Semana de ${brLong(dates[0])} a ${brLong(dates[5])}</span>
          </div>
          ${semResultado ? '<div class="empty-list">Nenhum resultado para os filtros aplicados nesta semana.</div>' : `
          <div class="grid-wrap">
            <div class="agrid">
              <div class="cell head-cell"></div>
              ${headCells}
              ${tecnicos.length ? `<div class="group-row">Técnicos</div>` + rowsFor(tecnicos) : ''}
              ${auxiliares.length ? `<div class="group-row">Auxiliares</div>` + rowsFor(auxiliares) : ''}
            </div>
          </div>`}
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
        <div class="list-item">
          <span class="name">${escapeHtml(p.nome)}</span>
          <button class="btn-danger-text" data-action="remover-pessoa" data-id="${p.id}">Remover</button>
        </div>`).join('');
    }
    return `
      <div class="col-2">
        <div class="panel sub-panel">
          <h3>Técnicos</h3>
          <p class="hint">Quem faz o trabalho técnico em campo ou oficina.</p>
          <div class="add-row">
            <input type="text" id="novoTecnico" placeholder="Nome do técnico">
            <button class="btn btn-accent" data-action="add-pessoa" data-tipo="tecnico">Adicionar</button>
          </div>
          ${list(tecnicos)}
        </div>
        <div class="panel sub-panel">
          <h3>Auxiliares</h3>
          <p class="hint">Quem apoia a equipe técnica.</p>
          <div class="add-row">
            <input type="text" id="novoAuxiliar" placeholder="Nome do auxiliar">
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
        state.data.nomeEmpresa = e.target.value || 'Equipe de Campo';
        saveData();
      });
    }

    app.addEventListener('click', onAppClick);
    app.addEventListener('input', onAppInput);
  }

  function onAppInput(e){
    const t = e.target;
    if(t.dataset.action==='cor-motivo'){
      const mo = state.data.motivos.find(m=>m.id===t.dataset.id);
      if(mo){ mo.cor = t.value; saveData(); render(); }
      return;
    }
    if(t.id==='filtroBusca'){
      state.filtros.busca = t.value;
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

    if(action==='exportar-dados'){ exportarDados(); return; }
    if(action==='importar-dados-click'){ document.getElementById('importarInput').click(); return; }

    if(action==='add-pessoa'){
      const tipo = el.dataset.tipo;
      const inputId = tipo==='tecnico' ? 'novoTecnico' : 'novoAuxiliar';
      const input = document.getElementById(inputId);
      const nome = input.value.trim();
      if(!nome){ showToast('Digite um nome antes de adicionar.'); return; }
      state.data.pessoas.push({id:uid('p'), nome, tipo});
      input.value='';
      saveData(); render();
      return;
    }
    if(action==='remover-pessoa'){
      const id = el.dataset.id;
      if(!confirm('Remover esta pessoa? Os eventos associados a ela continuarão salvos, mas não aparecerão mais na agenda.')) return;
      state.data.pessoas = state.data.pessoas.filter(p=>p.id!==id);
      saveData(); render();
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
      if(!confirm('Remover este motivo?')) return;
      state.data.motivos = state.data.motivos.filter(m=>m.id!==id);
      saveData(); render();
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
      state.data.eventos = state.data.eventos.filter(x=>x.id!==state.modal.eventoId);
      state.modal = null;
      saveData(); render();
      return;
    }
    if(action==='salvar-evento'){
      salvarEvento();
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
      if(e.target.value==='__novo__'){
        state.modal.showNewMotivo = true;
      } else {
        state.modal.motivoId = e.target.value;
        state.modal.showNewMotivo = false;
      }
      render();
      return;
    }
    if(e.target.id==='filtroTipo'){ state.filtros.tipo = e.target.value; render(); return; }
    if(e.target.id==='filtroMotivo'){ state.filtros.motivo = e.target.value; render(); return; }
    if(e.target.id==='filtroSomenteSemana'){ state.filtros.somenteSemana = e.target.checked; render(); return; }
    if(e.target.id==='irParaData'){ irParaData(e.target.value); return; }
    if(e.target.id==='importarInput'){
      if(e.target.files && e.target.files[0]){ importarDados(e.target.files[0]); }
      e.target.value = '';
      return;
    }
  });

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

    if(m.mode==='edit'){
      const ev = state.data.eventos.find(x=>x.id===m.eventoId);
      if(ev){ ev.pessoaId=pessoaId; ev.data=data; ev.motivoId=motivoId; ev.periodo=periodo; }
    } else {
      state.data.eventos.push({id:uid('e'), pessoaId, data, motivoId, periodo});
    }
    state.modal = null;
    saveData();
    render();
    showToast('Evento salvo.');
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
        const dates = weekDates(state.weekOffset);
        a.href = url;
        a.download = `agenda-semana-${iso(dates[0])}.png`;
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
