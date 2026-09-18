(function(){
  const cfg={
    apiKey:'AIzaSyD_vcPOimDMu4hLxe6mb0B0hZ85ZJwSYTA',
    authDomain:'g6k-z3.firebaseapp.com',
    databaseURL:'https://g6k-z3-default-rtdb.europe-west1.firebasedatabase.app/',
    projectId:'g6k-z3',
    storageBucket:'g6k-z3.firebasestorage.app',
    messagingSenderId:'1007699316093',
    appId:'1:1007699316093:web:1d00b1f102fd43acb91014'
  };
  if(!firebase.apps.length) firebase.initializeApp(cfg);
  const db=firebase.database();
  const $=id=>document.getElementById(id);
  const page=location.pathname.split('/').pop().toLowerCase();

  function text(id,value,fallback='—'){ const el=$(id); if(el) el.textContent=value||fallback; }
  function hideLookup(){
    const el=$('lookupBox')||document.querySelector('.lookup');
    if(el) el.classList.add('hidden');
  }
  function error(msg){ const el=$('lookupError')||$('tagError'); if(el) el.textContent=msg||''; }

  async function fetchTag(token){
    const snap=await db.ref('publicTags/'+token).once('value');
    return snap.val();
  }
  async function fetchDocs(ids){
    const arr=await Promise.all((ids||[]).map(async id=>{
      const s=await db.ref('publicDocuments/'+id).once('value'); return s.val();
    }));
    return arr.filter(Boolean).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  }

  function mealRow(label,ok){
    return `<div class="meal ${ok?'ok':'no'}"><span>${label}</span><span class="${ok?'status-ok':'status-no'}">${ok?'✓ AUTORIZADA':'NO ASIGNADA'}</span></div>`;
  }
  function accessRow(label,ok,kind='zone'){
    return `<div class="${kind} ${ok?'ok':'no'}"><span>${label}</span><span class="${ok?'status-ok':'status-no'}">${ok?'✓ AUTORIZADO':'NO AUTORIZADO'}</span></div>`;
  }
  function stateRow(label,ok){
    return `<div class="state ${ok?'ok':'no'}"><span>${label}</span><span class="${ok?'status-ok':'status-no'}">${ok?'✓ OK':'PENDIENTE'}</span></div>`;
  }

  async function renderOfficial(token){
    try{
      const x=await fetchTag(token); if(!x||x.role!=='OFICIAL') return error('TAG no válida para OFICIAL.');
      const p=x.data||{}; error('');
      text('oName',x.name); text('oRole','OFICIAL'); text('oLicense',p.license); text('oSpecialty',p.specialty); text('oPost',p.post); text('oLocation',p.location); text('oStart',p.start); text('oEnd',p.end);
      text('oHotel',p.hotel,'No asignado'); text('oRoom',p.room); text('oCheckin',p.checkin); text('oCheckout',p.checkout); if($('oHotelAddress')) $('oHotelAddress').textContent=p.hotelAddress||''; if($('oNotes')) $('oNotes').textContent=p.notes||'Sin instrucciones adicionales.';
      const m=p.meals||{}; if($('mealList')) $('mealList').innerHTML=mealRow('Cena viernes',!!m.friDinner)+mealRow('Desayuno sábado',!!m.satBreakfast)+mealRow('Comida sábado',!!m.satLunch)+mealRow('Cena sábado',!!m.satDinner)+mealRow('Desayuno domingo',!!m.sunBreakfast)+mealRow('Comida domingo',!!m.sunLunch);
      $('officialContent')?.classList.remove('hidden');
    }catch(e){ console.error(e); error('No se pudo consultar Firebase.'); }
  }

  async function renderPress(token){
    try{
      const x=await fetchTag(token); if(!x||x.role!=='PRENSA') return error('TAG no válida para PRENSA.');
      const p=x.data||{}; error('');
      text('pName',x.name); text('pContact',x.contact,'PRENSA'); text('pMedia',p.media); text('pType',p.type); text('pAccreditation',p.accreditation); text('pFunction',p.function); text('pVehicle',p.vehicle,'No indicado'); text('pPlate',p.plate); text('pParking',p.parking,'No asignado');
      text('pHotel',p.hotel,'No asignado'); text('pRoom',p.room); text('pCheckin',p.checkin); text('pCheckout',p.checkout); if($('pHotelAddress')) $('pHotelAddress').textContent=p.hotelAddress||''; if($('pNotes')) $('pNotes').textContent=p.notes||'Sin instrucciones adicionales.';
      const z=p.zones||{}; if($('zoneList')) $('zoneList').innerHTML=accessRow('Sala de prensa',!!z.pressRoom)+accessRow('Parque de asistencia',!!z.servicePark)+accessRow('Zona de salida',!!z.start)+accessRow('Zona de llegada',!!z.finish)+accessRow('Zonas prensa en tramo',!!z.stagePress)+accessRow('Podium / ceremonia',!!z.podium);
      const m=p.meals||{}; if($('mealList')) $('mealList').innerHTML=mealRow('Cena viernes',!!m.friDinner)+mealRow('Desayuno sábado',!!m.satBreakfast)+mealRow('Comida sábado',!!m.satLunch)+mealRow('Cena sábado',!!m.satDinner)+mealRow('Desayuno domingo',!!m.sunBreakfast)+mealRow('Comida domingo',!!m.sunLunch);
      $('pressContent')?.classList.remove('hidden');
    }catch(e){ console.error(e); error('No se pudo consultar Firebase.'); }
  }

  let participantDocs=[]; let participantFilter='ALL';
  function renderParticipantDocs(){
    if(!$('documentsList')) return;
    const labels={ROADBOOK:'Roadbook',TC:'TC / Tramos',TABLON:'Tablón de anuncios'};
    const docs=participantDocs.filter(d=>participantFilter==='ALL'||d.category===participantFilter);
    $('documentsList').innerHTML=docs.length?docs.map(d=>`<a class="doc-card" href="${d.dataUrl}" target="_blank" rel="noopener"><span class="doc-category">${labels[d.category]||d.category}</span><span class="doc-title">${d.title}</span>${d.description?`<span class="doc-desc">${d.description}</span>`:''}<span class="doc-date">${d.createdAt?new Date(d.createdAt).toLocaleString('es-ES'):''} · ${d.fileName||''}</span></a>`).join(''):'<div class="muted">No hay documentos publicados en esta categoría.</div>';
  }
  window.setDocFilter=function(f){ participantFilter=f; renderParticipantDocs(); };

  async function renderParticipant(token){
    try{
      const x=await fetchTag(token); if(!x||x.role!=='PARTICIPANTE') return error('TAG no válida para PARTICIPANTE.');
      const p=x.data||{}; error('');
      text('xDriver',p.driver,x.name); if($('xCodriver')) $('xCodriver').textContent='Copiloto: '+(p.codriver||'—'); text('xNumber',p.number,'—'); text('xTeam',p.team); text('xCar',p.car); text('xPlate',p.plate); text('xCategory',[p.category,p.className].filter(Boolean).join(' · '));
      text('xServicePlot',p.servicePlot,'No asignada'); text('xServiceType',p.serviceType); text('xServiceManager',p.serviceManager); text('xServicePhone',p.servicePhone); if($('xShared')) $('xShared').textContent=p.sharedService?'Sí'+(p.sharedWith?' · '+p.sharedWith:''):'No';
      const d=p.documents||{}; if($('docList')) $('docList').innerHTML=stateRow('Licencias',!!d.licence)+stateRow('Documentación vehículo',!!d.vehicle)+stateRow('Seguro / documentación',!!d.insurance)+stateRow('Verificaciones técnicas',!!d.scrutineering);
      text('xHotel',p.hotel,'No asignado'); text('xRoom',p.room); text('xCheckin',p.checkin); text('xCheckout',p.checkout); if($('xHotelAddress')) $('xHotelAddress').textContent=p.hotelAddress||''; if($('xNotes')) $('xNotes').textContent=p.notes||'Sin instrucciones adicionales.';
      participantDocs=await fetchDocs(x.docIds||[]); participantFilter='ALL'; renderParticipantDocs(); $('participantContent')?.classList.remove('hidden');
    }catch(e){ console.error(e); error('No se pudo consultar Firebase.'); }
  }

  async function renderOrganization(token){
    try{
      const x=await fetchTag(token); if(!x||x.role!=='ORGANIZACIÓN') return error('TAG no válida para ORGANIZACIÓN.');
      const p=x.data||{}; error('');
      text('oName',x.name); text('oLicense',p.license); text('oSpecialty',p.specialty); text('oPost',p.post); text('oLocation',p.location); text('oStart',p.start); text('oEnd',p.end); text('oHotel',p.hotel,'No asignado'); text('oRoom',p.room); text('oCheckin',p.checkin); text('oCheckout',p.checkout); if($('oHotelAddress')) $('oHotelAddress').textContent=p.hotelAddress||''; if($('oNotes')) $('oNotes').textContent=p.notes||'Sin instrucciones adicionales.';
      const docs=await fetchDocs(x.docIds||[]); const labels={ROADBOOK:'Roadbook',TC:'TC / Tramos',TABLON:'Tablón de anuncios'};
      if($('documentsList')) $('documentsList').innerHTML=docs.length?docs.map(d=>`<a class="doc" href="${d.dataUrl}" target="_blank" rel="noopener"><span class="cat">${labels[d.category]||d.category}</span><strong>${d.title}</strong>${d.description?`<span class="desc">${d.description}</span>`:''}</a>`).join(''):'<div class="muted">No tienes documentos asignados.</div>';
      $('organizationContent')?.classList.remove('hidden');
    }catch(e){ console.error(e); error('No se pudo consultar Firebase.'); }
  }

  async function renderVip(token){
    try{
      const x=await fetchTag(token); if(!x||x.role!=='VIP') return error('TAG no válida para VIP.');
      const p=x.data||{}; error('');
      text('vName',x.name,'VIP'); if($('vGroup')) $('vGroup').textContent=[p.group,p.accreditation].filter(Boolean).join(' · '); if($('vInfo')) $('vInfo').textContent=p.info||'Sin información adicional.'; if($('vSchedule')) $('vSchedule').textContent=p.schedule||'No hay horarios publicados.';
      const docs=await fetchDocs(x.docIds||[]); if($('boardList')) $('boardList').innerHTML=docs.length?docs.map(d=>`<a class="doc" href="${d.dataUrl}" target="_blank" rel="noopener"><span class="cat">Tablón de anuncios</span><strong>${d.title}</strong>${d.description?`<span class="desc">${d.description}</span>`:''}</a>`).join(''):'<div class="muted">No hay anuncios publicados.</div>';
      $('vipContent')?.classList.remove('hidden');
    }catch(e){ console.error(e); error('No se pudo consultar Firebase.'); }
  }

  let assistanceToken='';
  function setStage(step){
    ['stageTag','stageDorsal','stageInfo'].forEach(id=>$(id)?.classList.remove('active'));
    if(step===1) $('stageTag')?.classList.add('active'); if(step===2) $('stageDorsal')?.classList.add('active'); if(step===3) $('stageInfo')?.classList.add('active');
  }
  async function validateAssistance(token){
    try{
      const x=await fetchTag(token); if(!x||x.role!=='ASISTENCIA'){ if($('tagError')) $('tagError').textContent='TAG no válida para ASISTENCIA.'; return false; }
      assistanceToken=token; if($('tagError')) $('tagError').textContent=''; if($('assistanceUser')) $('assistanceUser').textContent='TAG de ASISTENCIA autorizada'; $('tagStep')?.classList.add('hidden'); $('dorsalStep')?.classList.remove('hidden'); $('assistanceContent')?.classList.add('hidden'); setStage(2); return true;
    }catch(e){ console.error(e); if($('tagError')) $('tagError').textContent='No se pudo consultar Firebase.'; return false; }
  }
  window.validateTag=function(){ const t=$('tagLookup')?.value.trim(); if(t) validateAssistance(t); };
  window.loadDorsal=async function(){
    const dorsal=$('dorsalLookup')?.value.trim(); if(!dorsal){ if($('dorsalError')) $('dorsalError').textContent='Introduce un dorsal.'; return; }
    if(!assistanceToken){ if($('dorsalError')) $('dorsalError').textContent='Primero valida la TAG.'; return; }
    try{
      const snap=await db.ref('publicAssistance/'+assistanceToken+'/'+dorsal).once('value'); const p=snap.val(); if(!p){ if($('dorsalError')) $('dorsalError').textContent='No se ha encontrado ningún participante con ese dorsal.'; $('assistanceContent')?.classList.add('hidden'); return; }
      if($('dorsalError')) $('dorsalError').textContent=''; text('aDriver',p.driver); text('aCar',p.car); text('aNumber',p.number,dorsal); text('aPlot',p.servicePlot,'No asignada'); text('aType',p.serviceType); text('aManager',p.serviceManager); text('aPhone',p.servicePhone); text('aTeam',p.team); text('aPlate',p.plate); if($('sharedBox')) $('sharedBox').textContent=p.sharedService?'Sí'+(p.sharedWith?' · Comparte con '+p.sharedWith:''):'No comparte asistencia.'; if($('aNotes')) $('aNotes').textContent=p.notes||'Sin instrucciones adicionales.'; $('assistanceContent')?.classList.remove('hidden'); setStage(3);
    }catch(e){ console.error(e); if($('dorsalError')) $('dorsalError').textContent='No se pudo consultar Firebase.'; }
  };
  window.newDorsal=function(){ if($('dorsalLookup')) $('dorsalLookup').value=''; if($('dorsalError')) $('dorsalError').textContent=''; $('assistanceContent')?.classList.add('hidden'); setStage(2); $('dorsalLookup')?.focus(); };

  async function renderByPage(token){
    if(page==='oficial.html') return renderOfficial(token);
    if(page==='prensa.html') return renderPress(token);
    if(page==='participante.html') return renderParticipant(token);
    if(page==='organizacion.html') return renderOrganization(token);
    if(page==='vip.html') return renderVip(token);
    if(page==='asistencia.html') return validateAssistance(token);
  }

  window.loadByTag=function(){ const t=$('tagLookup')?.value.trim(); if(t) renderByPage(t); };

  const initial=new URLSearchParams(location.search).get('token');
  if(initial){
    if(page!=='asistencia.html') hideLookup(); else $('tagStep')?.classList.add('hidden');
    renderByPage(initial);
  }else{
    const box=$('lookupBox')||document.querySelector('.lookup')||$('tagStep');
    const hint=box?.querySelector('.muted'); if(hint) hint.textContent='Modo de prueba: introduce el token NFC seguro. El acceso normal se realizará leyendo la TAG.';
    if($('tagLookup')) $('tagLookup').placeholder='Token NFC';
  }
})();
