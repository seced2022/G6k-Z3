(function(){
  function token(){
    const bytes=new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  }

  function tagUrl(t){
    if(!t) return '';
    const u=new URL('tag.html',location.href);
    u.searchParams.set('token',t);
    return u.href;
  }

  async function copy(value){
    try{ await navigator.clipboard.writeText(value); }
    catch(e){
      const ta=document.createElement('textarea');
      ta.value=value; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    alert('URL copiada.');
  }

  window.regenerateTagToken=function(){
    if($('tagOriginalId').value && !confirm('Al regenerar el token, la URL NFC anterior dejará de funcionar cuando guardes los cambios. ¿Continuar?')) return;
    $('tagToken').value=token();
    $('tagUrl').value=tagUrl($('tagToken').value);
  };

  window.copyTagUrlFromModal=function(){
    const v=$('tagUrl').value;
    if(v) copy(v); else alert('Todavía no hay URL.');
  };

  window.copyTagUrl=function(id){
    const t=getTags().find(x=>x.id===id);
    if(!t) return;
    if(!t.token){ alert('Esta TAG todavía no tiene token. Pulsa Editar y guarda.'); return; }
    copy(tagUrl(t.token));
  };

  function ensureTagTokens(){
    const tags=getTags();
    let changed=false;
    tags.forEach(t=>{ if(!t.token){ t.token=token(); changed=true; } });
    if(changed){
      localStorage.setItem(STORAGE.tags,JSON.stringify(tags));
      if(firebaseUser){ fbDb.ref(`${FIREBASE_EVENT_PATH}/tags`).set(tags).catch(console.error); }
    }
    return changed;
  }
  window.ensureTagTokens=ensureTagTokens;

  let syncTimer=null;
  window.queuePublicSync=function(){
    if(!firebaseReady || !firebaseUser || firebaseHydrating) return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>window.syncPublicFirebase(),250);
  };

  function publicPayload(role,person,profile){
    const full=((person.name||'')+' '+(person.surname||'')).trim();
    if(role==='OFICIAL') return {name:full,role,data:{
      license:profile.license||'',specialty:profile.specialty||'',post:profile.post||'',location:profile.location||'',
      start:profile.start||'',end:profile.end||'',hotel:profile.hotel||'',room:profile.room||'',checkin:profile.checkin||'',checkout:profile.checkout||'',
      hotelAddress:profile.hotelAddress||'',meals:profile.meals||{},notes:profile.notes||''}};

    if(role==='PRENSA'){
      const p=profile.press||{};
      return {name:full,role,contact:[person.email,person.phone].filter(Boolean).join(' · '),data:{
        media:p.media||'',type:p.type||'',accreditation:p.accreditation||'',function:p.function||'',vehicle:p.vehicle||'',plate:p.plate||'',parking:p.parking||'',
        zones:p.zones||{},hotel:p.hotel||'',room:p.room||'',checkin:p.checkin||'',checkout:p.checkout||'',hotelAddress:p.hotelAddress||'',meals:p.meals||{},notes:p.notes||''}};
    }

    if(role==='PARTICIPANTE'){
      const p=profile.participant||{};
      return {name:full,role,data:{
        number:p.number||'',team:p.team||'',driver:p.driver||full,codriver:p.codriver||'',car:p.car||'',plate:p.plate||'',category:p.category||'',className:p.className||'',
        servicePlot:p.servicePlot||'',serviceType:p.serviceType||'',serviceManager:p.serviceManager||'',servicePhone:p.servicePhone||'',sharedService:!!p.sharedService,sharedWith:p.sharedWith||'',
        documents:p.documents||{},hotel:p.hotel||'',room:p.room||'',checkin:p.checkin||'',checkout:p.checkout||'',hotelAddress:p.hotelAddress||'',notes:p.notes||''}};
    }

    if(role==='ORGANIZACIÓN'){
      const p=profile.organization||{};
      return {name:full,role,data:{
        license:p.license||'',specialty:p.specialty||'',post:p.post||'',location:p.location||'',start:p.start||'',end:p.end||'',hotel:p.hotel||'',room:p.room||'',
        checkin:p.checkin||'',checkout:p.checkout||'',hotelAddress:p.hotelAddress||'',notes:p.notes||''},docIds:p.allowedDocIds||[]};
    }

    if(role==='VIP'){
      const p=profile.vip||{};
      return {name:full,role,data:{accreditation:p.accreditation||'',group:p.group||'',info:p.info||'',schedule:p.schedule||''}};
    }

    if(role==='ASISTENCIA') return {role,data:{}};
    return {name:full,role,data:{}};
  }

  window.syncPublicFirebase=async function(){
    if(!firebaseUser || firebaseUser.uid!==ALLOWED_ADMIN_UID) return;
    ensureTagTokens();

    const people=getPeople(), tags=getTags(), profiles=getProfiles(), docs=getDocuments();
    const peopleMap=Object.fromEntries(people.map(p=>[p.id,p]));
    const publicTags={}, publicDocuments={}, assistanceTokens=[];

    docs.forEach(d=>{ publicDocuments[d.id]={
      id:d.id,title:d.title||'',category:d.category||'',description:d.description||'',fileName:d.fileName||'',mime:d.mime||'',dataUrl:d.dataUrl||'',createdAt:d.createdAt||''
    }; });

    tags.forEach(t=>{
      if(t.status!=='active' || !t.personId || !t.token) return;
      const person=peopleMap[t.personId]; if(!person) return;
      const role=(t.role||person.role||'').toUpperCase();
      const profile=profiles[person.id]||{};
      const payload=publicPayload(role,person,profile);
      if(role==='PARTICIPANTE') payload.docIds=docs.map(d=>d.id);
      if(role==='VIP') payload.docIds=docs.filter(d=>d.category==='TABLON').map(d=>d.id);
      payload.tagId=t.id;
      payload.updatedAt=new Date().toISOString();
      publicTags[t.token]=payload;
      if(role==='ASISTENCIA') assistanceTokens.push(t.token);
    });

    const publicAssistance={};
    assistanceTokens.forEach(tk=>{
      publicAssistance[tk]={};
      people.forEach(person=>{
        const p=(profiles[person.id]||{}).participant||{};
        const dorsal=String(p.number||'').trim(); if(!dorsal) return;
        publicAssistance[tk][dorsal]={
          number:dorsal,driver:p.driver||(((person.name||'')+' '+(person.surname||'')).trim()),car:p.car||'',servicePlot:p.servicePlot||'',serviceType:p.serviceType||'',
          serviceManager:p.serviceManager||'',servicePhone:p.servicePhone||'',sharedService:!!p.sharedService,sharedWith:p.sharedWith||'',team:p.team||'',plate:p.plate||'',notes:p.notes||''
        };
      });
    });

    try{
      await Promise.all([
        fbDb.ref('publicTags').set(publicTags),
        fbDb.ref('publicDocuments').set(publicDocuments),
        fbDb.ref('publicAssistance').set(publicAssistance)
      ]);
      const el=$('publicSyncInfo'); if(el) el.textContent='Sincronizado · '+new Date().toLocaleTimeString('es-ES');
    }catch(err){
      console.error(err);
      const el=$('publicSyncInfo'); if(el) el.textContent='Error al sincronizar la información pública.';
    }
  };

  // CRUD TAG con token seguro
  window.openTagModal=function(){
    fillPersonSelect();
    $('tagOriginalId').value=''; $('tagModalTitle').textContent='Nueva TAG'; $('tagSaveButton').textContent='Guardar TAG';
    $('tagId').value=''; $('tagRole').value=''; $('tagPerson').value=''; $('tagStatus').value='active';
    $('tagToken').value=token(); $('tagUrl').value=tagUrl($('tagToken').value);
    $('tagModal').classList.add('show');
  };

  window.editTag=function(id){
    const t=getTags().find(x=>x.id===id); if(!t) return;
    fillPersonSelect();
    $('tagOriginalId').value=t.id; $('tagModalTitle').textContent='Editar TAG'; $('tagSaveButton').textContent='Guardar cambios';
    $('tagId').value=t.id; $('tagRole').value=t.role||''; $('tagPerson').value=t.personId||''; $('tagStatus').value=t.status||'active';
    $('tagToken').value=t.token||token(); $('tagUrl').value=tagUrl($('tagToken').value);
    $('tagModal').classList.add('show');
  };

  window.saveTag=function(){
    const originalId=$('tagOriginalId').value.trim().toUpperCase();
    const id=$('tagId').value.trim().toUpperCase();
    if(!id){ alert('Introduce un ID de TAG.'); return; }
    const tags=getTags();
    if(tags.some(t=>t.id===id && t.id!==originalId)){ alert('Ese ID de TAG ya existe.'); return; }
    const personId=$('tagPerson').value;
    let role=$('tagRole').value;
    if(personId&&!role){ const p=getPeople().find(x=>x.id===personId); if(p) role=p.role; }
    const item={id,personId,role,status:$('tagStatus').value,token:($('tagToken').value||'').trim()||token()};
    if(originalId){ const i=tags.findIndex(t=>t.id===originalId); if(i<0) return; tags[i]=item; } else tags.push(item);
    saveTags(tags); closeTagModal(); renderAll();
  };

  // Render TAGS con copiar URL
  window.renderTags=function(){
    const people=getPeople();
    const peopleMap=Object.fromEntries(people.map(p=>[p.id,p]));
    const q=($('tagSearch')?.value||'').trim().toLowerCase();
    const f=$('tagFilter')?.value||'all';
    const rows=getTags().filter(t=>{
      const p=peopleMap[t.personId];
      const txt=(t.id+' '+(p?fullName(p):'')+' '+(t.role||'')).toLowerCase();
      const okQ=!q||txt.includes(q);
      let okF=true;
      if(f==='active') okF=t.status==='active';
      if(f==='unassigned') okF=!t.personId||t.status==='unassigned';
      if(f==='blocked') okF=t.status==='blocked';
      return okQ&&okF;
    }).map(t=>{
      const p=peopleMap[t.personId];
      return `<tr>
        <td><strong>${t.id}</strong></td>
        <td>${p?fullName(p):'<span class="muted">Sin asignar</span>'}</td>
        <td>${rolePill(t.role)}</td>
        <td>${statusPill(t.status)}</td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn small" onclick="editTag('${t.id}')">Editar</button>
          <button class="btn small" onclick="copyTagUrl('${t.id}')">Copiar URL</button>
          <button class="btn small" onclick="toggleTag('${t.id}')">${t.status==='blocked'?'Activar':'Bloquear'}</button>
          <button class="btn small danger" onclick="deleteTag('${t.id}')">Eliminar</button>
        </div></td>
      </tr>`;
    }).join('');
    $('tagsBody').innerHTML=rows||'<tr><td colspan="5" class="muted">No hay resultados.</td></tr>';
  };

  // Envolver guardados para actualizar proyección pública
  const sPeople=savePeople, sTags=saveTags, sProfiles=saveProfiles, sDocs=saveDocuments;
  window.savePeople=function(v){ sPeople(v); queuePublicSync(); };
  window.saveTags=function(v){ sTags(v); queuePublicSync(); };
  window.saveProfiles=function(v){ sProfiles(v); queuePublicSync(); };
  window.saveDocuments=function(v){ sDocs(v); queuePublicSync(); };

  const oldLoad=loadFirebaseData;
  window.loadFirebaseData=async function(){
    await oldLoad();
    ensureTagTokens();
    renderAll();
    if(firebaseUser && firebaseUser.uid===ALLOWED_ADMIN_UID) await syncPublicFirebase();
  };

  const oldUpload=uploadLocalDataToFirebase;
  window.uploadLocalDataToFirebase=async function(){
    await oldUpload();
    if(firebaseUser && firebaseUser.uid===ALLOWED_ADMIN_UID) await syncPublicFirebase();
  };

  // Si Firebase ya había restaurado la sesión antes de cargar este archivo,
  // sincronizamos igualmente.
  setTimeout(async()=>{
    try{
      if(firebaseUser && firebaseUser.uid===ALLOWED_ADMIN_UID){
        ensureTagTokens();
        renderAll();
        await syncPublicFirebase();
      }
    }catch(e){ console.error(e); }
  },500);
})();
