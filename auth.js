/* =====================================================================
   EscribAI · auth.js — Cuentas, planes y sincronización (Supabase)
===================================================================== */
"use strict";
const SB_URL="https://tbaliejmtaeniffmqgif.supabase.co";
const SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiYWxpZWptdGFlbmlmZm1xZ2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyNzI5MDQsImV4cCI6MjA5ODg0ODkwNH0.6deb7nWjNS7Y1EyKPI-ADEnwut0b6ZzIQLg6KPFrBZ8";
/* Enlaces de pago (Stripe Payment Links). Vacío = contacto por email */
const PAY_LINKS={
  pro_mes:"https://buy.stripe.com/3cI8wQ6pG2uTcMobMH9k402",
  pro_anyo:"https://buy.stripe.com/28E9AUaFW1qPbIk1839k401",
  empresas:"https://buy.stripe.com/28E8wQ7tK7PdfYA03Z9k400"
};
const GOOGLE_ACTIVO=false; // ponlo en true cuando el proveedor Google esté configurado en Supabase
/* Portal de clientes de Stripe (gestionar/cancelar suscripción). Actívalo en Stripe → Settings → Billing → Customer portal */
const PORTAL_LINK="https://billing.stripe.com/p/login/28E8wQ7tK7PdfYA03Z9k400";
const PLANES=[
  {id:"demo",nombre:"Demo",precio:"0€",per:"para siempre",puntos:["Transcripción en tiempo real ilimitada","2 perfiles de voz","1 organización","Resumen automático","Exportación TXT"]},
  {id:"pro_mes",nombre:"Pro Mensual",precio:"9,99€",per:"/mes",puntos:["Todo lo de la Demo","Hablantes y organizaciones ilimitados","8 plantillas de acta y envío por email","Historial en la nube","Transcripción de archivos y modo IA"]},
  {id:"pro_anyo",nombre:"Pro Anual",precio:"79€",per:"/año (2 meses gratis)",puntos:["Todo lo del Pro Mensual","Precio bloqueado para siempre","Soporte prioritario"]},
  {id:"empresas",nombre:"Empresas",precio:"29€",per:"/mes por equipo",puntos:["Todo lo del Pro","Diarización profesional IA incluida (sin API key propia)","Marca propia y dominio de empresa","Formación y soporte dedicado"]}
];

let sb=null,sesionUser=null,perfil=null,licPayload=null;

/* ---------- UI: botón de usuario en cabecera ---------- */
document.querySelector("header").insertBefore((()=>{
  const b=document.createElement("button");b.className="btn sm";b.id="btnUser";b.textContent="👤 Entrar";b.style.marginLeft="auto";
  document.querySelector("header .status").style.marginLeft="0";
  return b;
})(),document.querySelector("header .status"));

/* ---------- UI: pestaña Planes ---------- */
(()=>{
  const nav=document.querySelector("nav");
  const nb=document.createElement("button");nb.dataset.tab="planes";nb.textContent="⭐ Planes";
  nb.onclick=()=>{document.querySelectorAll("nav button").forEach(x=>x.classList.remove("act"));nb.classList.add("act");
    document.querySelectorAll(".tabpane").forEach(p=>p.classList.add("hide"));
    document.getElementById("tab-planes").classList.remove("hide");renderPlanes();};
  nav.appendChild(nb);
  const pane=document.createElement("div");pane.className="tabpane hide";pane.id="tab-planes";
  pane.innerHTML='<div id="planActual" class="card" style="padding:16px 20px;margin-bottom:14px"></div><div class="statsrow" id="planGrid" style="align-items:stretch"></div>';
  document.querySelector("main").appendChild(pane);
})();
function renderPlanes(){
  const actual=planNube()?perfil.plan:(licPayload?"licencia":"demo");
  document.getElementById("planActual").innerHTML="Tu plan actual: <b style='color:var(--acc2)'>"+
    (actual==="licencia"?"PRO (licencia de por vida)":PLANES.find(p=>p.id===actual||p.id===actual+"_mes")?.nombre||actual)+"</b>"+
    (perfil&&perfil.plan_hasta?" · válido hasta "+new Date(perfil.plan_hasta).toLocaleDateString("es-ES"):"")+
    (planNube()?' <button class="btn sm" style="margin-left:12px" onclick="gestionarSuscripcion()">⚙️ Gestionar / cancelar suscripción</button>':"");
  document.getElementById("planGrid").innerHTML=PLANES.map(p=>`
    <div class="stat" style="min-width:220px;display:flex;flex-direction:column">
      <span style="font-size:13px;font-weight:700;color:var(--txt)">${p.nombre}</span>
      <b style="font-size:26px">${p.precio}<small style="font-size:12px;color:var(--mut)"> ${p.per}</small></b>
      <ul style="list-style:none;margin:10px 0;flex:1;display:flex;flex-direction:column;gap:6px">
        ${p.puntos.map(x=>'<li style="font-size:12.5px;color:#c6cde0">✓ '+x+"</li>").join("")}
      </ul>
      ${p.id==="demo"?"":'<button class="btn sm pri" onclick="suscribir(\''+p.id+'\')">Suscribirme</button>'}
    </div>`).join("");
}
window.gestionarSuscripcion=()=>{
  const email=sesionUser?sesionUser.email:"";
  if(PORTAL_LINK){location.href=PORTAL_LINK+(PORTAL_LINK.includes("?")?"&":"?")+"prefilled_email="+encodeURIComponent(email);return}
  location.href="mailto:contacto@talentdigitalconsulting.com?subject="+encodeURIComponent("Gestionar mi suscripción — EscribAI")+"&body="+encodeURIComponent("Hola, quiero gestionar o cancelar mi suscripción.\nMi cuenta: "+email);
};
window.suscribir=id=>{
  const link=PAY_LINKS[id];
  const email=sesionUser?sesionUser.email:"";
  if(link){location.href=link+(link.includes("?")?"&":"?")+"prefilled_email="+encodeURIComponent(email);return}
  location.href="mailto:ecommercepgventas@gmail.com?subject="+encodeURIComponent("Suscripción "+id+" — EscribAI")+"&body="+encodeURIComponent("Hola, quiero suscribirme al plan "+id+".\nMi cuenta: "+email);
};

/* ---------- UI: modal de acceso ---------- */
document.body.insertAdjacentHTML("beforeend",`
<div class="overlay hide" id="authOverlay" style="z-index:120">
  <div class="modal" style="max-width:430px">
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">
      <div class="logo" style="width:34px;height:34px"><svg viewBox="0 0 24 24" style="width:19px;height:19px;fill:#fff"><path d="M12 15a4 4 0 0 0 4-4V6a4 4 0 1 0-8 0v5a4 4 0 0 0 4 4zm6-4a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.94V22h2v-3.06A8 8 0 0 0 20 11h-2z"/></svg></div>
      <h2 style="margin:0">Escrib<span style="background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent">AI</span></h2>
    </div>
    <p class="sub" id="authSub">Crea tu cuenta gratis o entra para acceder a tus actas.</p>
    <button class="btn" id="btnGoogle" style="width:100%;justify-content:center"><svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41.4 34.9 44 29.9 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>&nbsp;Continuar con Google</button>
    <div style="display:flex;align-items:center;gap:10px;margin:14px 0;color:var(--mut);font-size:12px"><hr style="flex:1;border-color:var(--line)">o con tu correo<hr style="flex:1;border-color:var(--line)"></div>
    <div id="authRegistro" class="hide">
      <div class="inline">
        <input id="regNombre" placeholder="Nombre">
        <input id="regApellidos" placeholder="Apellidos">
      </div>
      <input id="regTelefono" placeholder="Teléfono" style="margin-top:10px">
    </div>
    <input id="authEmail" type="email" placeholder="Correo electrónico" style="margin-top:10px">
    <input id="authPass" type="password" placeholder="Contraseña (mín. 6 caracteres)" style="margin-top:10px">
    <label style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--mut);margin-top:10px;cursor:pointer">
      <input type="checkbox" id="authRecordar" style="width:auto"> Recordar mi correo en este dispositivo
    </label>
    <button class="btn pri" id="authAccion" style="width:100%;justify-content:center;margin-top:14px">Entrar</button>
    <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12.5px">
      <a href="#" id="authOlvido" style="color:var(--acc2)">¿Has olvidado tu contraseña?</a>
      <a href="#" id="authCambio" style="color:var(--acc2)">Crear cuenta nueva</a>
    </div>
  </div>
</div>`);

let modoRegistro=false;
function pintarModo(){
  document.getElementById("authRegistro").classList.toggle("hide",!modoRegistro);
  document.getElementById("authAccion").textContent=modoRegistro?"Crear cuenta gratis":"Entrar";
  document.getElementById("authCambio").textContent=modoRegistro?"Ya tengo cuenta":"Crear cuenta nueva";
  document.getElementById("authSub").textContent=modoRegistro?"Regístrate gratis: accede a la demo y suscríbete cuando quieras.":"Entra para acceder a tus actas y organizaciones.";
}
document.getElementById("authCambio").onclick=e=>{e.preventDefault();modoRegistro=!modoRegistro;pintarModo()};
document.getElementById("authOlvido").onclick=async e=>{
  e.preventDefault();
  const email=document.getElementById("authEmail").value.trim();
  if(!email){toast("Escribe tu correo arriba y vuelve a pulsar");return}
  const el=e.target;if(el._busy)return;el._busy=true;el.style.opacity=".5";
  const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  el._busy=false;el.style.opacity="1";
  if(error){
    console.error("reset:",error);
    let msg=error.message&&error.message!=="{}"?error.message:"";
    if(error.status===429)msg="Límite de correos alcanzado: sube «Emails per hour» en Supabase → Rate Limits";
    else if(error.status>=500||!msg)msg="El servidor de correo rechazó el envío. Revisa en Brevo que el remitente esté verificado (Senders → ✓) y que en Supabase → SMTP el Sender email coincida exactamente.";
    toast("❌ "+msg);
  }else toast("📬 Correo enviado a "+email+" — puede tardar 1-2 min; revisa también el spam");
};
document.getElementById("btnGoogle").onclick=async()=>{
  if(!GOOGLE_ACTIVO){toast("🔧 El acceso con Google estará disponible muy pronto. De momento usa tu correo y contraseña.");return}
  const{error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
  if(error)toast("❌ Google: "+error.message);
};
document.getElementById("authAccion").onclick=async()=>{
  const email=document.getElementById("authEmail").value.trim();
  const pass=document.getElementById("authPass").value;
  if(!email||pass.length<6){toast("Revisa el correo y la contraseña (mín. 6)");return}
  if(document.getElementById("authRecordar").checked)LS.set("vs_login_email",email);
  const btn=document.getElementById("authAccion");btn.disabled=true;
  try{
    if(modoRegistro){
      const nombre=document.getElementById("regNombre").value.trim();
      const apellidos=document.getElementById("regApellidos").value.trim();
      const telefono=document.getElementById("regTelefono").value.trim();
      if(!nombre){toast("Escribe tu nombre");btn.disabled=false;return}
      const{data,error}=await sb.auth.signUp({email,password:pass,options:{data:{nombre,apellidos,telefono}}});
      if(error)throw error;
      if(data.session)toast("🎉 Cuenta creada, ¡bienvenido!");
      else toast("📬 Cuenta creada. Revisa tu correo y confirma para entrar.");
    }else{
      const{error}=await sb.auth.signInWithPassword({email,password:pass});
      if(error)throw error;
      toast("👋 ¡Hola de nuevo!");
    }
  }catch(err){
    console.error("auth:",err);
    let m=err&&err.message&&err.message!=="{}"?err.message:"";
    if(m==="Invalid login credentials")m="Correo o contraseña incorrectos";
    else if(m==="User already registered")m="Ese correo ya tiene cuenta: usa «Entrar» o recupera la contraseña";
    else if(!m||err.status>=500)m="No se pudo enviar el correo de verificación (fallo del SMTP). Arreglo: en Supabase → SMTP pon un remitente verificado en Brevo, o desactiva «Confirm email» en Authentication → Providers.";
    toast("❌ "+m);
  }
  btn.disabled=false;
};
document.getElementById("btnUser").onclick=async()=>{
  if(sesionUser){
    if(!confirm("¿Cerrar sesión de "+sesionUser.email+"?"))return;
    try{await sb.auth.signOut({scope:"local"})}catch(e){console.warn("signout",e)}
    sesionUser=null;perfil=null;
    await cargarPerfil();
    mostrarAuth(true);
    toast("👋 Sesión cerrada");
  }else mostrarAuth(true);
};
function mostrarAuth(v){document.getElementById("authOverlay").classList.toggle("hide",!v)}

/* ---------- lógica de sesión, perfil y plan ---------- */
function planNube(){
  return !!(perfil&&["pro","pro_mes","pro_anyo","empresas"].includes(perfil.plan)&&(!perfil.plan_hasta||new Date(perfil.plan_hasta)>new Date()));
}
function recalcPro(){
  pro=licPayload||(planNube()?{email:perfil.email||sesionUser.email,plan:perfil.plan}:null);
  updateProUI();
}
async function cargarPerfil(){
  perfil=null;
  if(sesionUser){
    const{data}=await sb.from("perfiles").select("*").eq("id",sesionUser.id).maybeSingle();
    perfil=data||null;
    if(!perfil){ // auto-reparación: crea el perfil si el registro fue anterior a las tablas
      const m=sesionUser.user_metadata||{};
      try{await sb.from("perfiles").insert({id:sesionUser.id,email:sesionUser.email,nombre:m.nombre||m.full_name||"",apellidos:m.apellidos||"",telefono:m.telefono||""})}catch(e){}
      const r2=await sb.from("perfiles").select("*").eq("id",sesionUser.id).maybeSingle();
      perfil=r2.data||null;
    }
    const{data:du}=await sb.from("datos_usuario").select("*").eq("user_id",sesionUser.id).maybeSingle();
    let curar=false;
    if(du){
      if(du.orgs&&du.orgs.length&&!orgs.length){orgs=du.orgs;LS.set("vs_orgs",orgs);renderOrgs()}
      if(du.ajustes){
        // la nube solo pisa lo local cuando aporta un valor; lo vacío nunca borra nada
        ["license","key","prov","lang","sens","plantilla"].forEach(k=>{
          if(du.ajustes[k]&&du.ajustes[k]!==settings[k]){settings[k]=du.ajustes[k]}
          else if(settings[k]&&!du.ajustes[k])curar=true;
        });
        if(Array.isArray(du.ajustes.misPlantillas)&&du.ajustes.misPlantillas.length&&!(settings.misPlantillas&&settings.misPlantillas.length))settings.misPlantillas=du.ajustes.misPlantillas;
        else if(settings.misPlantillas&&settings.misPlantillas.length&&!(du.ajustes.misPlantillas&&du.ajustes.misPlantillas.length))curar=true;
        LS.set("vs_settings",settings);loadSettings();
      }
    }
    const{data:acts}=await sb.from("actas").select("*").eq("user_id",sesionUser.id).order("fecha",{ascending:false}).limit(50);
    if(acts&&acts.length){
      const loc=LS.get("vs_sessions",[]);
      const ids=new Set(loc.map(s=>s.id));
      acts.forEach(a=>{if(!ids.has(a.id))loc.push({id:a.id,name:a.nombre,date:a.fecha,duration:a.duracion,segments:a.contenido.segments||[],summary:a.contenido.summary||null,speakers:a.contenido.speakers||[]})});
      loc.sort((a,b)=>new Date(b.date)-new Date(a.date));
      LS.set("vs_sessions",loc.slice(0,100));
    }
  }
  licPayload=await verifyLicense(settings.license);
  recalcPro();
  if(typeof curar!=="undefined"&&curar)syncNube();
  console.log("[EscribAI] sesión:",sesionUser?sesionUser.email:"-","| plan nube:",perfil?perfil.plan:"-","| licencia local:",settings.license?"sí":"no","| PRO:",!!pro);
  const b=document.getElementById("btnUser");
  b.textContent=sesionUser?"👤 "+(sesionUser.email.split("@")[0]):"👤 Entrar";
  b.title=sesionUser?sesionUser.email+" — clic para salir":"Entrar o crear cuenta";
}
async function syncNube(){
  if(!sesionUser)return;
  try{
    await sb.from("datos_usuario").upsert({user_id:sesionUser.id,
      ajustes:{license:settings.license,key:settings.key,prov:settings.prov,lang:settings.lang,sens:settings.sens,plantilla:settings.plantilla,misPlantillas:settings.misPlantillas||[]},
      orgs:orgs,actualizado:new Date().toISOString()});
  }catch(e){console.warn("sync",e)}
}
async function subirActa(s){
  if(!sesionUser)return;
  try{
    await sb.from("actas").upsert({id:s.id,user_id:sesionUser.id,nombre:s.name,fecha:s.date,duracion:s.duration,
      contenido:{segments:s.segments,summary:s.summary,speakers:s.speakers}});
  }catch(e){console.warn("acta",e)}
}

/* ---------- envolver acciones de la app para sincronizar ---------- */
(()=>{
  const wrap=(id,extra)=>{const el=document.getElementById(id);if(!el)return;const orig=el.onclick;el.onclick=async ev=>{await orig(ev);extra()}};
  wrap("orgSave",syncNube);
  wrap("orgDel",syncNube);
  const bs=document.getElementById("btnSaveSet"),bsOrig=bs.onclick;
  bs.onclick=async()=>{await bsOrig();licPayload=await verifyLicense(settings.license);recalcPro();syncNube()};
  const bg=document.getElementById("btnSave"),bgOrig=bg.onclick;
  bg.onclick=()=>{bgOrig();const s=LS.get("vs_sessions",[])[0];if(s)subirActa(s)};
})();

/* ---------- arranque ---------- */
(async()=>{
  if(!window.supabase){toast("⚠️ Sin conexión con el servidor de cuentas");return}
  sb=window.supabase.createClient(SB_URL,SB_KEY);
  const rec=LS.get("vs_login_email","");
  if(rec){document.getElementById("authEmail").value=rec;document.getElementById("authRecordar").checked=true}
  sb.auth.onAuthStateChange(async(ev,session)=>{
    if(ev==="PASSWORD_RECOVERY"){
      const np=prompt("Escribe tu nueva contraseña (mín. 6 caracteres):");
      if(np&&np.length>=6){const{error}=await sb.auth.updateUser({password:np});toast(error?"❌ "+error.message:"🔑 Contraseña actualizada")}
    }
    sesionUser=session?session.user:null;
    await cargarPerfil();
    mostrarAuth(!sesionUser);
    if(sesionUser&&!LS.get("vs_tutorial_visto",false)){
      LS.set("vs_tutorial_visto",true);
      if(typeof abrirTutorial==="function")setTimeout(()=>abrirTutorial(0),600);
    }
  });
  const{data:{session}}=await sb.auth.getSession();
  sesionUser=session?session.user:null;
  await cargarPerfil();
  mostrarAuth(!sesionUser);
  if(new URLSearchParams(location.search).get("pago")==="ok"){
    history.replaceState(null,"",location.pathname);
    toast("🎉 ¡Pago recibido! Tu plan se activará en unos segundos…");
    setTimeout(async()=>{await cargarPerfil();toast(planNube()?"⭐ ¡Plan premium activo! Disfrútalo":"El plan se activará en breve; si en unos minutos no aparece, escríbenos.")},6000);
  }
})();
